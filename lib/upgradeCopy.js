/**
 * Pre-launch-aware copy for upgrade CTAs.
 *
 * During pre-launch (`NEXT_PUBLIC_PAYMENTS_ENABLED !== "true"`), upgrade buttons
 * route users to the waitlist and explainer text says "launches soon". Once
 * the env var is flipped to "true", these helpers fall back to the original
 * "Upgrade to Pro/Team" copy without further code changes.
 *
 * Both server and client components can call these helpers; the env-var check
 * is the only state they read.
 */

import { PLAN_DISPLAY } from "./plans";

export function paymentsEnabled() {
  return process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
}

function displayName(targetPlan) {
  return PLAN_DISPLAY[targetPlan] || targetPlan;
}

export function getUpgradeButtonLabel(targetPlan) {
  if (paymentsEnabled()) {
    return `Upgrade to ${displayName(targetPlan)}`;
  }
  return `Join ${displayName(targetPlan)} Waitlist`;
}

export function getUpgradeExplainerText(targetPlan) {
  const name = displayName(targetPlan);
  if (paymentsEnabled()) {
    return `Upgrade to ${name} to unlock this feature.`;
  }
  return `This feature will be available on the ${name} plan. ${name} launches soon — join the waitlist to be first in line.`;
}
