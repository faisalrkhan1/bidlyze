"use client";

import { useMemo } from "react";

/**
 * Composite Bid Readiness Score.
 *
 * Computed from live state — requirement statuses, compliance edits, action items,
 * decision panel state, clarifications — rather than a frozen AI number. Surfaces
 * what's blocking submission and what's been confirmed.
 */
export default function BidReadiness({ analysis, requirementStatuses, complianceEdits, actions, decision, clarifications }) {
  const breakdown = useMemo(
    () => computeReadiness({ analysis, requirementStatuses, complianceEdits, actions, decision, clarifications }),
    [analysis, requirementStatuses, complianceEdits, actions, decision, clarifications]
  );

  const { score, level, factors, blockers } = breakdown;

  const ringColor = score >= 75 ? "#10b981" : score >= 50 ? "#eab308" : score >= 25 ? "#f97316" : "#ef4444";
  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Bid Readiness</h3>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Live — updates as you work
          </span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Score ring */}
        <div className="md:col-span-3 flex flex-col items-center gap-2">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-primary)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" stroke={ringColor} strokeDasharray={`${score * 2.64} 264`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{score}</span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/ 100</span>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            level === "ready" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            level === "on track" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
            level === "needs work" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
            "bg-red-500/10 text-red-400 border-red-500/20"
          }`}>
            {levelLabel}
          </span>
        </div>

        {/* Factor bars */}
        <div className="md:col-span-6 space-y-3">
          {factors.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{f.label}</span>
                <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  {f.score}/{f.maxScore}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: "var(--border-primary)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(f.score / f.maxScore) * 100}%`,
                    background: f.score / f.maxScore >= 0.75 ? "#10b981" : f.score / f.maxScore >= 0.5 ? "#eab308" : f.score / f.maxScore >= 0.25 ? "#f97316" : "#ef4444",
                  }}
                />
              </div>
              {f.detail && (
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{f.detail}</p>
              )}
            </div>
          ))}
        </div>

        {/* Blockers */}
        <div className="md:col-span-3">
          <p className="text-[10px] uppercase tracking-wider mb-2 font-semibold" style={{ color: "var(--text-muted)" }}>
            Top blockers
          </p>
          {blockers.length === 0 ? (
            <p className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>
              No blockers detected. Continue with submission preparation.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {blockers.slice(0, 4).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function computeReadiness({ analysis, requirementStatuses, complianceEdits, actions, decision, clarifications }) {
  const requirements = analysis?.requirements || [];
  const complianceItems = analysis?.complianceAnalysis?.items || [];
  const showstoppers = analysis?.riskRadar?.showstoppers || [];

  // ── Factor 1: Requirements coverage (30) ──
  const requirementEdits = requirementStatuses?.edits || {};
  let reqMet = 0;
  let reqPartial = 0;
  let reqNotMet = 0;
  const totalReqs = Math.max(requirements.length, 1);
  requirements.forEach((_, i) => {
    const status = requirementEdits[`req-${i}`]?.status || "needs_review";
    if (status === "met") reqMet++;
    else if (status === "partial") reqPartial++;
    else if (status === "not_met") reqNotMet++;
  });
  const reqScore = requirements.length === 0
    ? 15
    : Math.round(((reqMet + reqPartial * 0.5) / totalReqs) * 30);

  // ── Factor 2: Compliance position (25) ──
  let compliantCount = 0;
  let gapCount = 0;
  let partialCount = 0;
  complianceItems.forEach((c, i) => {
    const edit = complianceEdits?.[`cm-${i}`];
    const status = edit?.status || (c.status === "compliant" ? "compliant" : c.status === "gap" ? "gap" : "needs_review");
    if (status === "compliant") compliantCount++;
    else if (status === "gap") gapCount++;
    else if (status === "partial") partialCount++;
  });
  const totalCompliance = Math.max(complianceItems.length, 1);
  const aiComplianceScore = analysis?.complianceAnalysis?.overallComplianceScore;
  const complianceUserScore = complianceItems.length === 0
    ? (typeof aiComplianceScore === "number" ? Math.round((aiComplianceScore / 100) * 25) : 12)
    : Math.round(((compliantCount + partialCount * 0.5) / totalCompliance) * 25);

  // ── Factor 3: Risk & showstoppers (15) ──
  const riskScore = analysis?.riskRadar?.riskScore ?? 50;
  const showstopperPenalty = Math.min(showstoppers.length * 3, 9);
  const riskFactor = Math.max(0, 15 - Math.round((riskScore / 100) * 15) - showstopperPenalty);

  // ── Factor 4: Action plan execution (15) ──
  const totalActions = (actions || []).length;
  const doneActions = (actions || []).filter((a) => a.status === "done").length;
  const blockedActions = (actions || []).filter((a) => a.status === "blocked").length;
  const actionFactor = totalActions === 0
    ? 7
    : Math.max(0, Math.round((doneActions / totalActions) * 15) - blockedActions);

  // ── Factor 5: Decision & approval (10) ──
  let decisionFactor = 0;
  if (decision?.decision === "bid") decisionFactor += 5;
  if (decision?.approvalStatus === "approved") decisionFactor += 5;
  else if (decision?.approvalStatus === "under_review") decisionFactor += 2;

  // ── Factor 6: Open clarifications (5) ──
  const openClarifications = (clarifications || []).filter((c) => c.status === "open" || c.status === "sent").length;
  const clarificationFactor = Math.max(0, 5 - Math.min(openClarifications, 5));

  const score = Math.min(100, Math.max(0, reqScore + complianceUserScore + riskFactor + actionFactor + decisionFactor + clarificationFactor));

  let level = "at risk";
  if (score >= 75) level = "ready";
  else if (score >= 55) level = "on track";
  else if (score >= 30) level = "needs work";

  const blockers = [];
  if (showstoppers.length > 0) showstoppers.slice(0, 2).forEach((s) => blockers.push(s));
  if (gapCount > 0) blockers.push(`${gapCount} compliance gap${gapCount > 1 ? "s" : ""} unresolved`);
  if (reqNotMet > 0) blockers.push(`${reqNotMet} mandatory requirement${reqNotMet > 1 ? "s" : ""} not met`);
  if (openClarifications > 0) blockers.push(`${openClarifications} clarification${openClarifications > 1 ? "s" : ""} pending response`);
  if (decision?.approvalStatus !== "approved") blockers.push("Internal decision not yet approved");
  if (blockedActions > 0) blockers.push(`${blockedActions} blocked action${blockedActions > 1 ? "s" : ""}`);

  return {
    score,
    level,
    factors: [
      { key: "requirements", label: "Requirements coverage", score: reqScore, maxScore: 30, detail: requirements.length ? `${reqMet} met, ${reqPartial} partial, ${reqNotMet} not met of ${requirements.length}` : "No requirements extracted" },
      { key: "compliance", label: "Compliance position", score: complianceUserScore, maxScore: 25, detail: complianceItems.length ? `${compliantCount} compliant, ${gapCount} gap${gapCount === 1 ? "" : "s"}` : "Compliance items not yet broken down" },
      { key: "risk", label: "Risk profile", score: riskFactor, maxScore: 15, detail: `AI risk score ${riskScore}/100${showstoppers.length ? ` · ${showstoppers.length} showstopper(s)` : ""}` },
      { key: "actions", label: "Action plan execution", score: actionFactor, maxScore: 15, detail: totalActions ? `${doneActions} of ${totalActions} actions complete` : "No actions captured" },
      { key: "decision", label: "Decision & approval", score: decisionFactor, maxScore: 10, detail: decision?.decision ? `Decision: ${decision.decision.replace("_", " ")}` : "Decision not recorded" },
      { key: "clarifications", label: "Clarifications closed", score: clarificationFactor, maxScore: 5, detail: openClarifications ? `${openClarifications} still open` : "All clarifications resolved" },
    ],
    blockers,
  };
}
