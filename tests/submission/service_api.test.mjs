// Submission Check beta: server side (input validation, the check, the API route).
// AI is faked; no network, no database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { normaliseResponse, checkProposalAgainstAnalysis, CheckInputError, LIMITS } from "../../lib/submission/service.js";
import { extractPages } from "../../lib/readiness/pages.js";
import { sha256Hex } from "../../lib/submission/extractClient.js";

const FX = new URL("../fixtures/submission/", import.meta.url);
const ecta = JSON.parse(readFileSync(new URL("ecta-analysis.json", FX)));
const legacy = JSON.parse(readFileSync(new URL("legacy-analysis.json", FX)));
const quotes = JSON.parse(readFileSync(new URL("ecta_quotes.json", FX))).quotes;
const truth = JSON.parse(readFileSync(new URL("../e2e/submission_truth.json", import.meta.url)));
const pdf = readFileSync(new URL("../e2e/ECTA_test_response.pdf", import.meta.url));
let pages;
before(async () => {
  pages = (await extractPages({ buffer: pdf, contentType: "application/pdf" })).pages;
});

const analysisOf = (row) => ({ id: row.id, name: row.analysis_data.summary.projectName, fileName: row.file_name, analysisData: row.analysis_data });

// Fake OpenRouter: the "good reviewer", answering whatever ids it is asked about.
const realFetch = globalThis.fetch;
let aiCalls = 0;
const dbReads = [];
// Test users: the ECTA analysis belongs to "owner".
const USERS = {
  "tok-owner": { id: "00000000-0000-4000-8000-000000000001", email: "owner@example.com", aud: "authenticated" },
  "tok-other": { id: "00000000-0000-4000-8000-000000000002", email: "other@example.com", aud: "authenticated" },
  "tok-busy": { id: "00000000-0000-4000-8000-000000000003", email: "busy@example.com", aud: "authenticated" },
};
before(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    // Fake Supabase: auth (token -> user) and the analyses table (owner-filtered).
    if (u.startsWith("http://supabase.test/auth/v1/user")) {
      const auth = new Headers(init?.headers).get("authorization") || "";
      const user = USERS[auth.replace("Bearer ", "")];
      return user ? Response.json(user) : Response.json({ msg: "invalid JWT" }, { status: 401 });
    }
    if (u.startsWith("http://supabase.test/rest/v1/analyses")) {
      dbReads.push(u);
      return u.includes(`user_id=eq.${ecta.user_id}`) && u.includes(`id=eq.${ecta.id}`) ? Response.json(ecta) : Response.json({ code: "PGRST116", message: "no rows" }, { status: 406 });
    }
    if (!u.includes("openrouter")) throw new Error(`unexpected network call: ${url}`);
    aiCalls += 1;
    const body = JSON.parse(init.body);
    const ids = JSON.parse(body.messages[1].content.at(-1).text.split("\n")[1]).map((r) => r.id);
    const byReq = new Map(truth.requirements.map((t) => [t.requirement, t]));
    const asked = JSON.parse(body.messages[1].content.at(-1).text.split("\n")[1]);
    const results = asked.map((r) => {
      const t = byReq.get(r.requirement);
      if (!t) return { id: r.id, status: "missing", evidence: [], gap: "(test stub: unknown requirement)" };
      return { id: r.id, status: t.expected, evidence: quotes[t.id] ? [{ quote: quotes[t.id][0], file: "R1", page: quotes[t.id][1] }] : [], gap: t.expected === "answered" ? "" : t.trap };
    });
    assert.equal(ids.length, results.length);
    return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ results }) } }], usage: { prompt_tokens: 3000, completion_tokens: 1500, cost: 0.02 } }) };
  };
});
after(() => { globalThis.fetch = realFetch; });

test("input: proposal pages are validated and normalised", () => {
  assert.throws(() => normaliseResponse(null), CheckInputError);
  assert.throws(() => normaliseResponse({ pages: [] }), /no pages/);
  assert.throws(() => normaliseResponse({ pages: Array.from({ length: LIMITS.maxPages + 1 }, () => ({ text: "x" })) }), (e) => e.status === 413);
  assert.throws(() => normaliseResponse({ pages: [{ n: 1, text: "   " }, { n: 2, text: "short" }] }), (e) => e.status === 422 && /scanned/.test(e.message));
  const r = normaliseResponse({ filename: "x.pdf", sha256: "bad", pages: [{ unit: "page", n: 1, text: "a".repeat(LIMITS.maxPageChars + 50) }, { unit: "weird", n: -4, text: 42 }] });
  assert.equal(r.pages[0].text.length, LIMITS.maxPageChars, "page text is capped");
  assert.deepEqual([r.pages[1].unit, r.pages[1].n, r.pages[1].text], ["page", 2, ""]);
  assert.equal(r.sha256, null, "invalid fingerprints are dropped");
});

test("check against a page-cited analysis: two-sided evidence, stored tender verification, no database", async () => {
  const sha256 = await sha256Hex(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));
  const response = normaliseResponse({ filename: "ECTA_test_response.pdf", contentType: "application/pdf", sha256, pages });
  const res = await checkProposalAgainstAnalysis({ analysis: analysisOf(ecta), response });
  assert.equal(res.success, true);
  assert.equal(res.items.length, 18);
  assert.equal(res.legacy, false);
  assert.deepEqual(res.summary, { total: 18, answered: 6, partial: 5, conflict: 4, missing: 3, manual: 0, unproven: 0, decidedByCode: 0 });
  const q01 = res.items.find((i) => i.id === "Q01");
  assert.equal(q01.status, "conflict");
  assert.equal(q01.tender.status, "verified");
  assert.equal(q01.tender.checkedBy, "analysis", "tender quote verification comes from the saved analysis");
  assert.equal(q01.tender.page, 2);
  assert.equal(q01.evidence[0].status, "verified");
  assert.equal(q01.evidence[0].page, 4);
  assert.equal(q01.category, "Financial");
  assert.equal(res.response.sha256, sha256);
  assert.equal(res.response.unit, "page");
});

test("check against an older analysis (no citations): works, flagged as legacy, no tender quotes", async () => {
  const res = await checkProposalAgainstAnalysis({ analysis: analysisOf(legacy), response: normaliseResponse({ filename: "r.pdf", pages }) });
  assert.equal(res.legacy, true);
  assert.equal(res.items.length, 18);
  assert.ok(res.items.every((i) => i.tender === null));
});

test("errors: no requirements, AI failure, partial AI failure", async () => {
  const response = normaliseResponse({ filename: "r.pdf", pages });
  await assert.rejects(checkProposalAgainstAnalysis({ analysis: { id: "x", analysisData: { requirements: [] } }, response }), (e) => e.status === 422);
  await assert.rejects(
    checkProposalAgainstAnalysis({ analysis: analysisOf(ecta), response, run: async () => ({ success: false, error: "The AI service could not check this response." }) }),
    (e) => e.status === 502 && /AI service/.test(e.message)
  );
  // A batch that never came back: those requirements are "not checked", never OK.
  const res = await checkProposalAgainstAnalysis({
    analysis: analysisOf(ecta),
    response,
    run: async ({ requirements }) => ({
      success: true,
      items: requirements.map((r) => ({ id: r.id, status: "unproven", notChecked: true, evidence: [], checks: [], flags: ["Not checked"], gap: "", requirement: r.requirement, tender: null })),
      summary: { total: requirements.length },
      meta: { failedBatches: [1] },
    }),
  });
  assert.ok(res.items.every((i) => i.notChecked));
  assert.deepEqual(res.meta.failedBatches, [1]);
});

// ── API route ───────────────────────────────────────────────────────────────
async function callRoute(body, { env = {}, headers = {} } = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    const { POST } = await import("../../app/api/submission-check/route.js");
    const req = new Request("http://localhost/api/submission-check", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
    const res = await POST(req);
    return { status: res.status, json: await res.json() };
  } finally {
    for (const k of Object.keys(env)) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
}

test("API: off in production (404) — the beta never runs on bidlyze.com", async () => {
  const r = await callRoute({ analysisId: "demo-alton", response: { pages } }, { env: { VERCEL_ENV: "production" } });
  assert.equal(r.status, 404);
});

test("API: bad requests are rejected before any AI call", async () => {
  const before = aiCalls;
  assert.equal((await callRoute("not json")).status, 400);
  assert.equal((await callRoute({ analysisId: "demo-alton", response: { pages: [] } })).status, 400);
  assert.equal((await callRoute({ analysisId: "demo-alton", response: { pages: [{ n: 1, text: "   " }] } })).status, 422);
  const big = await callRoute({ analysisId: "x", response: { pages } }, { headers: { "content-length": "9000000" } });
  assert.equal(big.status, 413);
  assert.equal(aiCalls, before, "no AI call was made");
});

test("API: a real tender needs a signed-in user (401), and so does a live run on the sample tender", async () => {
  const before = aiCalls;
  const real = await callRoute({ analysisId: ecta.id, response: { pages } });
  assert.equal(real.status, 401);
  const demoLive = await callRoute({ analysisId: "demo-alton", live: true, response: { filename: "x.pdf", pages } });
  assert.equal(demoLive.status, 401);
  assert.equal(aiCalls, before);
});

const RECORDED = new URL("../benchmarks/alton-cctv-2026/runs/demo-recorded-result.json", import.meta.url);
test("API: the sample proposal returns the recorded live result instantly, with no AI call", { skip: !existsSync(RECORDED) && "recorded demo result not generated yet" }, async () => {
  const rec = JSON.parse(readFileSync(RECORDED));
  const before = aiCalls;
  const r = await callRoute({ analysisId: "demo-alton", response: { filename: "sample.pdf", sha256: rec.response.sha256, pages } });
  assert.equal(r.status, 200);
  assert.ok(r.json.recorded?.checkedAt);
  assert.equal(r.json.items.length, rec.items.length);
  assert.equal(aiCalls, before);
});

// ── Access control and cost limits ──────────────────────────────────────────
const auth = (t) => ({ authorization: `Bearer ${t}` });

test("API: production is a closed beta — unlisted (e.g. free) accounts get 403 before any AI call or database read", async () => {
  const beforeAi = aiCalls;
  const beforeDb = dbReads.length;
  const env = { VERCEL_ENV: "production", SUBMISSION_CHECK_BETA: "on", SUBMISSION_CHECK_ALLOWED_EMAILS: "" };
  const r = await callRoute({ analysisId: ecta.id, response: { pages } }, { env, headers: auth("tok-owner") });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /closed beta/);
  const demoLive = await callRoute({ analysisId: "demo-alton", live: true, response: { filename: "x.pdf", pages } }, { env, headers: auth("tok-owner") });
  assert.equal(demoLive.status, 403);
  assert.equal(aiCalls, beforeAi);
  assert.equal(dbReads.length, beforeDb);
});

test("API: an allow-listed user can check their own analysis; another user's analysis is not found", async () => {
  const env = { VERCEL_ENV: "production", SUBMISSION_CHECK_BETA: "on", SUBMISSION_CHECK_ALLOWED_EMAILS: "owner@example.com,other@example.com" };
  const ok = await callRoute({ analysisId: ecta.id, response: { filename: "p.pdf", pages } }, { env, headers: auth("tok-owner") });
  assert.equal(ok.status, 200, JSON.stringify(ok.json).slice(0, 200));
  assert.equal(ok.json.items.length, 18);
  assert.ok(ok.json.items.every((i) => i.type), "every item has a requirement type");
  assert.ok(Array.isArray(ok.json.documents) && ok.json.documents.length > 0);
  const theirs = await callRoute({ analysisId: ecta.id, response: { filename: "p.pdf", pages } }, { env, headers: auth("tok-other") });
  assert.equal(theirs.status, 404);
});

test("API: per-user rate limit (429 with Retry-After) stops repeated paid checks", async () => {
  const env = { VERCEL_ENV: "preview" };
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const r = await callRoute({ analysisId: "demo-alton", live: true, response: { filename: "x.pdf", pages } }, { env, headers: auth("tok-busy") });
    statuses.push(r.status);
    if (r.status === 429) assert.match(r.json.error, /in the last hour/);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});

test("internal recording endpoint is never public: 404 in production even with the beta switched on", async () => {
  const saved = { ...process.env };
  Object.assign(process.env, { VERCEL_ENV: "production", SUBMISSION_CHECK_BETA: "on" });
  try {
    const before = aiCalls;
    const { GET } = await import("../../app/api/submission-check/demo/route.js");
    const res = await GET(new Request("http://localhost/api/submission-check/demo?part=record&confirm=1"));
    assert.equal(res.status, 404);
    const st = await import("../../app/api/selftest/route.js");
    assert.equal((await st.GET(new Request("http://localhost/api/selftest?mode=submission"))).status, 404);
    assert.equal(aiCalls, before);
  } finally {
    for (const k of ["VERCEL_ENV", "SUBMISSION_CHECK_BETA"]) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});
