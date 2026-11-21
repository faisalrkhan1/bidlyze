"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * "Delete this tender" with an inline two-step confirm (no browser dialog).
 * Calls /api/analysis/delete, then hands control back via onDeleted().
 */
export default function DeleteTender({ analysisId, onDeleted }) {
  const [step, setStep] = useState("idle"); // idle | confirm | working | error
  const [error, setError] = useState("");

  async function run() {
    setStep("working");
    setError("");
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const res = await fetch("/api/analysis/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ analysis_id: analysisId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Delete failed. Please try again.");
      onDeleted?.(data);
    } catch (e) {
      setError(e.message);
      setStep("error");
    }
  }

  return (
    <div className="rounded-2xl p-5" style={{ border: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
      <p className="text-sm font-semibold mb-1">Delete this tender</p>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Permanently removes the uploaded files and everything extracted from them. It still counts towards this month&apos;s analyses.
      </p>

      {step === "idle" && (
        <button onClick={() => setStep("confirm")} className="px-4 py-2 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10">
          Delete tender…
        </button>
      )}

      {(step === "confirm" || step === "error") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-red-400">This cannot be undone.</span>
          <button onClick={run} className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white">
            Yes, delete permanently
          </button>
          <button onClick={() => { setStep("idle"); setError(""); }} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ border: "1px solid var(--border-primary)" }}>
            Cancel
          </button>
        </div>
      )}

      {step === "working" && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Deleting…</p>}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
