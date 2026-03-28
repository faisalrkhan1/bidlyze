"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useTheme } from "@/lib/theme";

const SEVERITY_COLORS = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
  major: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", dot: "bg-orange-500" },
  minor: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500" },
};

const CATEGORY_LABELS = {
  scope: "Scope",
  financial: "Financial",
  timeline: "Timeline",
  technical: "Technical",
  legal: "Legal",
  compliance: "Compliance",
  evaluation: "Evaluation",
  administrative: "Administrative",
};

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

function SeverityBadge({ severity }) {
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.minor;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {severity?.charAt(0).toUpperCase() + severity?.slice(1)}
    </span>
  );
}

function CategoryBadge({ category }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
      style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" }}
    >
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

function ChangeCard({ change, expanded, onToggle }) {
  const colors = SEVERITY_COLORS[change.severity] || SEVERITY_COLORS.minor;

  return (
    <div
      className={`rounded-xl overflow-hidden transition-colors duration-300 border ${colors.border}`}
      style={{ background: "var(--bg-subtle)" }}
    >
      <div
        className="p-4 cursor-pointer flex items-start justify-between gap-4"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <SeverityBadge severity={change.severity} />
            <CategoryBadge category={change.category} />
          </div>
          <h4 className="font-semibold text-sm">{change.title}</h4>
          {!expanded && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
              {change.description}
            </p>
          )}
        </div>
        <svg
          className={`w-5 h-5 flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          style={{ color: "var(--text-muted)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <p className="text-sm pt-4" style={{ color: "var(--text-secondary)" }}>
            {change.description}
          </p>

          {/* Side-by-side diff */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
              <p className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wider">Original</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {change.originalText || "N/A"}
              </p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
              <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">Amended</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {change.amendedText || "N/A"}
              </p>
            </div>
          </div>

          {change.impact && (
            <div className="rounded-lg p-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)" }}>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Impact</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{change.impact}</p>
            </div>
          )}

          {change.actionRequired && (
            <div className="rounded-lg p-3 bg-emerald-500/5" style={{ border: "1px solid rgba(16, 185, 129, 0.15)" }}>
              <p className="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-wider">Action Required</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{change.actionRequired}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompareResultsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [data] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("bidlyze-comparison");
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const [filter, setFilter] = useState("all");
  const [expandedCards, setExpandedCards] = useState({});
  const router = useRouter();

  useEffect(() => {
    if (!data) {
      router.push("/compare");
    }
  }, [router, data]);

  if (authLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { comparison, originalFileName, amendedFileName } = data;
  const { summary, changes = [], financialImpact, deadlineChanges, complianceChanges, riskAssessment } = comparison;

  const filteredChanges = filter === "all"
    ? changes
    : changes.filter((c) => c.severity === filter);

  function toggleCard(id) {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const impactColors = {
    minimal: { bg: "bg-blue-500/10", text: "text-blue-400" },
    moderate: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
    significant: { bg: "bg-orange-500/10", text: "text-orange-400" },
    transformative: { bg: "bg-red-500/10", text: "text-red-400" },
  };

  const impactStyle = impactColors[summary?.overallImpact] || impactColors.moderate;

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header className="transition-colors duration-300" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
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

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Back + Title */}
        <button
          onClick={() => router.push("/compare")}
          className="flex items-center gap-2 text-sm font-medium mb-6 transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          New Comparison
        </button>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              Amendment <span className="text-emerald-500">Analysis</span>
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {originalFileName} → {amendedFileName}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${impactStyle.bg} ${impactStyle.text}`}>
            {summary?.overallImpact?.charAt(0).toUpperCase() + summary?.overallImpact?.slice(1)} Impact
          </span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
            <p className="text-2xl font-bold">{summary?.totalChanges || 0}</p>
            <p className="text-xs font-medium mt-1" style={{ color: "var(--text-muted)" }}>Total Changes</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
            <p className="text-2xl font-bold text-red-400">{summary?.critical || 0}</p>
            <p className="text-xs font-medium mt-1 text-red-400">Critical</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: "rgba(249, 115, 22, 0.05)", border: "1px solid rgba(249, 115, 22, 0.15)" }}>
            <p className="text-2xl font-bold text-orange-400">{summary?.major || 0}</p>
            <p className="text-xs font-medium mt-1 text-orange-400">Major</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.15)" }}>
            <p className="text-2xl font-bold text-blue-400">{summary?.minor || 0}</p>
            <p className="text-xs font-medium mt-1 text-blue-400">Minor</p>
          </div>
        </div>

        {/* AI Recommendation */}
        {summary?.recommendation && (
          <div
            className="p-5 rounded-xl mb-8 bg-emerald-500/5"
            style={{ border: "1px solid rgba(16, 185, 129, 0.2)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              <h3 className="font-semibold text-emerald-500">AI Recommendation</h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {summary.recommendation}
            </p>
          </div>
        )}

        {/* Financial Impact */}
        {financialImpact?.hasFinancialChanges && (
          <div
            className="p-5 rounded-xl mb-8"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <h3 className="font-semibold">Financial Impact</h3>
            </div>

            {financialImpact.estimatedValueChange && (
              <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                {financialImpact.estimatedValueChange}
              </p>
            )}

            {financialImpact.budgetImplications?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Budget Implications</p>
                <ul className="space-y-1.5">
                  {financialImpact.budgetImplications.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {financialImpact.pricingAdjustment && (
              <div className="rounded-lg p-3 bg-yellow-500/5" style={{ border: "1px solid rgba(234, 179, 8, 0.15)" }}>
                <p className="text-xs font-semibold text-yellow-500 mb-1">Pricing Adjustment</p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{financialImpact.pricingAdjustment}</p>
              </div>
            )}
          </div>
        )}

        {/* Deadline Changes */}
        {deadlineChanges?.hasDeadlineChanges && deadlineChanges.changes?.length > 0 && (
          <div
            className="p-5 rounded-xl mb-8"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <h3 className="font-semibold">Deadline Changes</h3>
            </div>

            <div className="space-y-3">
              {deadlineChanges.changes.map((dc, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 rounded-lg" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)" }}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Event</p>
                    <p className="text-sm font-medium">{dc.event}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-red-400">Original</p>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{dc.originalDate}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-emerald-400">New</p>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{dc.newDate}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Impact</p>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{dc.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance Changes */}
        {complianceChanges && (complianceChanges.newRequirements?.length > 0 || complianceChanges.removedRequirements?.length > 0 || complianceChanges.modifiedRequirements?.length > 0) && (
          <div
            className="p-5 rounded-xl mb-8"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              <h3 className="font-semibold">Compliance Changes</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {complianceChanges.newRequirements?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-emerald-400">Added</p>
                  <ul className="space-y-1.5">
                    {complianceChanges.newRequirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span className="text-emerald-400 mt-0.5">+</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {complianceChanges.removedRequirements?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-400">Removed</p>
                  <ul className="space-y-1.5">
                    {complianceChanges.removedRequirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span className="text-red-400 mt-0.5">−</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {complianceChanges.modifiedRequirements?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-yellow-400">Modified</p>
                  <ul className="space-y-1.5">
                    {complianceChanges.modifiedRequirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span className="text-yellow-400 mt-0.5">~</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk Assessment */}
        {riskAssessment && (
          <div
            className="p-5 rounded-xl mb-8"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <h3 className="font-semibold">Risk Assessment</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                riskAssessment.overallRiskChange === "increased"
                  ? "bg-red-500/10 text-red-400"
                  : riskAssessment.overallRiskChange === "decreased"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-blue-500/10 text-blue-400"
              }`}>
                Risk {riskAssessment.overallRiskChange === "increased" ? "↑ Increased" : riskAssessment.overallRiskChange === "decreased" ? "↓ Decreased" : "→ Unchanged"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {riskAssessment.newRisks?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-400">New Risks</p>
                  <ul className="space-y-1.5">
                    {riskAssessment.newRisks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {riskAssessment.mitigatedRisks?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-emerald-400">Mitigated Risks</p>
                  <ul className="space-y-1.5">
                    {riskAssessment.mitigatedRisks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-sm font-medium mr-2" style={{ color: "var(--text-muted)" }}>Filter:</span>
          {[
            { key: "all", label: "All Changes", count: changes.length },
            { key: "critical", label: "Critical", count: summary?.critical || 0 },
            { key: "major", label: "Major", count: summary?.major || 0 },
            { key: "minor", label: "Minor", count: summary?.minor || 0 },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === f.key
                  ? "bg-emerald-500 text-white"
                  : ""
              }`}
              style={filter !== f.key ? { background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" } : {}}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Change Cards */}
        <div className="space-y-4">
          {filteredChanges.length === 0 ? (
            <div className="p-8 text-center rounded-xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No changes found for this filter.</p>
            </div>
          ) : (
            filteredChanges.map((change) => (
              <ChangeCard
                key={change.id}
                change={change}
                expanded={!!expandedCards[change.id]}
                onToggle={() => toggleCard(change.id)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
