// Submission Check — deterministic gates (no AI).
//
// The AI proposes a verdict per requirement and quotes the bidder's response.
// These checks run in code, independently of the AI, and can only DOWNGRADE
// the verdict (answered -> partial/conflict/missing/unproven). They never
// upgrade it. They separate a TEXTUAL match from genuine compliance:
//
//   evidence  every response quote must really be on the cited response page
//             (same checker as tender citations). No proof -> "unproven".
//   echo      a quote that only repeats the requirement's own words, with no
//             commitment ("we", "attached", "comply"...), is not an answer.
//   values    numbers with units in the requirement (2%, 120 days, 5 years,
//             three certificates) are compared with the same unit in the
//             quote. Below a minimum (or above a maximum) -> "conflict".
//   codes     standards named in the requirement (ISO 27001, IP68, Cyber
//             Essentials) must all appear in the evidence, else "partial".
//   timing    "before delivery" answered with "after delivery" -> "conflict".
//   deviation wording such as "not", "exception", "subject to" -> a flag to
//             check (no status change on its own).

import { normalize, verifyCitation } from "../readiness/verify.js";

export const STATUSES = ["answered", "partial", "conflict", "missing", "unproven"];

const NUM_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90,
};
const UNIT_ALIASES = {
  "%": "percent", percent: "percent", "per cent": "percent",
  day: "days", days: "days", week: "weeks", weeks: "weeks", month: "months", months: "months",
  year: "years", years: "years", hour: "hours", hours: "hours",
  certificate: "certificates", certificates: "certificates", project: "projects", projects: "projects",
  copy: "copies", copies: "copies", reference: "references", references: "references",
};
const UNIT_RE = "(%|per cent|percent|days?|weeks?|months?|years?|hours?|certificates?|projects?|cop(?:y|ies)|references?)";
const NUM_RE = `(\\d+(?:\\.\\d+)?|${Object.keys(NUM_WORDS).join("|")})`;
// number, optional "(3)", up to two words in between, then a unit.
// Default comparison is "at least" (validity, experience, ratings); wording
// such as "maximum" or "not to exceed" flips it to "at most".
const QTY_RE = new RegExp(`${NUM_RE}(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?:[a-z-]+\\s+){0,2}?${UNIT_RE}(?![a-z])`, "gi");
const MAX_WORDS = /\b(maximum|max\.?|not exceed|not to exceed|not more than|no more than|up to|at most|capped)\b/i;

function lower(s) {
  return String(s || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

/** Quantities like {n: 120, unit: "days", cmp: ">=" | "<="}. */
export function extractQuantities(text) {
  const t = lower(text);
  const out = [];
  for (const m of t.matchAll(QTY_RE)) {
    const raw = m[1];
    const n = /^\d/.test(raw) ? Number(raw) : NUM_WORDS[raw];
    const unit = UNIT_ALIASES[m[2]] || m[2];
    if (!Number.isFinite(n)) continue;
    // A 4-digit number followed by "years" is a calendar year list, not a duration.
    if (unit === "years" && n >= 1900) continue;
    const before = t.slice(Math.max(0, m.index - 40), m.index);
    const cmp = MAX_WORDS.test(before) ? "<=" : ">=";
    out.push({ n, unit, cmp, text: m[0].trim() });
  }
  return out;
}

/** Standards / ratings named in text: ISO 27001, IP68, Cyber Essentials (Plus). */
export function extractCodes(text) {
  const t = lower(text);
  const codes = new Set();
  for (const m of t.matchAll(/\biso(?:\/iec)?\s*(\d{4,5})/g)) codes.add(`ISO ${m[1]}`);
  for (const m of t.matchAll(/\bip\s?(\d{2})\b/g)) codes.add(`IP${m[1]}`);
  if (/\bcyber essentials plus\b/.test(t)) codes.add("Cyber Essentials Plus");
  else if (/\bcyber essentials\b/.test(t)) codes.add("Cyber Essentials");
  return [...codes];
}

const TIMING_RE = /\b(before|prior to|after|following|upon)\s+(?:the\s+)?([a-z]+)/g;
function timings(text) {
  const out = [];
  for (const m of lower(text).matchAll(TIMING_RE)) {
    const when = m[1] === "before" || m[1] === "prior to" ? "before" : "after";
    out.push({ when, event: m[2] });
  }
  return out;
}

const COMMITMENT = /\b(we|our|us|attached|enclosed|enclose|provided|provide|included|include|comply|complies|compliant|confirm|confirmed|submitted|joined|attended|registered|hold|holds)\b/i;
const DEVIATION = /\b(not|cannot|unable|exception|deviation|deviate|instead of|alternative to|subject to|excluding)\b/i;

function contentTokens(s) {
  return normalize(s).split(" ").filter((w) => w.length > 2);
}

/** True when the quote only repeats the requirement's wording with no commitment. */
export function isEcho(quote, requirementText) {
  if (COMMITMENT.test(quote)) return false;
  const q = contentTokens(quote);
  if (q.length === 0) return true;
  const req = new Set(contentTokens(requirementText));
  const shared = q.filter((w) => req.has(w)).length;
  return shared / q.length >= 0.8;
}

// Countable items: giving fewer than required is a PARTIAL answer (two of three
// certificates). Thresholds (%, days, years...) below the minimum CONFLICT.
const COUNT_UNITS = new Set(["certificates", "projects", "copies", "references"]);

/** Compare required quantities with the evidence. */
export function compareValues(requirementText, evidenceText) {
  const required = extractQuantities(requirementText);
  const given = extractQuantities(evidenceText);
  const conflicts = [];
  const shortfalls = [];
  const unconfirmed = [];
  for (const r of required) {
    const same = given.filter((g) => g.unit === r.unit);
    if (same.length === 0) { unconfirmed.push(r.text); continue; }
    const ok = same.some((g) => (r.cmp === "<=" ? g.n <= r.n : g.n >= r.n));
    if (ok) continue;
    const msg = `tender: ${r.text} · response: ${same.map((g) => g.text).join(", ")}`;
    (COUNT_UNITS.has(r.unit) ? shortfalls : conflicts).push(msg);
  }
  return { conflicts, shortfalls, unconfirmed };
}

export function missingCodes(requirementText, evidenceText) {
  const have = new Set(extractCodes(evidenceText));
  return extractCodes(requirementText).filter((c) => !have.has(c));
}

export function timingConflicts(requirementText, evidenceText) {
  const req = timings(requirementText);
  const ev = timings(evidenceText);
  const out = [];
  for (const r of req) {
    const clash = ev.find((e) => e.event === r.event && e.when !== r.when);
    if (clash) out.push(`tender: ${r.when} ${r.event} · response: ${clash.when} ${clash.event}`);
  }
  return out;
}

const RANK = { answered: 0, partial: 1, missing: 2, conflict: 3, unproven: 4 };

/**
 * Apply all gates to one AI result.
 * @param {object} req   { id, requirement, tenderQuote }
 * @param {object} ai    { status, evidence: [{quote, file, page}], gap }
 * @param {object} responseIndex  buildIndex() of the response files
 * @returns {{ status, aiStatus, decidedBy, evidence, checks, flags, gap }}
 */
export function applyGates(req, ai, responseIndex) {
  const aiStatus = ["answered", "partial", "conflict", "missing"].includes(ai?.status) ? ai.status : "missing";
  const checks = [];
  const flags = [];

  // 1. Evidence: every quote checked against the response pages, in code.
  const evidence = (Array.isArray(ai?.evidence) ? ai.evidence : [])
    .filter((e) => e && typeof e.quote === "string" && e.quote.trim())
    .slice(0, 3)
    .map((e) => {
      const v = verifyCitation(responseIndex, { quote: e.quote, file: e.file || "R1", page: e.page });
      return { quote: String(e.quote).slice(0, 400), file: `R${v.fileIndex}`, page: v.pageN, status: v.status };
    });
  const proven = evidence.filter((e) => e.status !== "unverified");
  checks.push({ type: "evidence", result: `${proven.length}/${evidence.length} quote(s) found in the response` });

  const reqText = `${req.requirement || ""}`;
  const done = (status, decidedBy) => ({ id: req.id, status, aiStatus, decidedBy, evidence, checks, flags, gap: String(ai?.gap || "") });

  if (aiStatus === "missing") return done("missing", "ai");
  if (proven.length === 0) {
    flags.push(evidence.length ? "The AI's quote is not in your response — check this requirement yourself." : "The AI gave no quote from your response.");
    return done("unproven", "code");
  }

  // 2. Echo: proof that only repeats the requirement is not an answer.
  const real = proven.filter((e) => !isEcho(e.quote, `${reqText} ${req.tenderQuote || ""}`));
  if (real.length === 0) {
    flags.push("Your response only repeats the requirement's wording; there is no commitment or evidence.");
    checks.push({ type: "echo", result: "repeats requirement only" });
    return done("missing", "code");
  }
  const evText = real.map((e) => e.quote).join(" \n ");

  // 3–5. Values, timing, standards.
  const { conflicts, shortfalls, unconfirmed } = compareValues(reqText, evText);
  const timing = timingConflicts(reqText, evText);
  const codes = missingCodes(reqText, evText);
  if (conflicts.length) checks.push({ type: "values", result: conflicts.join("; ") });
  if (shortfalls.length) checks.push({ type: "quantity", result: shortfalls.join("; ") });
  if (unconfirmed.length) flags.push(`Not stated in the quoted text: ${unconfirmed.join(", ")} — confirm it is in your response.`);
  if (timing.length) checks.push({ type: "timing", result: timing.join("; ") });
  if (codes.length) checks.push({ type: "standards", result: `not mentioned: ${codes.join(", ")}` });
  if (DEVIATION.test(evText)) flags.push("The quoted text contains wording like 'not', 'exception' or 'subject to' — check it is not a deviation.");

  let status = aiStatus;
  let decidedBy = "ai";
  const downgrade = (to) => {
    if (RANK[to] > RANK[status]) { status = to; decidedBy = "code"; }
  };
  if (conflicts.length || timing.length) downgrade("conflict");
  if (codes.length || shortfalls.length) downgrade("partial");
  return done(status, decidedBy);
}
