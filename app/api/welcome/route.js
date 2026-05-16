import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, buildWelcomeEmail } from "@/lib/email";
import { PLANS } from "@/lib/plans";

/**
 * Idempotently ensure a `subscriptions` row exists for the authenticated user.
 *
 * This is called from the dashboard's first-visit hook (see app/dashboard/page.js)
 * and acts as the application-layer replacement for a Postgres trigger.
 *
 * - When `PAYMENTS_ENABLED !== "true"` (pre-launch) every new user is provisioned
 *   on the `prelaunch` tier with 10 analyses/month.
 * - When `PAYMENTS_ENABLED === "true"` (post-launch) every new user is provisioned
 *   on the `free` tier with 3 analyses/month — the original behaviour.
 *
 * Existing rows are never overwritten: the function checks for a pre-existing
 * row first and bails out, so paying users / pre-launch users are safe across
 * repeated calls or env-var flips.
 */
async function ensureSubscriptionRow(adminClient, userId) {
  const { data: existing, error: selectError } = await adminClient
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    console.error("[welcome] subscription lookup failed:", selectError.message);
    return;
  }
  if (existing) return; // Never downgrade or rewrite existing rows.

  const paymentsLive = process.env.PAYMENTS_ENABLED === "true";
  const planKey = paymentsLive ? "free" : "prelaunch";
  const plan = PLANS[planKey] || PLANS.free;

  const { error: insertError } = await adminClient
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan: planKey,
      analyses_limit: plan.analysesLimit,
      status: "active",
      updated_at: new Date().toISOString(),
    });

  if (insertError && insertError.code !== "23505") {
    // 23505 = unique_violation. A race with another call already inserted
    // the row, which is fine — that's the whole point of idempotency.
    console.error("[welcome] subscription provisioning failed:", insertError.message);
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Provision the default subscription row using the service-role client so
    // RLS does not interfere with the insert. Best-effort: a failure here
    // should not block the welcome email or the dashboard load.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey
      );
      await ensureSubscriptionRow(adminClient, user.id);
    } else {
      console.warn("[welcome] SUPABASE_SERVICE_ROLE_KEY missing — skipping subscription provisioning");
    }

    // Send welcome email (fire and forget — no error returned to client)
    const email = buildWelcomeEmail();
    sendEmail({ to: user.email, subject: email.subject, html: email.html })
      .catch((err) => console.error("Failed to send welcome email:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Welcome API error:", error);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
