"use client";

// Home: start a new check, see recent checks, try the sample.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import AppShell from "@/app/components/AppShell";
import { Card, Dot, EmptyState, GROUP_COLOR, Icon, Notice, Pill, PrimaryButton, Skeleton, Spinner, WORKFLOW_STEPS } from "./ui";
import { useTenders, fetchUsage, fmtDate } from "./useChecks";

export function LocalSummary({ local }) {
  if (!local) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--text-secondary)" }} data-testid="local-summary">
      {[["attention", "need attention"], ["manual", "to check"], ["ok", "OK"]].map(([g, label]) => (
        <span key={g} className="inline-flex items-center gap-1.5"><Dot color={GROUP_COLOR[g]} /><span className="tabular">{local[g]}</span> {label}</span>
      ))}
      <span>Reviewed <span className="tabular">{local.reviewed}</span> of <span className="tabular">{local.total}</span></span>
    </span>
  );
}

export function UsageLine({ usage }) {
  if (!usage?.tracked || !usage.limits) return null;
  return (
    <p className="text-[13px]" style={{ color: "var(--text-secondary)" }} data-testid="usage-line">
      Beta allowance this month: <span className="tabular font-medium" style={{ color: "var(--text-primary)" }}>{usage.used?.checks ?? 0}</span> of <span className="tabular">{usage.limits.checks_per_month}</span> checks used.
    </p>
  );
}

export default function SubmissionCheckHome() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { rows, error } = useTenders(user, { limit: 20 });
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (user) fetchUsage().then(setUsage);
  }, [user]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><Spinner className="w-8 h-8" /></div>;
  }

  const recent = (rows || []).slice(0, 5);

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Home" }]}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em]">Submission Check</h1>
            <Pill tone="outline">Beta</Pill>
          </div>
          <p className="text-[15px] max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Before a bid goes out, check the supplier&apos;s proposal against the tender&apos;s requirements. Each finding quotes both documents with page numbers, for your team to review and export.
          </p>
        </header>

        {/* Start */}
        <Card className="p-5 sm:p-6" data-testid="start-card">
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] font-semibold">Check a proposal</h2>
              <ol className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }} aria-label="How a check works">
                {WORKFLOW_STEPS.map((s, i) => (
                  <li key={s} className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-1">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold tabular shrink-0" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <PrimaryButton onClick={() => router.push("/submission-check/new")} data-testid="start-new" className="md:self-center h-11 px-5 text-[15px]">
              <Icon name="plus" /> Start a new check
            </PrimaryButton>
          </div>
          <div className="mt-4 pt-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between" style={{ borderTop: "1px solid var(--border-primary)" }}>
            <UsageLine usage={usage} />
            <button onClick={() => router.push("/submission-check/demo")} className="text-[13px] font-medium inline-flex items-center gap-1.5 hover:underline underline-offset-2 text-left" style={{ color: "var(--accent-text)" }} data-testid="tender-demo">
              Try it with a sample tender (public UK tender, fictional supplier, no AI cost) <Icon name="right" className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>

        {/* Recent */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
            <h2 className="text-[16px] font-semibold flex-1">Recent tenders</h2>
            {rows?.length > 5 && <button onClick={() => router.push("/submission-check/history")} className="text-[13px] font-medium hover:underline underline-offset-2" style={{ color: "var(--accent-text)" }}>See all in History</button>}
          </div>
          {rows === null ? (
            <div className="px-5 py-5" data-testid="tenders-loading"><Skeleton rows={3} /><span className="sr-only">Loading your tenders</span></div>
          ) : error ? (
            <div className="p-5"><Notice tone="red" icon="warning" title="Your tenders could not be loaded">{error}</Notice></div>
          ) : recent.length === 0 ? (
            <EmptyState icon="doc" title="No checks yet" action={<PrimaryButton onClick={() => router.push("/submission-check/new")}>Start a new check</PrimaryButton>}>
              Add a tender and the supplier&apos;s proposal to run your first check, or try the sample tender above.
            </EmptyState>
          ) : (
            <ul data-testid="tender-list">
              {recent.map((r, i) => (
                <li key={r.id} style={i ? { borderTop: "1px solid var(--border-primary)" } : undefined}>
                  <button
                    disabled={r.total === 0}
                    onClick={() => router.push(`/submission-check/${r.id}`)}
                    className="w-full text-left px-5 py-3.5 flex items-center gap-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[var(--bg-card-hover)]"
                    data-testid={`tender-${r.id}`}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--st-neutral-bg)", color: "var(--text-secondary)" }}><Icon name="doc" className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[14px] font-semibold truncate">{r.name}</p>
                      <p className="text-[13px] truncate" style={{ color: "var(--text-secondary)" }}>
                        {r.total > 0 ? <><span className="tabular">{r.total}</span> requirements</> : "No requirement list (cannot be checked)"}, added {fmtDate(r.createdAt)}
                      </p>
                      {r.local ? <LocalSummary local={r.local} /> : r.total > 0 && <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No check on this device yet</p>}
                    </div>
                    {r.total > 0 && r.cited === 0 && <Pill tone="amber" title="Analysed before page-cited quotes were added">No tender quotes</Pill>}
                    {r.total > 0 && <Icon name="right" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid sm:grid-cols-3 rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
          {[
            ["shield", "Evidence you can check", "Every finding quotes the tender and the proposal. Bidlyze confirms each quote appears word for word on the cited page."],
            ["user", "Your team decides", "Findings are a starting point. Reviewers agree or override each one, add notes, and export the result."],
            ["lock", "Your files stay with you", "Files are read in your browser; only their text is sent for the check. The proposal and the results are not stored on Bidlyze's servers."],
          ].map(([icon, title, body], i) => (
            <div key={title} className={`p-4 sm:p-5 border-[var(--border-primary)] ${i ? "border-t sm:border-t-0 sm:border-l" : ""}`}>
              <p className="text-[14px] font-semibold inline-flex items-center gap-2"><span style={{ color: "var(--accent-text)" }}><Icon name={icon} className="w-[18px] h-[18px]" /></span>{title}</p>
              <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{body}</p>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
          Beta: an aid for your own review, not a compliance certificate. It can miss or misjudge a requirement.
        </p>
      </div>
    </AppShell>
  );
}
