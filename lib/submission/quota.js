// Who may start a paid Submission Check run, and the durable usage limits.
//
// Every paid AI run (reading a tender's requirements, or checking a proposal)
// is "claimed" before the AI is called and "finished" afterwards, through two
// database functions (docs/proposals/2026-11-22_submission_check_beta_quota.sql):
//  - beta list: in production only invited e-mails (table submission_check_beta_users,
//    or the SUBMISSION_CHECK_ALLOWED_EMAILS variable) may run checks
//  - one run at a time per account; a per-hour rate; monthly allowances for
//    checks and tenders; a monthly AI-cost cap per account; a daily cost cap
//    across all accounts
//  - the same request id twice is never a second paid run (double clicks, retries)
//
// Production FAILS CLOSED: if the limits cannot be checked in the database (for
// example the migration is not applied yet), no paid run starts.
// Preview and local development fall back to the in-memory limits in access.js
// when the database functions are missing, and say so in the logs and the API answer.

import { liveCheckAccess, createRateLimiter, limitsFromEnv } from "./access.js";

// Conservative defaults for the first, five-person beta (change per tester in
// submission_check_beta_users, or for everyone with the SUBMISSION_CHECK_* variables).
export const DEFAULT_QUOTA = {
  checks_per_month: 10,
  tenders_per_month: 5,
  per_hour: 4,
  cost_cap_usd_per_month: 5,
  global_cost_usd_per_day: 8,
  stale_minutes: 10,
};

// Upper-bound AI cost of a run, booked when it starts so that runs still in flight
// count against the cost caps. Deliberately pessimistic: list prices with no prompt
// caching, every pass using its full output allowance (live runs cost 5-15x less).
const PRICE = { inPerMTok: 3, outPerMTok: 15 };
const CHARS_PER_TOKEN = 3.5;
const PROMPT_OVERHEAD_TOKENS = 3000; // instructions, requirement list, JSON shape
const TENDER_PASSES = [{ outTokens: 6000 }, { outTokens: 32000 }]; // overview + requirements (lib/readiness/engine.js)
const CHECK_BATCH_OUT_TOKENS = 16000; // lib/submission/check.js
const CHECK_BATCH_SIZE = 40;
const MAX_REQUIREMENTS = 150;
const SAFETY = 1.2;

/**
 * @param {{ kind: "tender"|"check", chars: number, requirements?: number }} run
 * @returns {number} US dollars, rounded up to the cent, between $0.05 and $20
 */
export function estimateRunCostUsd({ kind, chars, requirements = MAX_REQUIREMENTS }, price = PRICE) {
  const inTokens = Math.max(0, Number(chars) || 0) / CHARS_PER_TOKEN + PROMPT_OVERHEAD_TOKENS;
  const calls = kind === "tender"
    ? TENDER_PASSES
    : Array.from({ length: Math.max(1, Math.ceil(Math.min(requirements, MAX_REQUIREMENTS) / CHECK_BATCH_SIZE)) }, () => ({ outTokens: CHECK_BATCH_OUT_TOKENS }));
  const usd = calls.reduce((sum, c) => sum + (inTokens * price.inPerMTok + c.outTokens * price.outPerMTok) / 1e6, 0) * SAFETY;
  return Math.min(20, Math.max(0.05, Math.ceil(usd * 100) / 100));
}

export function quotaLimitsFromEnv(env = process.env) {
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    checks_per_month: Math.floor(n(env.SUBMISSION_CHECK_CHECKS_PER_MONTH, DEFAULT_QUOTA.checks_per_month)),
    tenders_per_month: Math.floor(n(env.SUBMISSION_CHECK_TENDERS_PER_MONTH, DEFAULT_QUOTA.tenders_per_month)),
    per_hour: Math.floor(n(env.SUBMISSION_CHECK_MAX_PER_HOUR, DEFAULT_QUOTA.per_hour)),
    cost_cap_usd_per_month: n(env.SUBMISSION_CHECK_COST_CAP_USD_PER_MONTH, DEFAULT_QUOTA.cost_cap_usd_per_month),
    global_cost_usd_per_day: n(env.SUBMISSION_CHECK_GLOBAL_COST_CAP_USD_PER_DAY, DEFAULT_QUOTA.global_cost_usd_per_day),
    stale_minutes: DEFAULT_QUOTA.stale_minutes,
  };
}

const isProduction = (env) => env.VERCEL_ENV === "production";

function allowList(env) {
  return String(env.SUBMISSION_CHECK_ALLOWED_EMAILS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Missing database function/table (migration not applied). */
export function isMissingSchema(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return code === "PGRST202" || code === "42883" || code === "42P01" || /could not find the function|does not exist/i.test(msg);
}

const KIND_LABEL = { tender: "tender readings", check: "checks" };

/** Plain-English message for a refused claim. */
export function refusalMessage(r, kind) {
  switch (r?.code) {
    case "not_in_beta":
      return { status: 403, reason: "Submission Check is in a closed beta. Your account is not on the invited list yet; ask Bidlyze to add it. You can still try the sample tender." };
    case "busy":
      return { status: 429, reason: "A check is already running for your account. Wait for it to finish (up to 5 minutes), then try again.", retryAfterSec: r.retry_after || 60 };
    case "rate":
      return { status: 429, reason: `You have started ${r.limit} runs in the last hour, the beta limit. Try again in ${Math.max(1, Math.ceil((r.retry_after || 3600) / 60))} minutes.`, retryAfterSec: r.retry_after || 3600 };
    case "monthly_checks":
    case "monthly_tenders":
      return { status: 429, reason: `You have used this month's beta allowance of ${r.limit} ${KIND_LABEL[kind] || "runs"}. It resets on the 1st; ask Bidlyze if you need more.`, retryAfterSec: 86_400 };
    case "monthly_cost":
      return { status: 429, reason: "You have reached this month's beta usage limit. It resets on the 1st; ask Bidlyze if you need more.", retryAfterSec: 86_400 };
    case "global_cost":
      return { status: 503, reason: "Checks are paused for today because the beta's daily usage limit was reached. Please try again tomorrow.", retryAfterSec: 3600 };
    default:
      return { status: 503, reason: "Checks are temporarily unavailable. Please try again later." };
  }
}

/**
 * @param {object} deps
 * @param {object|null} deps.admin   Supabase service-role client (null if not configured)
 * @param {object} [deps.env]
 * @param {Function} [deps.now]
 */
export function createQuota({ admin, env = process.env, now = () => Date.now(), log = console } = {}) {
  const limitsNow = () => quotaLimitsFromEnv(env);
  const limits = limitsNow();
  const memory = createRateLimiter({ ...limitsFromEnv(env), perHour: limits.per_hour }, now);
  const memoryRuns = new Map(); // runId -> release()
  const memoryRequests = new Map(); // `${userId}:${requestId}` -> runId
  let warned = false;

  function memoryClaim(user, requestId) {
    const access = liveCheckAccess(user, env);
    if (!access.allowed) return { ok: false, status: access.status, code: "not_allowed", reason: access.reason };
    const key = `${user.id}:${requestId}`;
    if (memoryRequests.has(key)) {
      return { ok: false, status: 409, code: "duplicate", reason: "This request was already received. Wait for it to finish, or start a new check." };
    }
    const slot = memory.acquire(user.id);
    if (!slot.ok) return { ok: false, status: slot.status, code: "rate", reason: slot.reason, retryAfterSec: slot.retryAfterSec };
    const runId = `mem-${user.id.slice(0, 8)}-${now()}-${Math.random().toString(36).slice(2, 8)}`;
    memoryRuns.set(runId, slot.release);
    memoryRequests.set(key, runId);
    return { ok: true, runId, store: "memory" };
  }

  return {
    limits,

    /**
     * @returns {Promise<{ok: true, runId: string, store: "db"|"memory"} |
     *   {ok: false, status: number, code: string, reason: string, retryAfterSec?: number, existing?: object}>}
     */
    async claim({ user, requestId, kind, reserveUsd }) {
      const forceDb = String(env.SUBMISSION_CHECK_QUOTA || "").toLowerCase() === "db";
      if (!user) return { ok: false, status: 401, code: "signed_out", reason: "Sign in to run a check." };
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(String(requestId || ""))) {
        return { ok: false, status: 400, code: "bad_request_id", reason: "Invalid request. Refresh the page and try again." };
      }
      const email = String(user.email || "").toLowerCase();
      const listed = allowList(env).includes(email);
      // Preview with an allow-list set: the list still applies (as before).
      if (!isProduction(env) && allowList(env).length && !listed) {
        return { ok: false, status: 403, code: "not_in_beta", reason: "This account is not on the Submission Check beta list." };
      }

      if (!admin) {
        if (isProduction(env) || forceDb) {
          log.error("[quota] no service-role client: refusing paid run (fail closed)");
          return { ok: false, status: 503, code: "quota_unavailable", reason: "Checks are temporarily unavailable (usage limits could not be verified). Please try again later." };
        }
        return memoryClaim(user, requestId);
      }

      const { data, error } = await admin.rpc("submission_check_claim", {
        p_user_id: user.id,
        p_email: email,
        p_request_id: requestId,
        p_kind: kind,
        p_require_beta: isProduction(env) && !listed,
        p_limits: limitsNow(),
        p_reserve_usd: Number.isFinite(Number(reserveUsd)) ? Number(reserveUsd) : 1,
      });
      if (error) {
        if (!isProduction(env) && !forceDb && isMissingSchema(error)) {
          if (!warned) log.warn("[quota] database functions not installed (migration not applied): preview uses in-memory limits");
          warned = true;
          return memoryClaim(user, requestId);
        }
        log.error("[quota] claim failed, refusing paid run (fail closed):", error.code || "", error.message || error);
        return { ok: false, status: 503, code: "quota_unavailable", reason: "Checks are temporarily unavailable (usage limits could not be verified). Please try again later." };
      }
      if (data?.allowed) return { ok: true, runId: data.run_id, store: "db", used: data.used, limits: data.limits };
      if (data?.code === "duplicate") {
        return {
          ok: false,
          status: 409,
          code: "duplicate",
          existing: { runId: data.run_id, status: data.status, kind: data.kind, analysisId: data.analysis_id || null },
          reason: data.status === "running" ? "This request is already being processed. Wait for it to finish." : "This request was already processed. Start a new check to run it again.",
        };
      }
      const m = refusalMessage(data, kind);
      return { ok: false, code: data?.code || "refused", ...m };
    },

    /** Never throws: a failed write is logged (the run then expires as stale after 10 minutes). */
    async finish(claim, { userId, status, costUsd = null, errorCode = null, analysisId = null, pages = null, requirements = null }) {
      if (!claim?.ok) return;
      if (claim.store === "memory") {
        const release = memoryRuns.get(claim.runId);
        if (release) release();
        memoryRuns.delete(claim.runId);
        return;
      }
      try {
        const { error } = await admin.rpc("submission_check_finish", {
          p_run_id: claim.runId,
          p_user_id: userId,
          p_status: status,
          p_cost_usd: Number.isFinite(Number(costUsd)) ? Number(costUsd) : 0,
          p_error_code: errorCode,
          p_analysis_id: analysisId,
          p_pages: Number.isFinite(pages) ? pages : null,
          p_requirements: Number.isFinite(requirements) ? requirements : null,
        });
        if (error) log.error("[quota] finish failed:", error.code || "", error.message || error);
      } catch (e) {
        log.error("[quota] finish threw:", e?.message || e);
      }
    },

    /** For the Account page. */
    async usage(user) {
      if (!user) return null;
      const base = { limits: limitsNow(), tracked: false, inBeta: null };
      if (!admin) return base;
      const { data, error } = await admin.rpc("submission_check_usage", { p_user_id: user.id, p_email: String(user.email || "").toLowerCase(), p_limits: limitsNow() });
      if (error) return { ...base, error: isMissingSchema(error) ? "not_installed" : "unavailable" };
      const listed = allowList(env).includes(String(user.email || "").toLowerCase());
      return {
        tracked: true,
        inBeta: isProduction(env) ? Boolean(data?.in_beta || listed) : true,
        betaExpiresAt: data?.beta_expires_at || null,
        used: data?.used,
        limits: data?.limits,
        periodStart: data?.period_start,
      };
    },
  };
}
