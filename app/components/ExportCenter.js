"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { exportPDF } from "@/app/utils/exportPDF";
import { exportToExcel, exportMultiSheetExcel } from "@/app/utils/exportExcel";
import { getComplianceExportData } from "./ComplianceMatrix";
import { getClarificationExportData } from "./ClarificationRegister";
import { hasFeature, PLAN_DISPLAY, minPlanFor } from "@/lib/plans";

function ExportTile({ icon, title, description, badge, locked, lockedReason, onClick, disabled }) {
  const isDisabled = disabled || locked;
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className="text-left p-4 rounded-xl flex gap-3 items-start transition-all disabled:cursor-not-allowed"
      style={{
        background: "var(--bg-subtle)",
        border: "1px solid var(--border-primary)",
        opacity: isDisabled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.background = "var(--bg-card-hover)"; }}
      onMouseLeave={(e) => { if (!isDisabled) e.currentTarget.style.background = "var(--bg-subtle)"; }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-semibold">{title}</p>
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {locked ? lockedReason : description}
        </p>
      </div>
    </button>
  );
}

const FILE_ICONS = {
  pdf: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  docx: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9.75m0 0H7.5m2.25 0V12m6.75 6V12m0 6h2.25M5.625 21h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  ),
  xlsx: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m-17.25 0h17.25" />
    </svg>
  ),
  json: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  ),
};

/**
 * Workspace Export Center.
 * Provides per-deliverable downloads in the same place, gates by plan, and surfaces
 * the editable workspace data — not just AI output — so exports reflect the user's work.
 */
export default function ExportCenter({
  analysis,
  fileName,
  filePath,
  analysisId,
  userPlan,
  requirementStatuses,
  complianceEdits,
  workflowActions,
  workflowDecision,
  clarifications,
  onDownloadOriginal,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);

  const slug = (analysis?.summary?.projectName || fileName || "tender")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "tender";
  const datePart = new Date().toISOString().slice(0, 10);
  const baseName = `Bidlyze_${slug}_${datePart}`;

  const canExcel = hasFeature(userPlan, "excelExport");
  const canDocx = hasFeature(userPlan, "proposalWriter");

  function safe(fn) {
    return async () => {
      try {
        await fn();
      } catch (e) {
        console.error("Export failed:", e);
        alert("Export failed. Please refresh the page and try again. If the issue persists, contact support@bidlyze.com.");
      } finally {
        setBusy(null);
      }
    };
  }

  // ── PDF Executive Report ──
  const doPdf = safe(async () => {
    setBusy("pdf");
    exportPDF(analysis, fileName);
  });

  // ── XLSX Requirements ──
  const doXlsxRequirements = safe(async () => {
    setBusy("xlsxReq");
    const requirements = analysis?.requirements || [];
    if (requirements.length === 0) {
      alert("No requirements were extracted from this tender, so there is nothing to export yet.");
      return;
    }
    const edits = requirementStatuses?.edits || {};
    const statusMap = { met: "Met", partial: "Partial", not_met: "Not Met", needs_review: "Needs Review" };
    const rows = requirements.map((r, i) => {
      const e = edits[`req-${i}`] || {};
      return {
        "#": i + 1,
        Requirement: r.requirement || "",
        "Source Ref": r.sourceRef || "",
        Category: r.category || "",
        Priority: r.priority || (r.mandatory ? "HIGH" : "MEDIUM"),
        Status: statusMap[e.status] || "Needs Review",
        Owner: e.owner || "",
        "Evidence Required": e.evidence || "",
        "Due Date": e.dueDate || "",
        Notes: e.notes || "",
      };
    });
    exportToExcel(rows, "Requirements", `${baseName}_Requirements.xlsx`);
  });

  // ── XLSX Compliance Matrix ──
  const doXlsxCompliance = safe(async () => {
    setBusy("xlsxComp");
    const items = analysis?.complianceAnalysis?.items || [];
    if (items.length === 0) {
      alert("No compliance items found in this analysis. Re-run analysis with the full compliance breakdown.");
      return;
    }
    const rows = getComplianceExportData(items, complianceEdits || {});
    exportToExcel(rows, "Compliance Matrix", `${baseName}_Compliance.xlsx`);
  });

  // ── XLSX Action / RACI Tracker ──
  const doXlsxActions = safe(async () => {
    setBusy("xlsxAct");
    const list = workflowActions || [];
    if (list.length === 0) {
      alert("No action items captured yet. Add actions from the Action Tracker section, then export.");
      return;
    }
    const rows = list.map((a, i) => ({
      "#": i + 1,
      Title: a.title || "",
      Owner: a.owner || "",
      "Due Date": a.dueDate || "",
      Priority: (a.priority || "").toUpperCase(),
      Status: (a.status || "").replace("_", " "),
      Source: a.source || "",
      Notes: a.notes || "",
      Created: a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "",
    }));
    exportToExcel(rows, "Actions", `${baseName}_Actions.xlsx`);
  });

  // ── XLSX Clarifications ──
  const doXlsxClarifications = safe(async () => {
    setBusy("xlsxClr");
    const list = clarifications || [];
    if (list.length === 0) {
      alert("No clarification questions captured yet. Add them from the Clarification Register, then export.");
      return;
    }
    const rows = getClarificationExportData(list);
    exportToExcel(rows, "Clarifications", `${baseName}_Clarifications.xlsx`);
  });

  // ── XLSX Workspace Bundle (all sheets) ──
  const doXlsxBundle = safe(async () => {
    setBusy("xlsxAll");
    const sheets = [];
    const requirements = analysis?.requirements || [];
    if (requirements.length > 0) {
      const edits = requirementStatuses?.edits || {};
      const statusMap = { met: "Met", partial: "Partial", not_met: "Not Met", needs_review: "Needs Review" };
      sheets.push({
        name: "Requirements",
        data: requirements.map((r, i) => {
          const e = edits[`req-${i}`] || {};
          return {
            "#": i + 1,
            Requirement: r.requirement || "",
            "Source Ref": r.sourceRef || "",
            Category: r.category || "",
            Priority: r.priority || (r.mandatory ? "HIGH" : "MEDIUM"),
            Status: statusMap[e.status] || "Needs Review",
            Owner: e.owner || "",
            "Evidence Required": e.evidence || "",
            "Due Date": e.dueDate || "",
            Notes: e.notes || "",
          };
        }),
      });
    }
    const compliance = analysis?.complianceAnalysis?.items || [];
    if (compliance.length > 0) {
      sheets.push({ name: "Compliance", data: getComplianceExportData(compliance, complianceEdits || {}) });
    }
    if ((workflowActions || []).length > 0) {
      sheets.push({
        name: "Actions",
        data: workflowActions.map((a, i) => ({
          "#": i + 1,
          Title: a.title || "",
          Owner: a.owner || "",
          "Due Date": a.dueDate || "",
          Priority: (a.priority || "").toUpperCase(),
          Status: (a.status || "").replace("_", " "),
          Source: a.source || "",
          Notes: a.notes || "",
        })),
      });
    }
    if ((clarifications || []).length > 0) {
      sheets.push({ name: "Clarifications", data: getClarificationExportData(clarifications) });
    }
    const risks = analysis?.riskRadar?.categories || [];
    if (risks.length > 0) {
      const riskRows = [];
      risks.forEach((cat) => (cat.risks || []).forEach((r) => riskRows.push({
        Category: cat.category || "",
        Risk: r.risk || "",
        Severity: r.severity || "",
        Likelihood: r.likelihood || "",
        Impact: r.impact || "",
        Mitigation: r.mitigation || "",
        Owner: r.owner || "",
      })));
      if (riskRows.length > 0) sheets.push({ name: "Risks", data: riskRows });
    }

    if (sheets.length === 0) {
      alert("No workspace data yet to export. Work through requirements, compliance, and actions first.");
      return;
    }
    exportMultiSheetExcel(sheets, `${baseName}_Workspace.xlsx`);
  });

  // ── JSON dump ──
  const doJson = safe(async () => {
    setBusy("json");
    const payload = {
      analysisId,
      fileName,
      exportedAt: new Date().toISOString(),
      analysis,
      workspace: {
        requirementStatuses,
        complianceEdits,
        workflowActions,
        workflowDecision,
        clarifications,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <div className="p-5 flex items-start justify-between gap-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div>
          <h3 className="font-semibold mb-0.5">Export Center</h3>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Generate working deliverables from this tender workspace. Exports reflect your latest edits and assignments.
          </p>
        </div>
        {busy && (
          <span className="text-[11px] flex items-center gap-1.5 shrink-0" style={{ color: "var(--text-muted)" }}>
            <div className="w-3 h-3 rounded-full border border-emerald-500 border-t-transparent animate-spin" />
            Preparing
          </span>
        )}
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <ExportTile
          icon={FILE_ICONS.pdf}
          title="Executive PDF Report"
          badge="PDF"
          description="Branded one-pager + breakdown of score, requirements, compliance, risk, and pricing."
          onClick={doPdf}
        />
        <ExportTile
          icon={FILE_ICONS.docx}
          title="Proposal Sections (.docx)"
          badge="DOCX"
          locked={!canDocx}
          lockedReason={`Proposal writer available on ${PLAN_DISPLAY[minPlanFor("proposalWriter")] || "paid"} plan and above.`}
          description="Open the proposal writer to draft and export executive summary, technical response, compliance matrix, methodology, team, and risk mitigation as one document."
          onClick={() => router.push(`/proposal/${analysisId}`)}
        />
        <ExportTile
          icon={FILE_ICONS.xlsx}
          title="Compliance Matrix"
          badge="XLSX"
          locked={!canExcel}
          lockedReason={`Excel export available on ${PLAN_DISPLAY[minPlanFor("excelExport")] || "paid"} plan and above.`}
          description="Editable compliance positions with status, severity, owner, evidence, and notes."
          onClick={doXlsxCompliance}
        />
        <ExportTile
          icon={FILE_ICONS.xlsx}
          title="Requirements Tracker"
          badge="XLSX"
          locked={!canExcel}
          lockedReason={`Excel export available on ${PLAN_DISPLAY[minPlanFor("excelExport")] || "paid"} plan and above.`}
          description="Every extracted requirement with source reference, priority, status, owner, evidence, and due date."
          onClick={doXlsxRequirements}
        />
        <ExportTile
          icon={FILE_ICONS.xlsx}
          title="Action / RACI Tracker"
          badge="XLSX"
          locked={!canExcel}
          lockedReason={`Excel export available on ${PLAN_DISPLAY[minPlanFor("excelExport")] || "paid"} plan and above.`}
          description="All workspace actions with owner, due date, priority, status, source, and notes."
          onClick={doXlsxActions}
        />
        <ExportTile
          icon={FILE_ICONS.xlsx}
          title="Clarification Register"
          badge="XLSX"
          locked={!canExcel}
          lockedReason={`Excel export available on ${PLAN_DISPLAY[minPlanFor("excelExport")] || "paid"} plan and above.`}
          description="Open questions to the issuing authority, with priority, source, status, and recorded responses."
          onClick={doXlsxClarifications}
        />
        <ExportTile
          icon={FILE_ICONS.xlsx}
          title="Workspace Bundle"
          badge="XLSX"
          locked={!canExcel}
          lockedReason={`Excel export available on ${PLAN_DISPLAY[minPlanFor("excelExport")] || "paid"} plan and above.`}
          description="One workbook with every sheet — requirements, compliance, actions, clarifications, and risks."
          onClick={doXlsxBundle}
        />
        <ExportTile
          icon={FILE_ICONS.json}
          title="Raw Data (JSON)"
          badge="JSON"
          description="Complete AI output plus your workspace edits — for archiving or piping into another tool."
          onClick={doJson}
        />
        {filePath && (
          <ExportTile
            icon={FILE_ICONS.pdf}
            title="Original Source Document"
            badge="DOWNLOAD"
            description="Re-download the original tender file you uploaded."
            onClick={onDownloadOriginal}
          />
        )}
      </div>

      <div className="px-5 py-3 text-[11px] flex items-start gap-2" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderTop: "1px solid var(--border-primary)" }}>
        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
        </svg>
        <span>
          Exports are AI-assisted and reflect your workspace edits — always verify exported numbers, dates, and clauses against the source tender before submission.
        </span>
      </div>
    </div>
  );
}
