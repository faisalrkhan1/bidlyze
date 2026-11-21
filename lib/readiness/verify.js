// Citation verification — the core trust feature of the MVP.
//
// The AI is told to copy an exact quote and say which file + page it is on.
// This code then checks, without any AI, whether that is true:
//
//   "verified"    quote found on the cited page (or running across its page break)
//   "relocated"   quote found, but on a different page (we correct the page)
//   "approximate" at least 85% of the quote's words appear, in order, in one
//                 passage of a page, AND every number in the quote is in that
//                 passage (usually PDF line-break / table-layout noise)
//   "unverified"  not found — shown to the reviewer as a warning
//
// Nothing marked "unverified" should reach a customer without human review.
// Tests: lib/readiness/__tests__/verify.test.mjs  (npm test)

const MIN_QUOTE_CHARS = 8;
const APPROX_THRESHOLD = 0.85;
const ELLIPSIS = /\.{3,}|…/;

/**
 * Make page text and quotes comparable despite PDF-extraction noise:
 * ligatures and Arabic presentation forms (NFKC), curly quotes, dash variants,
 * words hyphenated across lines, compound hyphens, sentence punctuation,
 * diacritics and non-breaking spaces. Decimal points and % are kept so that
 * numbers stay exact.
 */
export function normalize(s) {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/-\s+/g, "")                 // "require-\nments" -> "requirements"
    .replace(/-/g, "")                    // "in-country" == "incountry" on both sides
    .replace(/[ـ\p{M}]/gu, "")       // Arabic tatweel + diacritics/combining marks
    .replace(/\.(?=\s|$)/g, " ")          // sentence full stops (keeps 2.5 and 3.2.4)
    .replace(/[^\p{L}\p{N}%.' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.' ]+|[.' ]+$/g, "");
}

// Page furniture that PDF extraction puts between two halves of a sentence
// at a page break: "Page 5 of 8", "5 / 8", "- 5 -", "صفحة 5 من 8".
const PAGE_NUMBER_LINE = /^[\s\-\u2013\u2014]*(?:page|p\.|\u0635\u0641\u062D\u0629)?\s*\d{1,4}\s*(?:(?:of|\/|\u0645\u0646)\s*\d{1,4})?[\s\-\u2013\u2014]*$/gimu;

export function stripPageNumbers(text) {
  return String(text || "").replace(PAGE_NUMBER_LINE, "");
}

function tokens(s) {
  return normalize(s)
    .split(" ")
    .map((t) => t.replace(/^[.']+|[.']+$/g, ""))
    .filter((t) => t.length > 1 || /\d/.test(t));
}

const hasDigit = (t) => /\d/.test(t);

// Words that flip a requirement's meaning. An approximate match must not
// drop one ("shall not attend" vs "shall attend") or add one.
const NEGATIONS = new Set(["not", "no", "never", "without", "except", "unless", "nor", "cannot", "neither", "\u0644\u0627", "\u063A\u064A\u0631", "\u0644\u064A\u0633", "\u0639\u062F\u0645"]);

/**
 * Best passage on a page for an approximate match.
 * Score = share of quote tokens found IN ORDER in a window of the page, so a
 * reshuffled sentence does not pass. A window only counts if it also contains
 * every number in the quote, so "5%" never matches a page that says "2%".
 */
function bestOrderedWindow(quoteTokens, pageTokens) {
  const w = quoteTokens.length;
  if (w === 0 || pageTokens.length === 0) return 0;
  const numbers = quoteTokens.filter(hasDigit);
  const size = Math.ceil(w * 1.3) + 2;
  const step = Math.max(1, Math.floor(w / 6));
  let best = 0;
  for (let i = 0; i <= Math.max(0, pageTokens.length - Math.min(w, pageTokens.length)); i += step) {
    const win = pageTokens.slice(i, i + size);
    if (numbers.length && !numbers.every((n) => win.includes(n))) continue;
    let pos = 0;
    let hit = 0;
    let first = -1;
    for (const t of quoteTokens) {
      const at = win.indexOf(t, pos);
      if (at !== -1) {
        if (first === -1) first = at;
        hit += 1;
        pos = at + 1;
      }
    }
    if (first !== -1) {
      const span = win.slice(first, pos);
      const quoteNeg = quoteTokens.filter((t) => NEGATIONS.has(t));
      if (!quoteNeg.every((n) => span.includes(n))) continue;
      if (span.some((t) => NEGATIONS.has(t) && !quoteTokens.includes(t))) continue;
    }
    best = Math.max(best, hit / w);
    if (best >= 0.999) break;
  }
  return best;
}

/** All parts of an ellipsis-shortened quote must appear in this order. */
function containsInOrder(hay, parts) {
  let from = 0;
  for (const part of parts) {
    const at = hay.indexOf(part, from);
    if (at === -1) return false;
    from = at + part.length;
  }
  return true;
}

/**
 * Build a lookup index once per analysis.
 * @param {Array<{fileIndex,pages}>} files
 */
export function buildIndex(files) {
  const byKey = new Map();
  const all = [];
  for (const f of files) {
    for (const p of f.pages) {
      const norm = normalize(stripPageNumbers(p.text));
      const entry = { fileIndex: f.fileIndex, page: p, norm, toks: null };
      byKey.set(`${f.fileIndex}:${p.n}`, entry);
      all.push(entry);
    }
  }
  return { byKey, all };
}

function pageTokens(entry) {
  if (!entry.toks) entry.toks = tokens(stripPageNumbers(entry.page.text));
  return entry.toks;
}

/**
 * Verify one citation.
 * @returns {{status, fileIndex, pageN}}
 */
export function verifyCitation(index, { quote, file, page }) {
  const fileIndex = Number(String(file || "").replace(/\D/g, "")) || 1;
  const pageN = Number(String(page || "").replace(/\D/g, "")) || null;

  const raw = String(quote || "");
  const parts = raw.split(ELLIPSIS).map(normalize).filter((p) => p.length >= 4);
  const whole = normalize(raw);
  if (whole.replace(/ /g, "").length < MIN_QUOTE_CHARS || parts.length === 0) {
    return { status: "unverified", fileIndex, pageN };
  }

  const isElided = parts.length > 1;
  const matches = (hay) => (isElided ? containsInOrder(hay, parts) : hay.includes(parts[0]));
  const key = (fi, n) => index.byKey.get(`${fi}:${n}`);
  const join = (...entries) => entries.filter(Boolean).map((e) => e.norm).join(" ");

  // 1. On the cited page, or running across its page breaks.
  const cited = pageN ? key(fileIndex, pageN) : null;
  if (cited) {
    const prev = key(fileIndex, pageN - 1);
    const next = key(fileIndex, pageN + 1);
    if (matches(cited.norm) || matches(join(cited, next)) || matches(join(prev, cited))) {
      return { status: "verified", fileIndex, pageN };
    }
  }

  // 2. Somewhere else in the package: correct the page.
  for (const e of index.all) {
    if (matches(e.norm)) return { status: "relocated", fileIndex: e.fileIndex, pageN: e.page.n };
  }
  for (const e of index.all) {
    const next = key(e.fileIndex, e.page.n + 1);
    if (next && matches(join(e, next))) return { status: "relocated", fileIndex: e.fileIndex, pageN: e.page.n };
  }

  // 3. Approximate: same words in the same order, all numbers present.
  //    Ellipsis quotes are already shortened by the AI, so they must match exactly.
  if (isElided) return { status: "unverified", fileIndex, pageN };
  const qt = tokens(raw);
  if (cited && bestOrderedWindow(qt, pageTokens(cited)) >= APPROX_THRESHOLD) {
    return { status: "approximate", fileIndex, pageN };
  }
  let best = { score: 0, entry: null };
  for (const e of index.all) {
    if (e === cited) continue;
    const score = bestOrderedWindow(qt, pageTokens(e));
    if (score > best.score) best = { score, entry: e };
  }
  if (best.entry && best.score >= APPROX_THRESHOLD) {
    return { status: "approximate", fileIndex: best.entry.fileIndex, pageN: best.entry.page.n };
  }
  return { status: "unverified", fileIndex, pageN };
}

/** Count statuses for the report header. */
export function summarizeCitations(items) {
  const s = { total: 0, verified: 0, relocated: 0, approximate: 0, unverified: 0 };
  for (const it of items) {
    if (!it?.citation) continue;
    s.total += 1;
    s[it.citation.status] = (s[it.citation.status] || 0) + 1;
  }
  return s;
}
