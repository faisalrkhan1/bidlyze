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

// "manual": a submission instruction or conduct rule (deadline, delivery,
// packaging, e-mail subject, no-lobbying, scoring guidance) that a response
// document cannot evidence. Shown as "check this yourself", never as compliant.
export const STATUSES = ["answered", "partial", "conflict", "missing", "manual", "unproven"];

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
const QTY_RE = new RegExp(`\\b${NUM_RE}(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?:[a-z-]+\\s+){0,2}?${UNIT_RE}(?![a-z])`, "gi");
const MAX_WORDS = /\b(maximum|max\.?|not exceed|not to exceed|not more than|no more than|up to|at most|capped|within)\b/gi;
const MIN_WORDS = /\b(minimum|min\.?|at least|not less than|no less than)\b/gi;

// Nearest min/max wording before a number decides the comparison:
// "within 24 hours" is a maximum, "at least 31 days" a minimum. Default: minimum.
function comparison(before) {
  const last = (re) => Math.max(-1, ...[...before.matchAll(re)].map((m) => m.index));
  return last(MAX_WORDS) > last(MIN_WORDS) ? "<=" : ">=";
}

// Durations in different units are compared in a common unit
// (72 hours = 3 days; 18 months = 1.5 years). Other units only match themselves.
const BASE = { hours: ["hours", 1], days: ["hours", 24], weeks: ["hours", 168], months: ["months", 1], years: ["months", 12] };
function inBase(q) {
  const [unit, f] = BASE[q.unit] || [q.unit, 1];
  return { unit, n: q.n * f };
}

// Countable items: giving fewer than required is a PARTIAL answer (two of three
// certificates). Thresholds (%, days, years...) below the minimum CONFLICT.
const COUNT_UNITS = new Set(["certificates", "projects", "copies", "references"]);

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
    const before = t.slice(Math.max(0, m.index - 40), m.index);
    // A 4-digit number followed by "years" is a calendar year list, not a duration.
    if (unit === "years" && n >= 1900) continue;
    // Standard and model numbers are not quantities: "ISO 27001 certificates",
    // "ISO 9001:2015 certificate", "IP68", "PS-200".
    if (/(?:\biso(?:\/iec)?|\biec|\bip|[:\-\/])\s*$/.test(before)) continue;
    if (COUNT_UNITS.has(unit) && n >= 1000) continue;
    const cmp = comparison(before);
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

function longestRun(a, b) {
  let best = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) cur[j] = prev[j - 1] + 1;
      if (cur[j] > best) best = cur[j];
    }
    prev = cur;
  }
  return best;
}

/**
 * True when the quote only COPIES the requirement (most of the quote is one
 * unbroken run of the requirement's own words) with no commitment.
 * A quote that merely reuses the tender's vocabulary ("It covers the initial
 * installation and annual maintenance for Years 1 and 2", a list of the same
 * place names) is an answer to be judged, not an echo. Found in the
 * real-world benchmark (A31, A34), where the old word-overlap test turned
 * correct verdicts into "missing".
 */
export function isEcho(quote, ...requirementTexts) {
  if (COMMITMENT.test(quote)) return false;
  const q = normalize(quote).split(" ").filter(Boolean);
  if (q.length === 0) return true;
  const run = Math.max(0, ...requirementTexts.map((t) => longestRun(q, normalize(t).split(" ").filter(Boolean))));
  return run >= 6 && run / q.length >= 0.7;
}


/** Compare required quantities with the evidence. */
export function compareValues(requirementText, evidenceText) {
  const required = extractQuantities(requirementText);
  const given = extractQuantities(evidenceText);
  const conflicts = [];
  const shortfalls = [];
  const unconfirmed = [];
  for (const r of required) {
    const rb = inBase(r);
    const same = given.filter((g) => inBase(g).unit === rb.unit);
    if (same.length === 0) { unconfirmed.push(r.text); continue; }
    const ok = same.some((g) => (r.cmp === "<=" ? inBase(g).n <= rb.n : inBase(g).n >= rb.n));
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
  const aiStatus = ["answered", "partial", "conflict", "missing", "manual"].includes(ai?.status) ? ai.status : "missing";
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
  if (aiStatus === "manual") {
    flags.push("Check this yourself: it is about how or when the bid is submitted, not what the response says.");
    return done("manual", "ai");
  }
  if (proven.length === 0) {
    flags.push(evidence.length ? "The AI's quote is not in your response — check this requirement yourself." : "The AI gave no quote from your response.");
    return done("unproven", "code");
  }

  // 2. Echo: proof that only repeats the requirement is not an answer.
  const real = proven.filter((e) => !isEcho(e.quote, reqText, req.tenderQuote || ""));
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
