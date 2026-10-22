// Citation verification — the core trust feature of the MVP.
//
// The AI is told to copy an exact quote and say which file + page it is on.
// This code then checks, without any AI, whether that is true:
//
//   "verified"   quote found on the cited page
//   "relocated"  quote found, but on a different page (we correct the page)
//   "approximate" ~85%+ of the quote's words appear together on the cited page
//                 (usually PDF line-break / hyphenation noise)
//   "unverified" quote not found anywhere — shown to the reviewer as a warning
//
// Nothing marked "unverified" should reach a customer without human review.

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/-\s+/g, "")            // re-join words hyphenated across lines
    .replace(/[^\p{L}\p{N}%.\-' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return normalize(s)
    .split(" ")
    .map((t) => t.replace(/^[.\-']+|[.\-']+$/g, ""))
    .filter((t) => t.length > 1);
}

// Share of quote tokens found in the best-matching window of the page.
function windowOverlap(quoteTokens, pageTokens) {
  if (quoteTokens.length === 0 || pageTokens.length === 0) return 0;
  const w = quoteTokens.length;
  const need = new Map();
  for (const t of quoteTokens) need.set(t, (need.get(t) || 0) + 1);

  let best = 0;
  const step = Math.max(1, Math.floor(w / 4));
  for (let i = 0; i <= Math.max(0, pageTokens.length - w); i += step) {
    const have = new Map();
    for (const t of pageTokens.slice(i, i + Math.ceil(w * 1.3))) have.set(t, (have.get(t) || 0) + 1);
    let hit = 0;
    for (const [t, c] of need) hit += Math.min(c, have.get(t) || 0);
    best = Math.max(best, hit / w);
    if (best >= 0.999) break;
  }
  return best;
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
      const entry = { fileIndex: f.fileIndex, page: p, norm: normalize(p.text) };
      byKey.set(`${f.fileIndex}:${p.n}`, entry);
      all.push(entry);
    }
  }
  return { byKey, all };
}

/**
 * Verify one citation.
 * @returns {{status, fileIndex, pageN}}
 */
export function verifyCitation(index, { quote, file, page }) {
  const q = normalize(quote);
  const fileIndex = Number(String(file || "").replace(/\D/g, "")) || 1;
  const pageN = Number(String(page || "").replace(/\D/g, "")) || null;

  if (!q || q.length < 8) return { status: "unverified", fileIndex, pageN };

  const cited = pageN ? index.byKey.get(`${fileIndex}:${pageN}`) : null;
  if (cited && cited.norm.includes(q)) return { status: "verified", fileIndex, pageN };

  const elsewhere = index.all.find((e) => e.norm.includes(q));
  if (elsewhere) return { status: "relocated", fileIndex: elsewhere.fileIndex, pageN: elsewhere.page.n };

  // Quotes that span a page break: check cited page + next page together.
  if (cited) {
    const next = index.byKey.get(`${fileIndex}:${pageN + 1}`);
    if (next && (cited.norm + " " + next.norm).includes(q)) return { status: "verified", fileIndex, pageN };
  }

  if (cited) {
    const overlap = windowOverlap(tokens(quote), tokens(cited.page.text));
    if (overlap >= 0.85) return { status: "approximate", fileIndex, pageN };
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
