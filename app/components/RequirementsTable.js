"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";
import { ConfidenceBadge } from "./AIConfidence";

const STATUS_OPTIONS = [
  { value: "needs_review", label: "Needs Review", bg: "bg-gray-500/10", text: "text-gray-400", order: 0 },
  { value: "met", label: "Met", bg: "bg-emerald-500/10", text: "text-emerald-400", order: 3 },
  { value: "partial", label: "Partial", bg: "bg-amber-500/10", text: "text-amber-400", order: 2 },
  { value: "not_met", label: "Not Met", bg: "bg-red-500/10", text: "text-red-400", order: 1 },
];

const CATEGORY_COLORS = {
  Technical: "bg-blue-500/10 text-blue-400",
  Financial: "bg-emerald-500/10 text-emerald-400",
  Legal: "bg-purple-500/10 text-purple-400",
  Administrative: "bg-amber-500/10 text-amber-400",
  Documentation: "bg-cyan-500/10 text-cyan-400",
  Compliance: "bg-orange-500/10 text-orange-400",
};

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, MED: 1, LOW: 2 };

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

export default function RequirementsTable({ analysisId, userId, requirements = [], complianceItems = [] }) {
  const [edits, setEdits] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState(null); // null | "status" | "priority" | "category" | "source"
  const [selected, setSelected] = useState(new Set());
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showBulk, setShowBulk] = useState(false);

  const rows = useMemo(() => buildRows(requirements, complianceItems), [requirements, complianceItems]);

  // Load
  useEffect(() => {
    if (!analysisId || !userId) { setLoaded(true); return; }
    getSupabase().from("analyses").select("requirement_statuses").eq("id", analysisId).eq("user_id", userId).single()
      .then(({ data }) => {
        if (data?.requirement_statuses) {
          const saved = data.requirement_statuses;
          if (saved.edits) setEdits(saved.edits);
          else if (saved.statuses) {
            const migrated = {};
            Object.entries(saved.statuses).forEach(([id, status]) => { migrated[id] = { status, notes: saved.notes?.[id] || "" }; });
            setEdits(migrated);
          }
        }
        setLoaded(true);
      });
  }, [analysisId, userId]);

  // Persist
  const persist = useCallback(async (data) => {
    if (!analysisId || !userId) return;
    setSaving(true);
    const { error } = await getSupabase().from("analyses").update({ requirement_statuses: { edits: data } }).eq("id", analysisId).eq("user_id", userId);
    setSaving(false);
    if (!error) setLastSaved(new Date());
  }, [analysisId, userId]);

  useEffect(() => {
    if (!loaded || !dirty) return;
    const t = setTimeout(() => persist(edits), 800);
    return () => clearTimeout(t);
  }, [edits, loaded, dirty, persist]);

  function getEdit(rowId, field) { return edits[rowId]?.[field] || ""; }

  function setEdit(rowId, field, value) {
    setDirty(true);
    setEdits((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: value } }));
  }

  // Bulk status change
  function bulkSetStatus(status) {
    setDirty(true);
    setEdits((prev) => {
      const next = { ...prev };
      selected.forEach((id) => { next[id] = { ...(next[id] || {}), status }; });
      return next;
    });
    setSelected(new Set());
    setShowBulk(false);
  }

  function toggleSelect(id) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  }

  // Filter + search + sort
  const filtered = useMemo(() => {
    let result = rows;
    if (filter !== "all") result = result.filter((r) => (getEdit(r.id, "status") || "needs_review") === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.requirement.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.sourceRef || "").toLowerCase().includes(q) ||
        (getEdit(r.id, "owner") || "").toLowerCase().includes(q)
      );
    }
    if (sortBy) {
      result = [...result].sort((a, b) => {
        if (sortBy === "status") {
          const ao = STATUS_OPTIONS.find((s) => s.value === (getEdit(a.id, "status") || "needs_review"))?.order ?? 0;
          const bo = STATUS_OPTIONS.find((s) => s.value === (getEdit(b.id, "status") || "needs_review"))?.order ?? 0;
          return ao - bo;
        }
        if (sortBy === "priority") return (PRIORITY_ORDER[a.priority || "MEDIUM"] ?? 1) - (PRIORITY_ORDER[b.priority || "MEDIUM"] ?? 1);
        if (sortBy === "category") return (a.category || "").localeCompare(b.category || "");
        if (sortBy === "source") return (a.sourceRef || "zzz").localeCompare(b.sourceRef || "zzz");
        return 0;
      });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, search, sortBy, edits]);

  const stats = useMemo(() => {
    const s = { met: 0, partial: 0, not_met: 0, needs_review: 0 };
    rows.forEach((r) => { const st = getEdit(r.id, "status") || "needs_review"; s[st] = (s[st] || 0) + 1; });
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, edits]);

  const total = rows.length;

  function exportToExcel() {
    import("@/app/utils/exportExcel").then(({ exportToExcel: exp }) => {
      exp(rows.map((r, i) => ({
        "#": i + 1, Requirement: r.requirement, "Source Ref": r.sourceRef || "", Category: r.category,
        Priority: r.priority || (r.mandatory ? "HIGH" : "MEDIUM"),
        Status: STATUS_OPTIONS.find((s) => s.value === (getEdit(r.id, "status") || "needs_review"))?.label || "Needs Review",
        Owner: getEdit(r.id, "owner"), Evidence: getEdit(r.id, "evidence"),
        "Due Date": getEdit(r.id, "dueDate"), Notes: getEdit(r.id, "notes"),
      })), "Requirements", "requirements-tracker.xlsx");
    });
  }

  if (rows.length === 0) return null;

  function SortButton({ col, label }) {
    const active = sortBy === col;
    return (
      <button onClick={() => setSortBy(active ? null : col)} className={`flex items-center gap-0.5 ${active ? "text-emerald-400" : ""}`}>
        {label}
        {active && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>}
      </button>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      {/* Header */}
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold">Requirements Tracker</h3>
            <ConfidenceBadge level="high" />
            {saving && <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}><div className="w-2 h-2 rounded-full border border-emerald-500 border-t-transparent animate-spin" />Saving</span>}
            {!saving && lastSaved && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Saved</span>}
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <div className="relative">
                <button onClick={() => setShowBulk(!showBulk)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
                  Set {selected.size} as...
                </button>
                {showBulk && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowBulk(false)} />
                    <div className="absolute right-0 top-full mt-1 z-40 rounded-lg shadow-lg overflow-hidden min-w-[130px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)" }}>
                      {STATUS_OPTIONS.map((s) => (
                        <button key={s.value} onClick={() => bulkSetStatus(s.value)} className="w-full text-left px-3 py-2 text-[11px] font-medium transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s.bg.replace("/10", "")}`} />{s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-input)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              Export
            </button>
          </div>
        </div>

        <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>{total} requirements extracted. Select rows for bulk actions, click to expand details.</p>

        {/* Progress */}
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
        <div className="min-w-[800px]">
          {/* Header Row — sortable */}
          <div className="grid grid-cols-24 gap-1 px-5 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
            <div className="col-span-1" onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}>
              <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-3 h-3 rounded cursor-pointer accent-emerald-500" />
            </div>
            <div className="col-span-7">Requirement</div>
            <div className="col-span-2"><SortButton col="source" label="Source" /></div>
            <div className="col-span-3"><SortButton col="category" label="Category" /></div>
            <div className="col-span-2 text-center"><SortButton col="priority" label="Priority" /></div>
            <div className="col-span-3 text-center"><SortButton col="status" label="Status" /></div>
            <div className="col-span-3">Owner</div>
            <div className="col-span-3 text-center">Due</div>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>{search ? "No requirements match your search." : "No requirements match this filter."}</div>
          ) : filtered.map((row, idx) => {
            const isExpanded = expandedRow === row.id;
            const status = getEdit(row.id, "status") || "needs_review";
            const isSelected = selected.has(row.id);
            const hasDetails = getEdit(row.id, "notes") || getEdit(row.id, "evidence") || row.commonIssue || row.remediation;

            return (
              <div key={row.id}>
                <div
                  className={`grid grid-cols-24 gap-1 px-5 py-2.5 items-center cursor-pointer transition-colors ${isSelected ? "bg-emerald-500/5" : ""}`}
                  style={{ borderBottom: "1px solid var(--border-primary)" }}
                  onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-subtle)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Checkbox */}
                  <div className="col-span-1" onClick={(e) => { e.stopPropagation(); toggleSelect(row.id); }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(row.id)} className="w-3 h-3 rounded cursor-pointer accent-emerald-500" />
                  </div>

                  {/* Requirement */}
                  <div className="col-span-7 text-sm font-medium leading-snug pr-2">
                    {row.requirement}
                    {hasDetails && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1.5 align-middle" />}
                  </div>

                  {/* Source Ref */}
                  <div className="col-span-2 text-[10px] truncate" style={{ color: row.sourceRef ? "var(--text-secondary)" : "var(--text-muted)" }}>
                    {row.sourceRef || "—"}
                  </div>

                  {/* Category */}
                  <div className="col-span-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${CATEGORY_COLORS[row.category] || "bg-gray-500/10 text-gray-400"}`}>{row.category}</span>
                  </div>

                  {/* Priority */}
                  <div className="col-span-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${row.mandatory || row.priority === "HIGH" ? "bg-red-500/10 text-red-400" : row.priority === "LOW" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"}`}>
                      {row.priority || (row.mandatory ? "HIGH" : "MED")}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <Dropdown value={status} options={STATUS_OPTIONS} onChange={(v) => setEdit(row.id, "status", v)} />
                  </div>

                  {/* Owner */}
                  <div className="col-span-3 text-[11px] truncate" style={{ color: getEdit(row.id, "owner") ? "var(--text-secondary)" : "var(--text-muted)" }}>
                    {getEdit(row.id, "owner") || "—"}
                  </div>

                  {/* Due Date */}
                  <div className="col-span-3 text-center text-[10px]" style={{ color: getEdit(row.id, "dueDate") ? "var(--text-secondary)" : "var(--text-muted)" }}>
                    {getEdit(row.id, "dueDate") || "—"}
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}>
                    {/* AI details */}
                    <div className="space-y-2.5">
                      {row.sourceRef && (
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Source Reference</p>
                          <p className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>{row.sourceRef}</p>
                        </div>
                      )}
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
                      {row.timeToRemediate && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Est. time: <span style={{ color: "var(--text-secondary)" }}>{row.timeToRemediate}</span></p>}
                      {!row.commonIssue && !row.remediation && !row.sourceRef && (
                        <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>No AI details for this item.</p>
                      )}
                    </div>

                    {/* Owner + Evidence + Due */}
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Owner</p>
                        <input type="text" value={getEdit(row.id, "owner")} onChange={(e) => setEdit(row.id, "owner", e.target.value)} placeholder="Assign..." className="w-full px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Evidence / Document Needed</p>
                        <input type="text" value={getEdit(row.id, "evidence")} onChange={(e) => setEdit(row.id, "evidence", e.target.value)} placeholder="e.g. ISO certificate, company profile..." className="w-full px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Due Date</p>
                        <input type="date" value={getEdit(row.id, "dueDate")} onChange={(e) => setEdit(row.id, "dueDate", e.target.value)} className="w-full px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
                      </div>
                    </div>

                    {/* Notes */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Notes</p>
                      <textarea value={getEdit(row.id, "notes")} onChange={(e) => setEdit(row.id, "notes", e.target.value)} placeholder="Internal notes..." rows={5} className="w-full px-3 py-2 rounded-lg text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/25" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
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

function buildRows(requirements, complianceItems) {
  const rows = [];
  const seen = new Set();

  if (requirements?.length) {
    requirements.forEach((r, i) => {
      rows.push({
        id: `req-${i}`, requirement: r.requirement, category: r.category || "Technical",
        mandatory: r.mandatory, priority: r.priority, sourceRef: r.sourceRef || null,
        source: "requirements", commonIssue: null, remediation: null, timeToRemediate: null,
      });
      seen.add(r.requirement?.toLowerCase().trim());
    });
  }

  if (complianceItems?.length) {
    complianceItems.forEach((c, i) => {
      const text = c.item || c.requirement;
      if (!text || seen.has(text.toLowerCase().trim())) return;
      seen.add(text.toLowerCase().trim());
      rows.push({
        id: `comp-${i}`, requirement: text, category: c.category || "Compliance",
        mandatory: c.severity === "HIGH", priority: c.severity || "MEDIUM", sourceRef: null,
        source: "compliance", commonIssue: c.commonIssue, remediation: c.remediation, timeToRemediate: c.timeToRemediate,
      });
    });
  }

  return rows;
}
