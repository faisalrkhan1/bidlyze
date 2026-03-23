"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import UserMenu from "@/app/components/UserMenu";

const DEFAULT_LIMIT = 3;

const PLAN_LABELS = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};


function ScoreBadge({ score }) {
  if (score == null) return <span style={{ color: "var(--text-muted)" }}>--</span>;
  const num = Number(score);
  let color = "text-red-400";
  let bg = "bg-red-500/10";
  if (num >= 70) { color = "text-emerald-400"; bg = "bg-emerald-500/10"; }
  else if (num >= 40) { color = "text-yellow-400"; bg = "bg-yellow-500/10"; }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${color} ${bg}`}>
      {num}
    </span>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div
      className="p-5 rounded-xl transition-colors duration-300"
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [usageCount, setUsageCount] = useState(null);
  const [analyses, setAnalyses] = useState(null);
  const [totalCount, setTotalCount] = useState(null);
  const [avgScore, setAvgScore] = useState(null);
  const [plan, setPlan] = useState("free");
  const [analysesLimit, setAnalysesLimit] = useState(DEFAULT_LIMIT);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [billingError, setBillingError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get subscription plan — use limit(1) instead of single() for resilience
    // (single() errors on 0 or 2+ rows; limit(1) always succeeds)
    supabase
      .from("subscriptions")
      .select("plan, analyses_limit, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.error("Subscription query error:", error.message);
          return;
        }
        const sub = data?.[0];
        if (sub?.plan) {
          setPlan(sub.plan);
          // null means unlimited (enterprise)
          setAnalysesLimit(sub.analyses_limit);
        }
      });

    // Monthly usage count
    supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth)
      .then(({ count }) => setUsageCount(count ?? 0));

    // Recent analyses (with score data for the table)
    supabase
      .from("analyses")
      .select("id, project_name, file_name, bid_score, created_at, file_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setAnalyses(data ?? []);
      });

    // Total analyses count (all time)
    supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setTotalCount(count ?? 0));

    // Average bid score
    supabase
      .from("analyses")
      .select("bid_score")
      .eq("user_id", user.id)
      .not("bid_score", "is", null)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const sum = data.reduce((acc, row) => acc + Number(row.bid_score), 0);
          setAvgScore(Math.round(sum / data.length));
        } else {
          setAvgScore(0);
        }
      });
  }, [user]);

  async function handleManageBilling() {
    setBillingError(null);
    setLoadingPortal(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session?.access_token) {
        setBillingError("Session expired. Please log in again.");
        setLoadingPortal(false);
        return;
      }
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setBillingError(data.error || "Failed to open billing portal. Please try again.");
        setLoadingPortal(false);
      }
    } catch (err) {
      console.error("Portal error:", err);
      setBillingError("Network error. Please check your connection.");
      setLoadingPortal(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isUnlimited = analysesLimit === null;
  const limitReached = !isUnlimited && usageCount !== null && usageCount >= (analysesLimit ?? DEFAULT_LIMIT);

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Top Bar */}
      <header className="transition-colors duration-300" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <span className="text-xl font-bold tracking-tight"><span className="text-emerald-500">Bid</span>lyze</span>
          </div>
          <UserMenu user={user} onLogout={logout} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
            Welcome back, <span className="text-emerald-500">{user?.email}</span>
          </h1>

          {/* Plan + Usage Bar */}
          {usageCount !== null && (
            <div
              className="p-5 rounded-xl transition-colors duration-300"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span
                    className="px-2.5 py-1 rounded-md text-xs font-semibold"
                    style={{
                      background: plan === "free" ? "var(--bg-input)" : "rgba(16, 185, 129, 0.1)",
                      color: plan === "free" ? "var(--text-secondary)" : "#10b981",
                      border: plan === "free" ? "1px solid var(--border-secondary)" : "1px solid rgba(16, 185, 129, 0.2)",
                    }}
                  >
                    {PLAN_LABELS[plan] || "Free"} Plan
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    {isUnlimited
                      ? `${usageCount} analyses used this month`
                      : `${usageCount} / ${analysesLimit ?? DEFAULT_LIMIT} analyses used this month`
                    }
                  </span>
                </div>
                {plan === "free" ? (
                  <button
                    onClick={() => router.push("/pricing")}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
                  >
                    Upgrade
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleManageBilling}
                      disabled={loadingPortal}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                      style={{ color: "var(--text-muted)", border: "1px solid var(--border-secondary)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-input)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {loadingPortal ? "Loading..." : "Manage Billing"}
                    </button>
                    <button
                      onClick={() => router.push("/pricing")}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ color: "var(--text-muted)", border: "1px solid var(--border-secondary)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-input)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      Change Plan
                    </button>
                  </div>
                )}
              </div>
              {billingError && (
                <div
                  className="mt-3 p-3 rounded-lg text-xs flex items-center justify-between"
                  style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171" }}
                >
                  <span>{billingError}</span>
                  <button onClick={() => setBillingError(null)} className="ml-3 font-bold hover:opacity-70">&times;</button>
                </div>
              )}
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: isUnlimited
                      ? "100%"
                      : `${Math.min((usageCount / (analysesLimit ?? DEFAULT_LIMIT)) * 100, 100)}%`,
                    background: isUnlimited ? "#10b981" : limitReached ? "#ef4444" : "#10b981",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total Analyses"
            value={totalCount ?? "--"}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            }
          />
          <StatCard
            label="Average Bid Score"
            value={avgScore !== null ? avgScore : "--"}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            }
          />
          <StatCard
            label="This Month"
            value={usageCount ?? "--"}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            }
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {/* New Analysis Card */}
          <div
            className="p-6 rounded-2xl transition-colors duration-300"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">New Analysis</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              Upload a tender document for AI-powered analysis
            </p>
            <button
              onClick={() => router.push("/upload")}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 bg-emerald-500 hover:bg-emerald-400 text-white"
            >
              Start Analysis
            </button>
          </div>

          {/* Amendment Tracker Card */}
          <div
            className="p-6 rounded-2xl transition-colors duration-300"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Amendment Intelligence</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              Compare tender versions to detect changes and assess impact
            </p>
            <button
              onClick={() => router.push("/compare")}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-input)"; e.currentTarget.style.borderColor = "var(--border-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-secondary)"; }}
            >
              Compare Documents
            </button>
          </div>
        </div>

        {/* Recent Analyses */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Analyses</h2>

          <div
            className="rounded-xl overflow-hidden transition-colors duration-300"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {analyses === null ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : analyses.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--icon-muted)" }}>
                  <svg className="w-6 h-6" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <p className="font-medium mb-1">No analyses yet</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Upload your first tender document to get started
                </p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div
                  className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider"
                  style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}
                >
                  <div className="col-span-4">Project Name</div>
                  <div className="col-span-3">File Name</div>
                  <div className="col-span-2 text-center">Bid Score</div>
                  <div className="col-span-2 text-right">Date</div>
                  <div className="col-span-1 text-center">File</div>
                </div>

                {/* Table Rows */}
                {analyses.map((a) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors duration-200 cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border-primary)" }}
                    onClick={() => router.push(`/analysis/${a.id}`)}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div className="col-span-4 text-sm font-medium truncate">
                      {a.project_name || "Untitled"}
                    </div>
                    <div className="col-span-3 text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                      {a.file_name || "--"}
                    </div>
                    <div className="col-span-2 text-center">
                      <ScoreBadge score={a.bid_score} />
                    </div>
                    <div className="col-span-2 text-sm text-right" style={{ color: "var(--text-muted)" }}>
                      {new Date(a.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div className="col-span-1 text-center">
                      {a.file_path ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            getSupabase().storage
                              .from("tenders")
                              .download(a.file_path)
                              .then(({ data, error }) => {
                                if (error || !data) return;
                                const url = URL.createObjectURL(data);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = a.file_name || "tender-document";
                                link.click();
                                URL.revokeObjectURL(url);
                              });
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-input)"; e.currentTarget.style.color = "#10b981"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                          title="Download original file"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </button>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>--</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
