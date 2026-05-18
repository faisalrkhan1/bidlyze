// Phase 2 reliability mode — hide non-core features behind flags.
// To restore a hidden feature, flip its flag to true.
// No JSX deletion; flag-gated only.

export const FEATURES = {
  // ─── Core 5-step workflow (visible) ───
  showRequirementsTracker: true,
  showComplianceMatrix: true,
  showRiskRadar: true,
  showExportCenter: true,
  showInternalNotes: true,
  showBidScoreBadge: true,
  showQuickInfoGrid: true,

  // ─── Hidden analysis-page sections (Phase 2 hide) ───
  showBidReadiness: false,
  showWinProbability: false,
  showCompetitorIntelligence: false,
  showPricingAdvisor: false,
  showKeyDatesSection: false,        // duplicates info in quick grid
  showEvaluationCriteriaSection: false,
  showFinancialRequirementsSection: false,
  showClarificationRegister: false,
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

  // ─── Export Center deliverables (trim 9 → 3) ───
  enableComplianceXlsxExport: true,
  enablePdfReportExport: true,
  enableOriginalFileDownload: true,
  enableDocxProposalExport: false,
  enableJsonExport: false,
  enableRaciExport: false,
  enableClarificationsExport: false,
  enableRequirementsXlsxExport: false,
  enableWorkspaceBundleExport: false,
};

/**
 * Helper to read a flag, defaults to false if unknown.
 */
export function isEnabled(flag) {
  return FEATURES[flag] === true;
}
