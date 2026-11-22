import type { NextConfig } from "next";

// Submission Check beta: on in preview deployments and local development,
// off in production unless SUBMISSION_CHECK_BETA=on (needs approval).
// Mirrors lib/submission/beta.js; inlined into the client bundle at build time.
const betaFlag = String(process.env.SUBMISSION_CHECK_BETA || "").toLowerCase();
const submissionCheckBeta =
  betaFlag !== "off" && (process.env.VERCEL_ENV !== "production" || betaFlag === "on");

const ALTON = "./tests/benchmarks/alton-cctv-2026";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUBMISSION_CHECK_BETA: submissionCheckBeta ? "1" : "",
  },
  // Files read from disk at run time by preview-only routes; make sure Vercel ships them.
  outputFileTracingIncludes: {
    "/api/selftest": [
      "./tests/e2e/ECTA_test_tender.pdf",
      "./tests/e2e/ground_truth.json",
      "./tests/e2e/ECTA_test_response.pdf",
      "./tests/e2e/submission_truth.json",
      `${ALTON}/supplier_proposal.pdf`,
      `${ALTON}/answer_key.json`,
      `${ALTON}/runs/*.requirements.json`,
      `${ALTON}/runs/*.expected.json`,
    ],
    "/api/submission-check": [`${ALTON}/runs/ti-run3.requirements.json`, `${ALTON}/runs/demo-recorded-result.json`],
    "/api/submission-check/demo": [`${ALTON}/supplier_proposal.pdf`, `${ALTON}/runs/ti-run3.requirements.json`],
  },
};

export default nextConfig;
