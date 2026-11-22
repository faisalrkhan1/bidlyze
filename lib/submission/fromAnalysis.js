// Turns a saved Tender Intelligence analysis into the requirement list that
// Submission Check checks the proposal against.
//
// Compatible with both saved formats:
//  - readiness-v2 analyses: requirements carry a page-cited, code-verified
//    tender quote (citation: {quote, page, fileIndex, fileName, status})
//  - older analyses: requirements have text and a free-text sourceRef only;
//    they are checked the same way but without a tender quote.
// Nothing is written back to the analysis.

export const MAX_CHECK_REQUIREMENTS = 150;

function clean(s, max = 1200) {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * @param {object} analysisData  analyses.analysis_data
 * @returns {{ requirements: object[], total: number, truncated: boolean, cited: number }}
 */
export function requirementsFromAnalysis(analysisData) {
  const list = Array.isArray(analysisData?.requirements) ? analysisData.requirements : [];
  const seen = new Set();
  const all = [];
  list.forEach((r, i) => {
    const text = clean(r?.requirement || r?.description || r?.title);
    if (!text) return;
    let id = clean(r?.id, 40) || `R${i + 1}`;
    while (seen.has(id)) id = `${id}b`;
    seen.add(id);
    const c = r?.citation && typeof r.citation === "object" && r.citation.quote ? r.citation : null;
    all.push({
      id,
      requirement: text,
      category: clean(r?.category, 60),
      mandatory: r?.mandatory !== false,
      priority: clean(r?.priority, 10).toUpperCase(),
      sourceRef: clean(r?.sourceRef || c?.label, 80),
      tenderQuote: c ? clean(c.quote, 600) : "",
      tenderFile: c?.fileIndex ? `F${c.fileIndex}` : "F1",
      tenderFileIndex: Number(c?.fileIndex) || 1,
      tenderFileName: clean(c?.fileName, 200),
      tenderPage: Number.isFinite(Number(c?.page)) && c?.page !== null ? Number(c.page) : null,
      tenderCitationStatus: c ? clean(c.status, 20) || "unverified" : "none",
    });
  });
  return {
    requirements: all.slice(0, MAX_CHECK_REQUIREMENTS),
    total: all.length,
    truncated: all.length > MAX_CHECK_REQUIREMENTS,
    cited: all.filter((r) => r.tenderQuote).length,
  };
}
