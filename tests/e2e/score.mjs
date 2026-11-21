// Score a Bidlyze analysis of the known-answer test tender (ECTA_test_tender.pdf).
//
// Usage (after running the test tender through the app):
//   node tests/e2e/score.mjs result.json
// where result.json is { "analysis_data": <analyses.analysis_data>,
//                        "disqualification": <disqualification_analyses row> }

import { readFileSync } from "node:fs";
import { score } from "../../lib/readiness/benchmark.js";

export { score };

if (process.argv[2]) {
  const truth = JSON.parse(readFileSync(new URL("./ground_truth.json", import.meta.url)));
  const r = JSON.parse(readFileSync(process.argv[2], "utf8"));
  console.log(JSON.stringify(score(truth, r.analysis_data, r.disqualification), null, 2));
}
