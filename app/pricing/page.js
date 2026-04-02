"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { PLANS, PLAN_DISPLAY } from "@/lib/plans";

const PLAN_CARDS = [
  {
    key: "free",
    features: [
      "3 analyses per month",
      "RFI / RFQ / RFP / Other",
      "Basic summary & requirements",
      "Requirement status tracking",
      "Internal notes",
      "30-day history",
    ],
  },
  {
    key: "pro",
    popular: true,
    features: [
      "25 analyses per month",
      "Everything in Free",
      "Source references & due dates",
      "Owner assignment per requirement",
      "Full compliance matrix",
      "Risk & assumption mapping",
      "Bid / No-Bid scoring",
      "Win probability & competitor intel",
      "Proposal Writer (6 sections)",
      "Tender Package workspace",
      "Bid Comparison",
      "Deadline Tracker",
      "Action items & decisions",
      "Excel export",
      "Unlimited history",
    ],
  },
  {
    key: "team",
    features: [
      "80 analyses per month",
      "Everything in Professional",
      "Internal comments & review",
      "Audit trail",
      "Branded PDF exports",
      "Shared tender library (roadmap)",
      "Team roles & permissions (roadmap)",
    ],
  },
  {
    key: "enterprise",
    features: [
      "Custom analysis volume",
      "Everything in Team",
      "SSO & admin controls (roadmap)",
      "Custom analysis templates",
      "API access (roadmap)",
      "Priority support & SLA",
      "Custom onboarding",
    ],
  },
];

const COMPARISON = [
  {
    category: "Analysis",
    features: [
      { name: "RFI / RFQ / RFP / Other", free: true, pro: true, team: true, enterprise: true },
      { name: "Basic summary & extraction", free: true, pro: true, team: true, enterprise: true },
      { name: "Requirement extraction table", free: true, pro: true, team: true, enterprise: true },
      { name: "Source references per requirement", free: false, pro: true, team: true, enterprise: true },
      { name: "Full compliance matrix", free: false, pro: true, team: true, enterprise: true },
      { name: "Risk & assumption mapping", free: false, pro: true, team: true, enterprise: true },
      { name: "Bid / No-Bid scoring", free: false, pro: true, team: true, enterprise: true },
      { name: "Win probability & competitor intel", free: false, pro: true, team: true, enterprise: true },
      { name: "Pricing Advisor", free: false, pro: true, team: true, enterprise: true },
    ],
  },
  {
    category: "Workflow",
    features: [
      { name: "Requirement status tracking", free: true, pro: true, team: true, enterprise: true },
      { name: "Internal notes", free: true, pro: true, team: true, enterprise: true },
      { name: "Owner assignment", free: false, pro: true, team: true, enterprise: true },
      { name: "Due dates per requirement", free: false, pro: true, team: true, enterprise: true },
      { name: "Action items & decision panel", free: false, pro: true, team: true, enterprise: true },
      { name: "Deadline Tracker", free: false, pro: true, team: true, enterprise: true },
      { name: "Internal review comments", free: false, pro: false, team: true, enterprise: true },
      { name: "Audit trail", free: false, pro: false, team: true, enterprise: true },
    ],
  },
  {
    category: "Advanced Features",
    features: [
      { name: "Proposal Writer (6 sections)", free: false, pro: true, team: true, enterprise: true },
      { name: "Amendment Intelligence", free: false, pro: true, team: true, enterprise: true },
      { name: "Tender Package workspace", free: false, pro: true, team: true, enterprise: true },
      { name: "Bid Comparison", free: false, pro: true, team: true, enterprise: true },
    ],
  },
  {
    category: "Export & History",
    features: [
      { name: "PDF export", free: true, pro: true, team: true, enterprise: true },
      { name: "Excel export", free: false, pro: true, team: true, enterprise: true },
      { name: "Branded exports", free: false, pro: false, team: true, enterprise: true },
      { name: "Analysis history", free: "30 days", pro: "Unlimited", team: "Unlimited", enterprise: "Unlimited" },
    ],
  },
  {
    category: "Team & Enterprise",
    features: [
      { name: "Shared tender library", free: false, pro: false, team: "Roadmap", enterprise: true },
      { name: "Team roles & permissions", free: false, pro: false, team: "Roadmap", enterprise: true },
      { name: "SSO & admin controls", free: false, pro: false, team: false, enterprise: "Roadmap" },
      { name: "API access", free: false, pro: false, team: false, enterprise: "Roadmap" },
      { name: "Priority support & SLA", free: false, pro: false, team: false, enterprise: true },
      { name: "Custom onboarding", free: false, pro: false, team: false, enterprise: true },
    ],
  },
];

function Check() { return <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>; }
function Dash() { return <span className="w-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>—</span>; }
function CellVal({ v }) { if (v === true) return <Check />; if (v === false) return <Dash />; return <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{v}</span>; }

export default function PricingPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [currentPlan, setCurrentPlan] = useState("free");
  const [usageCount, setUsageCount] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    supabase.from("subscriptions").select("plan, status").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.status === "active" && data?.plan) setCurrentPlan(data.plan); });
    const now = new Date();
    supabase.from("analyses").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
      .then(({ count }) => setUsageCount(count ?? 0));
  }, [user]);

  async function handleSubscribe(planKey) {
    if (planKey === "free" || planKey === "enterprise") return;
    setLoadingPlan(planKey);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ plan: planKey }) });
      const data = await res.json();
      if (data.success && data.url) window.location.assign(data.url);
      else setLoadingPlan(null);
    } catch { setLoadingPlan(null); }
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>;

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Pricing" }]}>
      <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Plans & Pricing</h1>
          <p className="text-base max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            One platform for RFI, RFQ, RFP, and tender intelligence. Scale from discovery to full team operations.
          </p>
          {usageCount !== null && (
            <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
              Current plan: <strong style={{ color: "var(--text-primary)" }}>{PLAN_DISPLAY[currentPlan] || "Free"}</strong> &middot; {usageCount} analyses this month
            </p>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {PLAN_CARDS.map((card) => {
            const plan = PLANS[card.key];
            const isCurrent = card.key === currentPlan;
            const isPopular = card.popular;

            return (
              <div key={card.key} className="relative rounded-2xl p-5 flex flex-col" style={{ background: "var(--bg-subtle)", border: isPopular ? "2px solid #10b981" : "1px solid var(--border-primary)" }}>
                {isPopular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white">Recommended</span>}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {isCurrent && <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>Current</span>}
                  </div>
                </div>

                <div className="mb-5">
                  {plan.price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{plan.period}</span>
                    </div>
                  ) : (
                    <div><span className="text-2xl font-bold">Custom</span><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Tailored to your organization</p></div>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {card.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {card.key === "enterprise" ? (
                  <a href="mailto:sales@bidlyze.com" className="w-full py-2.5 rounded-xl font-semibold text-sm text-center block transition-colors" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>Contact Sales</a>
                ) : isCurrent ? (
                  <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm opacity-40 cursor-not-allowed" style={{ border: "1px solid var(--border-secondary)" }}>Current Plan</button>
                ) : card.key === "free" ? (
                  <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm opacity-40 cursor-not-allowed" style={{ border: "1px solid var(--border-secondary)" }}>Free</button>
                ) : (
                  <button onClick={() => handleSubscribe(card.key)} disabled={loadingPlan === card.key} className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 ${isPopular ? "bg-emerald-500 hover:bg-emerald-400 text-white" : ""}`} style={!isPopular ? { border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" } : {}}>
                    {loadingPlan === card.key ? "Redirecting..." : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <h2 className="text-xl font-bold tracking-tight mb-6 text-center">Feature Comparison</h2>
        <div className="rounded-2xl overflow-hidden mb-8" style={{ border: "1px solid var(--border-primary)" }}>
          <div className="grid grid-cols-12 gap-1 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
            <div className="col-span-4">Feature</div>
            <div className="col-span-2 text-center">Free</div>
            <div className="col-span-2 text-center text-emerald-500">Pro</div>
            <div className="col-span-2 text-center">Team</div>
            <div className="col-span-2 text-center">Enterprise</div>
          </div>
          {COMPARISON.map((section) => (
            <div key={section.category}>
              <div className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>{section.category}</div>
              {section.features.map((f) => (
                <div key={f.name} className="grid grid-cols-12 gap-1 px-5 py-2.5 items-center text-sm" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <div className="col-span-4" style={{ color: "var(--text-secondary)" }}>{f.name}</div>
                  <div className="col-span-2 flex justify-center"><CellVal v={f.free} /></div>
                  <div className="col-span-2 flex justify-center"><CellVal v={f.pro} /></div>
                  <div className="col-span-2 flex justify-center"><CellVal v={f.team} /></div>
                  <div className="col-span-2 flex justify-center"><CellVal v={f.enterprise} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>All plans include RFI, RFQ, RFP, and tender support. <a href="mailto:sales@bidlyze.com" className="text-emerald-500">Contact sales</a> for custom pricing.</p>
        </div>
      </div>
    </AppShell>
  );
}
