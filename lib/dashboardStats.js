// Dashboard statistics (pure, unit-tested).

/**
 * Average bid score (0–100) over analyses that have a real numeric score.
 * Returns null when there is none, so the dashboard shows "--" instead of 0 or NaN.
 * @param {{bid_score: unknown}[]} rows
 */
export function averageBidScore(rows) {
  const scores = (rows || [])
    .map((r) => (r?.bid_score === null || r?.bid_score === undefined || r?.bid_score === "" ? NaN : Number(r.bid_score)))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
