"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

const STATUSES = [
  { value: "open", label: "Open", color: "bg-gray-500/10 text-gray-400" },
  { value: "sent", label: "Sent", color: "bg-blue-500/10 text-blue-400" },
  { value: "answered", label: "Answered", color: "bg-emerald-500/10 text-emerald-400" },
  { value: "withdrawn", label: "Withdrawn", color: "bg-red-500/10 text-red-400" },
];

const PRIORITIES = [
  { value: "HIGH", label: "High", color: "bg-red-500/10 text-red-400" },
  { value: "MEDIUM", label: "Medium", color: "bg-amber-500/10 text-amber-400" },
  { value: "LOW", label: "Low", color: "bg-emerald-500/10 text-emerald-400" },
];

function Badge({ value, options }) {
  const opt = options.find((o) => o.value === value);
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${opt?.color || ""}`}>{opt?.label || value}</span>;
}

/**
 * Editable register of clarification questions to put to the issuing authority.
 * Seeds from AI suggestions (clarificationQuestions / clarificationPoints) and persists
 * to the `clarifications` JSONB column on `analyses`.
 */
export default function ClarificationRegister({ analysisId, userId, seedItems = [], title = "Clarification Register" }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ question: "", reason: "", source: "", priority: "MEDIUM" });

  useEffect(() => {
    if (!analysisId || !userId) { setLoaded(true); return; }
    getSupabase().from("analyses").select("clarifications").eq("id", analysisId).eq("user_id", userId).single()
      .then(({ data, error }) => {
        if (!error && data?.clarifications?.length > 0) {
          setItems(data.clarifications);
        } else if (seedItems.length > 0) {
          setItems(seedItems.map((s, i) => ({
            id: `seed-${i}-${Date.now()}`,
            question: s.question || s.requirement || "",
            reason: s.reason || s.notes || "",
            source: s.source || s.sourceRef || "",
            priority: (s.priority || "MEDIUM").toUpperCase(),
            status: "open",
            answer: "",
            answeredAt: "",
            createdAt: new Date().toISOString(),
          })));
        }
        setLoaded(true);
      });
  }, [analysisId, userId, seedItems]);

  const persist = useCallback(async (next) => {
    if (!analysisId || !userId) return;
    await getSupabase().from("analyses").update({ clarifications: next }).eq("id", analysisId).eq("user_id", userId);
  }, [analysisId, userId]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => persist(items), 600);
    return () => clearTimeout(t);
  }, [items, loaded, persist]);

  function addItem() {
    if (!draft.question.trim()) return;
    setItems((prev) => [...prev, { ...draft, id: `clr-${Date.now()}`, status: "open", answer: "", answeredAt: "", createdAt: new Date().toISOString() }]);
    setDraft({ question: "", reason: "", source: "", priority: "MEDIUM" });
    setShowAdd(false);
  }

  function updateItem(id, field, value) {
    setItems((prev) => prev.map((q) => q.id === id ? { ...q, [field]: value, ...(field === "status" && value === "answered" ? { answeredAt: new Date().toISOString() } : {}) } : q));
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((q) => q.id !== id));
  }

  if (!loaded) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="font-semibold">{title} ({items.length})</h3>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add Question
          </button>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
          Track every clarification you need from the issuing authority before submission. AI-suggested questions are seeded — edit, prioritize, and mark answered as responses arrive.
        </p>
      </div>

      {showAdd && (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}>
          <textarea value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} placeholder="Question to put to the issuing authority..." rows={2} className="sm:col-span-2 px-3 py-2 rounded-lg text-sm resize-y" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
          <input type="text" value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} placeholder="Why this matters..." className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
          <input type="text" value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} placeholder="Source / clause reference..." className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
          <select value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button onClick={addItem} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">Add</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          No clarifications yet. AI-suggested questions appear here automatically, or add your own.
        </div>
      ) : (
        items.map((q) => (
          <div key={q.id} className="px-5 py-4 space-y-2" style={{ borderBottom: "1px solid var(--border-primary)" }}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-medium">{q.question}</p>
                  <Badge value={q.priority} options={PRIORITIES} />
                  <Badge value={q.status} options={STATUSES} />
                </div>
                <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {q.source && <span>Source: <span style={{ color: "var(--text-secondary)" }}>{q.source}</span></span>}
                  {q.reason && <span>Reason: <span style={{ color: "var(--text-secondary)" }}>{q.reason}</span></span>}
                  {q.answeredAt && <span>Answered: {new Date(q.answeredAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <select value={q.status} onChange={(e) => updateItem(q.id, "status", e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button onClick={() => removeItem(q.id)} className="shrink-0 p-1" style={{ color: "var(--text-muted)" }} title="Remove">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <textarea
              value={q.answer || ""}
              onChange={(e) => updateItem(q.id, "answer", e.target.value)}
              placeholder="Record the issuing authority's response here..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-xs resize-y"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
            />
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Shape clarifications for spreadsheet export.
 */
export function getClarificationExportData(items) {
  return items.map((q, i) => ({
    "#": i + 1,
    Question: q.question || "",
    Priority: q.priority || "",
    Status: STATUSES.find((s) => s.value === q.status)?.label || q.status || "",
    Source: q.source || "",
    Reason: q.reason || "",
    Response: q.answer || "",
    "Answered On": q.answeredAt ? new Date(q.answeredAt).toLocaleDateString() : "",
  }));
}
