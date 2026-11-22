"use client";

// Shared building blocks for the Submission Check screens (trust upgrade, Nov 2026).
// Theme variables come from app/globals.css, so light and dark both work.
//  - Colour means status: red = needs attention, amber = check manually, green = OK.
//    Everything else is ink, slate and the one brand colour (petrol) for actions.
//  - Words quoted from the tender or the proposal are set in a serif, like the
//    printed document, with a highlighter stroke when Bidlyze found them word for word.

import { STATUS, GROUPS, QUOTE_CHECK, TYPES } from "@/lib/submission/review";

const TONE = {
  red: { color: "var(--st-attention)", bg: "var(--st-attention-bg)", border: "var(--st-attention-border)" },
  amber: { color: "var(--st-manual)", bg: "var(--st-manual-bg)", border: "var(--st-manual-border)" },
  green: { color: "var(--st-ok)", bg: "var(--st-ok-bg)", border: "var(--st-ok-border)" },
  blue: { color: "var(--accent-text)", bg: "var(--accent-muted)", border: "var(--accent-border)" },
  gray: { color: "var(--text-secondary)", bg: "var(--st-neutral-bg)", border: "var(--border-secondary)" },
  outline: { color: "var(--text-secondary)", bg: "transparent", border: "var(--border-secondary)" },
};

export const GROUP_TONE = { attention: "red", manual: "amber", ok: "green" };
export const STATUS_TONE = { conflict: "red", missing: "red", partial: "red", unproven: "red", not_checked: "red", doc_unconfirmed: "amber", manual: "amber", answered: "green" };
export const GROUP_BAR = { attention: "var(--st-attention)", manual: "var(--st-manual)", ok: "var(--st-ok)" };
export const GROUP_COLOR = GROUP_BAR;

export function Pill({ tone = "gray", children, title, className = "" }) {
  const t = TONE[tone] || TONE.gray;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[12px] font-medium whitespace-nowrap ${className}`}
      style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}` }}
    >
      {children}
    </span>
  );
}

export function Dot({ color, className = "" }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${className}`} style={{ background: color }} aria-hidden="true" />;
}

/** Classification (Conflict, Partial, Answered…): neutral label with a dot in the review colour. */
export function StatusPill({ status, group, muted = false }) {
  const g = group || STATUS[status]?.group || "attention";
  const color = muted && status !== "answered" ? GROUP_COLOR.manual : GROUP_COLOR[g];
  return (
    <Pill tone="outline" title={STATUS[status]?.help}>
      <Dot color={color} />
      <span style={{ color: "var(--text-primary)" }}>{STATUS[status]?.label || status}</span>
    </Pill>
  );
}

/** Review result (Needs attention / Check manually / OK): the one coloured label. */
export function GroupPill({ group }) {
  return <Pill tone={GROUP_TONE[group]} title={GROUPS[group]?.hint}><Dot color={GROUP_COLOR[group]} />{GROUPS[group]?.label}</Pill>;
}

export function TypePill({ type }) {
  const t = TYPES[type];
  if (!t) return null;
  return <Pill tone="outline" title={t.help}>{t.label}</Pill>;
}

/** Bidlyze's word-for-word check of a quote. */
export function QuoteCheckPill({ status }) {
  const q = QUOTE_CHECK[status] || QUOTE_CHECK.unverified;
  const found = status === "verified" || status === "relocated";
  const color = found ? "var(--st-ok)" : status === "approximate" ? "var(--st-manual)" : status === "none" ? "var(--text-muted)" : "var(--st-attention)";
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium whitespace-nowrap" style={{ color }} title={found ? "Matched word for word in the document by Bidlyze's code" : undefined}>
      <Icon name={found ? "check" : status === "none" ? "info" : "warning"} className="w-3.5 h-3.5" strokeWidth={found ? 2.4 : 1.8} />
      {q.label}
    </span>
  );
}

/** Panel: the one container style (12 px radius, hairline border, no shadow). */
export function Card({ children, className = "", style, ...rest }) {
  return (
    <div className={`rounded-xl transition-colors duration-300 ${className}`} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", ...style }} {...rest}>
      {children}
    </div>
  );
}

export function Label({ children, className = "" }) {
  return <p className={`text-[13px] font-semibold mb-2 ${className}`} style={{ color: "var(--text-secondary)" }}>{children}</p>;
}

export function PrimaryButton({ children, onClick, disabled, type = "button", className = "", ...rest }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-[var(--accent)] hover:bg-[var(--accent-hover)] ${className}`}
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
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 hover:bg-[var(--bg-card-hover)] ${className}`}
      style={{ border: "1px solid var(--border-secondary)", color: "var(--text-primary)", background: "var(--bg-card)" }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TextButton({ children, onClick, className = "", ...rest }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 text-[13px] font-medium hover:underline underline-offset-2 ${className}`} style={{ color: "var(--accent-text)" }} {...rest}>
      {children}
    </button>
  );
}

export function Spinner({ className = "w-5 h-5", color = "var(--accent)" }) {
  return (
    <svg className={`animate-spin ${className}`} style={{ color }} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
      <path className="opacity-90" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

/** Loading placeholder rows. */
export function Skeleton({ rows = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg animate-pulse" style={{ background: "var(--st-neutral-bg)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded animate-pulse" style={{ background: "var(--st-neutral-bg)", width: `${70 - i * 12}%` }} />
            <div className="h-2.5 rounded animate-pulse" style={{ background: "var(--st-neutral-bg)", width: `${45 - i * 6}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Callout for warnings, errors and the human-review notice. */
export function Notice({ tone = "gray", icon = "info", title, children, action, className = "", ...rest }) {
  const t = TONE[tone] || TONE.gray;
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${className}`} style={{ background: t.bg, border: `1px solid ${t.border}` }} {...rest}>
      <Icon name={icon} className="w-[18px] h-[18px] shrink-0 mt-px" />
      <div className="flex-1 min-w-0 text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
        {title && <p className="font-semibold" style={{ color: t.color === TONE.gray.color ? "var(--text-primary)" : t.color }}>{title}</p>}
        <div style={{ color: "var(--text-secondary)" }}>{children}</div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon = "doc", title, children, action }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--st-neutral-bg)", color: "var(--text-secondary)" }}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <p className="text-sm mt-1 max-w-md" style={{ color: "var(--text-secondary)" }}>{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * The five steps of the workflow. `current` is 0-based; steps before it are done.
 * The numbered markers are meaningful here: this is a fixed sequence.
 */
export const WORKFLOW_STEPS = ["Choose tender", "Upload proposal", "Run check", "Review findings", "Export report"];
export function Stepper({ current = 0, steps = WORKFLOW_STEPS }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3 overflow-x-auto max-w-full" aria-label="Submission Check steps" data-testid="stepper">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 shrink-0" aria-current={active ? "step" : undefined}>
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold tabular"
              style={
                done
                  ? { background: "var(--accent)", color: "#fff" }
                  : active
                  ? { border: "1.5px solid var(--accent)", color: "var(--accent-text)", background: "var(--accent-muted)" }
                  : { border: "1px solid var(--border-secondary)", color: "var(--text-muted)" }
              }
            >
              {done ? <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.6} /> : i + 1}
            </span>
            <span className={`text-[13px] ${active ? "font-semibold" : "font-medium"} ${active ? "" : "hidden md:inline"}`} style={{ color: active ? "var(--text-primary)" : done ? "var(--text-secondary)" : "var(--text-muted)" }}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="w-4 sm:w-8 h-px" style={{ background: "var(--border-secondary)" }} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
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
  lock: "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z",
  info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  clipboard: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z",
};

export function Icon({ name, className = "w-4 h-4", strokeWidth = 1.8 }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      {PATHS[name].split(" M").map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i ? `M${d}` : d} />)}
    </svg>
  );
}

/**
 * A passage quoted from the tender or the proposal, set like the document it comes from.
 * Found word for word → highlighter stroke; not found → struck through.
 */
export function Quote({ text, location, status, onView, accent = "var(--border-secondary)", testId }) {
  const unverified = status === "unverified";
  const found = status === "verified" || status === "relocated";
  return (
    <figure className="rounded-lg overflow-hidden" style={{ background: "var(--excerpt-bg)", border: "1px solid var(--border-primary)" }} data-testid={testId}>
      <blockquote
        className={`font-document text-[15px] leading-[1.6] px-4 py-3 ${unverified ? "line-through opacity-60" : ""}`}
        style={{ borderLeft: `3px solid ${accent}`, color: "var(--text-primary)" }}
      >
        {found ? <span className="evidence-stroke">{text}</span> : text}
      </blockquote>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[12px]" style={{ borderTop: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
        {location && <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{location}</span>}
        {status && <QuoteCheckPill status={status} />}
        {onView && (
          <button type="button" onClick={onView} className="ml-auto inline-flex items-center gap-1 font-medium hover:underline underline-offset-2" style={{ color: "var(--accent-text)" }}>
            <Icon name="eye" className="w-3.5 h-3.5" /> View page
          </button>
        )}
      </figcaption>
    </figure>
  );
}

/** What happens to the proposal: shown before every live check (and in the results footer). */
export function ProcessingNote({ open = false }) {
  return (
    <details className="text-[13px] group" style={{ color: "var(--text-secondary)" }} data-testid="processing-note" open={open || undefined}>
      <summary className="cursor-pointer select-none inline-flex items-center gap-1.5 font-medium hover:underline underline-offset-2" style={{ color: "var(--text-primary)" }}>
        <Icon name="lock" className="w-4 h-4" /> How your proposal is processed and stored
      </summary>
      <ul className="mt-2 space-y-1.5 list-disc pl-5 leading-relaxed">
        <li>The file is read in this browser. Only its text is sent to Bidlyze; the file itself is not uploaded.</li>
        <li>Bidlyze sends the text to an AI model (Anthropic&apos;s Claude, through OpenRouter) to run the check. We ask OpenRouter to use only providers that do not collect user data; providers may still keep requests briefly under their own terms.</li>
        <li>Bidlyze does not save the file, its text or the results on its servers. Server logs record only the size, duration and cost of each check.</li>
        <li>Results and your review notes are kept in this browser only, until you start a new check. Export the report to keep or share them.</li>
      </ul>
    </details>
  );
}
