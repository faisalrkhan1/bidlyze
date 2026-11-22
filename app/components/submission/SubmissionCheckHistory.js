"use client";

// History: every tender on the account, what this browser remembers of its
// last check, and the actions: check another proposal, open the results, delete.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { Card, EmptyState, Icon, Notice, Pill, PrimaryButton, SecondaryButton, Skeleton, Spinner } from "./ui";
import { useTenders, fmtDate } from "./useChecks";
import { LocalSummary } from "./SubmissionCheckHome";

function DeleteButton({ id, name, onDeleted }) {
  const [step, setStep] = useState("idle"); // idle | confirm | working
  const [error, setError] = useState("");
  async function run() {
    setStep("working");
    setError("");
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const res = await fetch("/api/analysis/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ analysis_id: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "The tender could not be deleted. Please try again.");
      try { window.localStorage.removeItem(`bidlyze.submissionCheck.v1.${id}`); } catch { /* nothing kept */ }
      onDeleted();
    } catch (e) {
      setError(e.message);
      setStep("confirm");
    }
  }
  if (step === "idle") {
    return <button onClick={() => setStep("confirm")} className="text-[13px] font-medium inline-flex items-center gap-1 hover:underline underline-offset-2" style={{ color: "var(--text-secondary)" }} data-testid={`delete-${id}`} aria-label={`Delete ${name}`}><Icon name="trash" className="w-3.5 h-3.5" /> Delete</button>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[13px]">
      <span style={{ color: "var(--st-attention)" }}>Delete this tender and its requirement list? This cannot be undone.</span>
      <button onClick={run} disabled={step === "working"} className="font-semibold px-2.5 h-7 rounded-md text-white disabled:opacity-60" style={{ background: "var(--st-attention)" }} data-testid={`confirm-delete-${id}`}>{step === "working" ? "Deleting…" : "Delete"}</button>
      <button onClick={() => { setStep("idle"); setError(""); }} className="font-medium hover:underline underline-offset-2" style={{ color: "var(--text-secondary)" }}>Cancel</button>
      {error && <span style={{ color: "var(--st-attention)" }}>{error}</span>}
    </span>
  );
}

export default function SubmissionCheckHistory() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { rows, error, reload } = useTenders(user, { limit: 200 });
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter((r) => !q || `${r.name} ${r.fileName}`.toLowerCase().includes(q));
  }, [rows, query]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><Spinner className="w-8 h-8" /></div>;
  }

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Home", href: "/submission-check" }, { label: "History" }]}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 space-y-2">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em]">History</h1>
            <p className="text-[15px] max-w-2xl" style={{ color: "var(--text-secondary)" }}>
              Every tender on your account. Results and review notes are kept in the browser where the check was run; export a report to share it.
            </p>
          </div>
          <PrimaryButton onClick={() => router.push("/submission-check/new")}><Icon name="plus" /> New check</PrimaryButton>
        </header>

        <Card className="overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
            <p className="text-[14px] font-semibold flex-1">{rows ? <><span className="tabular">{rows.length}</span> tender{rows.length === 1 ? "" : "s"}</> : "Tenders"}</p>
            <div className="relative sm:w-72">
              <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by tender or file name" aria-label="Search your tenders" data-testid="history-search" className="w-full h-9 text-[13px] pl-9 pr-3 rounded-lg focus:outline-none" style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
            </div>
          </div>

          {rows === null ? (
            <div className="px-5 py-5"><Skeleton rows={4} /><span className="sr-only">Loading</span></div>
          ) : error ? (
            <div className="p-5"><Notice tone="red" icon="warning" title="Your tenders could not be loaded">{error}</Notice></div>
          ) : shown.length === 0 ? (
            rows.length === 0
              ? <EmptyState icon="clock" title="Nothing here yet" action={<PrimaryButton onClick={() => router.push("/submission-check/new")}>Start a new check</PrimaryButton>}>Tenders you check appear here, so you can check further proposals against them.</EmptyState>
              : <EmptyState icon="search" title="No tenders match your search">Try another word from the tender name or file name.</EmptyState>
          ) : (
            <ul data-testid="history-list">
              {shown.map((r, i) => (
                <li key={r.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3" style={i ? { borderTop: "1px solid var(--border-primary)" } : undefined} data-testid={`history-row-${r.id}`}>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[14px] font-semibold truncate" title={r.name}>{r.name}</p>
                    <p className="text-[13px] truncate" style={{ color: "var(--text-secondary)" }} title={r.fileName}>
                      {r.total > 0 ? <><span className="tabular">{r.total}</span> requirements</> : "No requirement list"}, added {fmtDate(r.createdAt)}
                      <span className="hidden lg:inline" style={{ color: "var(--text-muted)" }}>, {r.fileName}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.local ? <LocalSummary local={r.local} /> : <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No check saved on this device</span>}
                      {r.source === "tender-intelligence" && <Pill tone="outline" title="Created with the earlier Tender Intelligence analysis">Full tender analysis</Pill>}
                      {r.total > 0 && r.cited === 0 && <Pill tone="amber" title="Analysed before page-cited quotes were added">No tender quotes</Pill>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end">
                    {r.total > 0 && (
                      r.local
                        ? <PrimaryButton onClick={() => router.push(`/submission-check/${r.id}`)} className="h-9" data-testid={`open-${r.id}`}>Open results</PrimaryButton>
                        : <SecondaryButton onClick={() => router.push(`/submission-check/${r.id}`)} className="h-9" data-testid={`check-${r.id}`}>Check a proposal</SecondaryButton>
                    )}
                    {r.source === "tender-intelligence" && (
                      <button onClick={() => router.push(`/analysis/${r.id}`)} className="text-[13px] font-medium hover:underline underline-offset-2" style={{ color: "var(--text-secondary)" }}>Tender analysis</button>
                    )}
                    <DeleteButton id={r.id} name={r.name} onDeleted={reload} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
