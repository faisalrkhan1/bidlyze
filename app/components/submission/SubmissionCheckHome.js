"use client";

// Submission Check (beta) start page: choose an analysed tender (or the
// sample tender), then upload the supplier proposal on the next screen.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { requirementsFromAnalysis } from "@/lib/submission/fromAnalysis";
import { isDeletedAnalysis } from "@/lib/deleteTender";
import { Card, Icon, Pill, Spinner } from "./ui";

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function SubmissionCheckHome() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    getSupabase()
      .from("analyses")
      .select("id, project_name, file_name, created_at, analysis_data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: e }) => {
        if (e) {
          setError("Your tenders could not be loaded. Please refresh the page.");
          setRows([]);
          return;
        }
        setRows(
          (data || [])
            .filter((r) => r.analysis_data && !isDeletedAnalysis(r))
            .map((r) => {
              const { total, cited } = requirementsFromAnalysis(r.analysis_data);
              return { id: r.id, name: r.analysis_data?.summary?.projectName || r.project_name || "Untitled tender", fileName: r.file_name, createdAt: r.created_at, total, cited, rfx: r.analysis_data?.rfxType || "rfp" };
            })
        );
      });
  }, [authLoading, user]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter((r) => !q || `${r.name} ${r.fileName}`.toLowerCase().includes(q));
  }, [rows, query]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><Spinner className="w-8 h-8" /></div>;
  }

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Submission Check" }]}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Submission Check</h1>
            <Pill tone="green">BETA</Pill>
          </div>
          <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Before you submit, check the supplier&apos;s technical proposal against every requirement of the tender.
            Each finding shows the exact wording from both documents, with page numbers, for you to review.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-center">
          {[
            ["1", "Choose the analysed tender"],
            ["2", "Upload the proposal (PDF or Word)"],
            ["3", "Review findings and export the report"],
          ].map(([n, t]) => (
            <div key={n} className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
              <span className="inline-flex w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold items-center justify-center mr-2">{n}</span>
              {t}
            </div>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
            <h2 className="font-semibold flex-1">Choose a tender</h2>
            <div className="relative sm:w-64">
              <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your tenders" className="w-full text-sm pl-9 pr-3 py-2 rounded-lg focus:outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
            </div>
          </div>

          <button
            onClick={() => router.push("/submission-check/demo")}
            className="w-full text-left px-5 py-4 flex items-center gap-4 transition-colors"
            style={{ borderBottom: "1px solid var(--border-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            data-testid="tender-demo"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0"><Icon name="doc" className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold flex items-center gap-2">Try it with a sample tender <Pill tone="blue">Sample</Pill></p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>Alton Town Council CCTV tender (public, UK) with a fictional supplier proposal · no AI cost</p>
            </div>
            <Icon name="right" />
          </button>

          {rows === null ? (
            <div className="px-5 py-8 flex items-center justify-center gap-3 text-sm" style={{ color: "var(--text-muted)" }}><Spinner /> Loading your tenders…</div>
          ) : error ? (
            <p className="px-5 py-6 text-sm text-red-400">{error}</p>
          ) : shown.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {rows.length === 0 ? (
                <>
                  No analysed tenders yet.{" "}
                  <button onClick={() => router.push("/upload")} className="text-emerald-500 font-medium hover:underline">Analyse a tender first</button>
                  , then come back to check a proposal against it.
                </>
              ) : "No tenders match your search."}
            </div>
          ) : (
            <ul data-testid="tender-list">
              {shown.map((r) => {
                const usable = r.total > 0;
                return (
                  <li key={r.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                    <button
                      disabled={!usable}
                      onClick={() => router.push(`/analysis/${r.id}/submission-check`)}
                      className="w-full text-left px-5 py-3.5 flex items-center gap-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onMouseEnter={(e) => usable && (e.currentTarget.style.background = "var(--bg-card-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      data-testid={`tender-${r.id}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0"><Icon name="doc" className="w-5 h-5" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.name}</p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {r.fileName} · analysed {fmtDate(r.createdAt)} · {usable ? `${r.total} requirements` : "no requirement list (cannot be checked)"}
                        </p>
                      </div>
                      {usable && r.cited === 0 && <Pill tone="amber" title="Analysed before page-cited quotes were added">No tender quotes</Pill>}
                      {usable && <Icon name="right" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
          Beta: an automated aid for your own review, not a compliance certificate. Proposals are read in your browser and are not stored by Bidlyze.
        </p>
      </div>
    </AppShell>
  );
}
