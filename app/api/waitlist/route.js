import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_PLANS = new Set(["pro", "team"]);
// Pragmatic email pattern — matches the standard <local>@<domain>.<tld> shape.
// Catches obvious garbage; the actual deliverability check happens when we
// email the waitlist.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function err(status, message) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "Invalid JSON body");
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const plan = typeof body?.plan === "string" ? body.plan.trim().toLowerCase() : "";

  if (!email) return err(400, "Email is required");
  if (!EMAIL_REGEX.test(email)) return err(400, "Email format is invalid");
  if (!VALID_PLANS.has(plan)) return err(400, "Plan must be 'pro' or 'team'");

  // If the request carries a Supabase bearer token, capture user_id for
  // de-anonymising the waitlist; missing/invalid tokens just fall through to
  // an anonymous waitlist entry.
  let userId = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data } = await userClient.auth.getUser(token);
      if (data?.user?.id) userId = data.user.id;
    } catch {
      // Ignore — anonymous insert is acceptable.
    }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("[waitlist] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return err(500, "Waitlist is temporarily unavailable. Please try again later.");
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey
  );

  const { error: insertError } = await adminClient
    .from("waitlist")
    .insert({
      email,
      plan,
      user_id: userId,
      source: "pricing_page",
    });

  if (insertError) {
    // 23505 = unique_violation — treat duplicate (email, plan) as success.
    if (insertError.code === "23505") {
      return NextResponse.json({ success: true, alreadyOnList: true });
    }
    console.error("[waitlist] insert failed:", insertError.message);
    return err(500, "Could not save your spot. Please try again in a moment.");
  }

  return NextResponse.json({ success: true, alreadyOnList: false });
}
