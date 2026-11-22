"use client";

// Small shared building blocks for the Submission Check beta screens.
// Uses the app's theme variables (globals.css), so light and dark both work.

import { STATUS, GROUPS, QUOTE_CHECK, TYPES } from "@/lib/submission/review";

const TONE_CLASS = {
  red: "bg-red-500/10 text-red-500 border-red-500/25",
  amber: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
  blue: "bg-sky-500/10 text-sky-500 border-sky-500/25",
  gray: "",
};

export const STATUS_TONE = { conflict: "red", missing: "red", partial: "amber", unproven: "amber", not_checked: "gray", doc_unconfirmed: "blue", manual: "blue", answered: "green" };
export const GROUP_TONE = { attention: "red", manual: "blue", ok: "green" };
export const GROUP_BAR = { attention: "#ef4444", manual: "#0ea5e9", ok: "#10b981" };

export function Pill({ tone = "gray", children, title, className = "" }) {
  const cls = TONE_CLASS[tone] || "";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${cls} ${className}`}
      style={tone === "gray" ? { background: "var(--icon-muted)", color: "var(--text-secondary)", borderColor: "var(--border-secondary)" } : undefined}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status, muted = false }) {
  return <Pill tone={muted && status !== "answered" ? "gray" : STATUS_TONE[status]} title={STATUS[status]?.help}>{STATUS[status]?.label || status}</Pill>;
}

export function TypePill({ type }) {
  const t = TYPES[type];
  if (!t) return null;
  return <Pill tone={type === "mandatory" ? "gray" : type === "conditional" ? "amber" : "blue"} title={t.help}>{t.label}</Pill>;
}

export function GroupPill({ group }) {
  return <Pill tone={GROUP_TONE[group]} title={GROUPS[group]?.hint}>{GROUPS[group]?.label}</Pill>;
}

export function QuoteCheckPill({ status }) {
  const q = QUOTE_CHECK[status] || QUOTE_CHECK.unverified;
  return (
    <Pill tone={q.tone} title={status === "verified" || status === "relocated" ? "Matched word for word in the document by Bidlyze's code" : undefined}>
      {(status === "verified" || status === "relocated") && <Icon name="check" className="w-3 h-3" />}
      {q.label}
    </Pill>
  );
}

export function Card({ children, className = "", style, ...rest }) {
  return (
    <div className={`rounded-2xl transition-colors duration-300 ${className}`} style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)", ...style }} {...rest}>
      {children}
    </div>
  );
}

export function Label({ children }) {
  return <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

export function PrimaryButton({ children, onClick, disabled, type = "button", className = "", ...rest }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, className = "", ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${className}`}
      style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "w-5 h-5" }) {
  return (
    <svg className={`animate-spin text-emerald-500 ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const PATHS = {
  check: "m4.5 12.75 6 6 9-13.5",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  upload: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5",
  shield: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  warning: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  download: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  left: "M15.75 19.5 8.25 12l7.5-7.5",
  right: "m8.25 4.5 7.5 7.5-7.5 7.5",
  x: "M6 18 18 6M6 6l12 12",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  external: "M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25",
  arrows: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  refresh: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99",
  clipboard: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z",
};

export function Icon({ name, className = "w-4 h-4", strokeWidth = 1.8 }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      {PATHS[name].split(" M").map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i ? `M${d}` : d} />)}
    </svg>
  );
}

/** A quoted passage with its location and verification status. */
export function Quote({ text, location, status, onView, accent = "var(--border-secondary)", testId }) {
  const unverified = status === "unverified";
  return (
    <figure className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }} data-testid={testId}>
      <blockquote className={`text-[13px] leading-relaxed pl-3 ${unverified ? "line-through opacity-60" : ""}`} style={{ borderLeft: `3px solid ${accent}`, color: "var(--text-primary)" }}>
        “{text}”
      </blockquote>
      <figcaption className="flex flex-wrap items-center gap-2 mt-2">
        {location && <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{location}</span>}
        {status && <QuoteCheckPill status={status} />}
        {onView && (
          <button type="button" onClick={onView} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 hover:underline">
            <Icon name="eye" className="w-3.5 h-3.5" /> View page
          </button>
        )}
      </figcaption>
    </figure>
  );
}

/** What happens to the proposal: shown before every live check (and in the results footer). */
export function ProcessingNote() {
  return (
    <details className="text-xs mt-1 group" style={{ color: "var(--text-muted)" }} data-testid="processing-note">
      <summary className="cursor-pointer select-none hover:underline">How your proposal is processed and stored</summary>
      <ul className="mt-2 space-y-1 list-disc pl-4" style={{ color: "var(--text-secondary)" }}>
        <li>The file is read in this browser. Only its text is sent to Bidlyze; the file itself is not uploaded.</li>
        <li>Bidlyze sends the text to an AI model (Anthropic&apos;s Claude, through OpenRouter) to run the check. We ask OpenRouter to use only providers that do not collect user data; providers may still keep requests briefly under their own terms.</li>
        <li>Bidlyze does not save the file, its text or the results on its servers. Server logs record only the size, duration and cost of each check.</li>
        <li>Results and your review notes are kept in this browser only, until you start a new check. Export the report to keep or share them.</li>
      </ul>
    </details>
  );
}

