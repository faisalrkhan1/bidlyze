"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: 0,
    period: "forever",
    analysesLimit: 3,
    features: [
      "3 analyses per month",
      "PDF, DOCX, TXT upload",
      "AI-powered analysis",
      "PDF export",
      "Email notifications",
    ],
  },
  {
    key: "starter",
    name: "Starter",
    price: 49,
    period: "/month",
    analysesLimit: 15,
    features: [
      "15 analyses per month",
      "Everything in Free",
      "Proposal Writer",
      "Amendment Intelligence",
      "Priority processing",
    ],
  },
  {
    key: "professional",
    name: "Professional",
    price: 149,
    period: "/month",
    analysesLimit: 50,
    popular: true,
    features: [
      "50 analyses per month",
      "Everything in Starter",
      "Competitor Intelligence",
      "Pricing Advisor",
      "Risk Radar",
      "Priority support",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: null,
    period: "",
    analysesLimit: null,
    features: [
      "Unlimited analyses",
      "Everything in Professional",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "Team collaboration",
    ],
  },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-300"
      style={{ border: "1px solid var(--border-secondary)", background: "var(--bg-subtle)" }}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-secondary)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-secondary)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  );
}

export default function PricingPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [currentPlan, setCurrentPlan] = useState("free");
  const [usageCount, setUsageCount] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabase();

    // Get current subscription
    supabase
      .from("subscriptions")
      .select("plan, analyses_limit, status")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.status === "active" && data?.plan) {
          setCurrentPlan(data.plan);
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

  async function handleSubscribe(planKey) {
    if (planKey === "free" || planKey === "enterprise") return;
    setLoadingPlan(planKey);

    try {
      const { data: { session } } = await getSupabase().auth.getSession();

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ plan: planKey }),
      });

      const data = await res.json();
      if (data.success && data.url) {
        window.location.assign(data.url);
      } else {
        console.error("Checkout error:", data.error);
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setLoadingPlan(null);
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

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header className="transition-colors duration-300" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-base text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">Bidlyze</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300"
              style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Log Out
            </button>
          </div>
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
              {usageCount} / {currentPlanConfig.analysesLimit ?? "∞"} analyses used this month
            </p>
          )}
        </div>

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
                  background: "var(--bg-subtle)",
                  border: isPopular
                    ? "2px solid #10b981"
                    : isCurrent
                    ? "2px solid var(--border-secondary)"
                    : "1px solid var(--border-primary)",
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
                  {plan.price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                        {plan.period}
                      </span>
                    </div>
                  ) : (
                    <span className="text-2xl font-bold">Custom</span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                {plan.key === "enterprise" ? (
                  <a
                    href="mailto:sales@bidlyze.com"
                    className="w-full py-3 rounded-xl font-semibold text-sm text-center transition-all duration-200"
                    style={{ border: "1px solid var(--border-secondary)", background: "transparent", display: "block" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-input)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Contact Sales
                  </a>
                ) : isCurrent ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl font-semibold text-sm opacity-50 cursor-not-allowed"
                    style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
                  >
                    Current Plan
                  </button>
                ) : plan.key === "free" ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl font-semibold text-sm opacity-50 cursor-not-allowed"
                    style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
                  >
                    {isDowngrade ? "Downgrade" : "Free"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={loadingPlan === plan.key}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 ${
                      isPopular
                        ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                        : ""
                    }`}
                    style={!isPopular ? { border: "1px solid var(--border-secondary)", background: "transparent" } : {}}
                    onMouseEnter={(e) => { if (!isPopular) e.currentTarget.style.background = "var(--bg-input)"; }}
                    onMouseLeave={(e) => { if (!isPopular) e.currentTarget.style.background = "transparent"; }}
                  >
                    {loadingPlan === plan.key ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Redirecting...
                      </span>
                    ) : (
                      isDowngrade ? "Downgrade" : "Subscribe"
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
