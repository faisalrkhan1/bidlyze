"use client";

import { useRouter } from "next/navigation";
import { hasFeature, minPlanFor, PLAN_DISPLAY } from "@/lib/plans";

/**
 * Feature gate component.
 * Shows children if the user's plan has the feature.
 * Shows a professional upgrade prompt otherwise.
 *
 * Usage:
 *   <UpgradeGate plan={userPlan} feature="proposalWriter" label="Proposal Writer">
 *     <ProposalWriter />
 *   </UpgradeGate>
 */
export default function UpgradeGate({ plan, feature, label, children, inline = false }) {
  const allowed = hasFeature(plan, feature);

  if (allowed) return children;

  const requiredPlan = minPlanFor(feature);
  const planName = PLAN_DISPLAY[requiredPlan] || "Professional";

  if (inline) {
    return <InlineUpgrade planName={planName} label={label} />;
  }

  return <BlockUpgrade planName={planName} label={label} />;
}

function BlockUpgrade({ planName, label }) {
  const router = useRouter();
  return (
    <div className="rounded-2xl p-8 text-center relative overflow-hidden" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
      {/* Blurred preview background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ background: "repeating-linear-gradient(45deg, var(--text-muted), var(--text-muted) 1px, transparent 1px, transparent 10px)" }} />

      <div className="relative">
        <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
          <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <h3 className="font-semibold mb-1">{label || "Feature"} — {planName} Plan</h3>
        <p className="text-sm mb-4 max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
          Upgrade to {planName} to unlock {(label || "this feature").toLowerCase()} and accelerate your bid workflow.
        </p>
        <button
          onClick={() => router.push("/pricing")}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
        >
          View Plans
        </button>
      </div>
    </div>
  );
}

function InlineUpgrade({ planName, label }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/pricing")}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
      style={{ background: "var(--accent-muted)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
      {planName}
    </button>
  );
}

/**
 * Hook-style check for use in conditionals.
 */
export function useFeatureCheck(plan, feature) {
  return hasFeature(plan, feature);
}
