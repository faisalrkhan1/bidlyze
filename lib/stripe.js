import Stripe from "stripe";

// Plan metadata (including analysesLimit and Stripe Price ID env mapping) lives
// in lib/plans.js, which is the single source of truth. Re-exported here so
// existing consumers (the Stripe webhook in particular) keep working without
// import-path changes.
export { PLANS, getPlanByPriceId } from "./plans";

let _stripe;
export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
