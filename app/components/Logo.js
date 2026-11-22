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

import { WORDMARK_PATH, WORDMARK_BOX, HIGHLIGHT, MARK_MASTER, MARK_SMALL } from "./brandPaths";

/**
 * The mark. At 20 px and below it switches to the pixel-fitted small drawing
 * (MARK_SMALL), which stays crisp in browser tabs and dense lists.
 */
export function LogoMark({ size = 32, className = "", title = "Bidlyze" }) {
  const m = size <= 20 ? MARK_SMALL : MARK_MASTER;
  const h = m.highlight;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${m.viewBox} ${m.viewBox}`} xmlns="http://www.w3.org/2000/svg" className={`shrink-0 ${className}`} role={title ? "img" : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true}>
      <rect width={m.viewBox} height={m.viewBox} rx={m.radius} style={{ fill: "var(--logo-tile, #0E5A6B)" }} />
      <path fill="#FFFFFF" fillRule="evenodd" d={m.b} />
      <rect x={h.x} y={h.y} width={h.w} height={h.h} rx={h.rx} fill={HIGHLIGHT} />
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
