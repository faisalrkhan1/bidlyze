"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

const DECISIONS = [
  { value: "bid", label: "Bid", color: "bg-emerald-500 text-white" },
  { value: "no_bid", label: "No Bid", color: "bg-red-500 text-white" },
  { value: "hold", label: "Hold", color: "bg-amber-500 text-white" },
  { value: "review", label: "Review Further", color: "bg-blue-500 text-white" },
];

/**
 * Decision management panel for tender/package/comparison.
 * Persists in the `workflow_decision` JSONB field on the analyses table.
 */
export default function DecisionPanel({ analysisId, userId, aiRecommendation }) {
  const [decision, setDecision] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!analysisId || !userId) { setLoaded(true); return; }
    getSupabase().from("analyses").select("workflow_decision").eq("id", analysisId).eq("user_id", userId).single()
      .then(({ data }) => { if (data?.workflow_decision) setDecision(data.workflow_decision); setLoaded(true); });
  }, [analysisId, userId]);

  const persist = useCallback(async (d) => {
    if (!analysisId || !userId) return;
    await getSupabase().from("analyses").update({ workflow_decision: d }).eq("id", analysisId).eq("user_id", userId);
  }, [analysisId, userId]);

  useEffect(() => {
    if (!loaded || !decision) return;
    const t = setTimeout(() => persist(decision), 600);
    return () => clearTimeout(t);
  }, [decision, loaded, persist]);

  function updateField(field, value) {
    setDecision((prev) => ({ ...(prev || {}), [field]: value, updatedAt: new Date().toISOString() }));
  }

  if (!loaded) return null;

  const currentDecision = decision?.decision;
  const currentConfig = DECISIONS.find((d) => d.value === currentDecision);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Internal Decision</h3>
          {decision?.updatedAt && (
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Last updated: {new Date(decision.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* AI Recommendation Reference */}
        {aiRecommendation && (
          <div className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>AI Recommendation</p>
            <p className="text-sm font-medium" style={{ color: "var(--accent-text)" }}>{aiRecommendation.decision || aiRecommendation}</p>
            {aiRecommendation.reasoning && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{aiRecommendation.reasoning}</p>}
          </div>
        )}

        {/* Decision Selector */}
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Your Decision</p>
          <div className="flex items-center gap-2 flex-wrap">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => updateField("decision", d.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  currentDecision === d.value ? d.color : ""
                }`}
                style={currentDecision !== d.value ? { border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" } : {}}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Decision Owner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Decision Owner</p>
            <input
              type="text"
              value={decision?.owner || ""}
              onChange={(e) => updateField("owner", e.target.value)}
              placeholder="Who is making this decision..."
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Decision Date</p>
            <input
              type="date"
              value={decision?.decisionDate || ""}
              onChange={(e) => updateField("decisionDate", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Rationale */}
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Decision Rationale</p>
          <textarea
            value={decision?.rationale || ""}
            onChange={(e) => updateField("rationale", e.target.value)}
            placeholder="Document why this decision was made..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm resize-y"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Review Notes */}
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Approval / Review Notes</p>
          <textarea
            value={decision?.reviewNotes || ""}
            onChange={(e) => updateField("reviewNotes", e.target.value)}
            placeholder="Notes from reviewers, approvers, or stakeholders..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-y"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
          />
        </div>
      </div>
    </div>
  );
}
