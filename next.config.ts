import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The preview-only live self-test (/api/selftest) reads the fictional
  // known-answer tender from disk; make sure Vercel ships those two files.
  outputFileTracingIncludes: {
    "/api/selftest": [
      "./tests/e2e/ECTA_test_tender.pdf",
      "./tests/e2e/ground_truth.json",
      "./tests/e2e/ECTA_test_response.pdf",
      "./tests/e2e/submission_truth.json",
    ],
  },
};

export default nextConfig;
