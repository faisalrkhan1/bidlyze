// Submission Check beta: where it is switched on.
//
// On by default in Vercel PREVIEW deployments and local development only.
// In production it stays off unless SUBMISSION_CHECK_BETA=on is set there
// (that needs Faisal's approval). SUBMISSION_CHECK_BETA=off turns it off anywhere.
export function submissionCheckBetaEnabled(env = process.env) {
  const flag = String(env.SUBMISSION_CHECK_BETA || "").toLowerCase();
  if (flag === "off") return false;
  if (env.VERCEL_ENV === "production") return flag === "on";
  return true;
}

/** Client-side check: next.config.ts inlines this at build time. */
export function submissionCheckBetaClient() {
  return process.env.NEXT_PUBLIC_SUBMISSION_CHECK_BETA === "1";
}
