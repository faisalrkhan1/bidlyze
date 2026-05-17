/**
 * Bidlyze Plan Configuration — single source of truth for pricing/gating.
 *
 * Tiers: free → pro → team → enterprise
 * All plans include RFI / RFQ / RFP / Other document types.
 * Plans are differentiated by depth, volume, exports, and collaboration.
 */

export const PLANS = {
  // Temporary pre-launch tier. Every signed-up user gets this until payments
  // are enabled (PAYMENTS_ENABLED=true). Mirrors Pro feature flags but caps
  // usage at 10 analyses/month. Not a Stripe price — `stripePriceIdEnv = null`
  // so the webhook's getPlanByPriceId() never resolves to "prelaunch".
  prelaunch: {
    key: "prelaunch",
    name: "Pre-Launch Access",
    price: 0,
    period: "during pre-launch",
    analysesLimit: 10,
    historyDays: null,
    description: "Full Pro features during pre-launch, 10 analyses per month.",
    stripePriceIdEnv: null,
    features: {
      // Mirrors pro.features exactly. Team-only flags (auditTrail, brandedExport)
      // stay false so Team-locked surfaces still gate during pre-launch.
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
    analysesLimit: 50,
    historyDays: null, // unlimited
    stripePriceIdEnv: "STRIPE_PRO_PRICE_ID",
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
    // Team launches as an early-access tier at $99/month. The post-early-access
    // sticker is $149/month — that target lives in `regularPrice` so the
    // pricing page can render an "after early-access" sub-line without
    // hard-coding numbers in two places.
    name: "Team",
    price: 99,
    regularPrice: 149,
    period: "/month",
    analysesLimit: 80,
    historyDays: null,
    stripePriceIdEnv: "STRIPE_TEAM_PRICE_ID",
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

// Legacy plan keys from before the 98d1297 rename
// (starter/professional → pro/team). Keep these as aliases so old
// DB rows, restored backups, or stale client state don't silently
// downgrade a paying customer to the free tier.
const LEGACY_PLAN_ALIASES = {
  professional: 'pro',
  starter: 'pro',
};

function normalizePlanKey(planKey) {
  return LEGACY_PLAN_ALIASES[planKey] || planKey;
}

/**
 * Check if a feature is available for a given plan.
 */
export function hasFeature(planKey, featureName) {
  const plan = PLANS[normalizePlanKey(planKey)] || PLANS.free;
  return plan.features[featureName] === true;
}

/**
 * Get the minimum *paid* plan required for a feature.
 *
 * The `prelaunch` tier is deliberately skipped here — it is a temporary
 * pre-launch grant, not a permanent rung on the pricing ladder. Upgrade
 * prompts must continue to point users at Pro or Team.
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
  prelaunch: "Pre-Launch Access",
  free: "Free",
  pro: "Professional",
  team: "Team",
  enterprise: "Enterprise",
};

/**
 * Resolve a Stripe Price ID to a plan key.
 *
 * Each plan above declares which env var holds its Stripe Price ID via
 * `stripePriceIdEnv`. This function is the single mapping consumed by the
 * Stripe webhook so plan limits and prices stay co-located.
 *
 * Server-only: relies on non-public env vars. The `process.env` lookup runs
 * inside the function body, so it is safe to keep this module client-importable
 * (the values just resolve to undefined in the browser, which never calls
 * this function).
 */
export function getPlanByPriceId(priceId) {
  if (!priceId) return null;
  for (const [key, plan] of Object.entries(PLANS)) {
    const envName = plan.stripePriceIdEnv;
    if (envName && process.env[envName] === priceId) return key;
  }
  return null;
}
