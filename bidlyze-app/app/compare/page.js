"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import UserMenu from "@/app/components/UserMenu";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

function validateFile(f) {
  if (!f) return "Please select a file.";
  if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(pdf|docx|txt)$/i)) {
    return "Unsupported file type. Please upload a PDF, DOCX, or TXT file.";
  }
  return null;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function UploadZone({ label, sublabel, file, onFile, dragActive, onDrag, onDrop, inputRef }) {
  return (
    <div className="flex-1">
      <h3 className="font-semibold mb-1">{label}</h3>
      <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>{sublabel}</p>
      <div
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
          dragActive
            ? "border-emerald-500 bg-emerald-500/5"
            : file
            ? "border-emerald-500/50 bg-emerald-500/5"
            : ""
        }`}
        style={!dragActive && !file ? { borderColor: "var(--border-secondary)", background: "var(--bg-subtle)" } : {}}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        {file ? (
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="font-medium text-sm mb-1 truncate">{file.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatSize(file.size)}</p>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--icon-muted)" }}>
              <svg className="w-6 h-6" style={{ color: "var(--text-secondary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="font-medium text-sm mb-1">Drop file here or click to browse</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>PDF, DOCX, or TXT</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [originalFile, setOriginalFile] = useState(null);
  const [amendedFile, setAmendedFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOriginal, setDragOriginal] = useState(false);
  const [dragAmended, setDragAmended] = useState(false);
  const originalRef = useRef(null);
  const amendedRef = useRef(null);
  const router = useRouter();

  function handleOriginalFile(f) {
    setError("");
    const err = validateFile(f);
    if (err) { setError(err); setOriginalFile(null); return; }
    setOriginalFile(f);
  }

  function handleAmendedFile(f) {
    setError("");
    const err = validateFile(f);
    if (err) { setError(err); setAmendedFile(null); return; }
    setAmendedFile(f);
  }

  function handleDragOriginal(e) {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") setDragOriginal(true);
    else if (e.type === "dragleave") setDragOriginal(false);
  }

  function handleDragAmended(e) {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") setDragAmended(true);
    else if (e.type === "dragleave") setDragAmended(false);
  }

  function handleDropOriginal(e) {
    e.preventDefault();
    setDragOriginal(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleOriginalFile(f);
  }

  function handleDropAmended(e) {
    e.preventDefault();
    setDragAmended(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleAmendedFile(f);
  }

  async function handleCompare() {
    if (!originalFile || !amendedFile) return;
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await getSupabase().auth.getSession();

      const formData = new FormData();
      formData.append("original", originalFile);
      formData.append("amended", amendedFile);

      const res = await fetch("/api/compare", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Comparison failed. Please try again.");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("bidlyze-comparison", JSON.stringify(data));
      router.push("/compare/results");
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <span className="text-xl font-bold tracking-tight"><span className="text-emerald-500">Bid</span>lyze</span>
          </div>
          <UserMenu user={user} onLogout={logout} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Back Button */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm font-medium mb-8 transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </button>

        {/* Title */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Amendment <span className="text-emerald-500">Intelligence</span>
          </h1>
          <p className="text-base max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Upload the original and amended tender documents to detect all changes, assess impact, and get AI-powered recommendations.
          </p>
        </div>

        {/* Upload Zones */}
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <UploadZone
              label="Original Tender"
              sublabel="Upload the original version"
              file={originalFile}
              onFile={handleOriginalFile}
              dragActive={dragOriginal}
              onDrag={handleDragOriginal}
              onDrop={handleDropOriginal}
              inputRef={originalRef}
            />

            {/* Arrow divider */}
            <div className="flex items-center justify-center sm:pt-10">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                <svg className="w-5 h-5 text-emerald-500 rotate-90 sm:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>

            <UploadZone
              label="Amended Tender"
              sublabel="Upload the amended version"
              file={amendedFile}
              onFile={handleAmendedFile}
              dragActive={dragAmended}
              onDrag={handleDragAmended}
              onDrop={handleDropAmended}
              inputRef={amendedRef}
            />
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleCompare}
            disabled={!originalFile || !amendedFile || loading}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Comparing documents...
              </span>
            ) : (
              "Compare Documents"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
