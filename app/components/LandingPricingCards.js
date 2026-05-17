"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { paymentsEnabled, getUpgradeButtonLabel } from "@/lib/upgradeCopy";
import WaitlistModal from "@/app/components/WaitlistModal";

/**
 * Pricing grid for the public landing page.
 *
 * Behaviour:
 *   - When NEXT_PUBLIC_PAYMENTS_ENABLED !== "true" (pre-launch): Pro and Team
 *     buttons open the waitlist modal; Free shows an "Available after pre-launch"
 *     caption; Enterprise keeps mailto:sales.
 *   - When NEXT_PUBLIC_PAYMENTS_ENABLED === "true": original signup-funnel
 *     behaviour — every non-enterprise CTA links to /login?tab=signup with the
 *     original CTA copy ("Get Started" / "Upgrade").
 *
 * No auth in this component — visitors are typically logged-out, so the modal
 * email field is empty (the modal still works fine for anonymous waitlist entries).
 */

const CARDS = [
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
    cta: "Get Started",
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
    cta: "Upgrade",
  },
  {
    key: "team",
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
    cta: "Upgrade",
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
    cta: "Contact Sales",
  },
];

export default function LandingPricingCards() {
  const [waitlistPlan, setWaitlistPlan] = useState(null); // "pro" | "team" | null
  const live = paymentsEnabled();

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {CARDS.map((card) => {
          const plan = PLANS[card.key];
          const isWaitlistTier = card.key === "pro" || card.key === "team";
          const ctaCopy = !live && isWaitlistTier ? getUpgradeButtonLabel(card.key) : card.cta;

          return (
            <div
              key={card.key}
              className="relative p-6 rounded-2xl flex flex-col"
              style={{
                background: "var(--bg-subtle)",
                border: card.popular
                  ? "2px solid #10b981"
                  : card.earlyAccess
                    ? "1px solid rgba(245, 158, 11, 0.45)"
                    : "1px solid var(--border-primary)",
              }}
            >
              {card.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white">
                  Recommended
                </span>
              )}
              {card.earlyAccess && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white">
                  Early Access
                </span>
              )}
              <div className="mb-1">
                <h3 className="font-bold">{plan.name}</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{card.tagline}</p>
              </div>
              <div className="mb-5 mt-3">
                {plan.price !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{plan.period}</span>
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
                  <span className="text-2xl font-bold">Custom</span>
                )}
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {card.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA — three branches: enterprise (mailto), pre-launch Pro/Team (waitlist modal), default (signup funnel) */}
              {card.key === "enterprise" ? (
                <Link
                  href="mailto:sales@bidlyze.com"
                  className="w-full py-3 rounded-xl text-sm font-semibold text-center transition-colors block"
                  style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}
                >
                  {ctaCopy}
                </Link>
              ) : !live && isWaitlistTier ? (
                <button
                  type="button"
                  onClick={() => setWaitlistPlan(card.key)}
                  className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-colors block ${
                    card.popular ? "bg-emerald-500 hover:bg-emerald-400 text-white" : ""
                  }`}
                  style={!card.popular ? { border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" } : {}}
                >
                  {ctaCopy}
                </button>
              ) : (
                <Link
                  href="/login?tab=signup"
                  className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-colors block ${
                    card.popular ? "bg-emerald-500 hover:bg-emerald-400 text-white" : ""
                  }`}
                  style={!card.popular ? { border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" } : {}}
                >
                  {ctaCopy}
                </Link>
              )}

              {/* Free-card pre-launch caption */}
              {!live && card.key === "free" && (
                <p className="text-[11px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
                  Available during pre-launch
                </p>
              )}
            </div>
          );
        })}
      </div>

      {waitlistPlan && (
        <WaitlistModal
          plan={waitlistPlan}
          defaultEmail=""
          onClose={() => setWaitlistPlan(null)}
        />
      )}
    </>
  );
}
