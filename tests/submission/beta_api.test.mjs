// Controlled-beta behaviour: reading an uploaded tender, durable usage limits,
// fail-closed production, document limits, and AI timeouts/retries.
// Network is fully faked: Supabase (auth, analyses, usage functions) and OpenRouter.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { normaliseDocuments, DOC_LIMITS, DocumentInputError } from "../../lib/submission/documents.js";
import { createQuota, refusalMessage, isMissingSchema, estimateRunCostUsd, DEFAULT_QUOTA } from "../../lib/submission/quota.js";
import { askJSON } from "../../lib/readiness/ai.js";
import { OVERVIEW_TASK, REQUIREMENTS_TASK } from "../../lib/readiness/passes.js";

const TENDER_PAGES = [
  { unit: "page", n: 1, text: "Invitation to Tender: Riverside Library CCTV Upgrade. Reference RL-2026-04. Tenders must be received by 12:00 on 15 January 2027. The Council invites tenders for the supply, installation and maintenance of a CCTV system at Riverside Library." },
  { unit: "page", n: 2, text: "Requirements. The contractor shall retain recordings for at least 31 days. All cameras must have a minimum resolution of 4 megapixels. The bidder must hold public liability insurance of not less than £5 million. A completed pricing schedule must be returned with the tender." },
];
const PROPOSAL_PAGES = [{ unit: "page", n: 1, text: "Our proposal. We will retain recordings for 31 days on the recorder. We will install 4 megapixel cameras throughout the library. We hold public liability insurance of £5 million with a UK insurer. Our pricing schedule is attached as Document 2." }];

const USERS = {
  "tok-a": { id: "00000000-0000-4000-8000-0000000000a1", email: "a@example.com", aud: "authenticated" },
  "tok-b": { id: "00000000-0000-4000-8000-0000000000b2", email: "b@example.com", aud: "authenticated" },
};

let rpcMode = "db"; // "db" | "missing" | "error"
let aiCalls = [];
let aiFail = null; // null | "requirements" | "all"
const saved = new Map(); // analysis id -> row
const runs = [];
let inserts = 0;

const reserves = [];
const providerSeen = [];
function rpcClaim(a) {
  reserves.push({ kind: a.p_kind, usd: a.p_reserve_usd });
  const ex = runs.find((r) => r.user === a.p_user_id && r.req === a.p_request_id);
  if (ex) return { allowed: false, code: "duplicate", run_id: ex.id, status: ex.status, kind: ex.kind, analysis_id: ex.analysis || null };
  const mine = runs.filter((r) => r.user === a.p_user_id);
  if (mine.some((r) => r.status === "running")) return { allowed: false, code: "busy", retry_after: 60 };
  if (a.p_kind === "tender" && mine.filter((r) => r.kind === "tender" && r.status !== "failed").length >= a.p_limits.tenders_per_month) return { allowed: false, code: "monthly_tenders", limit: a.p_limits.tenders_per_month };
  const id = `run-${runs.length + 1}`;
  runs.push({ id, user: a.p_user_id, req: a.p_request_id, kind: a.p_kind, status: "running" });
  return { allowed: true, run_id: id, used: { checks: 0, tenders: 1 }, limits: a.p_limits };
}

const realFetch = globalThis.fetch;
before(() => {
  Object.assign(process.env, {
    OPENROUTER_API_KEY: "test-key",
    NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUBMISSION_CHECK_TENDERS_PER_MONTH: "3",
  });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const headers = new Headers(init.headers);
    if (u.startsWith("http://supabase.test/auth/v1/user")) {
      const user = USERS[(headers.get("authorization") || "").replace("Bearer ", "")];
      return user ? Response.json(user) : Response.json({ msg: "invalid JWT" }, { status: 401 });
    }
    if (u.startsWith("http://supabase.test/rest/v1/rpc/")) {
      if (rpcMode === "missing") return Response.json({ code: "PGRST202", message: "Could not find the function public.submission_check_claim" }, { status: 404 });
      if (rpcMode === "error") return Response.json({ code: "57014", message: "canceling statement due to statement timeout" }, { status: 500 });
      const a = JSON.parse(init.body);
      if (u.endsWith("/submission_check_claim")) return Response.json(rpcClaim(a));
      if (u.endsWith("/submission_check_finish")) {
        const r = runs.find((x) => x.id === a.p_run_id && x.user === a.p_user_id && x.status === "running");
        if (r) Object.assign(r, { status: a.p_status, cost: a.p_cost_usd, error: a.p_error_code, analysis: a.p_analysis_id, pages: a.p_pages, requirements: a.p_requirements });
        return Response.json(Boolean(r));
      }
      if (u.endsWith("/submission_check_usage")) return Response.json({ in_beta: true, used: { checks: 1, tenders: 1, cost_usd: 0.3 }, limits: a.p_limits, period_start: "2026-11-01T00:00:00Z" });
    }
    if (u.startsWith("http://supabase.test/rest/v1/analyses")) {
      const user = USERS[(headers.get("authorization") || "").replace("Bearer ", "")];
      if ((init.method || "GET") === "POST") {
        const row = JSON.parse(init.body);
        // RLS "analyses_insert_own": a user can only insert rows for themselves.
        if (!user || row.user_id !== user.id) return Response.json({ code: "42501", message: "new row violates row-level security policy" }, { status: 403 });
        const id = `aaaaaaaa-0000-4000-8000-${String(++inserts).padStart(12, "0")}`;
        saved.set(id, { ...row, id });
        return Response.json({ id }, { status: 201 });
      }
      const id = (u.match(/id=eq\.([0-9a-f-]{36})/) || [])[1];
      const row = saved.get(id);
      return row && user && row.user_id === user.id ? Response.json(row) : Response.json({ code: "PGRST116", message: "no rows" }, { status: 406 });
    }
    if (!u.includes("openrouter")) throw new Error(`unexpected network call: ${u}`);
    const body = JSON.parse(init.body);
    providerSeen.push(body.provider);
    const task = body.messages[1].content.at(-1).text;
    const kind = task === OVERVIEW_TASK ? "overview" : task === REQUIREMENTS_TASK ? "requirements" : "other";
    aiCalls.push(kind);
    if (aiFail === "all" || aiFail === kind) return new Response("upstream error", { status: 503 });
    const answer = kind === "overview"
      ? { summary: { projectName: "Riverside Library CCTV Upgrade", tenderReference: "RL-2026-04", issuingAuthority: "The Council", submissionDeadline: "12:00, 15 January 2027", citation: { quote: "Tenders must be received by 12:00 on 15 January 2027", file: "F1", page: 1 } }, keyDates: [] }
      : {
          requirements: [
            { category: "Technical", requirement: "Retain recordings for at least 31 days", mandatory: true, priority: "HIGH", citation: { quote: "The contractor shall retain recordings for at least 31 days", file: "F1", page: 2 } },
            { category: "Technical", requirement: "Cameras of at least 4 megapixels", mandatory: true, priority: "HIGH", citation: { quote: "All cameras must have a minimum resolution of 4 megapixels", file: "F1", page: 2 } },
            { category: "Commercial", requirement: "Public liability insurance of at least £5 million", mandatory: true, priority: "HIGH", citation: { quote: "public liability insurance of not less than £5 million", file: "F1", page: 2 } },
          ],
        };
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 2000, completion_tokens: 500, cost: 0.04 } });
  };
});
after(() => { globalThis.fetch = realFetch; });
beforeEach(() => { rpcMode = "db"; aiFail = null; aiCalls = []; });

let seq = 0;
async function post(path, body, { env = { VERCEL_ENV: "preview" }, token = "tok-a" } = {}) {
  const savedEnv = { ...process.env };
  Object.assign(process.env, env);
  try {
    const mod = await import(`../../app/api/submission-check${path}/route.js`);
    const req = new Request(`http://localhost/api/submission-check${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify({ requestId: `beta-test-${++seq}`, ...body }),
    });
    const res = await mod.POST(req);
    return { status: res.status, json: await res.json() };
  } finally {
    for (const k of Object.keys(env)) if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
  }
}
const tenderBody = (extra = {}) => ({ tender: { files: [{ filename: "ITT_Riverside.pdf", contentType: "application/pdf", pages: TENDER_PAGES, scannedPages: [] }] }, ...extra });

// ── Reading an uploaded tender ─────────────────────────────────────────────
test("tender: requirements are read with only the two passes the check needs, saved to the user's account, and the run recorded", async () => {
  const r = await post("/tender", tenderBody());
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual([...aiCalls].sort(), ["overview", "requirements"], "no disqualification, clarification or decision passes");
  assert.equal(r.json.tender.name, "Riverside Library CCTV Upgrade");
  assert.equal(r.json.tender.requirementsTotal, 3);
  assert.equal(r.json.tender.cited, 3);
  const row = saved.get(r.json.analysisId);
  assert.equal(row.user_id, USERS["tok-a"].id);
  assert.equal(row.file_path, null, "the tender file is not stored");
  assert.equal(row.analysis_data.meta.source, "submission-check");
  assert.deepEqual(row.analysis_data.meta.passesSkipped, ["disqualification", "clarifications", "decision"]);
  assert.ok(row.analysis_data.requirements.every((q) => q.citation.status === "verified"), "tender quotes verified in code");
  assert.ok(!JSON.stringify(row).includes("Invitation to Tender: Riverside"), "the full tender text is not saved, only short quotes");
  const run = runs.find((x) => x.analysis === r.json.analysisId);
  assert.equal(run.status, "succeeded");
  assert.ok(run.cost > 0);
  assert.equal(run.requirements, 3);
});

test("tender: the same request sent again (lost connection) returns the saved tender, with no second AI run", async () => {
  const body = { requestId: "tender-replay-0001", ...tenderBody() };
  const first = await post("/tender", body);
  assert.equal(first.status, 200);
  aiCalls = [];
  const again = await post("/tender", body);
  assert.equal(again.status, 200);
  assert.equal(again.json.replayed, true);
  assert.equal(again.json.analysisId, first.json.analysisId);
  assert.equal(aiCalls.length, 0);
});

test("tender: unreadable or oversized documents are refused before anything is counted or any AI call", async () => {
  const before = runs.length;
  const scanned = await post("/tender", { tender: { files: [{ filename: "scan.pdf", pages: [{ n: 1, text: "  " }, { n: 2, text: "" }], scannedPages: [1, 2] }] } });
  assert.equal(scanned.status, 422);
  assert.match(scanned.json.error, /scanned document.*OCR/);
  const huge = await post("/tender", { tender: { files: [{ filename: "huge.pdf", pages: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, text: "x ".repeat(30_000) })) }] } });
  assert.equal(huge.status, 413);
  assert.match(huge.json.error, /too long.*about \d+ pages/);
  const tooMany = await post("/tender", { tender: { files: Array.from({ length: 6 }, (_, i) => ({ filename: `f${i}.pdf`, pages: TENDER_PAGES })) } });
  assert.equal(tooMany.status, 413);
  const notJson = await post("/tender", "{not json");
  assert.equal(notJson.status, 400);
  assert.equal(runs.length, before, "nothing counted");
  assert.equal(aiCalls.length, 0);
});

test("tender: an AI failure saves nothing and records a failed run with its cost; the requirement list is never saved half-done", async () => {
  aiFail = "requirements";
  const insertsBefore = inserts;
  const r = await post("/tender", tenderBody(), { token: "tok-b" });
  assert.equal(r.status, 502);
  assert.match(r.json.error, /requirements could not be read/);
  assert.equal(inserts, insertsBefore, "nothing saved");
  const run = runs.filter((x) => x.user === USERS["tok-b"].id).at(-1);
  assert.equal(run.status, "failed");
  assert.equal(run.error, "requirements_failed");
  aiFail = "all";
  const r2 = await post("/tender", tenderBody(), { token: "tok-b" });
  assert.equal(r2.status, 502);
  assert.match(r2.json.error, /try again/i);
});

test("tender: signed-out requests are refused", async () => {
  const r = await post("/tender", tenderBody(), { token: null });
  assert.equal(r.status, 401);
});

test("tender: the monthly tender allowance is enforced (3 in this test)", async () => {
  const user = { id: "00000000-0000-4000-8000-0000000000c3", email: "c@example.com", aud: "authenticated" };
  USERS["tok-c"] = user;
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await post("/tender", tenderBody(), { token: "tok-c" })).status);
  assert.deepEqual(statuses, [200, 200, 200, 429]);
});

// ── Fail closed ────────────────────────────────────────────────────────────
test("production fails closed: if the usage limits cannot be checked, no paid AI run starts", async () => {
  const env = { VERCEL_ENV: "production", SUBMISSION_CHECK_BETA: "on", SUBMISSION_CHECK_ALLOWED_EMAILS: "a@example.com" };
  for (const mode of ["missing", "error"]) {
    rpcMode = mode;
    const r = await post("/tender", tenderBody(), { env });
    assert.equal(r.status, 503, mode);
    assert.match(r.json.error, /usage limits could not be verified/);
  }
  assert.equal(aiCalls.length, 0);
});

test("preview without the migration falls back to in-memory limits (and says so in the logs only)", async () => {
  rpcMode = "missing";
  const r = await post("/tender", tenderBody(), { token: "tok-b" });
  assert.equal(r.status, 200);
  assert.equal(r.json.usage, null, "no durable usage reported");
});

test("the full new-check flow: read the tender, then check a two-file proposal against it", async () => {
  const t = await post("/tender", tenderBody(), { token: "tok-b" });
  assert.equal(t.status, 200);
  // The check pass answers from the proposal (fake reviewer).
  const realStub = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("openrouter")) return realStub(url, init);
    const body = JSON.parse(init.body);
    const asked = JSON.parse(body.messages[1].content.at(-1).text.split("\n")[1]);
    const quotes = {
      "Retain recordings for at least 31 days": ["We will retain recordings for 31 days on the recorder", "R1", 1],
      "Cameras of at least 4 megapixels": ["We will install 4 megapixel cameras throughout the library", "R1", 1],
      "Public liability insurance of at least £5 million": ["We hold public liability insurance of £5 million with a UK insurer", "R1", 1],
    };
    const results = asked.map((q) => (quotes[q.requirement] ? { id: q.id, status: "answered", evidence: [{ quote: quotes[q.requirement][0], file: quotes[q.requirement][1], page: quotes[q.requirement][2] }], gap: "" } : { id: q.id, status: "missing", evidence: [], gap: "not found" }));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ results }) } }], usage: { prompt_tokens: 1000, completion_tokens: 300, cost: 0.02 } });
  };
  try {
    const c = await post("", {
      analysisId: t.json.analysisId,
      response: { files: [
        { filename: "Technical.pdf", pages: PROPOSAL_PAGES },
        { filename: "Price_Schedule.pdf", pages: [{ unit: "page", n: 1, text: "Pricing schedule. Supply and installation of cameras: £42,000. Maintenance per year: £3,600. All prices exclude VAT." }] },
      ] },
    }, { token: "tok-b" });
    assert.equal(c.status, 200, JSON.stringify(c.json).slice(0, 300));
    assert.equal(c.json.items.length, 3);
    assert.equal(c.json.summary.answered, 3);
    assert.deepEqual(c.json.response.files.map((f) => [f.key, f.filename, f.pages]), [["R1", "Technical.pdf", 1], ["R2", "Price_Schedule.pdf", 1]]);
    assert.equal(c.json.response.pages, 2);
    assert.ok(c.json.items.every((i) => i.tender?.status === "verified"), "tender quotes carried over, verified");
  } finally {
    globalThis.fetch = realStub;
  }
});

// ── Usage endpoint ─────────────────────────────────────────────────────────
test("usage: the Account page gets this month's use and limits", async () => {
  const { GET } = await import("../../app/api/submission-check/usage/route.js");
  const res = await GET(new Request("http://localhost/api/submission-check/usage", { headers: { authorization: "Bearer tok-a" } }));
  const j = await res.json();
  assert.equal(res.status, 200);
  assert.equal(j.tracked, true);
  assert.equal(j.used.checks, 1);
  assert.equal(j.limits.tenders_per_month, 3);
  rpcMode = "missing";
  const j2 = await (await GET(new Request("http://localhost/api/submission-check/usage", { headers: { authorization: "Bearer tok-a" } }))).json();
  assert.equal(j2.tracked, false);
  assert.equal(j2.error, "not_installed");
});

// ── Pure units ─────────────────────────────────────────────────────────────
test("documents: several files get their own keys; limits and scanned pages are reported", () => {
  const { files, totalChars, scannedPages } = normaliseDocuments({ files: [
    { filename: "a.pdf", pages: PROPOSAL_PAGES, scannedPages: [3] },
    { filename: "b.docx", pages: [{ unit: "section", n: 1, text: "Second document with enough readable text to pass the minimum. ".repeat(5) }] },
  ] }, { kind: "proposal" });
  assert.deepEqual(files.map((f) => [f.key, f.role, f.unit]), [["R1", "primary", "page"], ["R2", "annex", "section"]]);
  assert.equal(scannedPages, 1);
  assert.ok(totalChars > 0);
  const t = normaliseDocuments({ files: [{ filename: "t.pdf", pages: TENDER_PAGES }] }, { kind: "tender" });
  assert.equal(t.files[0].key, "F1");
  assert.throws(() => normaliseDocuments({ files: [] }, { kind: "proposal" }), DocumentInputError);
  assert.throws(() => normaliseDocuments({ files: [{ filename: "x", pages: Array.from({ length: DOC_LIMITS.maxPagesPerFile + 1 }, () => ({ text: "x" })) }] }, { kind: "proposal" }), (e) => e.status === 413);
  // legacy single-file shape still accepted
  assert.equal(normaliseDocuments({ filename: "legacy.pdf", pages: PROPOSAL_PAGES }, { kind: "proposal" }).files[0].filename, "legacy.pdf");
});

test("quota: refusals are explained in plain words; missing functions are recognised", () => {
  assert.match(refusalMessage({ code: "not_in_beta" }, "check").reason, /closed beta/);
  assert.equal(refusalMessage({ code: "busy", retry_after: 60 }, "check").status, 429);
  assert.match(refusalMessage({ code: "monthly_checks", limit: 30 }, "check").reason, /allowance of 30 checks/);
  assert.match(refusalMessage({ code: "monthly_tenders", limit: 15 }, "tender").reason, /15 tender readings/);
  assert.equal(refusalMessage({ code: "global_cost" }, "check").status, 503);
  assert.ok(isMissingSchema({ code: "PGRST202" }));
  assert.ok(!isMissingSchema({ code: "57014", message: "timeout" }));
});

test("quota: production with no service-role key refuses paid runs; bad request ids are refused", async () => {
  const q = createQuota({ admin: null, env: { VERCEL_ENV: "production", SUBMISSION_CHECK_ALLOWED_EMAILS: "a@example.com" }, log: { error() {}, warn() {} } });
  const r = await q.claim({ user: USERS["tok-a"], requestId: "abcdefgh-1234", kind: "check" });
  assert.equal(r.status, 503);
  const q2 = createQuota({ admin: null, env: { VERCEL_ENV: "preview" } });
  assert.equal((await q2.claim({ user: USERS["tok-a"], requestId: "short", kind: "check" })).status, 400);
  const ok = await q2.claim({ user: USERS["tok-a"], requestId: "abcdefgh-1234", kind: "check" });
  assert.equal(ok.ok, true);
  assert.equal(ok.store, "memory");
  assert.equal((await q2.claim({ user: USERS["tok-a"], requestId: "abcdefgh-1234", kind: "check" })).status, 409, "duplicate in memory too");
  await q2.finish(ok, { userId: USERS["tok-a"].id, status: "succeeded" });
});

// ── AI calls: timeouts and retries ─────────────────────────────────────────
test("AI: errors a retry cannot fix (no credit, bad key) are not retried, so they are not paid twice", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response("payment required", { status: 402 }); };
  await assert.rejects(() => askJSON({ system: "s", task: "t", fetchImpl, label: "t" }), /402/);
  assert.equal(calls, 1);
});

test("AI: a hung call is stopped at its time limit instead of running past the server's 5 minutes", async () => {
  const fetchImpl = (url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const t0 = Date.now();
  await assert.rejects(() => askJSON({ system: "s", task: "t", fetchImpl, timeoutMs: 80, label: "t" }), (e) => e.timeout === true);
  assert.ok(Date.now() - t0 < 2000);
});

test("AI: a temporary 503 is retried once", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response("busy", { status: 503 });
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: "{\"ok\":true}" } }], usage: { cost: 0.01 } });
  };
  const r = await askJSON({ system: "s", task: "t", fetchImpl, label: "t" });
  assert.equal(r.json.ok, true);
  assert.equal(calls, 2);
});

// ── Cost reservations (in-flight runs count against the cost caps) ─────────
test("every paid run books an upper-bound cost before the AI is called", async () => {
  reserves.length = 0;
  const t = await post("/tender", tenderBody(), { token: "tok-b" });
  assert.equal(t.status, 200);
  const r = reserves.find((x) => x.kind === "tender");
  assert.ok(r && r.usd >= 0.5 && r.usd <= 20, `tender reservation ${r?.usd}`);
});

test("cost estimate: pessimistic, grows with size, bounded", () => {
  const small = estimateRunCostUsd({ kind: "tender", chars: 20_000 });
  const big = estimateRunCostUsd({ kind: "tender", chars: 600_000 });
  const check = estimateRunCostUsd({ kind: "check", chars: 30_000 });
  assert.ok(small >= 0.15 * 3, "at least 3x the live cost of a 7-page tender ($0.15)");
  assert.ok(check >= 0.09 * 3, "at least 3x the live cost of a 10-page check ($0.09)");
  assert.ok(big > small);
  assert.ok(estimateRunCostUsd({ kind: "check", chars: 30_000, requirements: 20 }) < check, "fewer requirements, fewer AI calls");
  assert.ok(estimateRunCostUsd({ kind: "check", chars: 1e9 }) <= 20);
  assert.ok(estimateRunCostUsd({ kind: "tender", chars: -5 }) >= 0.05);
});

test("conservative defaults for the five-person beta", () => {
  assert.deepEqual(
    { c: DEFAULT_QUOTA.checks_per_month, t: DEFAULT_QUOTA.tenders_per_month, h: DEFAULT_QUOTA.per_hour, m: DEFAULT_QUOTA.cost_cap_usd_per_month, g: DEFAULT_QUOTA.global_cost_usd_per_day },
    { c: 10, t: 5, h: 4, m: 5, g: 8 }
  );
});

test("privacy: every AI request asks OpenRouter for providers that do not collect data", () => {
  assert.ok(providerSeen.length >= 4, "AI calls were made in these tests");
  assert.ok(providerSeen.every((p) => p?.data_collection === "deny"), JSON.stringify(providerSeen.slice(0, 2)));
});
