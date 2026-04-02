"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";

const STATUSES = [
  { value: "analyzed", label: "Analyzed", color: "bg-blue-500/10 text-blue-400" },
  { value: "in_progress", label: "In Progress", color: "bg-amber-500/10 text-amber-400" },
  { value: "submitted", label: "Submitted", color: "bg-purple-500/10 text-purple-400" },
  { value: "won", label: "Won", color: "bg-emerald-500/10 text-emerald-400" },
  { value: "lost", label: "Lost", color: "bg-red-500/10 text-red-400" },
  { value: "dropped", label: "Dropped", color: "bg-gray-500/10 text-gray-400" },
  { value: "archived", label: "Archived", color: "bg-gray-500/10 text-gray-400" },
];

const TYPE_LABELS = {
  rfp: "RFP",
  rfq: "RFQ",
  rfi: "RFI",
  other: "Other",
  package: "Package",
  comparison: "Comparison",
};

const TYPE_COLORS = {
  rfp: "bg-emerald-500/10 text-emerald-400",
  rfq: "bg-blue-500/10 text-blue-400",
  rfi: "bg-purple-500/10 text-purple-400",
  other: "bg-amber-500/10 text-amber-400",
  package: "bg-purple-500/10 text-purple-400",
  comparison: "bg-cyan-500/10 text-cyan-400",
};

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = STATUSES.find((s) => s.value === value) || STATUSES[0];

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${current.color}`}
      >
        {current.label}
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 rounded-lg shadow-lg overflow-hidden min-w-[120px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)" }}>
            {STATUSES.map((s) => (
              <button key={s.value} onClick={(e) => { e.stopPropagation(); onChange(s.value); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s.color.split(" ")[0].replace("/10", "")}`} />
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function extractRecordInfo(record) {
  const d = record.analysis_data || {};
  const rfxType = d.rfxType || (d.isPackage ? "package" : d.isComparison ? "comparison" : "rfp");
  const summary = d.summary || d.packageSummary || d.tenderContext || {};
  const client = summary.issuingAuthority || summary.authority || "";
  const deadline = summary.submissionDeadline || "";
  const sector = summary.sector || "";
  const score = record.bid_score;
  const decision = record.workflow_decision?.decision;
  const approvalStatus = record.workflow_decision?.approvalStatus;
  const fileCount = d.files?.length || (d.isPackage || d.isComparison ? parseInt(record.file_name) || 0 : 1);

  return { rfxType, client, deadline, sector, score, decision, approvalStatus, fileCount };
}

export default function HistoryPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    getSupabase()
      .from("analyses")
      .select("id, project_name, file_name, bid_score, created_at, analysis_data, workflow_decision, tender_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRecords(data || []);
        setLoading(false);
      });
  }, [user]);

  async function updateStatus(id, newStatus) {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, tender_status: newStatus } : r));
    await getSupabase().from("analyses").update({ tender_status: newStatus }).eq("id", id).eq("user_id", user.id);
  }

  function navigateTo(record) {
    const d = record.analysis_data || {};
    if (d.isPackage) router.push(`/workspace/${record.id}`);
    else if (d.isComparison) router.push(`/bid-compare/${record.id}`);
    else router.push(`/analysis/${record.id}`);
  }

  // Filter and sort
  const filtered = useMemo(() => {
    let result = records;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const info = extractRecordInfo(r);
        return (r.project_name || "").toLowerCase().includes(q)
          || (info.client || "").toLowerCase().includes(q)
          || (r.file_name || "").toLowerCase().includes(q);
      });
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((r) => {
        const info = extractRecordInfo(r);
        return info.rfxType === typeFilter;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((r) => (r.tender_status || "analyzed") === statusFilter);
    }

    // Sort
    if (sortBy === "date_asc") result = [...result].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (sortBy === "name") result = [...result].sort((a, b) => (a.project_name || "").localeCompare(b.project_name || ""));
    if (sortBy === "score") result = [...result].sort((a, b) => (b.bid_score ?? -1) - (a.bid_score ?? -1));

    return result;
  }, [records, search, typeFilter, statusFilter, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: records.length, analyzed: 0, in_progress: 0, submitted: 0, won: 0, lost: 0, dropped: 0 };
    records.forEach((r) => {
      const status = r.tender_status || "analyzed";
      if (s[status] !== undefined) s[status]++;
    });
    return s;
  }, [records]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Tender History" }]}>
      <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Tender History</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{stats.total} opportunities tracked</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/upload")} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              New Analysis
            </button>
          </div>
        </div>

        {/* Pipeline Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-6">
          {[
            { label: "Total", value: stats.total, color: "" },
            { label: "Analyzed", value: stats.analyzed, color: "text-blue-400" },
            { label: "In Progress", value: stats.in_progress, color: "text-amber-400" },
            { label: "Submitted", value: stats.submitted, color: "text-purple-400" },
            { label: "Won", value: stats.won, color: "text-emerald-400" },
            { label: "Lost", value: stats.lost, color: "text-red-400" },
            { label: "Dropped", value: stats.dropped, color: "text-gray-400" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, client, or file name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
            <option value="all">All Statuses</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name">Name A–Z</option>
            <option value="score">Highest Score</option>
          </select>
        </div>

        {/* Results */}
        {loading ? (
          <div className="p-16 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center rounded-2xl" style={{ border: "1px solid var(--border-primary)" }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--icon-muted)" }}>
              <svg className="w-7 h-7" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="font-semibold mb-1">{search || typeFilter !== "all" || statusFilter !== "all" ? "No matches found" : "No analyses yet"}</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search || typeFilter !== "all" || statusFilter !== "all" ? "Try adjusting your search or filters." : "Upload your first tender document to get started."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] font-medium uppercase tracking-wider" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
              <div className="col-span-4">Opportunity</div>
              <div className="col-span-2">Client</div>
              <div className="col-span-1 text-center">Type</div>
              <div className="col-span-1 text-center">Score</div>
              <div className="col-span-2">Analyzed</div>
              <div className="col-span-2 text-center">Status</div>
            </div>

            {/* Rows */}
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {filtered.map((record) => {
                  const info = extractRecordInfo(record);
                  const status = record.tender_status || "analyzed";

                  return (
                    <div
                      key={record.id}
                      className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center cursor-pointer transition-colors"
                      style={{ borderBottom: "1px solid var(--border-primary)" }}
                      onClick={() => navigateTo(record)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Opportunity */}
                      <div className="col-span-4">
                        <p className="text-sm font-medium truncate">{record.project_name || "Untitled"}</p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{record.file_name}</p>
                      </div>

                      {/* Client */}
                      <div className="col-span-2 text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                        {info.client || "—"}
                      </div>

                      {/* Type */}
                      <div className="col-span-1 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLORS[info.rfxType] || TYPE_COLORS.other}`}>
                          {TYPE_LABELS[info.rfxType] || "Other"}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="col-span-1 text-center">
                        {info.score != null ? (
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                            info.score >= 70 ? "bg-emerald-500/10 text-emerald-400" :
                            info.score >= 40 ? "bg-amber-500/10 text-amber-400" :
                            "bg-red-500/10 text-red-400"
                          }`}>
                            {info.score}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </div>

                      {/* Date */}
                      <div className="col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(record.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {info.deadline && info.deadline !== "Not specified" && (
                          <p className="text-[10px] mt-0.5">Deadline: {info.deadline}</p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="col-span-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <StatusDropdown value={status} onChange={(v) => updateStatus(record.id, v)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        {filtered.length > 0 && (
          <p className="text-xs mt-4 text-center" style={{ color: "var(--text-muted)" }}>
            Showing {filtered.length} of {records.length} opportunities
          </p>
        )}
      </div>
    </AppShell>
  );
}
