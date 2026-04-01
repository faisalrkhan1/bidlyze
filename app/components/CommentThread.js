"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Internal comment/review thread for any analysis record.
 * Persists in the `workflow_comments` JSONB field on the analyses table.
 */
export default function CommentThread({ analysisId, userId, userEmail }) {
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!analysisId || !userId) { setLoaded(true); return; }
    getSupabase().from("analyses").select("workflow_comments").eq("id", analysisId).eq("user_id", userId).single()
      .then(({ data }) => {
        if (data?.workflow_comments?.length > 0) { setComments(data.workflow_comments); setExpanded(true); }
        setLoaded(true);
      });
  }, [analysisId, userId]);

  const persist = useCallback(async (items) => {
    if (!analysisId || !userId) return;
    await getSupabase().from("analyses").update({ workflow_comments: items }).eq("id", analysisId).eq("user_id", userId);
  }, [analysisId, userId]);

  function addComment() {
    if (!draft.trim()) return;
    const newComment = {
      id: `cmt-${Date.now()}`,
      text: draft.trim(),
      author: userEmail || "You",
      createdAt: new Date().toISOString(),
    };
    const updated = [...comments, newComment];
    setComments(updated);
    setDraft("");
    persist(updated);
  }

  function removeComment(id) {
    const updated = comments.filter((c) => c.id !== id);
    setComments(updated);
    persist(updated);
  }

  if (!loaded) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          <h3 className="font-semibold">Internal Review</h3>
          {comments.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-muted)", color: "var(--accent-text)" }}>
              {comments.length}
            </span>
          )}
        </div>
        <svg className="w-5 h-5 transition-transform" style={{ color: "var(--text-secondary)", transform: expanded ? "rotate(180deg)" : "" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border-primary)" }}>
          {/* Comment List */}
          {comments.length > 0 && (
            <div className="space-y-3 mt-4 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-[10px] font-bold shrink-0 mt-0.5">
                    {(c.author || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">{c.author}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{c.text}</p>
                  </div>
                  <button onClick={() => removeComment(c.id)} className="shrink-0 p-1" style={{ color: "var(--text-muted)" }}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New Comment */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
              placeholder="Add a comment or review note..."
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
            />
            <button onClick={addComment} disabled={!draft.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-40">
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
