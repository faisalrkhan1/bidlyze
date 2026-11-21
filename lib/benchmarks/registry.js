// Real-world benchmarks: an authentic public tender (fetched at run time, see
// sources.js) + a fictional supplier response + a hand-checked answer key.
export const BENCHMARKS = {
  "alton-cctv-2026": {
    source: "alton-cctv-2026",
    dir: "tests/benchmarks/alton-cctv-2026",
    response: "supplier_proposal.pdf",
    key: "answer_key.json",
    // Facts a correct Tender Intelligence report must contain (from the tender text).
    keyDates: {
      submissionDeadline: "2026-08-14",
      contractStart: "2026-11-01",
      operationalBy: "2026-11-01",
      contractEnd: "2029-10-31",
      awardMeeting: "2026-09-09",
    },
    evaluationWeights: { general: 20, commercial: 10, technical: 20, price: 50 },
  },
};
