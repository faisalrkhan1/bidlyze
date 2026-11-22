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
import { Card, EmptyState, Icon, Notice, Pill, PrimaryButton, Skeleton, Spinner, Stepper } from "./ui";

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
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em]">Submission Check</h1>
            <Pill tone="outline">Beta</Pill>
          </div>
          <p className="text-[15px] max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Before you submit, check the supplier&apos;s proposal against every requirement of the tender. Each finding quotes both documents with page numbers, for your team to review and export.
          </p>
          <Stepper current={0} />
        </header>

        <div className="grid sm:grid-cols-3 rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
          {[
            ["shield", "Evidence you can check", "Every finding quotes the tender and the proposal. Bidlyze confirms each quote appears word for word on the cited page."],
            ["user", "Your team decides", "Findings are a starting point. Reviewers agree or override each one, and add notes."],
            ["lock", "Your proposal stays private", "Read in your browser; the file is not uploaded and nothing is stored on Bidlyze's servers."],
          ].map(([icon, title, body], i) => (
            <div key={title} className={`p-4 sm:p-5 border-[var(--border-primary)] ${i ? "border-t sm:border-t-0 sm:border-l" : ""}`}>
              <p className="text-[14px] font-semibold inline-flex items-center gap-2"><span style={{ color: "var(--accent-text)" }}><Icon name={icon} className="w-[18px] h-[18px]" /></span>{title}</p>
              <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{body}</p>
            </div>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
            <div className="flex-1">
              <h2 className="text-[16px] font-semibold">Choose a tender</h2>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Tenders you have analysed in Bidlyze. The proposal is checked against their requirement list.</p>
            </div>
            <div className="relative sm:w-64">
              <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your tenders" aria-label="Search your tenders" className="w-full h-9 text-[13px] pl-9 pr-3 rounded-lg focus:outline-none" style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
            </div>
          </div>

          <button
            onClick={() => router.push("/submission-check/demo")}
            className="w-full text-left px-5 py-4 flex items-center gap-4 transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{ borderBottom: "1px solid var(--border-primary)" }}
            data-testid="tender-demo"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--accent-muted)", color: "var(--accent-text)" }}><Icon name="doc" className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold flex items-center gap-2">Try it with a sample tender <Pill tone="blue">Sample</Pill></p>
              <p className="text-[13px] truncate" style={{ color: "var(--text-secondary)" }}>Alton Town Council CCTV tender (public, UK) with a fictional supplier proposal. No AI cost.</p>
            </div>
            <Icon name="right" />
          </button>

          {rows === null ? (
            <div className="px-5 py-5" data-testid="tenders-loading"><Skeleton rows={3} /><span className="sr-only">Loading your tenders</span></div>
          ) : error ? (
            <div className="p-5"><Notice tone="red" icon="warning" title="Your tenders could not be loaded">{error}</Notice></div>
          ) : shown.length === 0 ? (
            rows.length === 0 ? (
              <EmptyState icon="doc" title="No analysed tenders yet" action={<PrimaryButton onClick={() => router.push("/upload")}>Analyse a tender</PrimaryButton>}>
                Analyse a tender first, then come back to check a proposal against its requirements. Or try the sample tender above.
              </EmptyState>
            ) : (
              <EmptyState icon="search" title="No tenders match your search">Try another word from the tender name or file name.</EmptyState>
            )
          ) : (
            <ul data-testid="tender-list">
              {shown.map((r) => {
                const usable = r.total > 0;
                return (
                  <li key={r.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                    <button
                      disabled={!usable}
                      onClick={() => router.push(`/analysis/${r.id}/submission-check`)}
                      className="w-full text-left px-5 py-3.5 flex items-center gap-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[var(--bg-card-hover)]"
                      data-testid={`tender-${r.id}`}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--st-neutral-bg)", color: "var(--text-secondary)" }}><Icon name="doc" className="w-5 h-5" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold truncate">{r.name}</p>
                        <p className="text-[13px] truncate" style={{ color: "var(--text-secondary)" }}>
                          {usable ? <><span className="tabular">{r.total}</span> requirements</> : "No requirement list (cannot be checked)"}, analysed {fmtDate(r.createdAt)}
                          <span className="hidden md:inline" style={{ color: "var(--text-muted)" }}>, {r.fileName}</span>
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

        <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
          Beta: an aid for your own review, not a compliance certificate.
        </p>
      </div>
    </AppShell>
  );
}
