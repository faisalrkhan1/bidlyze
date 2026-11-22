// Validates a benchmark answer key against the documents, in code (no AI):
//  - every tender quote is found on its stated tender page
//  - every response quote is found on its stated response page
//  - terms whose absence justifies a "missing"/"partial" verdict really are absent
import { buildIndex, verifyCitation, normalize } from "../readiness/verify.js";

export function validateKey(key, tenderFiles, responseFiles) {
  const tIdx = buildIndex(tenderFiles);
  const rIdx = buildIndex(responseFiles);
  const rAll = normalize(responseFiles.flatMap((f) => f.pages.map((p) => p.text)).join(" "));
  const problems = [];
  let tOk = 0;
  let rOk = 0;
  let rTotal = 0;
  for (const r of key.requirements) {
    const tv = verifyCitation(tIdx, { quote: r.tenderQuote, file: "F1", page: r.tenderPage });
    if (tv.status === "verified" && tv.pageN === r.tenderPage) tOk += 1;
    else problems.push(`${r.id} tender quote: ${tv.status} p${tv.pageN} (expected p${r.tenderPage})`);
    for (const e of r.responseEvidence || []) {
      rTotal += 1;
      const rv = verifyCitation(rIdx, { quote: e.quote, file: "R1", page: e.page });
      if (rv.status === "verified" && rv.pageN === e.page) rOk += 1;
      else problems.push(`${r.id} response quote: ${rv.status} p${rv.pageN} (expected p${e.page})`);
    }
    if (r.expected === "answered" && !(r.responseEvidence || []).length) problems.push(`${r.id}: answered without evidence`);
    for (const term of r.absentTerms || []) {
      if (new RegExp(`\\b${term}`).test(rAll)) problems.push(`${r.id}: term "${term}" IS present in the response`);
    }
  }
  return { tenderQuotes: `${tOk}/${key.requirements.length}`, responseQuotes: `${rOk}/${rTotal}`, problems };
}
