"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { FEATURES } from "@/lib/featureFlags";
import { FILE_LIMITS, TENDER_FILE_ROLES, TENDER_FILE_ROLE_LABELS } from "@/lib/constants";

const FREE_LIMIT = 3;
const MAX_SIZE = FILE_LIMITS.MAX_FILE_SIZE;
const TENDER_PACKAGE = FEATURES.enableTenderPackageUpload;

// Accept attribute for the file input. Adds .xlsx when Tender Package mode is on.
const ACCEPT_LEGACY = ".pdf,.docx,.txt";
const ACCEPT_TENDER_PACKAGE = ".pdf,.docx,.txt,.xlsx";

const RFX_TYPES = [
  {
    id: "rfp",
    label: "RFP",
    name: "Request for Proposal",
    description: "Scope, compliance, technical requirements, risks, bid/no-bid",
  },
  {
    id: "rfq",
    label: "RFQ",
    name: "Request for Quotation",
    description: "Commercial extraction, BOQ analysis, pricing risks, submission requirements",
  },
  {
    id: "rfi",
    label: "RFI",
    name: "Request for Information",
    description: "Capability fit, qualification summary, clarification questions",
  },
  {
    id: "other",
    label: "Other",
    name: "Tender / Notice / EOI",
    description: "Document classification, obligations, deadlines, next steps",
  },
];

const ANALYSIS_STAGES = [
  { label: "Preparing document", delay: 0 },
  { label: "Extracting content", delay: 2000 },
  { label: "Analyzing requirements", delay: 5000 },
  { label: "Scoring opportunity", delay: 10000 },
  { label: "Generating intelligence", delay: 18000 },
];

const CONTENT_TYPE_BY_EXT = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function guessContentType(f) {
  if (f.type && FILE_LIMITS.ALLOWED_CONTENT_TYPES.includes(f.type)) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] || f.type || "application/octet-stream";
}

function isAcceptedContentType(ct) {
  return FILE_LIMITS.ALLOWED_CONTENT_TYPES.includes(ct);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function UploadPage() {
  const { user, loading: authLoading, logout } = useAuth();
  // entries: [{ id, file, role, progress }]
  const [entries, setEntries] = useState([]);
  const [rfxType, setRfxType] = useState("rfp");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [usageCount, setUsageCount] = useState(null);
  const [analysesLimit, setAnalysesLimit] = useState(FREE_LIMIT);
  const [currentStage, setCurrentStage] = useState(0);
  const [uploadStage, setUploadStage] = useState("idle"); // idle | preflight | uploading | analyzing
  const fileInputRef = useRef(null);
  const router = useRouter();

  // ── Subscription + monthly usage ──
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    supabase
      .from("subscriptions")
      .select("analyses_limit, status")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.status === "active" && data?.analyses_limit) {
          setAnalysesLimit(data.analyses_limit);
        }
      });

    supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth)
      .then(({ count }) => {
        setUsageCount(count ?? 0);
      });
  }, [user]);

  // ── Synthetic analysis-stage timer ──
  useEffect(() => {
    if (uploadStage !== "analyzing") return;
    const timers = ANALYSIS_STAGES.map((stage, index) => {
      if (index === 0) return null;
      return setTimeout(() => setCurrentStage(index), stage.delay);
    });
    return () => timers.forEach((t) => t && clearTimeout(t));
  }, [uploadStage]);

  const limitReached = usageCount !== null && usageCount >= analysesLimit;

  // ── File acceptance + addition ──
  function addFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    setError("");
    const arr = Array.from(fileList);

    if (!TENDER_PACKAGE) {
      // Legacy single-file: replace state with just one file.
      const f = arr[0];
      const ct = guessContentType(f);
      if (!isAcceptedContentType(ct)) {
        setError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
        return;
      }
      if (f.size > MAX_SIZE) {
        setError("File too large. Maximum size is 50MB.");
        return;
      }
      setEntries([{ id: `f-${Date.now()}`, file: f, role: "primary", progress: 0 }]);
      return;
    }

    // Tender Package: append, enforce limits.
    let next = [...entries];
    for (const f of arr) {
      const ct = guessContentType(f);
      if (!isAcceptedContentType(ct)) {
        setError(`${f.name}: unsupported file type. Allowed: PDF, DOCX, TXT, XLSX.`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        setError(`${f.name}: too large (over ${MAX_SIZE / (1024 * 1024)}MB).`);
        continue;
      }
      // De-dupe by name + size
      if (next.find((e) => e.file.name === f.name && e.file.size === f.size)) continue;
      if (next.length >= FILE_LIMITS.MAX_FILES_PER_PACKAGE) {
        setError(`A tender package can hold at most ${FILE_LIMITS.MAX_FILES_PER_PACKAGE} files.`);
        break;
      }
      const totalAfter = next.reduce((s, e) => s + e.file.size, 0) + f.size;
      if (totalAfter > FILE_LIMITS.MAX_TOTAL_SIZE) {
        setError(
          `Combined size would exceed ${FILE_LIMITS.MAX_TOTAL_SIZE / (1024 * 1024)}MB. Remove a file or upload a smaller one.`
        );
        break;
      }
      // First file becomes primary; subsequent default to "other"
      const hasPrimary = next.some((e) => e.role === "primary");
      const role = hasPrimary ? "other" : "primary";
      next.push({ id: `f-${Date.now()}-${next.length}`, file: f, role, progress: 0 });
    }
    setEntries(next);
  }

  function removeEntry(id) {
    setError("");
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      // If we just removed the primary, promote the first remaining file.
      if (next.length > 0 && !next.some((e) => e.role === "primary")) {
        next[0] = { ...next[0], role: "primary" };
      }
      return next;
    });
  }

  function setRole(id, role) {
    setError("");
    setEntries((prev) => {
      // Setting a row to primary auto-demotes any previous primary.
      if (role === "primary") {
        return prev.map((e) =>
          e.id === id ? { ...e, role: "primary" } : e.role === "primary" ? { ...e, role: "other" } : e
        );
      }
      return prev.map((e) => (e.id === id ? { ...e, role } : e));
    });
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  }
  function handleDrag(e) {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  // ── Upload one file with XHR progress ──
  function uploadWithProgress(url, f, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", f.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload aborted"));
      xhr.send(f);
    });
  }

  function resetFlow() {
    setLoading(false);
    setUploadStage("idle");
    setEntries((prev) => prev.map((e) => ({ ...e, progress: 0 })));
  }

  async function handleAnalyze() {
    if (entries.length === 0 || limitReached) return;
    if (!entries.some((e) => e.role === "primary")) {
      setError("Mark exactly one file as the primary RFP.");
      return;
    }
    if (entries.filter((e) => e.role === "primary").length > 1) {
      setError("Only one file can be the primary RFP.");
      return;
    }

    setLoading(true);
    setError("");
    setCurrentStage(0);
    setUploadStage("preflight");

    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const auth = { Authorization: `Bearer ${session?.access_token}` };

      // Step 1 — preflight (batch or legacy single payload).
      const isBatch = TENDER_PACKAGE;
      const payload = isBatch
        ? {
            files: entries.map((e) => ({
              filename: e.file.name,
              contentType: guessContentType(e.file),
              fileSize: e.file.size,
            })),
          }
        : {
            filename: entries[0].file.name,
            contentType: guessContentType(entries[0].file),
            fileSize: entries[0].file.size,
          };

      const preRes = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const preData = await preRes.json().catch(() => ({}));
      if (!preRes.ok) {
        setError(preData?.error || "Could not start upload. Please try again.");
        resetFlow();
        return;
      }

      // Normalize response: legacy shape returns top-level uploadUrl, batch returns { uploads }.
      const uploads = isBatch
        ? preData.uploads
        : [{ uploadUrl: preData.uploadUrl, storagePath: preData.storagePath, filename: entries[0].file.name }];

      if (!Array.isArray(uploads) || uploads.length !== entries.length) {
        setError("Upload server returned an unexpected response.");
        resetFlow();
        return;
      }

      // Step 2 — PUT each file in sequence.
      setUploadStage("uploading");
      const storagePaths = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const u = uploads[i];
        try {
          await uploadWithProgress(u.uploadUrl, e.file, (p) =>
            setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, progress: p } : x)))
          );
          storagePaths.push(u.storagePath);
        } catch (uploadErr) {
          console.error(`Direct upload failed for ${e.file.name}:`, uploadErr);
          setError(`Upload failed for ${e.file.name}. Please check your connection and try again.`);
          resetFlow();
          return;
        }
      }

      // Step 3 — analyze.
      setUploadStage("analyzing");
      setCurrentStage(0);

      const analyzePayload = isBatch
        ? {
            files: entries.map((e, i) => ({
              storagePath: storagePaths[i],
              filename: e.file.name,
              contentType: guessContentType(e.file),
              role: e.role,
            })),
            rfxType,
          }
        : {
            storagePath: storagePaths[0],
            filename: entries[0].file.name,
            contentType: guessContentType(entries[0].file),
            rfxType,
          };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(analyzePayload),
      });
      const data = await res.json().catch(() => ({}));

      if (!data?.success) {
        setError(data?.error || "Analysis failed. Please try again.");
        resetFlow();
        return;
      }

      router.push("/analysis/" + data.analysisId);
    } catch (err) {
      console.error("Analyze flow error:", err);
      setError("Network error. Please check your connection and try again.");
      resetFlow();
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const breadcrumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: TENDER_PACKAGE ? "New Tender Package" : "New Analysis" },
  ];

  const hasFiles = entries.length > 0;
  const hasPrimary = entries.some((e) => e.role === "primary");
  const tooManyPrimaries = entries.filter((e) => e.role === "primary").length > 1;
  const totalSize = entries.reduce((s, e) => s + e.file.size, 0);
  const overTotalLimit = totalSize > FILE_LIMITS.MAX_TOTAL_SIZE;
  const canSubmit = hasFiles && hasPrimary && !tooManyPrimaries && !overTotalLimit && !loading;
  const titleStage = TENDER_PACKAGE ? "tender package" : "document";

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={breadcrumbs}>
      <div className="max-w-3xl mx-auto px-6 py-10 animate-fade-in">
        {/* Usage Counter */}
        {usageCount !== null && (
          <div className="mb-8 animate-slide-up">
            <div
              className="flex items-center justify-between p-4 rounded-xl transition-colors duration-300"
              style={{
                background: limitReached ? "rgba(239, 68, 68, 0.05)" : "var(--bg-subtle)",
                border: limitReached ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid var(--border-primary)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${limitReached ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                  <svg className={`w-4 h-4 ${limitReached ? "text-red-400" : "text-emerald-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                </div>
                <div>
                  <span className={`text-sm font-medium ${limitReached ? "text-red-400" : ""}`} style={!limitReached ? { color: "var(--text-secondary)" } : {}}>
                    {usageCount} / {analysesLimit} analyses this month
                  </span>
                  {!limitReached && (
                    <div className="mt-1.5 w-48 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-primary)" }}>
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min((usageCount / analysesLimit) * 100, 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>
              {limitReached && (
                <button onClick={() => router.push("/pricing")} className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">Upgrade</button>
              )}
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {TENDER_PACKAGE ? "New Tender Package" : "New Analysis"}
          </h1>
          <p className="text-sm sm:text-base" style={{ color: "var(--text-secondary)" }}>
            {TENDER_PACKAGE
              ? "Upload your tender files — main RFP plus any BOQ, annexes, T&Cs, or drawings — for a unified analysis."
              : "Select your document type, upload the file, and get structured intelligence in seconds."}
          </p>
        </div>

        {/* RFx Type Selector */}
        {!loading && !limitReached && (
          <div className="mb-6 animate-slide-up">
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Document Type</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RFX_TYPES.map((type) => {
                const isSelected = rfxType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setRfxType(type.id)}
                    className={`relative p-3 rounded-xl text-left transition-all duration-200 ${isSelected ? "ring-2 ring-emerald-500" : ""}`}
                    style={{
                      background: isSelected ? "var(--accent-muted)" : "var(--bg-subtle)",
                      border: isSelected ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-primary)",
                    }}
                  >
                    <span className={`text-sm font-bold ${isSelected ? "text-emerald-500" : ""}`}>{type.label}</span>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{type.name}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
              {RFX_TYPES.find((t) => t.id === rfxType)?.description}
            </p>
          </div>
        )}

        {/* Upload Area */}
        <div className="animate-slide-up">
          {limitReached ? (
            <div className="border-2 border-dashed rounded-2xl p-12 text-center opacity-50 transition-colors duration-300" style={{ borderColor: "var(--border-secondary)", background: "var(--bg-subtle)" }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--icon-muted)" }}>
                <svg className="w-7 h-7" style={{ color: "var(--text-secondary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <p className="font-medium mb-1">Free limit reached</p>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>You&apos;ve reached your free limit. Upgrade to continue.</p>
              <button onClick={() => router.push("/pricing")} className="inline-block px-6 py-3 rounded-xl font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">View Pricing</button>
            </div>
          ) : loading && uploadStage !== "analyzing" ? (
            /* Step 2: direct upload progress (per-file rows when batch) */
            <div className="rounded-2xl p-6 sm:p-8 transition-colors duration-300" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold mb-1">{uploadStage === "preflight" ? `Preparing ${titleStage}` : `Uploading ${titleStage}`}</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{entries.length} file{entries.length === 1 ? "" : "s"}</p>
              </div>
              <div className="max-w-md mx-auto space-y-3">
                {entries.map((e) => (
                  <div key={e.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="truncate pr-2" style={{ color: "var(--text-secondary)" }}>{e.file.name}</span>
                      <span style={{ color: "var(--text-muted)" }}>{uploadStage === "preflight" ? "…" : `${e.progress}%`}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-primary)" }}>
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-150 ease-out" style={{ width: `${Math.max(e.progress, uploadStage === "preflight" ? 2 : 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : loading ? (
            /* Step 3: Analysis Progress Stages */
            <div className="rounded-2xl p-8 sm:p-10 transition-colors duration-300" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="animate-spin h-6 w-6 text-emerald-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold mb-1">Analyzing your {titleStage}</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{entries.length} file{entries.length === 1 ? "" : "s"}</p>
              </div>
              <div className="space-y-3 max-w-sm mx-auto">
                {ANALYSIS_STAGES.map((stage, index) => {
                  const isCompleted = index < currentStage;
                  const isCurrent = index === currentStage;
                  const isPending = index > currentStage;
                  return (
                    <div key={stage.label} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-500 ${isCurrent ? "animate-fade-in" : ""}`} style={{ opacity: isPending ? 0.35 : 1, background: isCurrent ? "var(--bg-input)" : "transparent" }}>
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                        {isCompleted ? (
                          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        ) : isCurrent ? (
                          <svg className="animate-spin h-4 w-4 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <div className="w-2 h-2 rounded-full" style={{ background: "var(--text-muted)" }} />
                        )}
                      </div>
                      <span className={`text-sm font-medium transition-colors duration-300 ${isCompleted ? "text-emerald-500" : ""}`} style={isCurrent ? { color: "var(--text-primary)" } : isPending ? { color: "var(--text-muted)" } : {}}>
                        {stage.label}
                        {isCompleted && <span className="ml-1.5 text-xs" style={{ color: "var(--text-muted)" }}>Done</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 mx-auto max-w-sm">
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--border-primary)" }}>
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${((currentStage + 1) / ANALYSIS_STAGES.length) * 100}%` }} />
                </div>
                <p className="text-xs text-center mt-2" style={{ color: "var(--text-muted)" }}>Step {currentStage + 1} of {ANALYSIS_STAGES.length}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Drop zone / file list */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 ${
                  dragActive ? "border-emerald-500 bg-emerald-500/5" : hasFiles ? "border-emerald-500/50 bg-emerald-500/5" : ""
                }`}
                style={!dragActive && !hasFiles ? { borderColor: "var(--border-secondary)", background: "var(--bg-subtle)" } : {}}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={TENDER_PACKAGE ? ACCEPT_TENDER_PACKAGE : ACCEPT_LEGACY}
                  multiple={TENDER_PACKAGE}
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />

                {!hasFiles ? (
                  <div>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--icon-muted)" }}>
                      <svg className="w-7 h-7" style={{ color: "var(--text-secondary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="font-medium mb-1">
                      {TENDER_PACKAGE
                        ? "Drop your tender files here or click to browse"
                        : "Drop your document here or click to browse"}
                    </p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {TENDER_PACKAGE
                        ? `Main RFP + any BOQ, annexes, T&Cs, drawings. Up to ${FILE_LIMITS.MAX_FILES_PER_PACKAGE} files, ${FILE_LIMITS.MAX_TOTAL_SIZE / (1024 * 1024)}MB total.`
                        : "PDF, DOCX, or TXT — max 50MB"}
                    </p>
                  </div>
                ) : (
                  <div onClick={(e) => e.stopPropagation()} className="text-left">
                    {/* File list — header row + entries */}
                    <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                      {entries.length} file{entries.length === 1 ? "" : "s"} • {formatSize(totalSize)} total
                    </p>
                    <div className="space-y-2 mb-4">
                      {entries.map((e) => (
                        <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)" }}>
                          <svg className="w-5 h-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{e.file.name}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatSize(e.file.size)}</p>
                          </div>
                          {TENDER_PACKAGE && (
                            <select
                              value={e.role}
                              onChange={(ev) => setRole(e.id, ev.target.value)}
                              className="text-xs px-2 py-1.5 rounded-lg"
                              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                            >
                              {TENDER_FILE_ROLES.map((r) => (
                                <option key={r} value={r}>{TENDER_FILE_ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => removeEntry(e.id)}
                            className="shrink-0 p-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            title="Remove"
                            aria-label="Remove file"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add more / replace */}
                    <button
                      onClick={(ev) => { ev.stopPropagation(); fileInputRef.current?.click(); }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" }}
                    >
                      {TENDER_PACKAGE ? "Add more files" : "Replace file"}
                    </button>
                  </div>
                )}
              </div>

              {/* Validation notes */}
              {TENDER_PACKAGE && hasFiles && !hasPrimary && (
                <p className="mt-3 text-xs text-amber-500">Mark one file as the Primary RFP.</p>
              )}
              {TENDER_PACKAGE && tooManyPrimaries && (
                <p className="mt-3 text-xs text-amber-500">Only one file can be the Primary RFP.</p>
              )}

              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!canSubmit}
                className="w-full mt-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white"
              >
                {TENDER_PACKAGE && entries.length > 1 ? "Analyze Tender Package" : "Analyze Document"}
              </button>

              {/* File type hints */}
              <div className="mt-6 flex items-center justify-center gap-4 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
                {[
                  ...["PDF", "DOCX", "TXT"],
                  ...(TENDER_PACKAGE ? ["XLSX"] : []),
                ].map((label) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
