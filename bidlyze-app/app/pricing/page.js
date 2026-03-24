"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import UserMenu from "@/app/components/UserMenu";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: 0,
    period: "forever",
    analysesLimit: 3,
    cta: "Start Free",
    features: [
      "3 tender analyses per month",
      "Single document upload",
      "AI summary & bid score",
      "Basic compliance checklist",
      "PDF report export",
      "No signup required",
    ],
  },
  {
    key: "starter",
    name: "Starter",
    price: 29,
    period: "/month",
    priceId: "price_1TDLd7JbZq5ga8LYLedS8Xsb",
    analysesLimit: 10,
    cta: "Get Started",
    features: [
      "10 analyses per month",
      "5 documents per analysis",
      "Full risk & compliance analysis",
      "PDF + Excel export",
      "Full analysis history",
      "Email support",
    ],
  },
  {
    key: "professional",
    name: "Professional",
    price: 99,
    period: "/month",
    priceId: "price_1TDLdkJbZq5ga8LY1wnyYxAC",
    analysesLimit: 50,
    popular: true,
    cta: "Start Free Trial",
    features: [
      "50 analyses per month",
      "20 documents per analysis",
      "Everything in Starter",
      { text: "Multi-document intelligence", comingSoon: true },
      { text: "Scope decomposition", comingSoon: true },
      { text: "Proposal structure generator", comingSoon: true },
      { text: "Word template export", comingSoon: true },
      { text: "Up to 10 users", comingSoon: true },
      "Priority support",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 299,
    period: "/month",
    priceId: "price_1TDLeWJbZq5ga8LYsAOgqoQ1",
    analysesLimit: null,
    cta: "Contact Sales",
    ctaHref: "mailto:hello@bidlyze.com",
    features: [
      "Unlimited analyses",
      "Unlimited documents",
      "Everything in Professional",
      { text: "API access", comingSoon: true },
      { text: "Unlimited users", comingSoon: true },
      "Dedicated account manager",
      { text: "Custom integrations", comingSoon: true },
    ],
  },
];

export default function PricingPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [currentPlan, setCurrentPlan] = useState("free");
  const [usageCount, setUsageCount] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabase();

    // Get current subscription — use limit(1) instead of single() for resilience
    supabase
      .from("subscriptions")
      .select("plan, analyses_limit, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.error("Subscription query error:", error.message);
          return;
        }
        const sub = data?.[0];
        if (sub?.plan) {
          setCurrentPlan(sub.plan);
        }
      });

    // Get monthly usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth)
      .then(({ count }) => setUsageCount(count ?? 0));
  }, [user]);

  async function handleSubscribe(priceId) {
    if (!priceId) return;
    setError(null);
    setLoadingPlan(priceId);

    try {
      const { data: { session } } = await getSupabase().auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else if (data.success && data.upgraded) {
        // Plan changed via subscription update (no redirect needed)
        router.push("/dashboard?success=true");
      } else {
        setError(data.error || "Failed to start checkout. Please try again.");
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Network error. Please check your connection and try again.");
      setLoadingPlan(null);
    }
  }

  async function handleManageSubscription() {
    setLoadingPortal(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        console.error("Portal error:", data.error);
      }
    } catch (err) {
      console.error("Portal error:", err);
    } finally {
      setLoadingPortal(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const currentPlanConfig = PLANS.find((p) => p.key === currentPlan);
  const isPaidPlan = currentPlan !== "free";

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header className="transition-colors duration-300" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <span className="text-xl font-bold tracking-tight"><span className="text-emerald-500">Bid</span>lyze</span>
          </div>
          <UserMenu user={user} onLogout={logout} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Back */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm font-medium mb-8 transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </button>

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Choose Your <span className="text-emerald-500">Plan</span>
          </h1>
          <p className="text-base max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Scale your tender analysis capability with the right plan for your team.
          </p>
          {usageCount !== null && currentPlanConfig && (
            <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
              Current plan: <strong style={{ color: "var(--text-primary)" }}>{currentPlanConfig.name}</strong>
              {" "}&middot;{" "}
              {usageCount} / {currentPlanConfig.analysesLimit ?? "\u221E"} analyses used this month
            </p>
          )}
          {isPaidPlan && (
            <button
              onClick={handleManageSubscription}
              disabled={loadingPortal}
              className="mt-4 px-5 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {loadingPortal ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                  </svg>
                  Manage Subscription
                </>
              )}
            </button>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div
            className="mb-6 p-4 rounded-xl text-sm flex items-center justify-between"
            style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171" }}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 font-bold hover:opacity-70">&times;</button>
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const isPopular = plan.popular;
            const isDowngrade = PLANS.findIndex(p => p.key === currentPlan) > PLANS.findIndex(p => p.key === plan.key);

            return (
              <div
                key={plan.key}
                className="relative rounded-2xl p-6 flex flex-col transition-colors duration-300"
                style={{
                  background: isPopular ? "rgba(16, 185, 129, 0.04)" : "var(--bg-subtle)",
                  border: isPopular
                    ? "2px solid #10b981"
                    : isCurrent
                    ? "2px solid var(--border-secondary)"
                    : "1px solid var(--border-primary)",
                  boxShadow: isPopular ? "0 8px 32px rgba(16, 185, 129, 0.12)" : undefined,
                }}
              >
                {/* Badges */}
                <div className="flex items-center gap-2 mb-4">
                  {isPopular && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500 text-white">
                      Popular
                    </span>
                  )}
                  {isCurrent && (
                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-semibold"
                      style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" }}
                    >
                      Current Plan
                    </span>
                  )}
                </div>

                {/* Plan Name */}
                <h3 className="text-lg font-bold mb-2">{plan.name}</h3>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3.5 mb-8 flex-1">
                  {plan.features.map((feature, i) => {
                    const text = typeof feature === "string" ? feature : feature.text;
                    const comingSoon = typeof feature === "object" && feature.comingSoon;
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {text}
                          {comingSoon && (
                            <span
                              className="inline-block px-1.5 py-px rounded-full italic leading-none"
                              style={{ fontSize: "9px", background: "#f3f4f6", color: "#9ca3af" }}
                            >
                              soon
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* CTA Button */}
                {(() => {
                  // Determine contextual label for paid plan buttons
                  const isUpgrade = !isCurrent && !isDowngrade && plan.key !== "free";
                  const ctaLabel = isCurrent
                    ? "Current Plan"
                    : isPaidPlan && isUpgrade
                    ? "Upgrade"
                    : isPaidPlan && isDowngrade && plan.key !== "free"
                    ? "Downgrade"
                    : plan.cta;

                  if (isCurrent) {
                    return (
                      <button
                        disabled
                        className="w-full py-3 rounded-xl font-semibold text-sm opacity-50 cursor-not-allowed"
                        style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
                      >
                        Current Plan
                      </button>
                    );
                  }
                  if (plan.ctaHref) {
                    return (
                      <a
                        href={plan.ctaHref}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 block text-center"
                        style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-input)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        {isPaidPlan ? ctaLabel : plan.cta}
                      </a>
                    );
                  }
                  if (plan.key === "free") {
                    return (
                      <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                        style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-input)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        {plan.cta}
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={() => handleSubscribe(plan.priceId)}
                      disabled={loadingPlan === plan.priceId}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 ${
                        isPopular
                          ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                          : ""
                      }`}
                      style={!isPopular ? { border: "1px solid var(--border-secondary)", background: "transparent" } : {}}
                      onMouseEnter={(e) => { if (!isPopular) e.currentTarget.style.background = "var(--bg-input)"; }}
                      onMouseLeave={(e) => { if (!isPopular) e.currentTarget.style.background = "transparent"; }}
                    >
                      {loadingPlan === plan.priceId ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {isPaidPlan ? "Switching..." : "Redirecting..."}
                        </span>
                      ) : (
                        ctaLabel
                      )}
                    </button>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
