import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, getPlanByPriceId, PLAN_LIMITS } from "@/lib/stripe";

export const maxDuration = 300;

export async function POST(request) {
  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  console.log("[Stripe Webhook] Received event:", event.type);

  // Use service role key for admin operations (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        console.log("[Stripe Webhook] checkout.session.completed:", {
          sessionId: session.id,
          userId,
          plan,
          customer: session.customer,
          subscription: session.subscription,
        });

        if (!userId || !plan) {
          console.error(
            "[Stripe Webhook] SKIPPED — missing metadata. user_id:",
            userId,
            "plan:",
            plan,
            "Full metadata:",
            JSON.stringify(session.metadata)
          );
          break;
        }

        // Extract subscription ID (can be string or expanded object)
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!subscriptionId) {
          console.error(
            "[Stripe Webhook] SKIPPED — no subscription ID on session"
          );
          break;
        }

        // Extract customer ID (can be string or expanded object)
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null;

        // Retrieve the full subscription to get current_period_end
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        // PLAN_LIMITS: free=3, starter=10, professional=50, enterprise=null
        const analysesLimit = PLAN_LIMITS[plan] !== undefined ? PLAN_LIMITS[plan] : 3;

        let periodEnd = null;
        if (subscription.current_period_end) {
          periodEnd = new Date(
            subscription.current_period_end * 1000
          ).toISOString();
        }

        const rowData = {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          analyses_limit: analysesLimit,
          status: "active",
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        };

        // Check if a subscription row already exists for this user
        const { data: existing } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        let dbError;
        if (existing) {
          // Update existing row
          console.log("[Stripe Webhook] Updating existing subscription for user:", userId);
          const { error } = await supabase
            .from("subscriptions")
            .update(rowData)
            .eq("user_id", userId);
          dbError = error;
        } else {
          // Insert new row
          console.log("[Stripe Webhook] Inserting new subscription for user:", userId);
          const { error } = await supabase
            .from("subscriptions")
            .insert({ user_id: userId, ...rowData });
          dbError = error;
        }

        if (dbError) {
          console.error(
            "[Stripe Webhook] DATABASE ERROR:",
            dbError.message,
            "| Code:",
            dbError.code,
            "| Details:",
            dbError.details
          );
          return NextResponse.json(
            { error: "Database write failed: " + dbError.message },
            { status: 500 }
          );
        }

        console.log("[Stripe Webhook] SUCCESS — subscription saved for user:", userId, "plan:", plan);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = getPlanByPriceId(priceId);

        console.log("[Stripe Webhook] customer.subscription.updated:", {
          subscriptionId: subscription.id,
          priceId,
          plan,
          status: subscription.status,
        });

        if (!plan) {
          console.log("[Stripe Webhook] SKIPPED — unknown priceId:", priceId);
          break;
        }

        const analysesLimit = PLAN_LIMITS[plan] !== undefined ? PLAN_LIMITS[plan] : 3;

        let periodEnd = null;
        if (subscription.current_period_end) {
          periodEnd = new Date(
            subscription.current_period_end * 1000
          ).toISOString();
        }

        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            plan,
            analyses_limit: analysesLimit,
            status:
              subscription.status === "active"
                ? "active"
                : subscription.status,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (updateError) {
          console.error(
            "[Stripe Webhook] DATABASE ERROR on subscription.updated:",
            updateError.message
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log("[Stripe Webhook] customer.subscription.deleted:", subscription.id);

        const { error: deleteError } = await supabase
          .from("subscriptions")
          .update({
            plan: "free",
            analyses_limit: 3,
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (deleteError) {
          console.error(
            "[Stripe Webhook] DATABASE ERROR on subscription.deleted:",
            deleteError.message
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        console.log("[Stripe Webhook] invoice.payment_failed:", customerId);

        if (customerId) {
          const { error: failError } = await supabase
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);

          if (failError) {
            console.error(
              "[Stripe Webhook] DATABASE ERROR on payment_failed:",
              failError.message
            );
          }
        }
        break;
      }

      default:
        console.log("[Stripe Webhook] Unhandled event type:", event.type);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] UNHANDLED ERROR:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}
