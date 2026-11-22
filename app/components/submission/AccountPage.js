"use client";

// Account: who is signed in, beta access and this month's usage, appearance,
// data and privacy, sign out. No payments: the beta is free for invited testers.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import AppShell from "@/app/components/AppShell";
import ThemeToggle from "@/app/components/ThemeToggle";
import { Card, Icon, Notice, SecondaryButton, Skeleton, Spinner } from "./ui";
import { fetchUsage, fmtDate } from "./useChecks";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";

function Row({ label, children, testId }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 py-3.5" style={{ borderTop: "1px solid var(--border-primary)" }} data-testid={testId}>
      <p className="text-[13px] font-medium sm:w-48 shrink-0" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <div className="text-[14px] min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Meter({ used = 0, limit = 0 }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <span className="inline-flex items-center gap-3 w-full max-w-sm">
      <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--st-neutral-bg)" }} aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? "var(--st-manual)" : "var(--accent)" }} />
      </span>
      <span className="tabular text-[13px] shrink-0"><span className="font-semibold">{used}</span> of {limit}</span>
    </span>
  );
}

export default function AccountPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [usage, setUsage] = useState(undefined);

  useEffect(() => {
    if (user) fetchUsage().then((u) => setUsage(u || null));
  }, [user]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><Spinner className="w-8 h-8" /></div>;
  }

  const resets = (() => {
    const d = new Date();
    return fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString());
  })();

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Home", href: "/submission-check" }, { label: "Account" }]}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em]">Account</h1>
        </header>

        <Card className="px-5 pb-1 pt-4">
          <h2 className="text-[16px] font-semibold pb-3">Your account</h2>
          <Row label="Signed in as" testId="account-email"><span className="break-all">{user.email}</span></Row>
          <Row label="Plan" testId="account-plan">
            {usage === undefined ? <Skeleton rows={1} className="max-w-xs" /> : usage?.environment === "production" && usage?.inBeta === false
              ? <span>Not on the beta list yet. <a className="underline underline-offset-2" style={{ color: "var(--accent-text)" }} href={supportMailto("Submission Check beta access")}>Ask for access</a></span>
              : <span>Submission Check closed beta: free for invited testers{usage?.betaExpiresAt ? `, until ${fmtDate(usage.betaExpiresAt)}` : ""}.</span>}
          </Row>
        </Card>

        <Card className="px-5 pb-1 pt-4" data-testid="usage-card">
          <h2 className="text-[16px] font-semibold">This month&apos;s usage</h2>
          <p className="text-[13px] pb-3" style={{ color: "var(--text-secondary)" }}>Beta allowances reset on {resets}. Failed runs do not use them up.</p>
          {usage === undefined ? (
            <div className="pb-4"><Skeleton rows={2} /></div>
          ) : usage?.tracked ? (
            <>
              <Row label="Proposal checks"><Meter used={usage.used?.checks} limit={usage.limits?.checks_per_month} /></Row>
              <Row label="Tenders read"><Meter used={usage.used?.tenders} limit={usage.limits?.tenders_per_month} /></Row>
            </>
          ) : (
            <div className="pb-4">
              <Notice tone="gray" icon="info">
                {usage?.environment === "production"
                  ? "Usage could not be loaded right now. Please try again later."
                  : "Usage is not recorded on this preview yet (the usage-limit database table has not been added). Limits still apply per server."}
              </Notice>
            </div>
          )}
        </Card>

        <Card className="px-5 pb-1 pt-4">
          <h2 className="text-[16px] font-semibold pb-3">Appearance</h2>
          <Row label="Theme"><ThemeToggle /></Row>
        </Card>

        <Card className="px-5 pb-1 pt-4">
          <h2 className="text-[16px] font-semibold pb-3">Your data</h2>
          <Row label="Tenders">The requirement lists of your tenders are saved to your account. Delete any of them in <Link href="/submission-check/history" className="underline underline-offset-2" style={{ color: "var(--accent-text)" }}>History</Link>.</Row>
          <Row label="Proposals and results">Not stored on Bidlyze&apos;s servers. Results and review notes are kept in the browser where you ran the check.</Row>
          <Row label="Delete your account">Email <a href={supportMailto("Delete my Bidlyze account")} className="underline underline-offset-2" style={{ color: "var(--accent-text)" }}>{SUPPORT_EMAIL}</a> from this address and we will delete it with all its data.</Row>
          <Row label="Policies"><Link href="/privacy" className="underline underline-offset-2" style={{ color: "var(--accent-text)" }}>Privacy policy</Link><span style={{ color: "var(--text-muted)" }}>, </span><Link href="/terms" className="underline underline-offset-2" style={{ color: "var(--accent-text)" }}>Terms</Link></Row>
        </Card>

        <div className="flex items-center gap-3">
          <SecondaryButton onClick={logout} data-testid="account-logout"><Icon name="right" /> Log out</SecondaryButton>
          <a href={supportMailto()} className="text-[13px] font-medium hover:underline underline-offset-2" style={{ color: "var(--text-secondary)" }}>Contact support</a>
        </div>
      </div>
    </AppShell>
  );
}
