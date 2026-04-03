"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import UpgradeGate from "@/app/components/UpgradeGate";

const ACCEPTED = [".pdf", ".docx", ".txt"];
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_FILES = 10;

const FILE_CATEGORIES = [
  { id: "main_rfx", label: "Main RFP / RFQ / RFI", color: "text-emerald-400 bg-emerald-500/10" },
  { id: "boq", label: "BOQ / Pricing Sheet", color: "text-blue-400 bg-blue-500/10" },
  { id: "compliance", label: "Compliance Form", color: "text-purple-400 bg-purple-500/10" },
  { id: "annexure", label: "Annexure / Appendix", color: "text-amber-400 bg-amber-500/10" },
  { id: "contract", label: "Contract / Legal", color: "text-red-400 bg-red-500/10" },
  { id: "submission", label: "Submission Form", color: "text-cyan-400 bg-cyan-500/10" },
  { id: "attachment", label: "Supporting Attachment", color: "text-gray-400 bg-gray-500/10" },
];

function classifyFile(name) {
  const n = name.toLowerCase();
  if (/boq|bill.of.quantit|pricing|price.schedule|cost|quotation/i.test(n)) return "boq";
  if (/compliance|declaration|certificate|affidavit|sworn/i.test(n)) return "compliance";
  if (/contract|agreement|legal|terms|conditions|nda/i.test(n)) return "contract";
  if (/annex|appendix|addendum|amendment|schedule/i.test(n)) return "annexure";
  if (/form|submission|response.template|returnable/i.test(n)) return "submission";
  if (/rfp|rfq|rfi|tender|request.for|invitation|itb|itt/i.test(n)) return "main_rfx";
  return "attachment";
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const STAGES = [
  { label: "Uploading files", delay: 0 },
  { label: "Extracting document content", delay: 3000 },
  { label: "Classifying documents", delay: 6000 },
  { label: "Analyzing tender package", delay: 10000 },
  { label: "Generating compliance matrix", delay: 18000 },
  { label: "Building package summary", delay: 25000 },
];

export default function WorkspaceNewPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [userPlan, setUserPlan] = useState("free");
  const [files, setFiles] = useState([]);
  const [packageName, setPackageName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const fileInputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading) return;
    const timers = STAGES.map((s, i) =>
      i === 0 ? null : setTimeout(() => setCurrentStage(i), s.delay)
    );
    return () => timers.forEach((t) => t && clearTimeout(t));
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
    const newFiles = [...files];
    for (const f of incoming) {
      if (newFiles.length >= MAX_FILES) { setError(`Maximum ${MAX_FILES} files per package.`); break; }
      const ext = "." + f.name.split(".").pop().toLowerCase();
      if (!ACCEPTED.includes(ext)) { setError(`Unsupported file: ${f.name}`); continue; }
      if (f.size > MAX_FILE_SIZE) { setError(`File too large: ${f.name} (max 3MB each)`); continue; }
      if (newFiles.find((x) => x.file.name === f.name)) continue;
      newFiles.push({ file: f, category: classifyFile(f.name) });
    }
    setFiles(newFiles);
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCategory(idx, cat) {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, category: cat } : f)));
  }

  async function handleAnalyze() {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setCurrentStage(0);

    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const formData = new FormData();
      formData.append("packageName", packageName || "Tender Package");
      files.forEach((f, i) => {
        formData.append(`file_${i}`, f.file);
        formData.append(`category_${i}`, f.category);
      });
      formData.append("fileCount", files.length.toString());

      const res = await fetch("/api/workspace", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Package analysis failed.");
        setLoading(false);
        return;
      }
      router.push(`/workspace/${data.packageId}`);
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Tender Package" }]}>
      <UpgradeGate plan={userPlan} feature="tenderPackage" label="Tender Package">
      <div className="max-w-4xl mx-auto px-6 py-10 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Tender Package Workspace</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Upload multiple tender documents for combined analysis — RFx, BOQ, compliance forms, annexures, and more.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl p-8 sm:p-10" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="animate-spin h-6 w-6 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
              <h2 className="text-lg font-semibold mb-1">Analyzing tender package</h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{files.length} files &middot; {packageName || "Tender Package"}</p>
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              {STAGES.map((stage, i) => (
                <div key={stage.label} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${i === currentStage ? "animate-fade-in" : ""}`} style={{ opacity: i > currentStage ? 0.35 : 1, background: i === currentStage ? "var(--bg-input)" : "transparent" }}>
                  <div className="w-6 h-6 flex items-center justify-center">
                    {i < currentStage ? (
                      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    ) : i === currentStage ? (
                      <svg className="animate-spin h-4 w-4 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <div className="w-2 h-2 rounded-full" style={{ background: "var(--text-muted)" }} />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${i < currentStage ? "text-emerald-500" : ""}`} style={i === currentStage ? { color: "var(--text-primary)" } : i > currentStage ? { color: "var(--text-muted)" } : {}}>
                    {stage.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Package Name */}
            <div className="mb-6">
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Package Name</label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="e.g. IT Infrastructure RFP 2026"
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/25 transition-colors"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200"
              style={{ borderColor: "var(--border-secondary)", background: "var(--bg-subtle)" }}
            >
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => addFiles(Array.from(e.target.files))} />
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--icon-muted)" }}>
                <svg className="w-6 h-6" style={{ color: "var(--text-secondary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="font-medium mb-1">Drop tender package files here or click to browse</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>PDF, DOCX, or TXT &mdash; max {MAX_FILES} files, 3MB each</p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-primary)" }}>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{files.length} file{files.length !== 1 ? "s" : ""} selected</span>
                  <button onClick={() => setFiles([])} className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">Clear all</button>
                </div>
                {files.map((f, i) => {
                  const catConfig = FILE_CATEGORIES.find((c) => c.id === f.category);
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.file.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatSize(f.file.size)}</p>
                      </div>
                      <select
                        value={f.category}
                        onChange={(e) => updateCategory(i, e.target.value)}
                        className="text-xs font-medium px-2 py-1 rounded-lg appearance-none cursor-pointer"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}
                      >
                        {FILE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      <button onClick={() => removeFile(i)} className="text-xs p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={files.length === 0 || loading}
              className="w-full mt-6 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white"
            >
              Analyze Package ({files.length} file{files.length !== 1 ? "s" : ""})
            </button>
          </>
        )}
      </div>
      </UpgradeGate>
    </AppShell>
  );
}
