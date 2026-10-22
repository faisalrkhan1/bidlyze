// Phase 2 reliability mode — hide non-core features behind flags.
// To restore a hidden feature, flip its flag to true.
// No JSX deletion; flag-gated only.

export const FEATURES = {
  // ─── Core 5-step workflow (visible) ───
  showRequirementsTracker: true,
  showComplianceMatrix: true,
  showRiskRadar: false,               // MVP: replaced by the cited Disqualification checklist
  showExportCenter: true,
  showInternalNotes: true,
  showBidScoreBadge: true,
  showQuickInfoGrid: true,

  // ─── MVP: Tender Readiness Report ───
  // Multi-pass engine with page-cited, code-verified quotes (lib/readiness/*).
  // Set to false to fall back to the legacy single-prompt engine in lib/gemini.js.
  READINESS_ENGINE_V2: true,

  // ─── Hidden analysis-page sections (Phase 2 hide) ───
  showBidReadiness: false,
  showWinProbability: false,
  showCompetitorIntelligence: false,
  showPricingAdvisor: false,
  showKeyDatesSection: true,         // MVP: dates are now page-cited
  showEvaluationCriteriaSection: false,
  showFinancialRequirementsSection: false,
  showClarificationRegister: true,   // MVP: seeded from the clarifications pass
  showActionTracker: false,
  showDecisionPanel: false,
  showComments: false,
  showAuditTrail: false,

  // ─── Hidden routes (sidebar nav + analysis page entry points) ───
  showBidCompareRoute: false,
  showTenderPackageRoute: false,
  showDeadlineTrackerRoute: false,
  showAmendmentIntelligenceRoute: false, // No current call-site; reserved for future entry point.
  showProposalWriterEntry: false,        // No current call-site; reserved for future entry point.

  // ─── Tender Package mode (multi-file upload + analysis) ───
  enableTenderPackageUpload: true,
  showSourceDocumentsList: true,

  // ─── Disqualification Risk Detector ───
  // Runs a secondary AI pass scoring the tender against 15 GCC-universal
  // pass/fail checks plus AI-inferred risks. Toggle off to hide the badge,
  // the analysis-page section, and skip the post-analysis async trigger.
  DISQUALIFICATION_RISK_DETECTOR: true,

  // ─── Export Center deliverables (trim 9 → 3) ───
  enableComplianceXlsxExport: true,
  enablePdfReportExport: true,
  enableOriginalFileDownload: true,
  enableDocxProposalExport: false,
  enableJsonExport: false,
  enableRaciExport: false,
  enableClarificationsExport: true,
  enableRequirementsXlsxExport: false,
  enableWorkspaceBundleExport: false,
};

/**
 * Helper to read a flag, defaults to false if unknown.
 */
export function isEnabled(flag) {
  return FEATURES[flag] === true;
}
