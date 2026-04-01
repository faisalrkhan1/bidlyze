"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const MAX_SIZE = 3 * 1024 * 1024; // 3MB
const FREE_LIMIT = 3;

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
  { label: "Uploading document", delay: 0 },
  { label: "Extracting content", delay: 2000 },
  { label: "Analyzing requirements", delay: 5000 },
  { label: "Scoring opportunity", delay: 10000 },
  { label: "Generating intelligence", delay: 18000 },
];

export default function UploadPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [file, setFile] = useState(null);
  const [rfxType, setRfxType] = useState("rfp");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [usageCount, setUsageCount] = useState(null);
  const [analysesLimit, setAnalysesLimit] = useState(FREE_LIMIT);
  const [currentStage, setCurrentStage] = useState(0);
  const fileInputRef = useRef(null);
  const router = useRouter();

  // Fetch usage count and subscription limit
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

  // Analysis stage progression
  useEffect(() => {
    if (!loading) return;

    const timers = ANALYSIS_STAGES.map((stage, index) => {
      if (index === 0) return null; // First stage is immediate
      return setTimeout(() => {
        setCurrentStage(index);
      }, stage.delay);
    });

    return () => {
      timers.forEach((t) => t && clearTimeout(t));
    };
  }, [loading]);

  const limitReached = usageCount !== null && usageCount >= analysesLimit;

  function validateFile(f) {
    if (!f) return "Please select a file.";
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(pdf|docx|txt)$/i)) {
      return "Unsupported file type. Please upload a PDF, DOCX, or TXT file.";
    }
    if (f.size > MAX_SIZE) return "File too large. Maximum size is 3MB on the free plan.";
    return null;
  }

  function handleFile(f) {
    setError("");
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrag(e) {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  async function handleAnalyze() {
    if (!file || limitReached) return;
    setLoading(true);
    setError("");
    setCurrentStage(0);

    try {
      const { data: { session } } = await getSupabase().auth.getSession();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("rfxType", rfxType);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Analysis failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/analysis/" + data.analysisId);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function removeFile(e) {
    e.stopPropagation();
    setFile(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    { label: "New Analysis" },
  ];

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
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  limitReached ? "bg-red-500/10" : "bg-emerald-500/10"
                }`}>
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
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min((usageCount / analysesLimit) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              {limitReached && (
                <button
                  onClick={() => router.push("/pricing")}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            New Analysis
          </h1>
          <p className="text-sm sm:text-base" style={{ color: "var(--text-secondary)" }}>
            Select your document type, upload the file, and get structured intelligence in seconds.
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
            <div
              className="border-2 border-dashed rounded-2xl p-12 text-center opacity-50 transition-colors duration-300"
              style={{ borderColor: "var(--border-secondary)", background: "var(--bg-subtle)" }}
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--icon-muted)" }}>
                <svg className="w-7 h-7" style={{ color: "var(--text-secondary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <p className="font-medium mb-1">Free limit reached</p>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                You&apos;ve reached your free limit. Upgrade to continue.
              </p>
              <button
                onClick={() => router.push("/pricing")}
                className="inline-block px-6 py-3 rounded-xl font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
              >
                View Pricing
              </button>
            </div>
          ) : loading ? (
            /* Analysis Progress Stages */
            <div
              className="rounded-2xl p-8 sm:p-10 transition-colors duration-300"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
            >
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="animate-spin h-6 w-6 text-emerald-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold mb-1">Analyzing your document</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {file?.name}
                </p>
              </div>

              <div className="space-y-3 max-w-sm mx-auto">
                {ANALYSIS_STAGES.map((stage, index) => {
                  const isCompleted = index < currentStage;
                  const isCurrent = index === currentStage;
                  const isPending = index > currentStage;

                  return (
                    <div
                      key={stage.label}
                      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-500 ${
                        isCurrent ? "animate-fade-in" : ""
                      }`}
                      style={{
                        opacity: isPending ? 0.35 : 1,
                        background: isCurrent ? "var(--bg-input)" : "transparent",
                      }}
                    >
                      {/* Status Icon */}
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                        {isCompleted ? (
                          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : isCurrent ? (
                          <svg className="animate-spin h-4 w-4 text-emerald-500" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: "var(--text-muted)" }}
                          />
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className={`text-sm font-medium transition-colors duration-300 ${
                          isCompleted ? "text-emerald-500" : ""
                        }`}
                        style={
                          isCurrent
                            ? { color: "var(--text-primary)" }
                            : isPending
                            ? { color: "var(--text-muted)" }
                            : {}
                        }
                      >
                        {stage.label}
                        {isCompleted && (
                          <span className="ml-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                            Done
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="mt-8 mx-auto max-w-sm">
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--border-primary)" }}>
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-out"
                    style={{ width: `${((currentStage + 1) / ANALYSIS_STAGES.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-center mt-2" style={{ color: "var(--text-muted)" }}>
                  Step {currentStage + 1} of {ANALYSIS_STAGES.length}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  dragActive
                    ? "border-emerald-500 bg-emerald-500/5"
                    : file
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : ""
                }`}
                style={!dragActive && !file ? { borderColor: "var(--border-secondary)", background: "var(--bg-subtle)" } : {}}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />

                {file ? (
                  <div>
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    </div>
                    <p className="font-medium mb-1">{file.name}</p>
                    <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>{formatSize(file.size)}</p>
                    <button
                      onClick={removeFile}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-200"
                      style={{ color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-input)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--icon-muted)" }}>
                      <svg className="w-7 h-7" style={{ color: "var(--text-secondary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="font-medium mb-1">
                      Drop your document here or click to browse
                    </p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>PDF, DOCX, or TXT &mdash; max 3MB</p>
                  </div>
                )}
              </div>

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
                disabled={!file || loading}
                className="w-full mt-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white"
              >
                Analyze Document
              </button>

              {/* File type hints */}
              <div className="mt-6 flex items-center justify-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  PDF
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  DOCX
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  TXT
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
