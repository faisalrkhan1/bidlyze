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
    analysesLimit: 15,
    features: [
      "15 analyses per month",
      "Up to 5 documents per analysis",
      "Full analysis with risk flags & compliance gaps",
      "PDF report + Excel compliance matrix export",
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
      "Up to 20 documents per analysis",
      "Everything in Starter",
      "Multi-document intelligence",
      "Scope decomposition",
      "Proposal structure generator",
      "Word proposal template export",
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
      "Unlimited documents per analysis",
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
