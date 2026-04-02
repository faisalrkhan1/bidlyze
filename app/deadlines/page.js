"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";

const STATUS_COLORS = {
  analyzed: "bg-blue-500/10 text-blue-400",
  in_progress: "bg-amber-500/10 text-amber-400",
  submitted: "bg-purple-500/10 text-purple-400",
  won: "bg-emerald-500/10 text-emerald-400",
  lost: "bg-red-500/10 text-red-400",
  dropped: "bg-gray-500/10 text-gray-400",
  archived: "bg-gray-500/10 text-gray-400",
};

const TYPE_LABELS = { rfp: "RFP", rfq: "RFQ", rfi: "RFI", other: "Other", package: "Package", comparison: "Compare" };
const TYPE_COLORS = { rfp: "bg-emerald-500/10 text-emerald-400", rfq: "bg-blue-500/10 text-blue-400", rfi: "bg-purple-500/10 text-purple-400", other: "bg-amber-500/10 text-amber-400", package: "bg-purple-500/10 text-purple-400", comparison: "bg-cyan-500/10 text-cyan-400" };

/**
 * Try to parse a date string into a Date object.
 * Handles various formats: "30 April 2026", "2026-04-30", "April 30, 2026", etc.
 */
function parseDeadline(str) {
  if (!str || str === "Not specified" || str === "N/A") return null;
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
  // Try common tender date formats
  const cleaned = str.replace(/(\d+)(st|nd|rd|th)/gi, "$1").trim();
  const d2 = new Date(cleaned);
  if (!isNaN(d2.getTime()) && d2.getFullYear() > 2000) return d2;
  return null;
}

function daysUntil(date) {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function urgencyConfig(days) {
  if (days === null) return { label: "No deadline", color: "text-gray-400", bg: "bg-gray-500/10", priority: 99 };
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: "text-red-400", bg: "bg-red-500/10", priority: -1 };
  if (days === 0) return { label: "Due today", color: "text-red-400", bg: "bg-red-500/10", priority: 0 };
  if (days <= 3) return { label: `${days}d left`, color: "text-red-400", bg: "bg-red-500/10", priority: 1 };
  if (days <= 7) return { label: `${days}d left`, color: "text-amber-400", bg: "bg-amber-500/10", priority: 2 };
  if (days <= 14) return { label: `${days}d left`, color: "text-amber-400", bg: "bg-amber-500/10", priority: 3 };
  if (days <= 30) return { label: `${days}d left`, color: "text-emerald-400", bg: "bg-emerald-500/10", priority: 4 };
  return { label: `${days}d left`, color: "text-emerald-400", bg: "bg-emerald-500/10", priority: 5 };
}

function extractInfo(record) {
  const d = record.analysis_data || {};
  const rfxType = d.rfxType || (d.isPackage ? "package" : d.isComparison ? "comparison" : "rfp");
  const summary = d.summary || d.packageSummary || {};
  const client = summary.issuingAuthority || "";
  const deadlineStr = summary.submissionDeadline || "";
  const deadlineDate = parseDeadline(deadlineStr);
  const days = daysUntil(deadlineDate);
  const urgency = urgencyConfig(days);
  return { rfxType, client, deadlineStr, deadlineDate, days, urgency };
}

export default function DeadlinesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all"); // all | overdue | today | week | upcoming
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    getSupabase()
      .from("analyses")
      .select("id, project_name, created_at, analysis_data, tender_status, requirement_statuses")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => { setRecords(data || []); setLoading(false); });
  }, [user]);

  // Build enriched items
  const items = useMemo(() => {
    return records.map((r) => {
      const info = extractInfo(r);

      // Also collect requirement-level due dates
      const reqDueDates = [];
      const edits = r.requirement_statuses?.edits || {};
      Object.entries(edits).forEach(([id, edit]) => {
        if (edit.dueDate) {
          const dd = parseDeadline(edit.dueDate);
          if (dd) reqDueDates.push({ id, dueDate: dd, days: daysUntil(dd), label: edit.owner ? `${edit.owner}` : id });
        }
      });

      return { ...r, ...info, reqDueDates };
    }).filter((item) => {
      // Exclude dropped/archived/won/lost from active deadlines
      const status = item.tender_status || "analyzed";
      return !["dropped", "archived", "won", "lost"].includes(status);
    });
  }, [records]);

  // Filtered by view
  const filtered = useMemo(() => {
    let result = items;
    if (view === "overdue") result = result.filter((i) => i.days !== null && i.days < 0);
    else if (view === "today") result = result.filter((i) => i.days === 0);
    else if (view === "week") result = result.filter((i) => i.days !== null && i.days >= 0 && i.days <= 7);
    else if (view === "upcoming") result = result.filter((i) => i.days !== null && i.days > 7);
    // Sort by urgency (most urgent first)
    return [...result].sort((a, b) => (a.urgency.priority === b.urgency.priority ? (a.days ?? 999) - (b.days ?? 999) : a.urgency.priority - b.urgency.priority));
  }, [items, view]);

  // Stats
  const stats = useMemo(() => {
    const s = { overdue: 0, today: 0, week: 0, upcoming: 0, noDeadline: 0 };
    items.forEach((i) => {
      if (i.days === null) s.noDeadline++;
      else if (i.days < 0) s.overdue++;
      else if (i.days === 0) s.today++;
      else if (i.days <= 7) s.week++;
      else s.upcoming++;
    });
    return s;
  }, [items]);

  function navigateTo(record) {
    const d = record.analysis_data || {};
    if (d.isPackage) router.push(`/workspace/${record.id}`);
    else if (d.isComparison) router.push(`/bid-compare/${record.id}`);
    else router.push(`/analysis/${record.id}`);
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Deadlines" }]}>
      <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Deadline Tracker</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Submission deadlines and due dates across all active tenders.</p>
        </div>

        {/* Urgency Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Overdue", value: stats.overdue, color: "text-red-400", bgRing: stats.overdue > 0 ? "ring-2 ring-red-500/30" : "", view: "overdue" },
            { label: "Due Today", value: stats.today, color: "text-red-400", bgRing: stats.today > 0 ? "ring-2 ring-red-500/30" : "", view: "today" },
            { label: "This Week", value: stats.week, color: "text-amber-400", bgRing: "", view: "week" },
            { label: "Upcoming", value: stats.upcoming, color: "text-emerald-400", bgRing: "", view: "upcoming" },
            { label: "All Active", value: items.length, color: "", bgRing: "", view: "all" },
          ].map((card) => (
            <button
              key={card.view}
              onClick={() => setView(card.view)}
              className={`p-4 rounded-xl text-left transition-all ${card.bgRing} ${view === card.view ? "ring-2 ring-emerald-500/40" : ""}`}
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
            >
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>{card.label}</p>
            </button>
          ))}
        </div>

        {/* Timeline View */}
        {loading ? (
          <div className="p-16 text-center"><div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center rounded-2xl" style={{ border: "1px solid var(--border-primary)" }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--icon-muted)" }}>
              <svg className="w-7 h-7" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
            </div>
            <p className="font-semibold mb-1">{view === "all" ? "No active tenders" : `No ${view === "overdue" ? "overdue" : view === "today" ? "tenders due today" : view === "week" ? "tenders due this week" : "upcoming"} deadlines`}</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Deadlines from analyzed tenders will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const status = item.tender_status || "analyzed";
              const statusLabel = status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div
                  key={item.id}
                  className="rounded-xl p-4 sm:p-5 cursor-pointer transition-all hover:shadow-md"
                  style={{ background: "var(--bg-subtle)", border: item.days !== null && item.days <= 0 ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border-primary)" }}
                  onClick={() => navigateTo(item)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Title + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLORS[item.rfxType] || TYPE_COLORS.other}`}>
                          {TYPE_LABELS[item.rfxType] || "Other"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[status] || ""}`}>
                          {statusLabel}
                        </span>
                        {/* Urgency badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.urgency.bg} ${item.urgency.color}`}>
                          {item.urgency.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold truncate">{item.project_name || "Untitled"}</h3>
                      {item.client && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.client}</p>}
                    </div>

                    {/* Right: Deadline */}
                    <div className="text-right shrink-0">
                      {item.deadlineDate ? (
                        <>
                          <p className={`text-sm font-bold ${item.urgency.color}`}>
                            {item.deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Submission Deadline</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.deadlineStr || "No deadline specified"}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Requirement due dates (if any) */}
                  {item.reqDueDates.length > 0 && (
                    <div className="mt-3 pt-3 flex items-center gap-3 flex-wrap" style={{ borderTop: "1px solid var(--border-primary)" }}>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Req. due dates:</span>
                      {item.reqDueDates.slice(0, 5).map((rd) => {
                        const rdUrgency = urgencyConfig(rd.days);
                        return (
                          <span key={rd.id} className={`px-2 py-0.5 rounded text-[10px] font-medium ${rdUrgency.bg} ${rdUrgency.color}`}>
                            {rd.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {rd.label ? ` — ${rd.label}` : ""}
                          </span>
                        );
                      })}
                      {item.reqDueDates.length > 5 && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>+{item.reqDueDates.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
