"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

const STATUSES = [
  { value: "open", label: "Open", color: "bg-gray-500/10 text-gray-400" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-500/10 text-blue-400" },
  { value: "done", label: "Done", color: "bg-emerald-500/10 text-emerald-400" },
  { value: "blocked", label: "Blocked", color: "bg-red-500/10 text-red-400" },
];

const PRIORITIES = [
  { value: "high", label: "High", color: "bg-red-500/10 text-red-400" },
  { value: "medium", label: "Medium", color: "bg-amber-500/10 text-amber-400" },
  { value: "low", label: "Low", color: "bg-emerald-500/10 text-emerald-400" },
];

function Badge({ value, options }) {
  const opt = options.find((o) => o.value === value);
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${opt?.color || ""}`}>{opt?.label || value}</span>;
}

/**
 * Action/task tracker component.
 * Persists actions in the `workflow_actions` JSONB field on the analyses table.
 * Can be seeded with AI-generated items (compliance gaps, risk items, etc.)
 */
export default function ActionTracker({ analysisId, userId, seedItems = [], title = "Action Items" }) {
  const [actions, setActions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState({ title: "", owner: "", dueDate: "", priority: "medium", notes: "" });

  useEffect(() => {
    if (!analysisId || !userId) { setLoaded(true); return; }
    getSupabase().from("analyses").select("workflow_actions").eq("id", analysisId).eq("user_id", userId).single()
      .then(({ data }) => {
        if (data?.workflow_actions?.length > 0) setActions(data.workflow_actions);
        else if (seedItems.length > 0) {
          const seeded = seedItems.map((s, i) => ({
            id: `seed-${i}-${Date.now()}`,
            title: s.title || s.action || s.risk || s.requirement || s.question || "",
            owner: s.owner || s.responsible || "",
            dueDate: s.deadline || "",
            priority: (s.priority || s.severity || "medium").toLowerCase(),
            status: "open",
            notes: s.notes || s.mitigation || s.reason || "",
            source: s.source || s.category || "",
            createdAt: new Date().toISOString(),
          }));
          setActions(seeded);
        }
        setLoaded(true);
      });
  }, [analysisId, userId, seedItems]);

  const persist = useCallback(async (items) => {
    if (!analysisId || !userId) return;
    await getSupabase().from("analyses").update({ workflow_actions: items }).eq("id", analysisId).eq("user_id", userId);
  }, [analysisId, userId]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => persist(actions), 600);
    return () => clearTimeout(t);
  }, [actions, loaded, persist]);

  function addAction() {
    if (!draft.title.trim()) return;
    const newAction = { ...draft, id: `act-${Date.now()}`, status: "open", createdAt: new Date().toISOString() };
    setActions((prev) => [...prev, newAction]);
    setDraft({ title: "", owner: "", dueDate: "", priority: "medium", notes: "" });
    setShowAdd(false);
  }

  function updateAction(id, field, value) {
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, [field]: value } : a));
  }

  function removeAction(id) {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }

  const filtered = filter === "all" ? actions : actions.filter((a) => a.status === filter);
  const stats = { open: 0, in_progress: 0, done: 0, blocked: 0 };
  actions.forEach((a) => { if (stats[a.status] !== undefined) stats[a.status]++; });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title} ({actions.length})</h3>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add Action
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[{ value: "all", label: `All (${actions.length})` }, ...STATUSES.map((s) => ({ ...s, label: `${s.label} (${stats[s.value]})` }))].map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filter === f.value ? "bg-emerald-500/10 text-emerald-400" : ""}`} style={filter !== f.value ? { color: "var(--text-muted)", border: "1px solid var(--border-secondary)" } : { border: "1px solid rgba(16,185,129,0.2)" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}>
          <input type="text" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Action title..." className="sm:col-span-2 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
          <input type="text" value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} placeholder="Owner..." className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
          <input type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
          <select value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button onClick={addAction} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">Add</button>
        </div>
      )}

      {/* Action List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>{actions.length === 0 ? "No actions yet. Add one or they will be auto-generated from analysis." : "No actions match this filter."}</div>
      ) : (
        filtered.map((a) => (
          <div key={a.id} className="px-5 py-3 flex items-start gap-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
            {/* Status checkbox */}
            <button onClick={() => updateAction(a.id, "status", a.status === "done" ? "open" : "done")} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${a.status === "done" ? "bg-emerald-500 border-emerald-500" : ""}`} style={a.status !== "done" ? { borderColor: "var(--border-secondary)" } : {}}>
              {a.status === "done" && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-sm font-medium ${a.status === "done" ? "line-through" : ""}`} style={a.status === "done" ? { color: "var(--text-muted)" } : {}}>{a.title}</span>
                <Badge value={a.priority} options={PRIORITIES} />
                <Badge value={a.status} options={STATUSES} />
              </div>
              <div className="flex items-center gap-3 text-[11px] flex-wrap" style={{ color: "var(--text-muted)" }}>
                {a.owner && <span>Owner: {a.owner}</span>}
                {a.dueDate && <span>Due: {a.dueDate}</span>}
                {a.source && <span>Source: {a.source}</span>}
              </div>
            </div>

            {/* Status dropdown + remove */}
            <select value={a.status} onChange={(e) => updateAction(a.id, "status", e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={() => removeAction(a.id)} className="shrink-0 p-1" style={{ color: "var(--text-muted)" }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))
      )}
    </div>
  );
}
