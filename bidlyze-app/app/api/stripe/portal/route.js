import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

export const maxDuration = 300;

export async function POST(request) {
  try {
    // Authenticate user
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    if (!token || token === "undefined" || token === "null") {
      return NextResponse.json(
        { success: false, error: "Unauthorized — invalid token" },
        { status: 401 }
      );
    }

    // Use service role key for all server-side Supabase operations.
    // NEXT_PUBLIC_ env vars are inlined into client bundles by Turbopack
    // but may not be available in process.env for server-side Route Handlers.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized — session expired. Please log in again." },
        { status: 401 }
      );
    }

    // Use limit(1) instead of single() for resilience
    const { data: subRows, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (subError) {
      console.error("[Portal] Subscription query error:", subError.message);
      return NextResponse.json(
        { success: false, error: "Failed to look up subscription" },
        { status: 500 }
      );
    }

    const customerId = subRows?.[0]?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "No active subscription found. Subscribe to a plan first." },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    const origin = request.headers.get("origin") || request.headers.get("referer")?.replace(/\/[^/]*$/, "") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ success: true, url: portalSession.url });
  } catch (error) {
    console.error("[Portal] Error:", error?.message || error);
    const message = error?.message || "Unknown error creating portal session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
