import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

export async function POST(request) {
  try {
    // Pre-launch gate. Bidlyze is not yet able to accept payments while the
    // legal entity is being registered. Setting PAYMENTS_ENABLED=true on the
    // server restores the normal Stripe flow with no other code change.
    if (process.env.PAYMENTS_ENABLED !== "true") {
      return NextResponse.json(
        {
          success: false,
          error: "Payments are not yet enabled. Please join the waitlist.",
        },
        { status: 403 }
      );
    }

    // Authenticate user
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { plan } = await request.json();

    const priceIds = {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      team: process.env.STRIPE_TEAM_PRICE_ID,
    };

    const priceId = priceIds[plan];
    if (!priceId) {
      return NextResponse.json(
        { success: false, error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bidlyze.com";

    // Check if user already has a Stripe customer ID
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerOptions = {};
    if (existingSub?.stripe_customer_id) {
      customerOptions = { customer: existingSub.stripe_customer_id };
    } else {
      customerOptions = {
        customer_email: user.email,
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...customerOptions,
      metadata: {
        user_id: user.id,
        plan,
      },
      success_url: `${appUrl}/dashboard?payment=success`,
      cancel_url: `${appUrl}/pricing`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
