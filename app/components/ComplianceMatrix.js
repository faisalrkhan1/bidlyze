"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";

const STATUS_OPTIONS = [
  { value: "needs_review", label: "Needs Review", color: "bg-gray-500/10 text-gray-400" },
  { value: "compliant", label: "Compliant", color: "bg-emerald-500/10 text-emerald-400" },
  { value: "partial", label: "Partial", color: "bg-amber-500/10 text-amber-400" },
  { value: "gap", label: "Gap", color: "bg-red-500/10 text-red-400" },
  { value: "not_applicable", label: "N/A", color: "bg-gray-500/10 text-gray-400" },
];

const SEVERITY_OPTIONS = ["HIGH", "MEDIUM", "LOW"];
const CATEGORY_OPTIONS = ["Technical", "Financial", "Legal", "Administrative", "Documentation", "Compliance"];

function Dropdown({ value, options, onChange, colorMap }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => (typeof o === "object" ? o.value === value : o === value));
  const label = typeof current === "object" ? current.label : current || value;
  const cls = colorMap?.[typeof current === "object" ? current.value : current] || "";

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cls}`}>
        {label}
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-40 rounded-lg shadow-lg overflow-hidden min-w-[110px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)" }}>
            {options.map((opt) => {
              const val = typeof opt === "object" ? opt.value : opt;
              const lbl = typeof opt === "object" ? opt.label : opt;
              return (
                <button key={val} onClick={() => { onChange(val); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  {lbl}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function InlineEdit({ value, onChange, placeholder, multiline }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  useEffect(() => { setDraft(value || ""); }, [value]);

  if (!editing) {
    return (
      <span onClick={() => setEditing(true)} className="cursor-pointer hover:underline text-xs leading-snug block min-h-[16px]" style={{ color: value ? "var(--text-secondary)" : "var(--text-muted)" }}>
        {value || placeholder || "Click to edit"}
      </span>
    );
  }

  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onChange(draft); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !multiline) { setEditing(false); if (draft !== value) onChange(draft); } if (e.key === "Escape") { setEditing(false); setDraft(value || ""); } }}
      className="w-full text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500/25"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
      rows={multiline ? 2 : undefined}
      placeholder={placeholder}
    />
  );
}

const STATUS_COLOR_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.color]));

/**
 * Editable Compliance Matrix component.
 * Used across single analysis, tender packages, and bid comparisons.
 * Persists edits to the `compliance_edits` field in the analyses table.
 */
export default function ComplianceMatrix({ analysisId, userId, items = [], title = "Compliance Matrix" }) {
  const [edits, setEdits] = useState({});
  const [filters, setFilters] = useState({ status: "all", severity: "all", category: "all" });
  const [sortBy, setSortBy] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  // Load persisted edits
  useEffect(() => {
    if (!analysisId || !userId) { setLoaded(true); return; }
    getSupabase().from("analyses").select("compliance_edits").eq("id", analysisId).eq("user_id", userId).single()
      .then(({ data }) => { if (data?.compliance_edits) setEdits(data.compliance_edits); setLoaded(true); });
  }, [analysisId, userId]);

  // Auto-save edits
  const persist = useCallback(async (newEdits) => {
    if (!analysisId || !userId) return;
    await getSupabase().from("analyses").update({ compliance_edits: newEdits }).eq("id", analysisId).eq("user_id", userId);
  }, [analysisId, userId]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => persist(edits), 800);
    return () => clearTimeout(t);
  }, [edits, loaded, persist]);

  function getField(rowId, field) {
    return edits[rowId]?.[field];
  }
  function setField(rowId, field, value) {
    setEdits((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: value } }));
  }

  // Build rows from AI output + user edits
  const rows = useMemo(() => items.map((item, i) => {
    const id = `cm-${i}`;
    const e = edits[id] || {};
    return {
      id,
      requirement: e.requirement ?? item.requirement ?? item.item ?? "",
      source: e.source ?? item.source ?? "",
      category: e.category ?? item.category ?? "Technical",
      severity: e.severity ?? item.severity ?? "MEDIUM",
      status: e.status ?? (item.status === "compliant" ? "compliant" : item.status === "gap" ? "gap" : "needs_review"),
      owner: e.owner ?? "",
      notes: e.notes ?? item.notes ?? item.commonIssue ?? "",
      action: e.action ?? item.remediation ?? item.actionRequired ?? "",
      evidence: e.evidence ?? "",
      dueDate: e.dueDate ?? "",
      original: item,
    };
  }), [items, edits]);

  // Filter
  const filtered = useMemo(() => {
    let r = rows;
    if (filters.status !== "all") r = r.filter((x) => x.status === filters.status);
    if (filters.severity !== "all") r = r.filter((x) => x.severity === filters.severity);
    if (filters.category !== "all") r = r.filter((x) => x.category === filters.category);
    if (sortBy === "severity") r = [...r].sort((a, b) => { const o = { HIGH: 0, MEDIUM: 1, LOW: 2 }; return (o[a.severity] ?? 1) - (o[b.severity] ?? 1); });
    if (sortBy === "status") r = [...r].sort((a, b) => { const o = { gap: 0, partial: 1, needs_review: 2, compliant: 3, not_applicable: 4 }; return (o[a.status] ?? 2) - (o[b.status] ?? 2); });
    return r;
  }, [rows, filters, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: rows.length, compliant: 0, partial: 0, gap: 0, review: 0 };
    rows.forEach((r) => { if (r.status === "compliant") s.compliant++; else if (r.status === "partial") s.partial++; else if (r.status === "gap") s.gap++; else s.review++; });
    return s;
  }, [rows]);

  if (items.length === 0) return null;

  const categories = [...new Set(rows.map((r) => r.category))];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      {/* Header */}
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold">{title} ({rows.length})</h3>
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">{stats.compliant} Compliant</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">{stats.partial} Partial</span>
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold">{stats.gap} Gap</span>
            <span className="px-2 py-0.5 rounded font-semibold" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{stats.review} Review</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden flex mb-3" style={{ background: "var(--bg-input)" }}>
          {stats.compliant > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(stats.compliant / stats.total) * 100}%` }} />}
          {stats.partial > 0 && <div className="h-full bg-amber-500" style={{ width: `${(stats.partial / stats.total) * 100}%` }} />}
          {stats.gap > 0 && <div className="h-full bg-red-500" style={{ width: `${(stats.gap / stats.total) * 100}%` }} />}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Filter:</span>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>
            <option value="all">All Severity</option>
            {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-[10px] uppercase tracking-wider ml-2" style={{ color: "var(--text-muted)" }}>Sort:</span>
          <button onClick={() => setSortBy(sortBy === "severity" ? null : "severity")} className={`text-[11px] px-2 py-1 rounded-lg ${sortBy === "severity" ? "bg-emerald-500/10 text-emerald-400" : ""}`} style={sortBy !== "severity" ? { color: "var(--text-muted)", border: "1px solid var(--border-secondary)" } : { border: "1px solid rgba(16,185,129,0.2)" }}>Severity</button>
          <button onClick={() => setSortBy(sortBy === "status" ? null : "status")} className={`text-[11px] px-2 py-1 rounded-lg ${sortBy === "status" ? "bg-emerald-500/10 text-emerald-400" : ""}`} style={sortBy !== "status" ? { color: "var(--text-muted)", border: "1px solid var(--border-secondary)" } : { border: "1px solid rgba(16,185,129,0.2)" }}>Status</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header Row */}
          <div className="grid grid-cols-24 gap-1 px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
            <div className="col-span-1">#</div>
            <div className="col-span-6">Requirement</div>
            <div className="col-span-3">Source</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Severity</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Owner</div>
            <div className="col-span-5">Action / Notes</div>
          </div>

          {/* Data Rows */}
          {filtered.map((row, idx) => {
            const isExpanded = expandedRow === row.id;
            return (
              <div key={row.id}>
                <div
                  className="grid grid-cols-24 gap-1 px-4 py-2.5 items-center cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid var(--border-primary)" }}
                  onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="col-span-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{idx + 1}</div>
                  <div className="col-span-6 text-xs font-medium leading-snug pr-1">{row.requirement}</div>
                  <div className="col-span-3 text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{row.source || "—"}</div>
                  <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                    <Dropdown value={row.category} options={CATEGORY_OPTIONS} onChange={(v) => setField(row.id, "category", v)} />
                  </div>
                  <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                    <Dropdown value={row.severity} options={SEVERITY_OPTIONS} onChange={(v) => setField(row.id, "severity", v)} colorMap={{ HIGH: "bg-red-500/10 text-red-400", MEDIUM: "bg-amber-500/10 text-amber-400", LOW: "bg-emerald-500/10 text-emerald-400" }} />
                  </div>
                  <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                    <Dropdown value={row.status} options={STATUS_OPTIONS} onChange={(v) => setField(row.id, "status", v)} colorMap={STATUS_COLOR_MAP} />
                  </div>
                  <div className="col-span-3" onClick={(e) => e.stopPropagation()}>
                    <InlineEdit value={row.owner} onChange={(v) => setField(row.id, "owner", v)} placeholder="Assign owner" />
                  </div>
                  <div className="col-span-5 text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{row.action || row.notes || "—"}</div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}>
                    <div onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Action Needed</p>
                      <InlineEdit value={row.action} onChange={(v) => setField(row.id, "action", v)} placeholder="Describe action..." multiline />
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Evidence / Document Required</p>
                      <InlineEdit value={row.evidence} onChange={(v) => setField(row.id, "evidence", v)} placeholder="Required evidence..." multiline />
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Notes</p>
                      <InlineEdit value={row.notes} onChange={(v) => setField(row.id, "notes", v)} placeholder="Internal notes..." multiline />
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Due Date</p>
                        <input type="date" value={row.dueDate} onChange={(e) => setField(row.id, "dueDate", e.target.value)} className="text-xs px-2 py-1 rounded" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} onClick={(e) => e.stopPropagation()} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No items match current filters.</div>
      )}
    </div>
  );
}

/**
 * Export compliance matrix data for use by export utilities.
 * Returns clean array of rows with all fields.
 */
export function getComplianceExportData(items, edits) {
  return items.map((item, i) => {
    const id = `cm-${i}`;
    const e = edits[id] || {};
    return {
      "#": i + 1,
      Requirement: e.requirement ?? item.requirement ?? item.item ?? "",
      Source: e.source ?? item.source ?? "",
      Category: e.category ?? item.category ?? "",
      Severity: e.severity ?? item.severity ?? "",
      Status: e.status ?? (item.status === "compliant" ? "Compliant" : item.status === "gap" ? "Gap" : "Needs Review"),
      Owner: e.owner ?? "",
      "Action Needed": e.action ?? item.remediation ?? "",
      "Evidence Required": e.evidence ?? "",
      Notes: e.notes ?? item.notes ?? "",
      "Due Date": e.dueDate ?? "",
    };
  });
}
