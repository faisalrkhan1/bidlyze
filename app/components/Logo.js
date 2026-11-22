"use client";

/**
 * Bidlyze logo (direction A, "Evidence b").
 *
 * Mark: a lowercase b on a petrol tile; the bowl holds a highlighted line of
 * text, because Bidlyze shows the exact words behind every finding.
 * Wordmark: Public Sans SemiBold, outlined (brandPaths.js), so it renders the
 * same with or without web fonts.
 *
 * Colours follow the theme: the tile is --logo-tile (petrol 700 in light mode,
 * petrol 500 in dark mode); the wordmark uses currentColor.
 */

import { WORDMARK_PATH, WORDMARK_BOX, HIGHLIGHT } from "./brandPaths";

export function LogoMark({ size = 32, className = "", title = "Bidlyze" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className={`shrink-0 ${className}`} role="img" aria-label={title}>
      <rect width="64" height="64" rx="15" style={{ fill: "var(--logo-tile, #0E5A6B)" }} />
      <rect x="17" y="11" width="7.5" height="42" rx="2" fill="#FFFFFF" />
      <path d="M24 26.75 H37 a9.25 9.25 0 0 1 9.25 9.25 V43 a9.25 9.25 0 0 1 -9.25 9.25 H24" fill="none" stroke="#FFFFFF" strokeWidth="7.5" />
      <rect x="27.5" y="37.25" width="12.5" height="5.5" rx="1.2" fill={HIGHLIGHT} />
    </svg>
  );
}

/** The word "Bidlyze" at a given cap height (px). Uses currentColor. */
export function LogoWordmark({ capHeight = 12, className = "" }) {
  const h = (capHeight * WORDMARK_BOX.height) / WORDMARK_BOX.capHeight;
  const w = (h * WORDMARK_BOX.width) / WORDMARK_BOX.height;
  return (
    <svg width={w} height={h} viewBox={`${WORDMARK_BOX.x} ${WORDMARK_BOX.y} ${WORDMARK_BOX.width} ${WORDMARK_BOX.height}`} className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** Mark + wordmark. `size` is the mark size; the wordmark's cap height is 45% of it. */
export function LogoFull({ size = 32, className = "" }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.3 }} aria-label="Bidlyze" role="img">
      <LogoMark size={size} title="" />
      <LogoWordmark capHeight={size * 0.45} />
    </span>
  );
}
