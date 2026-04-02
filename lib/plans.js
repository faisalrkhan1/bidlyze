/**
 * Bidlyze Plan Configuration — single source of truth for pricing/gating.
 *
 * Tiers: free → pro → team → enterprise
 * All plans include RFI / RFQ / RFP / Other document types.
 * Plans are differentiated by depth, volume, exports, and collaboration.
 */

export const PLANS = {
  free: {
    key: "free",
    name: "Free",
    price: 0,
    period: "forever",
    analysesLimit: 3,
    historyDays: 30,
    features: {
      // Analysis
      singleDocAnalysis: true,
      rfxTypeSupport: true,
      basicSummary: true,
      requirementExtraction: true,
      requirementStatusTracking: true,
      // Gated in free
      sourceReferences: false,
      requirementOwnerField: false,
      requirementDueDates: false,
      requirementExcelExport: false,
      complianceMatrix: false,
      riskMapping: false,
      bidNoBidScoring: false,
      winProbability: false,
      competitorIntelligence: false,
      pricingAdvisor: false,
      proposalWriter: false,
      amendmentIntelligence: false,
      tenderPackage: false,
      bidComparison: false,
      deadlineTracker: false,
      actionTracker: false,
      decisionPanel: false,
      comments: false,
      auditTrail: false,
      excelExport: false,
      brandedExport: false,
      internalNotes: true,
      fullHistory: false,
    },
  },
  pro: {
    key: "pro",
    name: "Professional",
    price: 49,
    period: "/month",
    analysesLimit: 25,
    historyDays: null, // unlimited
    features: {
      singleDocAnalysis: true,
      rfxTypeSupport: true,
      basicSummary: true,
      requirementExtraction: true,
      requirementStatusTracking: true,
      sourceReferences: true,
      requirementOwnerField: true,
      requirementDueDates: true,
      requirementExcelExport: true,
      complianceMatrix: true,
      riskMapping: true,
      bidNoBidScoring: true,
      winProbability: true,
      competitorIntelligence: true,
      pricingAdvisor: true,
      proposalWriter: true,
      amendmentIntelligence: true,
      tenderPackage: true,
      bidComparison: true,
      deadlineTracker: true,
      actionTracker: true,
      decisionPanel: true,
      comments: true,
      auditTrail: false,
      excelExport: true,
      brandedExport: false,
      internalNotes: true,
      fullHistory: true,
    },
  },
  team: {
    key: "team",
    name: "Team",
    price: 149,
    period: "/month",
    analysesLimit: 80,
    historyDays: null,
    features: {
      singleDocAnalysis: true,
      rfxTypeSupport: true,
      basicSummary: true,
      requirementExtraction: true,
      requirementStatusTracking: true,
      sourceReferences: true,
      requirementOwnerField: true,
      requirementDueDates: true,
      requirementExcelExport: true,
      complianceMatrix: true,
      riskMapping: true,
      bidNoBidScoring: true,
      winProbability: true,
      competitorIntelligence: true,
      pricingAdvisor: true,
      proposalWriter: true,
      amendmentIntelligence: true,
      tenderPackage: true,
      bidComparison: true,
      deadlineTracker: true,
      actionTracker: true,
      decisionPanel: true,
      comments: true,
      auditTrail: true,
      excelExport: true,
      brandedExport: true,
      internalNotes: true,
      fullHistory: true,
    },
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    price: null,
    period: "",
    analysesLimit: null,
    historyDays: null,
    features: {
      singleDocAnalysis: true, rfxTypeSupport: true, basicSummary: true,
      requirementExtraction: true, requirementStatusTracking: true,
      sourceReferences: true, requirementOwnerField: true, requirementDueDates: true,
      requirementExcelExport: true, complianceMatrix: true, riskMapping: true,
      bidNoBidScoring: true, winProbability: true, competitorIntelligence: true,
      pricingAdvisor: true, proposalWriter: true, amendmentIntelligence: true,
      tenderPackage: true, bidComparison: true, deadlineTracker: true,
      actionTracker: true, decisionPanel: true, comments: true,
      auditTrail: true, excelExport: true, brandedExport: true,
      internalNotes: true, fullHistory: true,
    },
  },
};

/**
 * Check if a feature is available for a given plan.
 */
export function hasFeature(planKey, featureName) {
  const plan = PLANS[planKey] || PLANS.free;
  return plan.features[featureName] === true;
}

/**
 * Get the minimum plan required for a feature.
 */
export function minPlanFor(featureName) {
  for (const key of ["free", "pro", "team", "enterprise"]) {
    if (PLANS[key].features[featureName]) return key;
  }
  return "enterprise";
}

/**
 * Plan display names for upgrade prompts.
 */
export const PLAN_DISPLAY = {
  free: "Free",
  pro: "Professional",
  team: "Team",
  enterprise: "Enterprise",
};
