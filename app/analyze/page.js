"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useTheme } from "@/lib/theme";
import { exportPDF } from "@/app/utils/exportPDF";

function ScoreBadge({ score }) {
  const color =
    score >= 70
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : score >= 40
      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      : "bg-red-500/10 text-red-400 border-red-500/20";

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${color}`}>
      {score}/100
    </span>
  );
}

function RecommendationBadge({ recommendation }) {
  const isBid = recommendation === "BID";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${
        isBid
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/20"
      }`}
    >
      {isBid ? "BID" : "NO-BID"}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const colors = {
    HIGH: "bg-red-500/10 text-red-400",
    MEDIUM: "bg-yellow-500/10 text-yellow-400",
    LOW: "bg-emerald-500/10 text-emerald-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[severity] || ""}`} style={!colors[severity] ? { background: "var(--icon-muted)", color: "var(--text-secondary)" } : {}}>
      {severity}
    </span>
  );
}

function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden transition-colors duration-300" style={{ border: "1px solid var(--border-primary)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left transition-colors duration-300"
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-card-hover)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <h3 className="font-semibold">{title}</h3>
        <svg
          className={`w-5 h-5 transition-transform`}
          style={{ color: "var(--text-secondary)", transform: open ? "rotate(180deg)" : "" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-4 transition-colors duration-300" style={{ borderTop: "1px solid var(--border-primary)" }}>{children}</div>}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="p-4 rounded-xl transition-colors duration-300" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-sm font-medium">{value || "Not specified"}</p>
    </div>
  );
}

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

export default function AnalyzePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [result] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("bidlyze-result");
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    if (!result) {
      router.push("/dashboard");
    }
  }, [router, user, authLoading, result]);

  if (authLoading || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { analysis, fileName, analysisId } = result;
  const { summary, requirements, complianceAnalysis, riskRadar, keyDates, evaluationCriteria, financialRequirements, bidScore, winProbability, competitorIntelligence, pricingAdvisor } = analysis;

  function exportJSON() {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bidlyze-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header className="transition-colors duration-300" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-base text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">Bidlyze</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:block" style={{ color: "var(--text-secondary)" }}>{user?.email}</span>
            <ThemeToggle />
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300"
              style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push("/upload")}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300"
              style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Analyze Another
            </button>
            {analysisId && (
              <button
                onClick={() => router.push(`/proposal/${analysisId}`)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-400 transition-colors text-white flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
                Generate Proposal
              </button>
            )}
            <button
              onClick={() => exportPDF(analysis, fileName)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300"
              style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Export PDF
            </button>
            <button
              onClick={exportJSON}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300"
              style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Export JSON
            </button>
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

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">{summary?.projectName || "Tender Analysis"}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{fileName}</p>
          </div>
          <div className="flex items-center gap-3">
            {bidScore && <ScoreBadge score={bidScore.score} />}
            {bidScore && <RecommendationBadge recommendation={bidScore.recommendation} />}
          </div>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InfoCard label="Issuing Authority" value={summary?.issuingAuthority} />
          <InfoCard label="Tender Reference" value={summary?.tenderReference} />
          <InfoCard label="Estimated Value" value={summary?.estimatedValue ? `${summary.currency || ""} ${summary.estimatedValue}` : null} />
          <InfoCard label="Deadline" value={summary?.submissionDeadline} />
          <InfoCard label="Duration" value={summary?.projectDuration} />
          <InfoCard label="Location" value={summary?.location} />
          <InfoCard label="Sector" value={summary?.sector} />
          <InfoCard label="Currency" value={summary?.currency} />
        </div>

        {/* Brief Description */}
        {summary?.briefDescription && (
          <div className="p-5 rounded-2xl transition-colors duration-300" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Brief Description</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{summary.briefDescription}</p>
          </div>
        )}

        {/* AI Recommendation */}
        {bidScore?.reasoning && (
          <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-emerald-400 text-xs uppercase tracking-wider mb-2 font-semibold">
              AI Recommendation
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{bidScore.reasoning}</p>
          </div>
        )}

        {/* Win Probability */}
        {winProbability && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Circular Progress */}
              <div
                className="flex flex-col items-center justify-center p-6 rounded-2xl shrink-0"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)", minWidth: 180 }}
              >
                <div className="relative w-28 h-28 mb-3">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-primary)" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      strokeWidth="8" strokeLinecap="round"
                      stroke={winProbability.overall >= 60 ? "#10b981" : winProbability.overall >= 35 ? "#eab308" : "#ef4444"}
                      strokeDasharray={`${winProbability.overall * 2.64} 264`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{winProbability.overall}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>%</span>
                  </div>
                </div>
                <p className="text-sm font-semibold mb-1">Win Probability</p>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    winProbability.competitivePosition === "strong"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : winProbability.competitivePosition === "moderate"
                      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}
                >
                  {winProbability.competitivePosition?.charAt(0).toUpperCase() + winProbability.competitivePosition?.slice(1)} Position
                </span>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className="p-5 rounded-2xl"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">Strengths</p>
                  <ul className="space-y-2.5">
                    {winProbability.strengths?.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div
                  className="p-5 rounded-2xl"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">Weaknesses</p>
                  <ul className="space-y-2.5">
                    {winProbability.weaknesses?.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Factor Breakdown */}
            {winProbability.factors?.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid var(--border-primary)" }}
              >
                <div
                  className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider"
                  style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}
                >
                  <div className="col-span-3">Factor</div>
                  <div className="col-span-1 text-center">Score</div>
                  <div className="col-span-1 text-center">Impact</div>
                  <div className="col-span-7">Reasoning</div>
                </div>
                {winProbability.factors.map((f, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center"
                    style={{ borderBottom: "1px solid var(--border-primary)" }}
                  >
                    <div className="col-span-3 text-sm font-medium">{f.factor}</div>
                    <div className="col-span-1 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                        f.score >= 60 ? "text-emerald-400 bg-emerald-500/10"
                        : f.score >= 35 ? "text-yellow-400 bg-yellow-500/10"
                        : "text-red-400 bg-red-500/10"
                      }`}>
                        {f.score}
                      </span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        f.impact === "high" ? "bg-red-500/10 text-red-400"
                        : f.impact === "medium" ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {f.impact?.charAt(0).toUpperCase() + f.impact?.slice(1)}
                      </span>
                    </div>
                    <div className="col-span-7 text-sm" style={{ color: "var(--text-secondary)" }}>{f.reasoning}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Strategy Recommendation */}
            {winProbability.strategyRecommendation && (
              <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-emerald-400 text-xs uppercase tracking-wider mb-2 font-semibold">
                  Strategy Recommendation
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{winProbability.strategyRecommendation}</p>
              </div>
            )}
          </div>
        )}

        {/* Competitor Intelligence */}
        {competitorIntelligence && (
          <Section title="Competitor Intelligence" defaultOpen>
            <div className="space-y-6">
              {/* Market Dynamics */}
              {competitorIntelligence.marketDynamics && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Market Dynamics</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{competitorIntelligence.marketDynamics}</p>
                </div>
              )}

              {/* Competitor Cards */}
              {competitorIntelligence.estimatedCompetitors?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Estimated Competitors</p>
                  {competitorIntelligence.estimatedCompetitors.map((c, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl transition-colors duration-300"
                      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold">{c.name}</span>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-secondary)" }}
                          >
                            {c.type?.charAt(0).toUpperCase() + c.type?.slice(1)}
                          </span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                          c.threatLevel === "high" ? "bg-red-500/10 text-red-400"
                          : c.threatLevel === "medium" ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-emerald-500/10 text-emerald-400"
                        }`}>
                          {c.threatLevel?.charAt(0).toUpperCase() + c.threatLevel?.slice(1)} Threat
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs font-medium text-emerald-400 mb-1.5">Strengths</p>
                          <ul className="space-y-1">
                            {c.strengths?.map((s, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                                <svg className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-red-400 mb-1.5">Weaknesses</p>
                          <ul className="space-y-1">
                            {c.weaknesses?.map((w, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                                <svg className="w-3 h-3 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {c.estimatedApproach && (
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                          <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Likely approach:</span> {c.estimatedApproach}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Differentiation Strategy */}
              {competitorIntelligence.differentiationStrategy && (
                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-emerald-400 text-xs uppercase tracking-wider mb-2 font-semibold">
                    Differentiation Strategy
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{competitorIntelligence.differentiationStrategy}</p>
                </div>
              )}

              {/* Pricing Strategy */}
              {competitorIntelligence.pricingPosition && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Pricing Strategy</p>
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
                    {["aggressive", "balanced", "premium"].map((tier) => {
                      const isRecommended = competitorIntelligence.pricingPosition.recommended === tier;
                      return (
                        <div
                          key={tier}
                          className="flex items-start gap-4 px-5 py-4"
                          style={{
                            borderBottom: tier !== "premium" ? "1px solid var(--border-primary)" : undefined,
                            background: isRecommended ? "var(--accent-muted)" : undefined,
                          }}
                        >
                          <div className="flex items-center gap-2.5 shrink-0 w-28">
                            <span className="text-sm font-semibold">{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
                            {isRecommended && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white">
                                Rec
                              </span>
                            )}
                          </div>
                          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {competitorIntelligence.pricingPosition[tier]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {competitorIntelligence.pricingPosition.reasoning && (
                    <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Reasoning:</span> {competitorIntelligence.pricingPosition.reasoning}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Pricing Advisor */}
        {pricingAdvisor && (
          <Section title="Pricing Advisor" defaultOpen>
            <div className="space-y-6">
              {pricingAdvisor.canEstimate ? (
                <>
                  {/* Strategy Cards */}
                  {pricingAdvisor.strategies?.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {pricingAdvisor.strategies.map((s) => {
                        const isRec = pricingAdvisor.recommended === s.approach;
                        const colors = {
                          aggressive: { border: "border-blue-500/30", bg: "bg-blue-500/5", accent: "text-blue-400", badgeBg: "bg-blue-500/10", badge: "text-blue-400" },
                          balanced: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", accent: "text-emerald-400", badgeBg: "bg-emerald-500/10", badge: "text-emerald-400" },
                          premium: { border: "border-purple-500/30", bg: "bg-purple-500/5", accent: "text-purple-400", badgeBg: "bg-purple-500/10", badge: "text-purple-400" },
                        };
                        const c = colors[s.approach] || colors.balanced;
                        return (
                          <div
                            key={s.approach}
                            className={`relative p-5 rounded-2xl border transition-colors duration-300 ${isRec ? c.border + " " + c.bg : ""}`}
                            style={!isRec ? { background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" } : {}}
                          >
                            {isRec && (
                              <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">
                                Recommended
                              </span>
                            )}
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${c.accent}`}>{s.label}</p>
                            <p className="text-lg font-bold mb-3">
                              {pricingAdvisor.currency} {s.estimatedRange?.low?.toLocaleString()} – {s.estimatedRange?.high?.toLocaleString()}
                            </p>
                            <div className="space-y-2 mb-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Win Probability</span>
                                <span className={`text-xs font-semibold ${c.accent}`}>{s.winProbability}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full" style={{ background: "var(--border-primary)" }}>
                                <div
                                  className={`h-full rounded-full ${s.approach === "aggressive" ? "bg-blue-500" : s.approach === "balanced" ? "bg-emerald-500" : "bg-purple-500"}`}
                                  style={{ width: `${s.winProbability}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Margin</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.badgeBg} ${c.badge}`}>
                                  {s.margin?.charAt(0).toUpperCase() + s.margin?.slice(1)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Risk</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  s.risk === "high" ? "bg-red-500/10 text-red-400"
                                  : s.risk === "medium" ? "bg-yellow-500/10 text-yellow-400"
                                  : "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  {s.risk?.charAt(0).toUpperCase() + s.risk?.slice(1)}
                                </span>
                              </div>
                            </div>
                            {s.notes && (
                              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.notes}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recommendation */}
                  {pricingAdvisor.reasoning && (
                    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-emerald-400 text-xs uppercase tracking-wider mb-2 font-semibold">Pricing Recommendation</p>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{pricingAdvisor.reasoning}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 shrink-0 text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium mb-1">Insufficient financial data for pricing estimate</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        The tender document does not contain enough financial information to provide specific price ranges. General guidance is provided below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cost Drivers & Pricing Risks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pricingAdvisor.costDrivers?.length > 0 && (
                  <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Cost Drivers</p>
                    <ul className="space-y-2">
                      {pricingAdvisor.costDrivers.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                          <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                          </svg>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {pricingAdvisor.pricingRisks?.length > 0 && (
                  <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">Pricing Risks</p>
                    <ul className="space-y-2">
                      {pricingAdvisor.pricingRisks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                          <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
                          </svg>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Financial Tips */}
              {pricingAdvisor.financialTips && (
                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-emerald-400 text-xs uppercase tracking-wider mb-2 font-semibold">Financial Tips</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{pricingAdvisor.financialTips}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Collapsible Sections */}
        <div className="space-y-3">
          {/* Requirements */}
          {requirements?.length > 0 && (
            <Section title={`Requirements (${requirements.length})`} defaultOpen>
              <div className="space-y-3">
                {requirements.map((r, i) => (
                  <div key={i} className="p-4 rounded-xl transition-colors duration-300" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>{r.category}</span>
                      <div className="flex items-center gap-2">
                        {r.mandatory && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400">
                            Mandatory
                          </span>
                        )}
                        <SeverityBadge severity={r.priority} />
                      </div>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.requirement}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Compliance Gap Detector */}
          {complianceAnalysis && (
            <Section title="Compliance Gap Detector" defaultOpen>
              <div className="space-y-6">
                {/* Score + Summary Row */}
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Compliance Score Circle */}
                  <div
                    className="flex flex-col items-center justify-center p-6 rounded-2xl shrink-0"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)", minWidth: 180 }}
                  >
                    <div className="relative w-28 h-28 mb-3">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-primary)" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r="42" fill="none"
                          strokeWidth="8" strokeLinecap="round"
                          stroke={(complianceAnalysis.overallComplianceScore ?? 0) >= 70 ? "#10b981" : (complianceAnalysis.overallComplianceScore ?? 0) >= 40 ? "#eab308" : "#ef4444"}
                          strokeDasharray={`${(complianceAnalysis.overallComplianceScore ?? 0) * 2.64} 264`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold">{complianceAnalysis.overallComplianceScore ?? 0}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>%</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold mb-1">Compliance Score</p>
                  </div>

                  {/* Summary Stats */}
                  {complianceAnalysis.summary && (
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                        <p className="text-2xl font-bold">{complianceAnalysis.summary.totalItems ?? 0}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Total Items</p>
                      </div>
                      <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                        <p className="text-2xl font-bold text-emerald-400">{complianceAnalysis.summary.compliant ?? 0}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Compliant</p>
                      </div>
                      <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                        <p className="text-2xl font-bold text-yellow-400">{complianceAnalysis.summary.gaps ?? 0}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Gaps</p>
                      </div>
                      <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                        <p className="text-2xl font-bold text-red-400">{complianceAnalysis.summary.critical ?? 0}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Critical</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compliance Items */}
                {complianceAnalysis.items?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Compliance Items</p>
                    {complianceAnalysis.items.map((c, i) => {
                      const statusIcon = c.status === "compliant"
                        ? <svg className="w-5 h-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        : c.status === "gap"
                        ? <svg className="w-5 h-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        : <svg className="w-5 h-5 shrink-0 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" /></svg>;
                      const statusColor = c.status === "compliant" ? "border-emerald-500/20" : c.status === "gap" ? "border-red-500/20" : "border-yellow-500/20";
                      return (
                        <details key={i} className={`rounded-xl overflow-hidden border transition-colors duration-300 ${statusColor}`} style={{ background: "var(--bg-subtle)" }}>
                          <summary className="flex items-center gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                            {statusIcon}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{c.item}</p>
                              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.category}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <SeverityBadge severity={c.severity} />
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                c.status === "compliant" ? "bg-emerald-500/10 text-emerald-400"
                                : c.status === "gap" ? "bg-red-500/10 text-red-400"
                                : "bg-yellow-500/10 text-yellow-400"
                              }`}>
                                {c.status === "compliant" ? "Compliant" : c.status === "gap" ? "Gap" : "At Risk"}
                              </span>
                            </div>
                          </summary>
                          <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: "1px solid var(--border-primary)" }}>
                            {c.commonIssue && (
                              <div>
                                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Common Issue</p>
                                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.commonIssue}</p>
                              </div>
                            )}
                            {c.remediation && (
                              <div>
                                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Remediation</p>
                                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.remediation}</p>
                              </div>
                            )}
                            <div className="flex gap-4">
                              {c.timeToRemediate && (
                                <div>
                                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Time to Fix</p>
                                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.timeToRemediate}</p>
                                </div>
                              )}
                              {c.costEstimate && (
                                <div>
                                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Cost</p>
                                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.costEstimate}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}

                {/* Missing Documents & Certification Gaps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {complianceAnalysis.missingDocuments?.length > 0 && (
                    <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">Missing Documents</p>
                      <ul className="space-y-2">
                        {complianceAnalysis.missingDocuments.map((doc, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                            <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9.75m3 0H9.75m0 0v3m0-3H6.375a1.125 1.125 0 0 1-1.125-1.125V4.125A1.125 1.125 0 0 1 6.375 3H13.5l5.25 5.25v7.875a1.125 1.125 0 0 1-1.125 1.125H13.5" />
                            </svg>
                            {doc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {complianceAnalysis.certificationGaps?.length > 0 && (
                    <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400 mb-3">Certification Gaps</p>
                      <ul className="space-y-2">
                        {complianceAnalysis.certificationGaps.map((cert, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                            <svg className="w-4 h-4 mt-0.5 shrink-0 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
                            </svg>
                            {cert}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action Plan */}
                {complianceAnalysis.actionPlan?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Action Plan</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
                      {complianceAnalysis.actionPlan.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-4 px-5 py-4"
                          style={{ borderBottom: i < complianceAnalysis.actionPlan.length - 1 ? "1px solid var(--border-primary)" : undefined }}
                        >
                          <span className="shrink-0 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                            {a.priority}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{a.action}</p>
                            <div className="flex gap-4 mt-1">
                              {a.deadline && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Deadline: <span style={{ color: "var(--text-secondary)" }}>{a.deadline}</span></p>}
                              {a.owner && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Owner: <span style={{ color: "var(--text-secondary)" }}>{a.owner}</span></p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Risk Radar */}
          {riskRadar && (
            <Section title="Risk Radar" defaultOpen>
              <div className="space-y-6">
                {/* Overall Risk Gauge */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <div
                    className="flex flex-col items-center justify-center p-6 rounded-2xl shrink-0"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)", minWidth: 180 }}
                  >
                    <div className="relative w-28 h-14 mb-2 overflow-hidden">
                      <svg viewBox="0 0 100 50" className="w-full h-full">
                        <path d="M10 45 A35 35 0 0 1 90 45" fill="none" stroke="var(--border-primary)" strokeWidth="8" strokeLinecap="round" />
                        <path d="M10 45 A35 35 0 0 1 90 45" fill="none"
                          stroke={
                            (riskRadar.riskScore ?? 0) >= 75 ? "#ef4444"
                            : (riskRadar.riskScore ?? 0) >= 50 ? "#f97316"
                            : (riskRadar.riskScore ?? 0) >= 25 ? "#eab308"
                            : "#10b981"
                          }
                          strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={`${(riskRadar.riskScore ?? 0) * 1.26} 126`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
                        <span className="text-2xl font-bold">{riskRadar.riskScore ?? 0}</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold mb-1">Risk Score</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      riskRadar.overallRiskLevel === "critical" ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : riskRadar.overallRiskLevel === "high" ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                      : riskRadar.overallRiskLevel === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}>
                      {riskRadar.overallRiskLevel?.charAt(0).toUpperCase() + riskRadar.overallRiskLevel?.slice(1)} Risk
                    </span>
                  </div>

                  {/* Showstoppers */}
                  {riskRadar.showstoppers?.length > 0 && (
                    <div className="flex-1 p-5 rounded-2xl bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
                        </svg>
                        <p className="text-xs font-bold uppercase tracking-wider text-red-400">Showstoppers</p>
                      </div>
                      <ul className="space-y-2">
                        {riskRadar.showstoppers.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                            <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Risk Category Cards */}
                {riskRadar.categories?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {riskRadar.categories.map((cat, i) => {
                      const catLabel = cat.category?.charAt(0).toUpperCase() + cat.category?.slice(1);
                      const levelColors = {
                        critical: "bg-red-500/10 text-red-400",
                        high: "bg-orange-500/10 text-orange-400",
                        medium: "bg-yellow-500/10 text-yellow-400",
                        low: "bg-emerald-500/10 text-emerald-400",
                      };
                      const barColor = {
                        critical: "bg-red-500",
                        high: "bg-orange-500",
                        medium: "bg-yellow-500",
                        low: "bg-emerald-500",
                      };
                      return (
                        <details key={i} className="rounded-xl overflow-hidden transition-colors duration-300" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                          <summary className="flex items-center gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-semibold">{catLabel}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{cat.score}/100</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors[cat.riskLevel] || ""}`}>
                                    {cat.riskLevel?.charAt(0).toUpperCase() + cat.riskLevel?.slice(1)}
                                  </span>
                                </div>
                              </div>
                              <div className="w-full h-1.5 rounded-full" style={{ background: "var(--border-primary)" }}>
                                <div className={`h-full rounded-full ${barColor[cat.riskLevel] || "bg-gray-500"}`} style={{ width: `${cat.score}%` }} />
                              </div>
                            </div>
                            <svg className="w-4 h-4 shrink-0 transition-transform" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </summary>
                          {cat.risks?.length > 0 && (
                            <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border-primary)" }}>
                              <div className="pt-3" />
                              {cat.risks.map((r, j) => {
                                const sevColors = {
                                  critical: "bg-red-500/10 text-red-400",
                                  high: "bg-orange-500/10 text-orange-400",
                                  medium: "bg-yellow-500/10 text-yellow-400",
                                  low: "bg-emerald-500/10 text-emerald-400",
                                };
                                const likeColors = {
                                  certain: "bg-red-500/10 text-red-400",
                                  likely: "bg-orange-500/10 text-orange-400",
                                  possible: "bg-yellow-500/10 text-yellow-400",
                                  unlikely: "bg-emerald-500/10 text-emerald-400",
                                };
                                return (
                                  <div key={j} className="p-3 rounded-lg" style={{ border: "1px solid var(--border-primary)" }}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <p className="text-sm font-medium">{r.risk}</p>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${sevColors[r.severity] || ""}`}>
                                          {r.severity?.charAt(0).toUpperCase() + r.severity?.slice(1)}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${likeColors[r.likelihood] || ""}`}>
                                          {r.likelihood?.charAt(0).toUpperCase() + r.likelihood?.slice(1)}
                                        </span>
                                      </div>
                                    </div>
                                    {r.impact && (
                                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                                        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Impact:</span> {r.impact}
                                      </p>
                                    )}
                                    {r.mitigation && (
                                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                                        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Mitigation:</span> {r.mitigation}
                                      </p>
                                    )}
                                    {r.owner && (
                                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Owner:</span> {r.owner}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </details>
                      );
                    })}
                  </div>
                )}

                {/* Top Actions */}
                {riskRadar.topActions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Top Actions</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
                      {riskRadar.topActions.map((a, i) => {
                        const prioColors = {
                          immediate: "bg-red-500 text-white",
                          before_submission: "bg-yellow-500 text-white",
                          post_award: "bg-emerald-500 text-white",
                        };
                        const prioLabels = {
                          immediate: "Immediate",
                          before_submission: "Pre-Submission",
                          post_award: "Post-Award",
                        };
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-4 px-5 py-4"
                            style={{ borderBottom: i < riskRadar.topActions.length - 1 ? "1px solid var(--border-primary)" : undefined }}
                          >
                            <span className={`shrink-0 px-2.5 py-0.5 rounded-md text-xs font-bold ${prioColors[a.priority] || "bg-gray-500 text-white"}`}>
                              {prioLabels[a.priority] || a.priority}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{a.action}</p>
                              {a.responsible && (
                                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Owner: {a.responsible}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Key Dates */}
          {keyDates?.length > 0 && (
            <Section title={`Key Dates (${keyDates.length})`}>
              <div className="space-y-2">
                {keyDates.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg transition-colors duration-300"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
                  >
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{d.event}</span>
                    <span className="text-emerald-400 text-sm font-medium">{d.date}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Evaluation Criteria */}
          {evaluationCriteria?.length > 0 && (
            <Section title={`Evaluation Criteria (${evaluationCriteria.length})`}>
              <div className="space-y-3">
                {evaluationCriteria.map((e, i) => (
                  <div key={i} className="p-4 rounded-xl transition-colors duration-300" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-sm font-medium">{e.criterion}</p>
                      <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400">
                        {e.weight}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{e.details}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Financial Requirements */}
          {financialRequirements && (
            <Section title="Financial Requirements">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoCard label="Bid Bond" value={financialRequirements.bidBond} />
                <InfoCard label="Performance Bond" value={financialRequirements.performanceBond} />
                <InfoCard label="Minimum Turnover" value={financialRequirements.minimumTurnover} />
                <InfoCard label="Other Financial" value={financialRequirements.otherFinancial} />
              </div>
            </Section>
          )}
        </div>
      </main>
    </div>
  );
}
