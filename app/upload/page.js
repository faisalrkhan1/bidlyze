"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const MAX_SIZE = 3 * 1024 * 1024; // 3MB
const FREE_LIMIT = 3;

const features = [
  {
    title: "Tender Summary",
    description:
      "Get a complete overview of project details, issuing authority, deadlines, and estimated values.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    title: "Compliance Checklist",
    description:
      "Auto-generated checklist of all compliance requirements with critical item flags.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    ),
  },
  {
    title: "Risk Flags",
    description:
      "Identify potential risks with severity ratings and actionable mitigation recommendations.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
  {
    title: "Bid/No-Bid Score",
    description:
      "AI-powered scoring from 0-100 with a clear BID or NO-BID recommendation and reasoning.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-300"
      style={{ border: "1px solid var(--border-secondary)", background: "var(--bg-subtle)" }}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-secondary)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-secondary)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  );
}

export default function HomePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [usageCount, setUsageCount] = useState(null);
  const [analysesLimit, setAnalysesLimit] = useState(FREE_LIMIT);
  const fileInputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get subscription plan limit
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

    try {
      const { data: { session } } = await getSupabase().auth.getSession();

      const formData = new FormData();
      formData.append("file", file);

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

      sessionStorage.setItem("bidlyze-result", JSON.stringify(data));
      router.push("/analyze");
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header className="transition-colors duration-300" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-base text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">Bidlyze</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm hidden sm:block" style={{ color: "var(--text-secondary)" }}>{user?.email}</span>
            <ThemeToggle />
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300"
              style={{ border: "1px solid var(--border-secondary)", background: "transparent" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Usage Counter */}
        {usageCount !== null && (
          <div className="max-w-2xl mx-auto mb-8">
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
                <span className={`text-sm font-medium ${limitReached ? "text-red-400" : ""}`} style={!limitReached ? { color: "var(--text-secondary)" } : {}}>
                  {usageCount} / {analysesLimit} analyses this month
                </span>
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

        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            AI-Powered <span className="text-emerald-500">Tender Analysis</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Upload your tender document and get instant analysis with compliance checks,
            risk flags, and bid recommendations.
          </p>
        </div>

        {/* Upload Area */}
        <div className="max-w-2xl mx-auto mb-16">
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
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>{formatSize(file.size)}</p>
                  </div>
                ) : (
                  <div>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--icon-muted)" }}>
                      <svg className="w-7 h-7" style={{ color: "var(--text-secondary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="font-medium mb-1">
                      Drop your tender document here or click to browse
                    </p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>PDF, DOCX, or TXT — max 3MB</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file || loading}
                className="w-full mt-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing tender document...
                  </span>
                ) : (
                  "Analyze Tender"
                )}
              </button>
            </>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl transition-colors duration-300"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-secondary)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-primary)"}
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
