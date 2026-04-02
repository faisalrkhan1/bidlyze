"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Persistent notes component for a single analysis.
 * Stores notes in the analyses table `notes` column (JSONB).
 * Auto-saves after user stops typing for 1 second.
 */
export default function AnalysisNotes({ analysisId, userId }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [initialNote, setInitialNote] = useState("");

  // Load existing note on mount
  useEffect(() => {
    if (!analysisId || !userId) return;
    getSupabase()
      .from("analyses")
      .select("notes")
      .eq("id", analysisId)
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        const loaded = data?.notes || "";
        setNote(loaded);
        setInitialNote(loaded);
        if (loaded.trim()) setExpanded(true);
        setLoaded(true);
      });
  }, [analysisId, userId]);

  // Auto-save with debounce
  const saveNote = useCallback(
    async (text) => {
      if (!analysisId || !userId) return;
      setSaving(true);
      setSaveError(false);
      const { error } = await getSupabase()
        .from("analyses")
        .update({ notes: text })
        .eq("id", analysisId)
        .eq("user_id", userId);
      setSaving(false);
      if (error) {
        setSaveError(true);
        console.error("Notes save error:", error.message);
      } else {
        setLastSaved(new Date());
      }
    },
    [analysisId, userId]
  );

  useEffect(() => {
    if (!loaded) return;
    // Skip save if note hasn't changed from what was loaded
    if (note === initialNote) return;
    const timeout = setTimeout(() => {
      saveNote(note);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [note, loaded, saveNote, initialNote]);

  if (!loaded) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-colors duration-300"
      style={{ border: "1px solid var(--border-primary)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left transition-colors duration-300"
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM16.862 4.487L19.5 7.125" />
          </svg>
          <h3 className="font-semibold">Internal Notes</h3>
          {note.trim() && !expanded && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-muted)", color: "var(--accent-text)" }}>
              {note.trim().split("\n").length} line{note.trim().split("\n").length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <div className="w-2.5 h-2.5 rounded-full border border-emerald-500 border-t-transparent animate-spin" />
              Saving
            </span>
          )}
          {!saving && lastSaved && !saveError && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Saved
            </span>
          )}
          {saveError && (
            <span className="text-[11px] text-red-400">
              Not saved
            </span>
          )}
          <svg
            className="w-5 h-5 transition-transform"
            style={{ color: "var(--text-secondary)", transform: expanded ? "rotate(180deg)" : "" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-1" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
            Private working notes — not shared externally. Use for internal risks, assumptions, action items, or management comments.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add internal notes about this tender...&#10;&#10;Examples:&#10;• We lack ISO 27001 — need to partner with certified subcontractor&#10;• Client prefers on-premise deployment, not cloud&#10;• Need OEM letter from hardware vendor before submission&#10;• Budget committee approval required before committing"
            rows={6}
            className="w-full px-4 py-3 rounded-xl text-sm leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500/25 focus:border-emerald-500/50 transition-colors"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-secondary)",
              color: "var(--text-primary)",
              minHeight: "120px",
            }}
          />
        </div>
      )}
    </div>
  );
}
