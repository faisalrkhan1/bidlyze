"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

// Severity colour tokens per spec.
const SEVERITY_COLORS = {
  critical: "#DC2626",
  high: "#EA580C",
  medium: "#D97706",
  low: "#16A34A",
};

const LEVEL_BG_TEXT = {
  low: { bg: "#16A34A", text: "#FFFFFF" },
  medium: { bg: "#D97706", text: "#FFFFFF" },
  high: { bg: "#EA580C", text: "#FFFFFF" },
  critical: { bg: "#DC2626", text: "#FFFFFF" },
};

const SECTION_ANCHOR = "disqualification-risks";
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_MS = 60_000;
const AUTO_POLL_FRESH_WINDOW_MS = 2 * 60 * 1000; // analyses younger than this auto-poll

function scrollToSection() {
  const el = document.getElementById(SECTION_ANCHOR);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function fetchRecord(analysisId) {
  const { data, error } = await getSupabase()
    .from("disqualification_analyses")
    .select("*")
    .eq("analysis_id", analysisId)
    .maybeSingle();
  if (error) {
    // PostgREST returns an error when the row doesn't exist via .single(),
    // but .maybeSingle() returns null gracefully. Any real error we surface.
    if (error.code && error.code !== "PGRST116") {
      console.error("[disqual] fetch error:", error.message);
    }
    return null;
  }
  return data || null;
}

async function triggerRun(analysisId) {
  const { data: { session } } = await getSupabase().auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/analyze/disqualification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ analysis_id: analysisId }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || `Run failed (${res.status})`);
  }
  return res.json();
}

/**
 * Custom hook: fetches the disqualification record + manages polling and
 * the manual "Run risk check" trigger. Shared by the badge and the section.
 */
function useDisqualificationRecord({ analysisId, analysisCreatedAt }) {
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | empty | running | error
  const [error, setError] = useState(null);
  const pollStartRef = useRef(null);
  const pollTimerRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollStartRef.current = Date.now();
    const tick = async () => {
      const fresh = await fetchRecord(analysisId);
      if (fresh) {
        setRecord(fresh);
        setStatus("ready");
        stopPolling();
        return;
      }
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed >= POLL_MAX_MS) {
        setStatus("empty");
        stopPolling();
        return;
      }
      pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    };
    pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
  }, [analysisId, stopPolling]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchRecord(analysisId);
      if (cancelled) return;
      if (r) {
        setRecord(r);
        setStatus("ready");
        return;
      }
      // No record yet — auto-poll if analysis is fresh (async job likely still running).
      const createdMs = analysisCreatedAt ? new Date(analysisCreatedAt).getTime() : 0;
      const isFresh = createdMs && (Date.now() - createdMs) < AUTO_POLL_FRESH_WINDOW_MS;
      if (isFresh) {
        setStatus("loading");
        startPolling();
      } else {
        setStatus("empty");
      }
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [analysisId, analysisCreatedAt, startPolling, stopPolling]);

  const runNow = useCallback(async () => {
    setStatus("running");
    setError(null);
    try {
      const result = await triggerRun(analysisId);
      if (result?.disqualification) {
        setRecord(result.disqualification);
        setStatus("ready");
      } else {
        // If the API returned success without the row, fall back to polling.
        startPolling();
        setStatus("loading");
      }
    } catch (e) {
      setError(e?.message || "Failed to run risk check");
      setStatus("empty");
    }
  }, [analysisId, startPolling]);

  return { record, status, error, runNow };
}

export function DisqualificationRiskBadge({ analysisId, analysisCreatedAt }) {
  const { record, status, error, runNow } = useDisqualificationRecord({ analysisId, analysisCreatedAt });

  if (status === "loading") {
    return (
      <span
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border animate-pulse"
        style={{
          background: "var(--bg-subtle)",
          color: "var(--text-muted)",
          borderColor: "var(--border-primary)",
        }}
      >
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="40" />
        </svg>
        Disqualification risk: analyzing…
      </span>
    );
  }

  if (status === "running") {
    return (
      <span
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border"
        style={{ background: "#D4764E1A", color: "#D4764E", borderColor: "#D4764E55" }}
      >
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="40" />
        </svg>
        Running risk check…
      </span>
    );
  }

  if (status === "empty" || !record) {
    return (
      <button
        type="button"
        onClick={runNow}
        title={error || "Run the disqualification risk detector for this analysis"}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
        style={{ background: "#D4764E", color: "#FFFFFF", borderColor: "#D4764E" }}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
        Run risk check
      </button>
    );
  }

  const colors = LEVEL_BG_TEXT[record.risk_level] || LEVEL_BG_TEXT.low;
  return (
    <button
      type="button"
      onClick={scrollToSection}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border transition-transform hover:scale-[1.02]"
      style={{ background: colors.bg, color: colors.text, borderColor: colors.bg }}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
      </svg>
      Disqualification Risk: {record.risk_score}% — {String(record.risk_level || "").toUpperCase()}
    </button>
  );
}

function ItemCard({ item, kind }) {
  // kind: 'fixed' | 'dynamic'
  const sev = item.severity || "medium";
  const sevColor = SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium;
  const title = kind === "fixed" ? item.label : item.title;
  const statusLabel = kind === "fixed"
    ? (item.status === "required" ? "Required" : item.status === "not_required" ? "Not Required" : "Not Specified")
    : "Risk";
  return (
    <div
      className="p-4 rounded-xl transition-colors duration-300"
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span
            className="mt-0.5 shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full"
            style={{ background: `${sevColor}1A`, color: sevColor }}
          >
            {kind === "fixed" ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 12.75 6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
              </svg>
            )}
          </span>
          <p className="text-sm font-semibold leading-snug">{title}</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider"
          style={{ background: `${sevColor}1A`, color: sevColor, border: `1px solid ${sevColor}33` }}
        >
          {statusLabel}
        </span>
      </div>
      {item.details && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.details}</p>
      )}
      {item.evidence_quote && (
        <p className="text-xs italic mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          “{item.evidence_quote}”
        </p>
      )}
      {item.page_reference && (
        <p className="text-[11px] mt-2 font-medium" style={{ color: "var(--text-muted)" }}>
          Reference: {item.page_reference}
        </p>
      )}
    </div>
  );
}

export function DisqualificationRiskSection({ analysisId, analysisCreatedAt }) {
  const { record, status, error, runNow } = useDisqualificationRecord({ analysisId, analysisCreatedAt });
  const [confirmedOpen, setConfirmedOpen] = useState(false);

  const headerCard = (children) => (
    <section
      id={SECTION_ANCHOR}
      className="rounded-2xl overflow-hidden transition-colors duration-300"
      style={{ border: "1px solid var(--border-primary)" }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between gap-3"
        style={{ borderBottom: "1px solid var(--border-primary)" }}
      >
        <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-instrument-serif), serif" }}>
          Disqualification Risks
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          GCC eligibility-stage checklist
        </span>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );

  if (status === "loading") {
    return headerCard(
      <div className="space-y-3">
        <div className="h-6 w-1/3 rounded animate-pulse" style={{ background: "var(--bg-subtle)" }} />
        <div className="h-4 w-2/3 rounded animate-pulse" style={{ background: "var(--bg-subtle)" }} />
        <div className="h-24 w-full rounded-xl animate-pulse" style={{ background: "var(--bg-subtle)" }} />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Running disqualification risk check… this can take up to 60 seconds.
        </p>
      </div>
    );
  }

  if (status === "running") {
    return headerCard(
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 animate-spin" style={{ color: "#D4764E" }} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="40" />
        </svg>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Running the disqualification risk detector…</p>
      </div>
    );
  }

  if (status === "empty" || !record) {
    return headerCard(
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          We haven&apos;t run the disqualification risk detector for this analysis yet.
        </p>
        <button
          type="button"
          onClick={runNow}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: "#D4764E", color: "#FFFFFF" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          Run risk check
        </button>
        {error && (
          <p className="text-xs" style={{ color: SEVERITY_COLORS.critical }}>{error}</p>
        )}
      </div>
    );
  }

  // Ready state.
  const fixed = Array.isArray(record.fixed_checks) ? record.fixed_checks : [];
  const dynamic = Array.isArray(record.dynamic_findings) ? record.dynamic_findings : [];

  const criticalFixed = fixed.filter((f) => f.status === "not_specified" && f.severity === "critical");
  const criticalDynamic = dynamic.filter((d) => d.severity === "critical");
  const highFixed = fixed.filter((f) => f.status === "not_specified" && f.severity === "high");
  const highDynamic = dynamic.filter((d) => d.severity === "high");
  const mediumFixed = fixed.filter((f) => f.status === "not_specified" && f.severity === "medium");
  const mediumDynamic = dynamic.filter((d) => d.severity === "medium");
  const confirmedRequired = fixed.filter((f) => f.status === "required");

  const colors = LEVEL_BG_TEXT[record.risk_level] || LEVEL_BG_TEXT.low;

  return (
    <section
      id={SECTION_ANCHOR}
      className="rounded-2xl overflow-hidden transition-colors duration-300"
      style={{ border: "1px solid var(--border-primary)" }}
    >
      <div
        className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
        style={{ borderBottom: "1px solid var(--border-primary)" }}
      >
        <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-instrument-serif), serif" }}>
          Disqualification Risks
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          GCC eligibility-stage checklist
        </span>
      </div>

      <div className="p-5 space-y-6">
        {/* Header — score, level pill, summary */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className="shrink-0 flex flex-col items-center justify-center px-5 py-4 rounded-2xl"
            style={{ background: `${colors.bg}1A`, border: `1px solid ${colors.bg}33`, minWidth: 140 }}
          >
            <span className="text-4xl font-bold" style={{ color: colors.bg }}>{record.risk_score}</span>
            <span className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>RISK SCORE / 100</span>
          </div>
          <div className="flex-1 min-w-0">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2"
              style={{ background: colors.bg, color: colors.text }}
            >
              {String(record.risk_level).toUpperCase()} risk
            </span>
            {record.summary && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{record.summary}</p>
            )}
          </div>
        </div>

        {/* Critical Gaps */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: SEVERITY_COLORS.critical }}>
            Critical Gaps
          </p>
          {criticalFixed.length === 0 && criticalDynamic.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No critical gaps detected.</p>
          ) : (
            <div className="space-y-3">
              {criticalFixed.map((f) => <ItemCard key={`cf-${f.id}`} item={f} kind="fixed" />)}
              {criticalDynamic.map((d, i) => <ItemCard key={`cd-${i}`} item={d} kind="dynamic" />)}
            </div>
          )}
        </div>

        {/* High-Risk Items */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: SEVERITY_COLORS.high }}>
            High-Risk Items
          </p>
          {highFixed.length === 0 && highDynamic.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No high-risk items detected.</p>
          ) : (
            <div className="space-y-3">
              {highFixed.map((f) => <ItemCard key={`hf-${f.id}`} item={f} kind="fixed" />)}
              {highDynamic.map((d, i) => <ItemCard key={`hd-${i}`} item={d} kind="dynamic" />)}
            </div>
          )}
        </div>

        {/* Other Findings (medium) */}
        {(mediumFixed.length > 0 || mediumDynamic.length > 0) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: SEVERITY_COLORS.medium }}>
              Other Findings
            </p>
            <div className="space-y-3">
              {mediumFixed.map((f) => <ItemCard key={`mf-${f.id}`} item={f} kind="fixed" />)}
              {mediumDynamic.map((d, i) => <ItemCard key={`md-${i}`} item={d} kind="dynamic" />)}
            </div>
          </div>
        )}

        {/* Confirmed Requirements (collapsible, default closed) */}
        {confirmedRequired.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
            <button
              type="button"
              onClick={() => setConfirmedOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              style={{ background: "var(--bg-subtle)" }}
            >
              <span className="text-sm font-semibold">
                Confirmed Requirements ({confirmedRequired.length})
              </span>
              <svg
                className="w-4 h-4 transition-transform"
                style={{ color: "var(--text-muted)", transform: confirmedOpen ? "rotate(180deg)" : "" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {confirmedOpen && (
              <div className="p-4 space-y-3" style={{ borderTop: "1px solid var(--border-primary)" }}>
                {confirmedRequired.map((f) => <ItemCard key={`req-${f.id}`} item={f} kind="fixed" />)}
              </div>
            )}
          </div>
        )}

        {/* Re-run */}
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--border-primary)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Generated by AI — verify each finding against the source tender before relying on it.
          </p>
          <button
            type="button"
            onClick={runNow}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "#D4764E", color: "#FFFFFF" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Re-run analysis
          </button>
        </div>
      </div>
    </section>
  );
}
