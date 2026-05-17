"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { LogoMark } from "@/app/components/Logo";
import { PLANS, PLAN_DISPLAY } from "@/lib/plans";
import { getUpgradeButtonLabel } from "@/lib/upgradeCopy";
import WaitlistModal from "@/app/components/WaitlistModal";

const PAYMENTS_LIVE = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

const PLAN_CARDS = [
  {
    key: "free",
    tagline: "Explore the platform",
    features: [
      `${PLANS.free.analysesLimit} analyses per month`,
      "RFI / RFQ / RFP / Other",
      "AI summary & requirement extraction",
      "Basic requirement status tracking",
      "Internal notes",
      "PDF export",
      `${PLANS.free.historyDays}-day history`,
    ],
  },
  {
    key: "pro",
    popular: true,
    tagline: "For bid professionals",
    features: [
      `${PLANS.pro.analysesLimit} analyses per month`,
      "Everything in Free, plus:",
      "Source page references per requirement",
      "Full compliance matrix",
      "Risk & gap analysis",
      "Owner assignment & due dates",
      "Excel requirement export",
      "Proposal Writer",
      "Tender package workspace",
      "Deadline tracker",
      "Unlimited history",
    ],
  },
  {
    key: "team",
    // Early-access tier — $99/mo today, $149/mo after the early-access period.
    earlyAccess: true,
    tagline: "Collaborate on bids",
    features: [
      `${PLANS.team.analysesLimit} analyses per month`,
      "Everything in Professional, plus:",
      "Team workspace",
      "Internal review comments",
      "Shared tender library",
      "Audit trail",
      "Priority support",
      "Team roles & permissions",
    ],
  },
  {
    key: "enterprise",
    tagline: "For large organizations",
    features: [
      "Custom analysis volume",
      "Everything in Team, plus:",
      "SSO & admin controls",
      "Custom analysis templates",
      "API access",
      "Priority support & SLA",
      "Custom onboarding",
    ],
  },
];

const COMPARISON = [
  {
    category: "Document Analysis",
    features: [
      { name: "RFI / RFQ / RFP / Other document types", free: true, pro: true, team: true, enterprise: true },
      { name: "AI-powered summary & classification", free: true, pro: true, team: true, enterprise: true },
      { name: "Requirement extraction table", free: true, pro: true, team: true, enterprise: true },
      { name: "Source page references per requirement", free: false, pro: true, team: true, enterprise: true },
      { name: "Full compliance matrix", free: false, pro: true, team: true, enterprise: true },
      { name: "Risk & gap analysis", free: false, pro: true, team: true, enterprise: true },
    ],
  },
  {
    category: "Workflow & Tracking",
    features: [
      { name: "Requirement status tracking", free: true, pro: true, team: true, enterprise: true },
      { name: "Internal notes", free: true, pro: true, team: true, enterprise: true },
      { name: "Owner assignment per requirement", free: false, pro: true, team: true, enterprise: true },
      { name: "Due dates per requirement", free: false, pro: true, team: true, enterprise: true },
      { name: "Deadline tracker", free: false, pro: true, team: true, enterprise: true },
      { name: "Internal review comments", free: false, pro: false, team: true, enterprise: true },
      { name: "Audit trail", free: false, pro: false, team: true, enterprise: true },
    ],
  },
  {
    category: "Advanced Tools",
    features: [
      { name: "Proposal Writer", free: false, pro: true, team: true, enterprise: true },
      { name: "Tender package workspace", free: false, pro: true, team: true, enterprise: true },
    ],
  },
  {
    category: "Export & History",
    features: [
      { name: "PDF export", free: true, pro: true, team: true, enterprise: true },
      { name: "Excel requirement export", free: false, pro: true, team: true, enterprise: true },
      { name: "Tender history", free: `${PLANS.free.historyDays} days`, pro: "Unlimited", team: "Unlimited", enterprise: "Unlimited" },
    ],
  },
  {
    category: "Team & Enterprise",
    features: [
      { name: "Team workspace", free: false, pro: false, team: true, enterprise: true },
      { name: "Shared tender library", free: false, pro: false, team: true, enterprise: true },
      { name: "Team roles & permissions", free: false, pro: false, team: true, enterprise: true },
      { name: "Priority support", free: false, pro: false, team: true, enterprise: true },
      { name: "SSO & admin controls", free: false, pro: false, team: false, enterprise: true },
      { name: "API access", free: false, pro: false, team: false, enterprise: true },
      { name: "Custom analysis templates", free: false, pro: false, team: false, enterprise: true },
      { name: "Priority SLA", free: false, pro: false, team: false, enterprise: true },
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
  const [waitlistPlan, setWaitlistPlan] = useState(null); // "pro" | "team" | null

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
    // Pre-launch: short-circuit to the waitlist modal instead of Stripe.
    if (!PAYMENTS_LIVE) {
      setWaitlistPlan(planKey);
      return;
    }
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

  const pricingContent = (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
      {/* Pre-launch banner — hidden once NEXT_PUBLIC_PAYMENTS_ENABLED=true */}
      {!PAYMENTS_LIVE && (
        <div className="mb-8 rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent-text)" }}>
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm leading-relaxed">
            Bidlyze is in pre-launch. Every signed-up user gets Pro features with 10 analyses/month — free. Pro and Team plans open soon with full limits. Join the waitlist for early-bird pricing.
          </p>
        </div>
      )}

      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Plans & Pricing</h1>
        <p className="text-base max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
          From document upload to structured bid intelligence. Pick the plan that fits your workflow.
        </p>
        {user && usageCount !== null && (
          <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
            Current plan: <strong style={{ color: "var(--text-primary)" }}>{PLAN_DISPLAY[currentPlan] || "Free"}</strong> &middot; {usageCount} analyses this month
          </p>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
        {PLAN_CARDS.map((card) => {
          const plan = PLANS[card.key];
          const isCurrent = user && card.key === currentPlan;
          const isPopular = card.popular;

          return (
            <div key={card.key} className="relative rounded-2xl p-5 flex flex-col" style={{ background: "var(--bg-subtle)", border: isPopular ? "2px solid #10b981" : card.earlyAccess ? "1px solid rgba(245, 158, 11, 0.45)" : "1px solid var(--border-primary)" }}>
              {isPopular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white">Recommended</span>}
              {card.earlyAccess && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white">Early Access</span>}

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  {isCurrent && <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>Current</span>}
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{card.tagline}</p>
              </div>

              <div className="mb-5">
                {plan.price !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{plan.period}</span>
                    </div>
                    {plan.regularPrice && (
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        ${plan.regularPrice}{plan.period} after early-access period
                      </p>
                    )}
                    {card.earlyAccess && (
                      <p className="text-[10px] mt-1 leading-snug" style={{ color: "rgb(217 119 6 / 0.85)" }}>
                        Early Access: Team workspace, shared library, and roles ship during the early-access period. Comments and audit trail are available today.
                      </p>
                    )}
                  </>
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
                <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm opacity-40 cursor-not-allowed" style={{ border: "1px solid var(--border-secondary)" }}>Your Current Plan</button>
              ) : !user ? (
                <Link href="/login?tab=signup" className={`w-full py-2.5 rounded-xl font-semibold text-sm text-center block transition-colors ${isPopular ? "bg-emerald-500 hover:bg-emerald-400 text-white" : ""}`} style={!isPopular ? { border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" } : {}}>
                  {card.key === "free" ? "Get Started" : "Start Free"}
                </Link>
              ) : card.key === "free" ? (
                <>
                  <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm opacity-40 cursor-not-allowed" style={{ border: "1px solid var(--border-secondary)" }}>Free</button>
                  {!PAYMENTS_LIVE && (
                    <p className="text-[11px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
                      Available during pre-launch
                    </p>
                  )}
                </>
              ) : (
                <button onClick={() => handleSubscribe(card.key)} disabled={loadingPlan === card.key} className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${isPopular ? "bg-emerald-500 hover:bg-emerald-400 text-white" : ""}`} style={!isPopular ? { border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" } : {}}>
                  {loadingPlan === card.key
                    ? "Redirecting..."
                    : PAYMENTS_LIVE
                      ? "Upgrade"
                      : getUpgradeButtonLabel(card.key)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <h2 className="text-xl font-bold tracking-tight mb-6 text-center">Feature Comparison</h2>
      <div className="rounded-2xl overflow-hidden mb-8" style={{ border: "1px solid var(--border-primary)" }}>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
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
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>All plans include RFI, RFQ, RFP, and tender support. <a href="mailto:sales@bidlyze.com" className="text-emerald-500">Contact sales</a> for custom pricing.</p>
      </div>
    </div>
  );

  const waitlistModal = waitlistPlan ? (
    <WaitlistModal
      plan={waitlistPlan}
      defaultEmail={user?.email || ""}
      onClose={() => setWaitlistPlan(null)}
    />
  ) : null;

  // Authenticated: render inside app shell
  if (user) {
    return (
      <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Pricing" }]}>
        {pricingContent}
        {waitlistModal}
      </AppShell>
    );
  }

  // Public: render with public header/footer
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header className="sticky top-0 z-50 backdrop-blur-md" style={{ background: "var(--bg-primary-translucent)", borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-base font-semibold tracking-tight">Bidlyze</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}>
              Sign In
            </Link>
            <Link href="/login?tab=signup" className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
              Start Free
            </Link>
          </div>
        </div>
      </header>
      {pricingContent}
      {waitlistModal}
      <footer style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            &copy; {new Date().getFullYear()} Bidlyze. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs" style={{ color: "var(--text-muted)" }}>
            <Link href="/terms" className="hover:text-emerald-500 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-emerald-500 transition-colors">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-emerald-500 transition-colors">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
