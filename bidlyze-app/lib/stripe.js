import Stripe from "stripe";

let _stripe;
export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export const PRICE_IDS = {
  starter: "price_1TDLd7JbZq5ga8LYLedS8Xsb",
  professional: "price_1TDLdkJbZq5ga8LY1wnyYxAC",
  enterprise: "price_1TDLeWJbZq5ga8LYsAOgqoQ1",
};

// Canonical analyses limits used by webhook + checkout for DB writes.
// null = unlimited (enterprise).
export const PLAN_LIMITS = {
  free: 3,
  starter: 10,
  professional: 50,
  enterprise: null,
};

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    analysesLimit: 3,
    features: [
      "3 tender analyses per month",
      "Single document upload",
      "AI summary & bid score",
      "Basic compliance checklist",
      "PDF report export",
      "No signup required",
    ],
  },
  starter: {
    name: "Starter",
    price: 29,
    priceId: PRICE_IDS.starter,
    analysesLimit: PLAN_LIMITS.starter,
    features: [
      "10 analyses per month",
      "5 documents per analysis",
      "Full risk & compliance analysis",
      "PDF + Excel export",
      "Full analysis history",
      "Email support",
    ],
  },
  professional: {
    name: "Professional",
    price: 99,
    priceId: PRICE_IDS.professional,
    analysesLimit: 50,
    popular: true,
    features: [
      "50 analyses per month",
      "20 documents per analysis",
      "Everything in Starter",
      "Multi-document intelligence",
      "Scope decomposition",
      "Proposal structure generator",
      "Word template export",
      "Up to 10 users",
      "Priority support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: 299,
    priceId: PRICE_IDS.enterprise,
    analysesLimit: null,
    features: [
      "Unlimited analyses",
      "Unlimited documents",
      "Everything in Professional",
      "API access",
      "Unlimited users",
      "Dedicated account manager",
      "Custom integrations",
    ],
  },
};

export function getPlanByPriceId(priceId) {
  const mapping = {
    [PRICE_IDS.starter]: "starter",
    [PRICE_IDS.professional]: "professional",
    [PRICE_IDS.enterprise]: "enterprise",
  };
  return mapping[priceId] || null;
}
