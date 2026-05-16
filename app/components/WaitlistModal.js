"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { PLAN_DISPLAY } from "@/lib/plans";

/**
 * Pre-launch waitlist modal — collects an email for the Pro or Team plan and
 * POSTs to /api/waitlist. Idempotent for repeat submissions (the API treats
 * duplicate (email, plan) as success).
 *
 * Props:
 *   plan          "pro" | "team"
 *   defaultEmail  string — pre-fills the field; empty for anonymous visitors.
 *   onClose       () => void — called when the user dismisses or completes.
 *
 * Used by app/pricing/page.js and app/components/LandingPricingCards.js.
 */
export default function WaitlistModal({ plan, defaultEmail, onClose }) {
  const planLabel = PLAN_DISPLAY[plan] || plan;
  const [email, setEmail] = useState(defaultEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const headers = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "Could not save your spot. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 relative" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }} aria-label="Close">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

        {done ? (
          <div className="text-center py-2">
            <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4 bg-emerald-500/10 text-emerald-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">You&apos;re on the list</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              We&apos;ll email you when {planLabel} opens, with early-bird pricing.
            </p>
            <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 className="text-lg font-semibold mb-1">Join the {planLabel} waitlist</h3>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
              We&apos;ll email you when {planLabel} launches, with an early-bird discount for waitlist members.
            </p>
            <label className="block text-[11px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm mb-3"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
            />
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <div className="flex items-center gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium transition-colors" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-60">
                {submitting ? "Saving..." : "Join waitlist"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
