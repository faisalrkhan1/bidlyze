"use client";

/**
 * Bidlyze Logo System
 *
 * Mark: geometric stacked bars — abstract document/analysis symbol
 * Based on reference logo with three rows:
 *   Top: long bar + small pill
 *   Middle: medium bar + circle
 *   Bottom: full-width bar
 */

export function LogoMark({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="100" height="100" rx="22" fill="#10b981" />
      {/* Top row: long bar + small pill */}
      <rect x="14" y="16" width="42" height="16" rx="8" fill="white" />
      <rect x="62" y="16" width="24" height="16" rx="8" fill="white" opacity="0.8" />
      {/* Middle row: medium bar + circle */}
      <rect x="14" y="42" width="36" height="16" rx="8" fill="white" />
      <circle cx="72" cy="50" r="8" fill="white" opacity="0.8" />
      {/* Bottom row: full-width bar */}
      <rect x="14" y="68" width="72" height="16" rx="8" fill="white" />
    </svg>
  );
}

export function LogoFull({ size = 32, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.5 }}>
        Bidlyze
      </span>
    </div>
  );
}
