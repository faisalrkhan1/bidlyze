// Scores a Tender Intelligence (readiness) run on a real-world benchmark tender.
import { matchRequirements } from "./match.js";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");

export function isoDates(text) {
  const t = String(text || "").toLowerCase();
  const out = new Set();
  for (const m of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*,?\s+(\d{4})\b/g)) out.add(`${m[3]}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(m[1])}`);
  for (const m of t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/g)) out.add(`${m[3]}-${pad(MONTHS.indexOf(m[1]) + 1)}-${pad(m[2])}`);
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.add(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) out.add(`${m[3]}-${pad(m[2])}-${pad(m[1])}`);
  return out;
}

export function scoreReadiness(bench, key, data) {
  const reqs = data?.requirements || [];
  const match = matchRequirements(key.requirements, reqs);
  const rows = key.requirements.map((k) => {
    const m = match.get(k.id);
    const t = m ? reqs.find((r) => r.id === m.tiId) : null;
    return {
      id: k.id,
      found: !!t,
      ti: t?.id || null,
      page: t?.citation?.page ?? null,
      expectedPage: k.tenderPage,
      citation: t?.citation?.status || null,
      run: m?.run ?? 0,
      cov: m?.cov ?? 0,
    };
  });
  const found = rows.filter((r) => r.found);
  const used = new Set(found.map((r) => r.ti));
  const cit = { verified: 0, relocated: 0, approximate: 0, unverified: 0, none: 0 };
  for (const r of reqs) cit[r.citation?.status || "none"] += 1;

  const dates = isoDates(JSON.stringify(data?.keyDates || []) + JSON.stringify(data?.summary || {}));
  const dateHits = Object.fromEntries(Object.entries(bench.keyDates).map(([k, d]) => [k, dates.has(d)]));
  const evalText = JSON.stringify(data?.evaluationCriteria || []).toLowerCase();
  const weightHits = Object.fromEntries(Object.entries(bench.evaluationWeights).map(([k, w]) => [k, evalText.includes(`${w}%`) || new RegExp(`"weight[^"]*":\\s*"?${w}\\b`).test(evalText)]));

  return {
    summary: {
      keyRequirementsFound: `${found.length}/${rows.length}`,
      onCorrectPage: `${found.filter((r) => r.page === r.expectedPage).length}/${found.length}`,
      extractedRequirements: reqs.length,
      extractedNotInKey: reqs.length - used.size,
      citations: cit,
      keyDates: `${Object.values(dateHits).filter(Boolean).length}/${Object.keys(dateHits).length}`,
      evaluationWeights: `${Object.values(weightHits).filter(Boolean).length}/${Object.keys(weightHits).length}`,
    },
    notFound: rows.filter((r) => !r.found).map((r) => r.id),
    wrongPage: found.filter((r) => r.page !== r.expectedPage).map((r) => `${r.id} -> ${r.ti} p.${r.page} (expected p.${r.expectedPage})`),
    rows,
    dateHits,
    weightHits,
    match,
  };
}
