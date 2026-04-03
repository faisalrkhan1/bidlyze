"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import UpgradeGate from "@/app/components/UpgradeGate";

const MAX_FILES = 6;
const MAX_SIZE = 3 * 1024 * 1024;

const COMPARE_TYPES = [
  { id: "quotation", label: "Vendor Quotations", desc: "Compare pricing, scope, and commercial terms across vendor quotes" },
  { id: "proposal", label: "Bid Proposals", desc: "Compare technical responses, compliance, and deliverables" },
  { id: "revision", label: "Document Revisions", desc: "Compare different versions or amendments of the same tender" },
  { id: "scenario", label: "Internal Options", desc: "Compare internal bid strategies, pricing scenarios, or partner options" },
];

const STAGES = [
  { label: "Uploading submissions", delay: 0 },
  { label: "Extracting content", delay: 3000 },
  { label: "Analyzing each submission", delay: 7000 },
  { label: "Building comparison matrix", delay: 14000 },
  { label: "Generating recommendation", delay: 22000 },
];

function formatSize(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

export default function BidComparePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [userPlan, setUserPlan] = useState("free");
  const [files, setFiles] = useState([]);
  const [compareType, setCompareType] = useState("quotation");
  const [compareName, setCompareName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading) return;
    const t = STAGES.map((s, i) => i === 0 ? null : setTimeout(() => setStage(i), s.delay));
    return () => t.forEach((x) => x && clearTimeout(x));
  }, [loading]);

  useEffect(() => {
    if (!user) return;
    getSupabase()
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.status === "active" && data?.plan) setUserPlan(data.plan);
      });
  }, [user]);

  function addFiles(incoming) {
    setError("");
    const next = [...files];
    for (const f of incoming) {
      if (next.length >= MAX_FILES) { setError(`Maximum ${MAX_FILES} submissions.`); break; }
      if (f.size > MAX_SIZE) { setError(`${f.name} exceeds 3MB limit.`); continue; }
      if (!f.name.match(/\.(pdf|docx|txt)$/i)) { setError(`Unsupported: ${f.name}`); continue; }
      if (next.find((x) => x.file.name === f.name)) continue;
      next.push({ file: f, label: f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ") });
    }
    setFiles(next);
  }

  function updateLabel(i, label) {
    setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, label } : f));
  }

  async function handleCompare() {
    if (files.length < 2) { setError("Upload at least 2 submissions to compare."); return; }
    setLoading(true);
    setError("");
    setStage(0);

    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const fd = new FormData();
      fd.append("compareName", compareName || "Bid Comparison");
      fd.append("compareType", compareType);
      fd.append("fileCount", files.length.toString());
      files.forEach((f, i) => {
        fd.append(`file_${i}`, f.file);
        fd.append(`label_${i}`, f.label);
      });

      const res = await fetch("/api/bid-compare", {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();

      if (!data.success) { setError(data.error || "Comparison failed."); setLoading(false); return; }
      router.push(`/bid-compare/${data.compareId}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Bid Comparison" }]}>
      <UpgradeGate plan={userPlan} feature="bidComparison" label="Bid Comparison">
      <div className="max-w-4xl mx-auto px-6 py-10 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Bid Comparison</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Upload multiple submissions to compare commercially, technically, and by compliance — side by side.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl p-8 sm:p-10" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
              <h2 className="text-lg font-semibold mb-1">Comparing {files.length} submissions</h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{compareName || "Bid Comparison"}</p>
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              {STAGES.map((s, i) => (
                <div key={s.label} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${i === stage ? "animate-fade-in" : ""}`} style={{ opacity: i > stage ? 0.35 : 1, background: i === stage ? "var(--bg-input)" : "transparent" }}>
                  <div className="w-6 h-6 flex items-center justify-center">
                    {i < stage ? <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> :
                     i === stage ? <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> :
                     <div className="w-2 h-2 rounded-full" style={{ background: "var(--text-muted)" }} />}
                  </div>
                  <span className={`text-sm font-medium ${i < stage ? "text-emerald-500" : ""}`} style={i === stage ? { color: "var(--text-primary)" } : i > stage ? { color: "var(--text-muted)" } : {}}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Compare Type Selector */}
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Comparison Type</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COMPARE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCompareType(t.id)}
                    className={`p-3 rounded-xl text-left transition-all ${compareType === t.id ? "ring-2 ring-blue-500" : ""}`}
                    style={{ background: compareType === t.id ? "rgba(59,130,246,0.08)" : "var(--bg-subtle)", border: compareType === t.id ? "1px solid rgba(59,130,246,0.3)" : "1px solid var(--border-primary)" }}
                  >
                    <span className={`text-sm font-bold ${compareType === t.id ? "text-blue-500" : ""}`}>{t.label}</span>
                    <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="mb-6">
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Comparison Name</label>
              <input type="text" value={compareName} onChange={(e) => setCompareName(e.target.value)} placeholder="e.g. IT Infrastructure Vendor Comparison" className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/25" style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }} />
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all"
              style={{ borderColor: "var(--border-secondary)", background: "var(--bg-subtle)" }}
            >
              <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => addFiles(Array.from(e.target.files))} />
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--icon-muted)" }}>
                <svg className="w-6 h-6" style={{ color: "var(--text-secondary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </div>
              <p className="font-medium mb-1">Drop submissions here or click to browse</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>2–{MAX_FILES} files &middot; PDF, DOCX, or TXT &middot; 3MB each</p>
            </div>

            {/* File List with Labels */}
            {files.length > 0 && (
              <div className="mt-6 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{files.length} submission{files.length !== 1 ? "s" : ""}</span>
                  <button onClick={() => setFiles([])} className="text-xs font-medium text-red-400 hover:text-red-300">Clear all</button>
                </div>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                    <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-400">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateLabel(i, e.target.value)}
                        className="w-full text-sm font-medium bg-transparent border-none outline-none"
                        style={{ color: "var(--text-primary)" }}
                        placeholder="Submission label..."
                      />
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.file.name} &middot; {formatSize(f.file.size)}</p>
                    </div>
                    <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

            <button
              onClick={handleCompare}
              disabled={files.length < 2 || loading}
              className="w-full mt-6 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
            >
              Compare {files.length} Submission{files.length !== 1 ? "s" : ""}
            </button>
          </>
        )}
      </div>
      </UpgradeGate>
    </AppShell>
  );
}
