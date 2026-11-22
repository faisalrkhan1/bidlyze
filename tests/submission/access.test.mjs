// Who can run live (paid) checks, and how often; dashboard average score.
import { test } from "node:test";
import assert from "node:assert/strict";
import { liveCheckAccess, createRateLimiter, limitsFromEnv, DEFAULT_LIMITS } from "../../lib/submission/access.js";
import { averageBidScore } from "../../lib/dashboardStats.js";

const alice = { id: "u-alice", email: "Alice@Example.com" };
const bob = { id: "u-bob", email: "bob@example.com" };

test("production is default-deny: free or unlisted accounts cannot trigger paid checks", () => {
  assert.equal(liveCheckAccess(null, { VERCEL_ENV: "production" }).status, 401);
  assert.equal(liveCheckAccess(alice, { VERCEL_ENV: "production" }).status, 403, "empty allow-list = nobody");
  assert.equal(liveCheckAccess(bob, { VERCEL_ENV: "production", SUBMISSION_CHECK_ALLOWED_EMAILS: "alice@example.com" }).status, 403);
  assert.equal(liveCheckAccess(alice, { VERCEL_ENV: "production", SUBMISSION_CHECK_ALLOWED_EMAILS: "carol@x.com, alice@example.com" }).allowed, true, "case-insensitive list");
});

test("preview/dev: signed-in users (preview is behind Vercel Authentication), unless a list is set", () => {
  assert.equal(liveCheckAccess(bob, { VERCEL_ENV: "preview" }).allowed, true);
  assert.equal(liveCheckAccess(null, { VERCEL_ENV: "preview" }).status, 401);
  assert.equal(liveCheckAccess(bob, { VERCEL_ENV: "preview", SUBMISSION_CHECK_ALLOWED_EMAILS: "alice@example.com" }).status, 403);
});

test("rate limiter: one check at a time, per-hour and per-day caps, release", () => {
  let t = 0;
  const rl = createRateLimiter({ perHour: 3, perDay: 4, concurrent: 1 }, () => t);
  const a = rl.acquire("u1");
  assert.ok(a.ok);
  const b = rl.acquire("u1");
  assert.equal(b.status, 429, "second concurrent check refused");
  assert.match(b.reason, /already running/);
  assert.ok(rl.acquire("u2").ok, "other users are independent");
  a.release();
  a.release(); // idempotent
  for (let i = 0; i < 2; i++) {
    t += 1000;
    const s = rl.acquire("u1");
    assert.ok(s.ok);
    s.release();
  }
  t += 1000;
  const hour = rl.acquire("u1");
  assert.equal(hour.status, 429);
  assert.match(hour.reason, /3 checks in the last hour/);
  assert.ok(hour.retryAfterSec > 3000 && hour.retryAfterSec <= 3600);
  t += 3_600_000;
  const s4 = rl.acquire("u1");
  assert.ok(s4.ok, "allowed again after an hour");
  s4.release();
  t += 1000;
  const day = rl.acquire("u1");
  assert.equal(day.status, 429);
  assert.match(day.reason, /4 checks per day/);
});

test("limits come from the environment with safe defaults", () => {
  assert.deepEqual(limitsFromEnv({}), DEFAULT_LIMITS);
  assert.deepEqual(limitsFromEnv({ SUBMISSION_CHECK_MAX_PER_HOUR: "2", SUBMISSION_CHECK_MAX_PER_DAY: "x" }), { ...DEFAULT_LIMITS, perHour: 2 });
});

test("dashboard: average bid score ignores missing / non-numeric scores and is null when there are none (no NaN, no fake 0)", () => {
  assert.equal(averageBidScore([]), null);
  assert.equal(averageBidScore(null), null);
  assert.equal(averageBidScore([{ bid_score: null }, { bid_score: undefined }, { bid_score: "n/a" }, {}]), null);
  assert.equal(averageBidScore([{ bid_score: 70 }, { bid_score: "81" }, { bid_score: null }, { bid_score: 250 }]), 76);
  assert.equal(averageBidScore([{ bid_score: 0 }]), 0, "a real zero is kept");
});
