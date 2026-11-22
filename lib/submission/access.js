// Who may run a live (paid) Submission Check, and how often.
//
// Production is default-deny: only signed-in users whose e-mail is listed in
// SUBMISSION_CHECK_ALLOWED_EMAILS can run live checks (a closed beta). With the
// list empty, nobody can, so free accounts can never trigger paid AI checks.
// The sample proposal replays a recorded result and costs nothing.
// Preview and local development: any signed-in user (preview deployments are
// behind Vercel Authentication), unless an allow-list is set.
//
// Rate limits are kept in memory per server instance: they stop accidental
// repeats and loops, not a determined abuser. A durable per-user monthly quota
// needs a small database table (proposed in docs/proposals/, not applied).

export const DEFAULT_LIMITS = { perHour: 5, perDay: 15, concurrent: 1 };

function list(value) {
  return String(value || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function limitsFromEnv(env = process.env) {
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : d);
  return {
    perHour: n(env.SUBMISSION_CHECK_MAX_PER_HOUR, DEFAULT_LIMITS.perHour),
    perDay: n(env.SUBMISSION_CHECK_MAX_PER_DAY, DEFAULT_LIMITS.perDay),
    concurrent: DEFAULT_LIMITS.concurrent,
  };
}

/**
 * @param {{email?: string} | null} user
 * @returns {{ allowed: boolean, status?: number, reason?: string }}
 */
export function liveCheckAccess(user, env = process.env) {
  if (!user) return { allowed: false, status: 401, reason: "Sign in to run a check." };
  const allow = list(env.SUBMISSION_CHECK_ALLOWED_EMAILS);
  const email = String(user.email || "").toLowerCase();
  if (env.VERCEL_ENV === "production") {
    if (!allow.includes(email)) {
      return { allowed: false, status: 403, reason: "Submission Check is in a closed beta. Ask Bidlyze to add your account, or try the sample tender." };
    }
    return { allowed: true };
  }
  if (allow.length && !allow.includes(email)) {
    return { allowed: false, status: 403, reason: "This account is not on the Submission Check beta list." };
  }
  return { allowed: true };
}

/** In-memory sliding-window limiter (per user, per server instance). */
export function createRateLimiter(limits = DEFAULT_LIMITS, now = () => Date.now()) {
  const runs = new Map(); // userId -> timestamps (ms)
  const active = new Map(); // userId -> running count
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  return {
    /** @returns {{ ok: true, release: Function } | { ok: false, status: number, reason: string, retryAfterSec: number }} */
    acquire(userId) {
      const t = now();
      const list = (runs.get(userId) || []).filter((x) => t - x < DAY);
      runs.set(userId, list);
      if ((active.get(userId) || 0) >= limits.concurrent) {
        return { ok: false, status: 429, reason: "A check is already running for your account. Wait for it to finish.", retryAfterSec: 60 };
      }
      const lastHour = list.filter((x) => t - x < HOUR);
      if (lastHour.length >= limits.perHour) {
        const retry = Math.ceil((HOUR - (t - lastHour[0])) / 1000);
        return { ok: false, status: 429, reason: `You have run ${limits.perHour} checks in the last hour, the beta limit. Try again in ${Math.ceil(retry / 60)} minutes.`, retryAfterSec: retry };
      }
      if (list.length >= limits.perDay) {
        const retry = Math.ceil((DAY - (t - list[0])) / 1000);
        return { ok: false, status: 429, reason: `You have reached the beta limit of ${limits.perDay} checks per day. Try again tomorrow.`, retryAfterSec: retry };
      }
      list.push(t);
      active.set(userId, (active.get(userId) || 0) + 1);
      let released = false;
      return {
        ok: true,
        release() {
          if (released) return;
          released = true;
          active.set(userId, Math.max(0, (active.get(userId) || 1) - 1));
        },
      };
    },
  };
}
