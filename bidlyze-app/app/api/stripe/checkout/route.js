import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, getPlanByPriceId, PRICE_IDS, PLAN_LIMITS } from "@/lib/stripe";

const validPriceIds = new Set(Object.values(PRICE_IDS));

export async function POST(request) {
  try {
    // Authenticate user
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized — no token provided" },
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

    // Use service role key for server-side operations.
    // NEXT_PUBLIC_ env vars may not be in process.env for Route Handlers.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized — session expired. Please log in again.",
        },
        { status: 401 }
      );
    }

    const { priceId } = await request.json();

    if (!priceId || !validPriceIds.has(priceId)) {
      return NextResponse.json(
        { success: false, error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    const plan = getPlanByPriceId(priceId);
    const stripe = getStripe();

    // Derive base URL from the request origin so it works in local dev and production
    const origin = request.headers.get("origin") || request.headers.get("referer")?.replace(/\/[^/]*$/, "") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Check if user already has a subscription row (use maybeSingle to avoid
    // throwing when the user has no subscription row yet — e.g. free users)
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Upgrade / downgrade: update the existing Stripe subscription in place ──
    if (existingSub?.stripe_subscription_id && existingSub.status === "active") {
      const currentSub = await stripe.subscriptions.retrieve(
        existingSub.stripe_subscription_id
      );

      if (currentSub.status === "active" || currentSub.status === "trialing") {
        const updatedSub = await stripe.subscriptions.update(
          existingSub.stripe_subscription_id,
          {
            items: [
              {
                id: currentSub.items.data[0].id,
                price: priceId,
              },
            ],
            metadata: { user_id: user.id, plan: plan || "unknown" },
            proration_behavior: "create_prorations",
          }
        );

        // Write the new plan to the database immediately so the UI
        // reflects the change without waiting for the webhook.
        const periodEnd = updatedSub.current_period_end
          ? new Date(updatedSub.current_period_end * 1000).toISOString()
          : null;

        await supabase
          .from("subscriptions")
          .update({
            plan,
            analyses_limit:
              PLAN_LIMITS[plan] !== undefined ? PLAN_LIMITS[plan] : 3,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        return NextResponse.json({ success: true, upgraded: true });
      }
    }

    // ── New subscription: send the user through Stripe Checkout ──
    let customerOptions = {};
    if (existingSub?.stripe_customer_id) {
      customerOptions = { customer: existingSub.stripe_customer_id };
    } else {
      customerOptions = { customer_email: user.email };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...customerOptions,
      metadata: {
        user_id: user.id,
        plan: plan || "unknown",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: plan || "unknown",
        },
      },
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/pricing`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);

    // Surface the actual error message for debugging
    const message =
      error?.message || error?.raw?.message || "Unknown error creating checkout session";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
