"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { AIDisclaimer, ConfidenceBadge } from "@/app/components/AIConfidence";
import AnalysisNotes from "@/app/components/AnalysisNotes";
import { exportMultiSheetExcel, formatComparisonForExcel } from "@/app/utils/exportExcel";

const RATING_COLORS = {
  best: "bg-emerald-500/10 text-emerald-400",
  good: "bg-blue-500/10 text-blue-400",
  acceptable: "bg-amber-500/10 text-amber-400",
  weak: "bg-red-500/10 text-red-400",
  missing: "bg-gray-500/10 text-gray-400",
};

const COMPLIANCE_COLORS = {
  full: "bg-emerald-500/10 text-emerald-400",
  partial: "bg-amber-500/10 text-amber-400",
  "non-compliant": "bg-red-500/10 text-red-400",
  unclear: "bg-gray-500/10 text-gray-400",
};

function Section({ title, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <div className="flex items-center gap-2.5"><h3 className="font-semibold">{title}</h3>{badge}</div>
        <svg className="w-5 h-5 transition-transform" style={{ color: "var(--text-secondary)", transform: open ? "rotate(180deg)" : "" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && <div className="px-5 pb-5 pt-3" style={{ borderTop: "1px solid var(--border-primary)" }}>{children}</div>}
    </div>
  );
}

export default function BidCompareResultPage({ params }) {
  const { id } = use(params);
  const { user, loading: authLoading, logout } = useAuth();
  const [record, setRecord] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    getSupabase().from("analyses").select("*").eq("id", id).eq("user_id", user.id).single()
      .then(({ data, error }) => {
        if (error || !data || !data.analysis_data?.isComparison) setNotFound(true);
        else setRecord(data);
      });
  }, [id, user, authLoading]);

  if (authLoading || (!record && !notFound)) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }
  if (notFound) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}><div className="text-center"><h2 className="text-xl font-bold mb-2">Comparison not found</h2><button onClick={() => router.push("/dashboard")} className="px-6 py-3 rounded-xl text-sm font-semibold bg-emerald-500 text-white">Back to Dashboard</button></div></div>;
  }

  const a = record.analysis_data;
  const subs = a.submissions || [];
  const matrix = a.comparisonMatrix || [];
  const rec = a.recommendation || {};
  const ctx = a.tenderContext || {};

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: record.project_name || "Bid Comparison" }]}>
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl font-bold">{record.project_name}</h1>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">COMPARISON</span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{subs.length} submissions &middot; {a.compareType || "comparison"}</p>
          </div>
          {rec.bestOverall && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Best Overall</p>
              <p className="text-sm font-bold text-emerald-500">{rec.bestOverall.name}</p>
            </div>
          )}
        </div>

        {/* Export */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const sheets = [];
              if (matrix.length > 0) sheets.push({ name: "Comparison Matrix", data: formatComparisonForExcel(matrix, subs) });
              if (subs.length > 0) sheets.push({ name: "Submissions", data: subs.map((s) => ({ Name: s.name, Compliance: s.complianceLevel, Scope: s.scopeCoverage, Price: s.commercialSummary?.totalPrice || "—", Timeline: s.timeline || "—", Strengths: s.strengths?.join("; "), Weaknesses: s.weaknesses?.join("; "), Risks: s.risks?.join("; "), Exclusions: s.exclusions?.join("; ") })) });
              if (sheets.length > 0) exportMultiSheetExcel(sheets, `${record.project_name || "comparison"}-export.xlsx`);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export Excel
          </button>
        </div>

        {ctx.opportunity && (
          <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{ctx.opportunity}</p>
          </div>
        )}

        <AIDisclaimer variant="standard" />

        {/* Recommendation Cards */}
        {(rec.bestCommercial || rec.bestTechnical || rec.bestOverall || rec.highestRisk) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Best Commercial", data: rec.bestCommercial, color: "text-emerald-400" },
              { label: "Best Technical", data: rec.bestTechnical, color: "text-blue-400" },
              { label: "Best Overall", data: rec.bestOverall, color: "text-purple-400" },
              { label: "Highest Risk", data: rec.highestRisk, color: "text-red-400" },
            ].map((card) => card.data ? (
              <div key={card.label} className="p-4 rounded-xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{card.label}</p>
                <p className={`text-sm font-bold ${card.color}`}>{card.data.name}</p>
                <p className="text-xs mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>{card.data.reason}</p>
              </div>
            ) : null)}
          </div>
        )}

        {/* Comparison Matrix */}
        {matrix.length > 0 && (
          <Section title="Comparison Matrix" badge={<ConfidenceBadge level="medium" />}>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border-primary)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)", minWidth: 160 }}>Dimension</th>
                    {subs.map((s) => (
                      <th key={s.name} className="text-center px-3 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)", minWidth: 120 }}>{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      <td className="px-4 py-3 font-medium text-sm">
                        {row.dimension}
                        <span className="block text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{row.category}</span>
                      </td>
                      {subs.map((s) => {
                        const val = row.values?.find((v) => v.submissionName === s.name);
                        return (
                          <td key={s.name} className="text-center px-3 py-3">
                            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{val?.value || "—"}</p>
                            {val?.rating && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${RATING_COLORS[val.rating] || ""}`}>
                                {val.rating}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Submission Cards */}
        {subs.length > 0 && (
          <Section title={`Submission Details (${subs.length})`}>
            <div className="space-y-4">
              {subs.map((s, i) => (
                <div key={i} className="p-5 rounded-xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold">{s.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${COMPLIANCE_COLORS[s.complianceLevel] || ""}`}>
                        {s.complianceLevel}
                      </span>
                    </div>
                    {s.commercialSummary?.totalPrice && (
                      <span className="text-sm font-bold">{s.commercialSummary.currency} {s.commercialSummary.totalPrice}</span>
                    )}
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Compliance</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.complianceSummary}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Scope Coverage</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.scopeSummary}</p>
                    </div>
                  </div>

                  {/* Strengths / Weaknesses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1.5">Strengths</p>
                      <ul className="space-y-1">
                        {s.strengths?.map((str, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                            <svg className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                            {str}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1.5">Weaknesses / Risks</p>
                      <ul className="space-y-1">
                        {[...(s.weaknesses || []), ...(s.risks || [])].map((w, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                            <svg className="w-3 h-3 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Exclusions / Missing */}
                  {(s.exclusions?.length > 0 || s.missingItems?.length > 0) && (
                    <div className="mt-3 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
                      {s.exclusions?.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5">Exclusions</p>
                          <ul className="space-y-1">{s.exclusions.map((e, j) => <li key={j} className="text-xs" style={{ color: "var(--text-muted)" }}>- {e}</li>)}</ul>
                        </div>
                      )}
                      {s.missingItems?.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1.5">Missing Items</p>
                          <ul className="space-y-1">{s.missingItems.map((m, j) => <li key={j} className="text-xs" style={{ color: "var(--text-muted)" }}>- {m}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Commercial Comparison */}
        {a.commercialComparison && (
          <Section title="Commercial Comparison" badge={<ConfidenceBadge level="low" />} defaultOpen={false}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Lowest Price</p>
                  <p className="text-sm font-bold text-emerald-400">{a.commercialComparison.lowestPrice}</p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Highest Price</p>
                  <p className="text-sm font-bold text-red-400">{a.commercialComparison.highestPrice}</p>
                </div>
              </div>
              {a.commercialComparison.pricingNotes && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{a.commercialComparison.pricingNotes}</p>}
              {a.commercialComparison.missingCostElements?.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1.5 text-amber-400">Missing Cost Elements</p>
                  <ul className="space-y-1">{a.commercialComparison.missingCostElements.map((e, i) => <li key={i} className="text-xs" style={{ color: "var(--text-muted)" }}>- {e}</li>)}</ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Risk Comparison */}
        {a.riskComparison && (
          <Section title="Risk Comparison" badge={<ConfidenceBadge level="medium" />} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Lowest Risk</p>
                <p className="text-sm font-bold text-emerald-400">{a.riskComparison.lowestRisk}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Highest Risk</p>
                <p className="text-sm font-bold text-red-400">{a.riskComparison.highestRisk}</p>
              </div>
            </div>
            {a.riskComparison.commonRisks?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Risks Across Multiple Submissions</p>
                <ul className="space-y-1">{a.riskComparison.commonRisks.map((r, i) => <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>- {r}</li>)}</ul>
              </div>
            )}
          </Section>
        )}

        {/* Overall Recommendation */}
        {rec.summary && (
          <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10">
            <p className="text-blue-400 text-xs uppercase tracking-wider font-semibold mb-2">Evaluation Summary</p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>{rec.summary}</p>
            {rec.followUpActions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Follow-Up Actions</p>
                <ul className="space-y-1.5">
                  {rec.followUpActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span className="text-blue-400 font-bold text-xs mt-0.5">{i + 1}.</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <AnalysisNotes analysisId={record.id} userId={user.id} />
      </div>
    </AppShell>
  );
}
