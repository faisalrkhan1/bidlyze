import { NextResponse } from "next/server";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import { errJson, userFromRequest, getQuota } from "@/lib/submission/http";

// The signed-in user's beta status and usage this month (Account page).
export async function GET(request) {
  if (!submissionCheckBetaEnabled()) return errJson(404, "Not found");
  const { user } = await userFromRequest(request);
  if (!user) return errJson(401, "Your session has expired. Sign in again.");
  const quota = await getQuota();
  const usage = await quota.usage(user);
  return NextResponse.json({ success: true, ...usage, environment: process.env.VERCEL_ENV || "development" });
}
