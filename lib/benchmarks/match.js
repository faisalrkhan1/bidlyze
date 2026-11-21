// Matches requirements extracted by Tender Intelligence to answer-key items,
// using the tender text both sides quote (no AI). Several key items may match
// the same extracted requirement (e.g. one sentence with two obligations).
import { normalize } from "../readiness/verify.js";

const STOP = new Set("the and for with that this shall will are all any its their from into been have has must should also such which within each per who what when where there these those than then them they our your not but can may".split(" "));

export function contentTokens(s) {
  return normalize(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
}

/** Longest run of consecutive identical words shared by two texts. */
export function longestCommonRun(a, b) {
  const x = normalize(a).split(" ").filter(Boolean);
  const y = normalize(b).split(" ").filter(Boolean);
  let best = 0;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

function coverage(keyText, otherText) {
  const k = [...new Set(contentTokens(keyText))];
  if (!k.length) return 0;
  const o = new Set(contentTokens(otherText));
  return k.filter((w) => o.has(w)).length / k.length;
}

/**
 * @param keyReqs  answer-key requirements [{id, requirement, tenderQuote, tenderPage}]
 * @param tiReqs   extracted requirements [{id, requirement, citation:{quote,page,status}}]
 * @returns Map keyId -> {tiId, run, cov, score} | null
 */
export function matchRequirements(keyReqs, tiReqs) {
  const out = new Map();
  for (const k of keyReqs) {
    let best = null;
    for (const t of tiReqs) {
      const run = longestCommonRun(k.tenderQuote, t.citation?.quote || "");
      const cov = coverage(k.requirement, `${t.requirement} ${t.citation?.quote || ""}`);
      const ok = run >= 6 || (run >= 4 && cov >= 0.4) || cov >= 0.6;
      if (!ok) continue;
      const score = Math.min(run, 12) * 2 + cov * 10;
      if (!best || score > best.score) best = { tiId: t.id, run, cov: Math.round(cov * 100) / 100, score };
    }
    out.set(k.id, best);
  }
  return out;
}
