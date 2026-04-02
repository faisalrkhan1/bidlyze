"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

function Dropdown({ value, options, onChange }) {
  const current = options.find((s) => s.value === value) || options[0];
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${current.bg} ${current.text}`}>
        {current.label}
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-40 rounded-lg shadow-lg overflow-hidden min-w-[120px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)" }}>
            {options.map((opt) => (
              <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
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
 * Requirement Extraction Table — production working tool.
 * Combines AI-extracted requirements + compliance items.
 * Persists statuses, notes, owners, and evidence to `requirement_statuses` JSONB.
 */
export default function RequirementsTable({ analysisId, userId, requirements = [], complianceItems = [] }) {
  const [edits, setEdits] = useState({});  // { [rowId]: { status, notes, owner, evidence } }
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  const rows = useMemo(() => buildRows(requirements, complianceItems), [requirements, complianceItems]);

  // Load persisted data
  useEffect(() => {
    if (!analysisId || !userId) { setLoaded(true); return; }
    getSupabase()
      .from("analyses")
      .select("requirement_statuses")
      .eq("id", analysisId)
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data?.requirement_statuses) {
          // Support both old format {statuses, notes} and new format {edits}
          const saved = data.requirement_statuses;
          if (saved.edits) {
            setEdits(saved.edits);
          } else if (saved.statuses) {
            // Migrate old format
            const migrated = {};
            Object.entries(saved.statuses).forEach(([id, status]) => {
              migrated[id] = { status, notes: saved.notes?.[id] || "" };
            });
            setEdits(migrated);
          }
        }
        setLoaded(true);
      });
  }, [analysisId, userId]);

  // Persist with debounce
  const persist = useCallback(async (data) => {
    if (!analysisId || !userId) return;
    setSaving(true);
    const { error } = await getSupabase()
      .from("analyses")
      .update({ requirement_statuses: { edits: data } })
      .eq("id", analysisId)
      .eq("user_id", userId);
    setSaving(false);
    if (!error) setLastSaved(new Date());
  }, [analysisId, userId]);

  useEffect(() => {
    if (!loaded || !dirty) return;
    const t = setTimeout(() => persist(edits), 800);
    return () => clearTimeout(t);
  }, [edits, loaded, dirty, persist]);

  function getEdit(rowId, field) {
    return edits[rowId]?.[field] || "";
  }

  function setEdit(rowId, field, value) {
    setDirty(true);
    setEdits((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: value } }));
  }

  // Filter + search
  const filtered = useMemo(() => {
    let result = rows;
    if (filter !== "all") {
      result = result.filter((r) => (getEdit(r.id, "status") || "needs_review") === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.requirement.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (getEdit(r.id, "owner") || "").toLowerCase().includes(q)
      );
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, search, edits]);

  // Stats
  const stats = useMemo(() => {
    const s = { met: 0, partial: 0, not_met: 0, needs_review: 0 };
    rows.forEach((r) => { const st = getEdit(r.id, "status") || "needs_review"; s[st] = (s[st] || 0) + 1; });
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, edits]);

  const total = rows.length;

  // Export helper
  function exportToExcel() {
    import("@/app/utils/exportExcel").then(({ exportToExcel: exp }) => {
      const data = rows.map((r, i) => ({
        "#": i + 1,
        Requirement: r.requirement,
        Category: r.category,
        Priority: r.priority || (r.mandatory ? "HIGH" : "MEDIUM"),
        Status: STATUS_OPTIONS.find((s) => s.value === (getEdit(r.id, "status") || "needs_review"))?.label || "Needs Review",
        Owner: getEdit(r.id, "owner"),
        Evidence: getEdit(r.id, "evidence"),
        Notes: getEdit(r.id, "notes"),
        Source: r.source,
      }));
      exp(data, "Requirements", "requirements-tracker.xlsx");
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      {/* Header */}
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <h3 className="font-semibold">Requirements Tracker</h3>
            <ConfidenceBadge level="high" />
            {saving && (
              <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <div className="w-2 h-2 rounded-full border border-emerald-500 border-t-transparent animate-spin" />
                Saving
              </span>
            )}
            {!saving && lastSaved && (
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Saved</span>
            )}
          </div>
          <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-input)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export
          </button>
        </div>

        <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
          {total} requirements extracted. Update status, assign owners, and track evidence as you assess each item.
        </p>

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: "var(--bg-input)" }}>
            {stats.met > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(stats.met / total) * 100}%` }} />}
            {stats.partial > 0 && <div className="h-full bg-amber-500" style={{ width: `${(stats.partial / total) * 100}%` }} />}
            {stats.not_met > 0 && <div className="h-full bg-red-500" style={{ width: `${(stats.not_met / total) * 100}%` }} />}
          </div>
          <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-muted)" }}>{stats.met}/{total} met</span>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: "All", value: "all", count: total },
              { label: "Review", value: "needs_review", count: stats.needs_review },
              { label: "Met", value: "met", count: stats.met },
              { label: "Partial", value: "partial", count: stats.partial },
              { label: "Not Met", value: "not_met", count: stats.not_met },
            ].map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filter === f.value ? "bg-emerald-500/10 text-emerald-400" : ""}`} style={filter !== f.value ? { color: "var(--text-muted)", border: "1px solid var(--border-secondary)" } : { border: "1px solid rgba(16,185,129,0.2)" }}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-[240px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requirements..." className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px]" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[750px]">
          {/* Header Row */}
          <div className="grid grid-cols-24 gap-1 px-5 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
            <div className="col-span-1">#</div>
            <div className="col-span-8">Requirement</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-2 text-center">Priority</div>
            <div className="col-span-3 text-center">Status</div>
            <div className="col-span-4">Owner</div>
            <div className="col-span-3 text-center">Detail</div>
          </div>

          {/* Data Rows */}
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {search ? "No requirements match your search." : "No requirements match this filter."}
            </div>
          ) : filtered.map((row, idx) => {
            const isExpanded = expandedRow === row.id;
            const status = getEdit(row.id, "status") || "needs_review";
            const hasDetails = getEdit(row.id, "notes") || getEdit(row.id, "evidence") || getEdit(row.id, "owner") || row.commonIssue || row.remediation;
            const confidence = row.source === "requirements" ? "high" : "medium";

            return (
              <div key={row.id}>
                <div
                  className="grid grid-cols-24 gap-1 px-5 py-3 items-center cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid var(--border-primary)" }}
                  onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="col-span-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{idx + 1}</div>
                  <div className="col-span-8 text-sm font-medium leading-snug pr-2">{row.requirement}</div>
                  <div className="col-span-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${CATEGORY_COLORS[row.category] || "bg-gray-500/10 text-gray-400"}`}>
                      {row.category}
                    </span>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${row.mandatory || row.priority === "HIGH" ? "bg-red-500/10 text-red-400" : row.priority === "LOW" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"}`}>
                      {row.priority || (row.mandatory ? "HIGH" : "MED")}
                    </span>
                  </div>
                  <div className="col-span-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <Dropdown value={status} options={STATUS_OPTIONS} onChange={(v) => setEdit(row.id, "status", v)} />
                  </div>
                  <div className="col-span-4 text-[11px] truncate" style={{ color: getEdit(row.id, "owner") ? "var(--text-secondary)" : "var(--text-muted)" }}>
                    {getEdit(row.id, "owner") || "—"}
                  </div>
                  <div className="col-span-3 text-center flex items-center justify-center gap-1.5">
                    <ConfidenceBadge level={confidence} />
                    {hasDetails && (
                      <span className="w-4 h-4 inline-flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}>
                    {/* Col 1: AI details */}
                    <div className="space-y-2.5">
                      {row.commonIssue && (
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Common Issue</p>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{row.commonIssue}</p>
                        </div>
                      )}
                      {row.remediation && (
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Remediation</p>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{row.remediation}</p>
                        </div>
                      )}
                      {row.timeToRemediate && (
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Est. time: <span style={{ color: "var(--text-secondary)" }}>{row.timeToRemediate}</span>
                        </p>
                      )}
                      {!row.commonIssue && !row.remediation && (
                        <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>No AI remediation details for this item.</p>
                      )}
                    </div>

                    {/* Col 2: Owner + Evidence */}
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Owner / Assigned To</p>
                        <input type="text" value={getEdit(row.id, "owner")} onChange={(e) => setEdit(row.id, "owner", e.target.value)} placeholder="Assign to team member..." className="w-full px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Evidence / Document Needed</p>
                        <input type="text" value={getEdit(row.id, "evidence")} onChange={(e) => setEdit(row.id, "evidence", e.target.value)} placeholder="e.g. ISO 27001 certificate, company profile..." className="w-full px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
                      </div>
                    </div>

                    {/* Col 3: Notes */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Notes</p>
                      <textarea
                        value={getEdit(row.id, "notes")}
                        onChange={(e) => setEdit(row.id, "notes", e.target.value)}
                        placeholder="Internal notes for this requirement..."
                        rows={4}
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
 * Merge requirements + compliance items into unified rows, deduped.
 */
function buildRows(requirements, complianceItems) {
  const rows = [];
  const seen = new Set();

  if (requirements?.length) {
    requirements.forEach((r, i) => {
      rows.push({
        id: `req-${i}`,
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

  if (complianceItems?.length) {
    complianceItems.forEach((c, i) => {
      const text = c.item || c.requirement;
      if (!text) return;
      if (seen.has(text.toLowerCase().trim())) return;
      seen.add(text.toLowerCase().trim());
      rows.push({
        id: `comp-${i}`,
        requirement: text,
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
