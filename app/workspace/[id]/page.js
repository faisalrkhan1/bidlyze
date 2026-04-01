"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { AIDisclaimer, ConfidenceBadge } from "@/app/components/AIConfidence";
import AnalysisNotes from "@/app/components/AnalysisNotes";

const CAT_COLORS = {
  main_rfx: "bg-emerald-500/10 text-emerald-400",
  boq: "bg-blue-500/10 text-blue-400",
  compliance: "bg-purple-500/10 text-purple-400",
  annexure: "bg-amber-500/10 text-amber-400",
  contract: "bg-red-500/10 text-red-400",
  submission: "bg-cyan-500/10 text-cyan-400",
  attachment: "bg-gray-500/10 text-gray-400",
};

const IMPORTANCE_COLORS = {
  critical: "bg-red-500/10 text-red-400",
  important: "bg-amber-500/10 text-amber-400",
  reference: "bg-gray-500/10 text-gray-400",
};

function Section({ title, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <div className="flex items-center gap-2.5">
          <h3 className="font-semibold">{title}</h3>
          {badge}
        </div>
        <svg className="w-5 h-5 transition-transform" style={{ color: "var(--text-secondary)", transform: open ? "rotate(180deg)" : "" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && <div className="px-5 pb-5 pt-3" style={{ borderTop: "1px solid var(--border-primary)" }}>{children}</div>}
    </div>
  );
}

function PriorityBadge({ level }) {
  const c = { HIGH: "bg-red-500/10 text-red-400", MEDIUM: "bg-amber-500/10 text-amber-400", LOW: "bg-emerald-500/10 text-emerald-400" };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${c[level] || c.MEDIUM}`}>{level}</span>;
}

export default function WorkspaceDetailPage({ params }) {
  const { id } = use(params);
  const { user, loading: authLoading, logout } = useAuth();
  const [record, setRecord] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    getSupabase()
      .from("analyses")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data || !data.analysis_data?.isPackage) setNotFound(true);
        else setRecord(data);
      });
  }, [id, user, authLoading]);

  if (authLoading || (!record && !notFound)) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Package not found</h2>
          <button onClick={() => router.push("/dashboard")} className="px-6 py-3 rounded-xl font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const a = record.analysis_data;
  const pkg = a.packageSummary || {};
  const files = a.files || [];
  const fileClassifications = a.fileClassifications || [];

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: pkg.tenderObjective || "Tender Package" }]}>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl font-bold">{pkg.tenderObjective || record.project_name}</h1>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">PACKAGE</span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{files.length} documents &middot; {pkg.sector || "Tender Package"}</p>
          </div>
          {a.recommendation && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${
              a.recommendation.decision === "BID" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
              a.recommendation.decision === "CONSIDER" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
              "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {a.recommendation.decision}
            </span>
          )}
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Authority", value: pkg.issuingAuthority },
            { label: "Reference", value: pkg.reference },
            { label: "Est. Value", value: pkg.estimatedValue ? `${pkg.currency || ""} ${pkg.estimatedValue}` : null },
            { label: "Sector", value: pkg.sector },
          ].map((item) => item.value && item.value !== "Not specified" ? (
            <div key={item.label} className="p-4 rounded-xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{item.label}</p>
              <p className="text-sm font-medium">{item.value}</p>
            </div>
          ) : null)}
        </div>

        {/* Description */}
        {pkg.briefDescription && (
          <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{pkg.briefDescription}</p>
          </div>
        )}

        <AIDisclaimer variant="standard" />

        {/* Recommendation */}
        {a.recommendation && (
          <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-emerald-400 text-xs uppercase tracking-wider font-semibold mb-2">Package Recommendation</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{a.recommendation.reasoning}</p>
          </div>
        )}

        {/* Scope & Deliverables */}
        {(pkg.scopeAreas?.length > 0 || pkg.majorDeliverables?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {pkg.scopeAreas?.length > 0 && (
              <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Key Scope Areas</p>
                <ul className="space-y-2">
                  {pkg.scopeAreas.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pkg.majorDeliverables?.length > 0 && (
              <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Major Deliverables</p>
                <ul className="space-y-2">
                  {pkg.majorDeliverables.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span className="text-xs font-bold text-emerald-400 mt-0.5">{i + 1}.</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Document Files */}
        <Section title={`Tender Documents (${files.length})`} badge={<ConfidenceBadge level="high" />}>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
              <div className="col-span-4">File</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-4">Content</div>
              <div className="col-span-2 text-center">Importance</div>
            </div>
            {fileClassifications.map((fc, i) => {
              const uploadedFile = files.find((f) => f.fileName === fc.fileName);
              return (
                <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <div className="col-span-4">
                    <p className="font-medium truncate">{fc.fileName}</p>
                    {uploadedFile && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{Math.round((uploadedFile.size || 0) / 1024)} KB</p>}
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${CAT_COLORS[uploadedFile?.category] || CAT_COLORS.attachment}`}>
                      {fc.detectedType}
                    </span>
                  </div>
                  <div className="col-span-4 text-xs" style={{ color: "var(--text-muted)" }}>{fc.keyContent}</div>
                  <div className="col-span-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${IMPORTANCE_COLORS[fc.importance] || ""}`}>
                      {fc.importance?.charAt(0).toUpperCase() + fc.importance?.slice(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Key Deadlines */}
        {a.keyDeadlines?.length > 0 && (
          <Section title={`Key Deadlines (${a.keyDeadlines.length})`}>
            <div className="space-y-2">
              {a.keyDeadlines.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{d.event}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{d.date}</span>
                    {d.source && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{d.source}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Submission Requirements */}
        {a.submissionRequirements?.length > 0 && (
          <Section title={`Submission Requirements (${a.submissionRequirements.length})`} badge={<ConfidenceBadge level="high" />}>
            <div className="space-y-3">
              {a.submissionRequirements.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                  <span className="text-xs font-bold shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{r.requirement}</span>
                      {r.mandatory && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold">Required</span>}
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.source && `Source: ${r.source}`}{r.format ? ` — Format: ${r.format}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Compliance Matrix */}
        {a.complianceMatrix?.length > 0 && (
          <Section title={`Compliance Matrix (${a.complianceMatrix.length})`} badge={<ConfidenceBadge level="medium" />}>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                <div className="col-span-4">Requirement</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-1 text-center">Severity</div>
                <div className="col-span-3">Action Needed</div>
              </div>
              {a.complianceMatrix.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 items-start text-sm" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <div className="col-span-4 font-medium leading-snug">{item.requirement}</div>
                  <div className="col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>{item.source}</div>
                  <div className="col-span-2"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-500/10" style={{ color: "var(--text-secondary)" }}>{item.category}</span></div>
                  <div className="col-span-1 text-center"><PriorityBadge level={item.severity} /></div>
                  <div className="col-span-3 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>{item.notes}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Risk Flags */}
        {a.riskFlags?.length > 0 && (
          <Section title={`Risk Flags (${a.riskFlags.length})`} badge={<ConfidenceBadge level="medium" />}>
            <div className="space-y-3">
              {a.riskFlags.map((r, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{r.risk}</span>
                    <PriorityBadge level={r.severity} />
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Source: {r.source} &mdash; Mitigation: {r.mitigation}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Missing Info & Clarifications */}
        {(a.missingInformation?.length > 0 || a.clarificationPoints?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {a.missingInformation?.length > 0 && (
              <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-amber-400">Missing / Unclear Information</p>
                <ul className="space-y-2">
                  {a.missingInformation.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.clarificationPoints?.length > 0 && (
              <div className="p-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-blue-400">Clarification Questions</p>
                <div className="space-y-2.5">
                  {a.clarificationPoints.map((q, i) => (
                    <div key={i}>
                      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{q.question}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{q.reason}{q.source ? ` — ${q.source}` : ""}</p>
                    </div>
                  ))}
                </div>
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
