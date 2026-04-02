"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { ConfidenceBadge } from "./AIConfidence";

const STATUS_OPTIONS = [
  { value: "needs_review", label: "Needs Review", bg: "bg-gray-500/10", text: "text-gray-400" },
  { value: "met", label: "Met", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  { value: "partial", label: "Partial", bg: "bg-amber-500/10", text: "text-amber-400" },
  { value: "not_met", label: "Not Met", bg: "bg-red-500/10", text: "text-red-400" },
];

const CATEGORY_COLORS = {
  Technical: "bg-blue-500/10 text-blue-400",
  Financial: "bg-emerald-500/10 text-emerald-400",
  Legal: "bg-purple-500/10 text-purple-400",
  Administrative: "bg-amber-500/10 text-amber-400",
  Documentation: "bg-cyan-500/10 text-cyan-400",
  Compliance: "bg-orange-500/10 text-orange-400",
};

function StatusDropdown({ value, onChange }) {
  const current = STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${current.bg} ${current.text}`}
      >
        {current.label}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-40 rounded-lg shadow-lg overflow-hidden min-w-[130px]"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)" }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-medium transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${opt.bg.replace("/10", "")}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Requirement extraction table built from AI analysis.
 * Combines data from `requirements` and `complianceAnalysis.items`.
 * Status is editable and persisted to the `requirement_statuses` JSONB column.
 */
export default function RequirementsTable({ analysisId, userId, requirements = [], complianceItems = [] }) {
  const [statuses, setStatuses] = useState({});
  const [notes, setNotes] = useState({});
  const [filter, setFilter] = useState("all");
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  // Build unified row list from requirements + compliance items
  const rows = buildRows(requirements, complianceItems);

  // Load persisted statuses on mount
  useEffect(() => {
    if (!analysisId || !userId) return;
    getSupabase()
      .from("analyses")
      .select("requirement_statuses")
      .eq("id", analysisId)
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data?.requirement_statuses) {
          const saved = data.requirement_statuses;
          if (saved.statuses) setStatuses(saved.statuses);
          if (saved.notes) setNotes(saved.notes);
        }
        setLoaded(true);
      });
  }, [analysisId, userId]);

  // Persist statuses with debounce
  const persist = useCallback(
    async (newStatuses, newNotes) => {
      if (!analysisId || !userId) return;
      await getSupabase()
        .from("analyses")
        .update({ requirement_statuses: { statuses: newStatuses, notes: newNotes } })
        .eq("id", analysisId)
        .eq("user_id", userId);
    },
    [analysisId, userId]
  );

  useEffect(() => {
    if (!loaded || !dirty) return;
    const t = setTimeout(() => persist(statuses, notes), 800);
    return () => clearTimeout(t);
  }, [statuses, notes, loaded, dirty, persist]);

  function updateStatus(rowId, newStatus) {
    setDirty(true);
    setStatuses((prev) => ({ ...prev, [rowId]: newStatus }));
  }

  function updateNote(rowId, text) {
    setDirty(true);
    setNotes((prev) => ({ ...prev, [rowId]: text }));
  }

  // Filter rows
  const filteredRows = filter === "all" ? rows : rows.filter((r) => (statuses[r.id] || "needs_review") === filter);

  // Stats
  const total = rows.length;
  const metCount = rows.filter((r) => statuses[r.id] === "met").length;
  const partialCount = rows.filter((r) => statuses[r.id] === "partial").length;
  const notMetCount = rows.filter((r) => statuses[r.id] === "not_met").length;
  const reviewCount = total - metCount - partialCount - notMetCount;

  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--border-primary)" }}
    >
      {/* Header */}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h3 className="font-semibold">Requirements Tracker</h3>
            <ConfidenceBadge level="high" />
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {total} requirements extracted from tender document. Update status as you assess each item.
          </p>
        </div>
        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "All", value: "all", count: total },
            { label: "Review", value: "needs_review", count: reviewCount },
            { label: "Met", value: "met", count: metCount },
            { label: "Partial", value: "partial", count: partialCount },
            { label: "Not Met", value: "not_met", count: notMetCount },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filter === f.value ? "bg-emerald-500/10 text-emerald-400" : ""}`}
              style={filter !== f.value ? { color: "var(--text-muted)", border: "1px solid var(--border-secondary)" } : { border: "1px solid rgba(16,185,129,0.2)" }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-subtle)" }}>
        <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: "var(--bg-input)" }}>
          {metCount > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(metCount / total) * 100}%` }} />}
          {partialCount > 0 && <div className="h-full bg-amber-500" style={{ width: `${(partialCount / total) * 100}%` }} />}
          {notMetCount > 0 && <div className="h-full bg-red-500" style={{ width: `${(notMetCount / total) * 100}%` }} />}
        </div>
        <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-muted)" }}>
          {metCount}/{total} met
        </span>
      </div>

      {/* Table — scrollable on mobile */}
      <div className="overflow-x-auto">
      <div className="min-w-[700px]">
      {/* Table Header */}
      <div
        className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-medium uppercase tracking-wider"
        style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}
      >
        <div className="col-span-1">#</div>
        <div className="col-span-5">Requirement</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-1 text-center">Priority</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-1 text-center">Notes</div>
      </div>

      {/* Rows */}
      {filteredRows.map((row, idx) => {
        const isExpanded = expandedRow === row.id;
        return (
          <div key={row.id}>
            <div
              className="grid grid-cols-12 gap-2 px-5 py-3 items-center text-sm cursor-pointer transition-colors"
              style={{ borderBottom: "1px solid var(--border-primary)" }}
              onClick={() => setExpandedRow(isExpanded ? null : row.id)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="col-span-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>{idx + 1}</div>
              <div className="col-span-5 text-sm font-medium leading-snug pr-2">{row.requirement}</div>
              <div className="col-span-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[row.category] || "bg-gray-500/10 text-gray-400"}`}>
                  {row.category}
                </span>
              </div>
              <div className="col-span-1 text-center">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  row.mandatory ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"
                }`}>
                  {row.priority || (row.mandatory ? "HIGH" : "MED")}
                </span>
              </div>
              <div className="col-span-2 text-center" onClick={(e) => e.stopPropagation()}>
                <StatusDropdown
                  value={statuses[row.id] || "needs_review"}
                  onChange={(v) => updateStatus(row.id, v)}
                />
              </div>
              <div className="col-span-1 text-center">
                {notes[row.id] ? (
                  <span className="w-5 h-5 inline-flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </span>
                ) : (
                  <svg className="w-4 h-4 mx-auto" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Expanded row — notes + details */}
            {isExpanded && (
              <div
                className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
                style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}
              >
                {/* Details */}
                <div className="space-y-2">
                  {row.commonIssue && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Common Issue</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{row.commonIssue}</p>
                    </div>
                  )}
                  {row.remediation && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Remediation</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{row.remediation}</p>
                    </div>
                  )}
                  {row.timeToRemediate && (
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Est. time to resolve: <span style={{ color: "var(--text-secondary)" }}>{row.timeToRemediate}</span>
                    </p>
                  )}
                </div>
                {/* Note input */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Your Notes</p>
                  <textarea
                    value={notes[row.id] || ""}
                    onChange={(e) => updateNote(row.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Add notes for this requirement..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/25 transition-colors"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
      </div>
    </div>
  );
}

/**
 * Merge requirements array + compliance items into unified rows.
 */
function buildRows(requirements, complianceItems) {
  const rows = [];
  const seen = new Set();

  // Requirements from the main requirements array
  if (requirements?.length) {
    requirements.forEach((r, i) => {
      const key = `req-${i}`;
      rows.push({
        id: key,
        requirement: r.requirement,
        category: r.category || "Technical",
        mandatory: r.mandatory,
        priority: r.priority,
        source: "requirements",
        commonIssue: null,
        remediation: null,
        timeToRemediate: null,
      });
      seen.add(r.requirement?.toLowerCase().trim());
    });
  }

  // Compliance items (avoid duplicates)
  if (complianceItems?.length) {
    complianceItems.forEach((c, i) => {
      const itemText = c.item || c.requirement;
      if (!itemText) return;
      const key = itemText.toLowerCase().trim();
      if (seen.has(key)) return;
      seen.add(key);

      rows.push({
        id: `comp-${i}`,
        requirement: itemText,
        category: c.category || "Compliance",
        mandatory: c.severity === "HIGH",
        priority: c.severity || "MEDIUM",
        source: "compliance",
        commonIssue: c.commonIssue,
        remediation: c.remediation,
        timeToRemediate: c.timeToRemediate,
      });
    });
  }

  return rows;
}
