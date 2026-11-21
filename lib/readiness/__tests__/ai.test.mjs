// Tests for the AI call wrapper: cut-off answers, retries, privacy routing.
// No network: global fetch is replaced with a fake OpenRouter. Run: npm test

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { salvageTruncatedJSON, providerPreferences, askJSON, parseJSON } from "../ai.js";

// ── salvageTruncatedJSON ────────────────────────────────────────────────────

test("salvage keeps complete array items and drops the half-written one", () => {
  const cut = '{"requirements":[{"requirement":"A","citation":{"quote":"q1","page":1}},{"requirement":"B","citation":{"quote":"q2","page":2}},{"requirement":"C","cit';
  const out = salvageTruncatedJSON(cut);
  assert.deepEqual(out.requirements.map((r) => r.requirement), ["A", "B"]);
});

test("salvage handles braces and quotes inside strings", () => {
  const cut = '{"items":[{"t":"bond {2%} \\"unconditional\\""},{"t":"x]y}z"},{"t":"half';
  const out = salvageTruncatedJSON(cut);
  assert.deepEqual(out.items.map((i) => i.t), ['bond {2%} "unconditional"', "x]y}z"]);
});

test("salvage keeps earlier keys when a later array is cut", () => {
  const cut = '```json\n{"summary":"ok","fixed_checks":[{"id":"bid_bond","status":"required"}],"dynamic_findings":[{"title":"T1"},{"title":"T2","sev';
  const out = salvageTruncatedJSON(cut);
  assert.equal(out.summary, "ok");
  assert.equal(out.fixed_checks.length, 1);
  assert.deepEqual(out.dynamic_findings.map((d) => d.title), ["T1"]);
});

test("salvage returns null when nothing complete was written", () => {
  assert.equal(salvageTruncatedJSON('{"requirements":[{"requirement":"A"'), null);
  assert.equal(salvageTruncatedJSON("not json at all"), null);
});

test("salvage returns the object unchanged when it was not actually cut", () => {
  assert.deepEqual(salvageTruncatedJSON('{"a":[1,2],"b":{"c":3}}'), { a: [1, 2], b: { c: 3 } });
});

test("parseJSON strips markdown fences", () => {
  assert.deepEqual(parseJSON('```json\n{"x":1}\n```'), { x: 1 });
});

// ── providerPreferences ─────────────────────────────────────────────────────

test("privacy routing: data collection is always denied", () => {
  assert.deepEqual(providerPreferences({}), { data_collection: "deny" });
});

test("privacy routing: AI_PROVIDER_ONLY pins providers with no fallback; AI_ZDR adds zdr", () => {
  assert.deepEqual(providerPreferences({ AI_PROVIDER_ONLY: "anthropic, amazon-bedrock", AI_ZDR: "true" }), {
    data_collection: "deny",
    only: ["anthropic", "amazon-bedrock"],
    allow_fallbacks: false,
    zdr: true,
  });
});

// ── askJSON with a fake OpenRouter ──────────────────────────────────────────

const realFetch = globalThis.fetch;
let calls;
function fakeOpenRouter(responses) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (r.status && r.status !== 200) return { ok: false, status: r.status, text: async () => "error" };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: r.content }, finish_reason: r.finish || "stop" }],
        usage: { prompt_tokens: 1000, completion_tokens: 100, cost: 0.01 },
      }),
    };
  };
}

beforeEach(() => { process.env.OPENROUTER_API_KEY = "test-key"; });
afterEach(() => { globalThis.fetch = realFetch; });

test("askJSON sends the privacy routing preferences and returns parsed JSON", async () => {
  fakeOpenRouter([{ content: '{"ok":true}' }]);
  const r = await askJSON({ system: "s", task: "t", label: "t1" });
  assert.deepEqual(r.json, { ok: true });
  assert.equal(r.truncated, false);
  assert.equal(calls[0].body.provider.data_collection, "deny");
});

test("askJSON: an answer cut off at max_tokens returns the complete items, flagged, without a second paid call", async () => {
  fakeOpenRouter([{ content: '{"requirements":[{"requirement":"A"},{"requirement":"B"},{"requ', finish: "length" }]);
  const r = await askJSON({ system: "s", task: "t", label: "t2" });
  assert.equal(r.truncated, true);
  assert.deepEqual(r.json.requirements.map((x) => x.requirement), ["A", "B"]);
  assert.equal(calls.length, 1);
});

test("askJSON: an unrecoverable cut-off fails without retrying", async () => {
  fakeOpenRouter([{ content: '{"requirements":[{"requ', finish: "length" }]);
  await assert.rejects(askJSON({ system: "s", task: "t", label: "t3" }), /cut off/);
  assert.equal(calls.length, 1);
});

test("askJSON: invalid JSON is retried once and the usage of both attempts is counted", async () => {
  fakeOpenRouter([{ content: "Sorry, here is the analysis: {broken" }, { content: '{"ok":1}' }]);
  const r = await askJSON({ system: "s", task: "t", label: "t4" });
  assert.deepEqual(r.json, { ok: 1 });
  assert.equal(calls.length, 2);
  assert.equal(r.usage.prompt_tokens, 2000);
  assert.ok(Math.abs(r.usage.cost - 0.02) < 1e-9);
});

test("askJSON: an HTTP error on both attempts throws", async () => {
  fakeOpenRouter([{ status: 503 }]);
  await assert.rejects(askJSON({ system: "s", task: "t", label: "t5" }), /503/);
  assert.equal(calls.length, 2);
});
