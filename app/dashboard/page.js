"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";

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
  if (num >= 70) {
    color = "text-emerald-400";
    bg = "bg-emerald-500/10";
  } else if (num >= 40) {
    color = "text-yellow-400";
    bg = "bg-yellow-500/10";
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${color} ${bg}`}>
      {num}
    </span>
  );
}

function StatCard({ label, value, icon, accentColor }) {
  const colorMap = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-500" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-500" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-500" },
  };
  const accent = colorMap[accentColor] || colorMap.emerald;

  return (
    <div
      className="p-5 rounded-xl transition-all duration-300 hover:shadow-md"
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${accent.bg} ${accent.text} flex items-center justify-center`}>
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
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get subscription plan
    supabase
      .from("subscriptions")
      .select("plan, analyses_limit, status")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.status === "active" && data?.plan) {
          setPlan(data.plan);
          setAnalysesLimit(data.analyses_limit ?? DEFAULT_LIMIT);
        }
      });

    // Monthly usage count
    supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth)
      .then(({ count }) => setUsageCount(count ?? 0));

    // Recent analyses
    supabase
      .from("analyses")
      .select("id, project_name, file_name, bid_score, created_at, file_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setAnalyses(data ?? []);
      });

    // Total analyses count
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

  // Filter analyses by search query
  const filteredAnalyses = useMemo(() => {
    if (!analyses) return null;
    if (!searchQuery.trim()) return analyses;
    const q = searchQuery.toLowerCase().trim();
    return analyses.filter(
      (a) => (a.project_name || "").toLowerCase().includes(q)
    );
  }, [analyses, searchQuery]);

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const limitReached = usageCount !== null && usageCount >= analysesLimit;
  const usagePercent = analysesLimit > 0 ? Math.min((usageCount / analysesLimit) * 100, 100) : 0;
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <section className="mb-8 animate-fade-in">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            Welcome back, <span className="text-emerald-500">{displayName}</span>
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Here is an overview of your bid analysis activity.
          </p>
        </section>

        {/* Plan + Usage Bar */}
        {usageCount !== null && (
          <section className="mb-8 animate-fade-in" style={{ animationDelay: "50ms" }}>
            <div
              className="p-5 rounded-xl transition-colors duration-300"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 flex-wrap">
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
                    {usageCount} / {analysesLimit} analyses used this month
                  </span>
                </div>
                {plan === "free" ? (
                  <button
                    onClick={() => router.push("/pricing")}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors shrink-0"
                  >
                    Upgrade
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/pricing")}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0"
                    style={{ color: "var(--text-muted)", border: "1px solid var(--border-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    Manage Plan
                  </button>
                )}
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${usagePercent}%`,
                    background: limitReached ? "#ef4444" : "#10b981",
                  }}
                />
              </div>
              {limitReached && (
                <p className="text-xs mt-2 text-red-400">
                  You have reached your monthly limit.{" "}
                  <button
                    onClick={() => router.push("/pricing")}
                    className="underline hover:text-red-300 transition-colors"
                  >
                    Upgrade your plan
                  </button>{" "}
                  to continue analyzing.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <StatCard
            label="Total Analyses"
            value={totalCount ?? "--"}
            accentColor="blue"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            }
          />
          <StatCard
            label="Average Bid Score"
            value={avgScore !== null ? avgScore : "--"}
            accentColor="violet"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            }
          />
          <StatCard
            label="This Month"
            value={usageCount ?? "--"}
            accentColor="amber"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            }
          />
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 animate-fade-in" style={{ animationDelay: "150ms" }}>
          {/* New Analysis */}
          <div
            className="group p-6 rounded-2xl transition-all duration-300 hover:shadow-lg"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">New Analysis</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              Upload a tender document for AI-powered bid analysis and scoring.
            </p>
            <button
              onClick={() => router.push("/upload")}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 bg-emerald-500 hover:bg-emerald-400 text-white"
            >
              Start Analysis
            </button>
          </div>

          {/* Compare Documents */}
          <div
            className="group p-6 rounded-2xl transition-all duration-300 hover:shadow-lg"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
          >
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Compare Documents</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              Compare tender versions to detect changes and assess impact.
            </p>
            <button
              onClick={() => router.push("/compare")}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-input)";
                e.currentTarget.style.borderColor = "var(--border-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "var(--border-secondary)";
              }}
            >
              Compare Documents
            </button>
          </div>
        </section>

        {/* Recent Analyses */}
        <section className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Analyses</h2>
            {analyses && analyses.length > 0 && (
              <button
                onClick={() => router.push("/analyses")}
                className="text-xs font-medium transition-colors duration-200"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                View All &rarr;
              </button>
            )}
          </div>

          {/* Search Bar */}
          {analyses && analyses.length > 0 && (
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by project name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-colors duration-200 outline-none"
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#10b981")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Table */}
          <div
            className="rounded-xl overflow-hidden transition-colors duration-300"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {filteredAnalyses === null ? (
              <div className="p-10 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredAnalyses.length === 0 && !searchQuery ? (
              /* True empty state -- no analyses at all */
              <div className="p-16 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--bg-input)" }}
                >
                  <svg className="w-8 h-8" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <p className="font-semibold mb-1">No analyses yet</p>
                <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
                  Upload your first tender document to get started with AI-powered bid analysis.
                </p>
                <button
                  onClick={() => router.push("/upload")}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
                >
                  Upload Document
                </button>
              </div>
            ) : filteredAnalyses.length === 0 && searchQuery ? (
              /* Search returned nothing */
              <div className="p-12 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "var(--bg-input)" }}
                >
                  <svg className="w-7 h-7" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <p className="font-medium mb-1">No results found</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No analyses match &ldquo;{searchQuery}&rdquo;. Try a different search term.
                </p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div
                  className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider"
                  style={{
                    background: "var(--bg-subtle)",
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border-primary)",
                  }}
                >
                  <div className="col-span-4">Project Name</div>
                  <div className="col-span-3">File Name</div>
                  <div className="col-span-2 text-center">Bid Score</div>
                  <div className="col-span-2 text-right">Date</div>
                  <div className="col-span-1 text-center">File</div>
                </div>

                {/* Table Rows */}
                {filteredAnalyses.map((a) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors duration-150 cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border-primary)" }}
                    onClick={() => router.push(`/analysis/${a.id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
                            getSupabase()
                              .storage.from("tenders")
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
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--bg-input)";
                            e.currentTarget.style.color = "#10b981";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--text-secondary)";
                          }}
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
        </section>
      </div>
    </AppShell>
  );
}
