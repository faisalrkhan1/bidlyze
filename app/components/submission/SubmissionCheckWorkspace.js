"use client";

// Submission Check (beta) workspace: check a supplier's technical proposal
// against an analysed tender.
//
// Privacy and safety by design for the beta:
//  - the proposal is read in this browser; only its page text is sent to the
//    check (no file upload, nothing stored in Bidlyze's database or storage)
//  - results and reviewer notes stay in this browser (localStorage) until the
//    user starts a new check; the export is the shareable record
//  - every screen says the results need human review; nothing is called "compliant"

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { requirementsFromAnalysis } from "@/lib/submission/fromAnalysis";
import { proposalContentType, extractProposalPages, sha256Hex, MAX_PROPOSAL_BYTES, ExtractionError } from "@/lib/submission/extractClient";
import { isDeletedAnalysis } from "@/lib/deleteTender";
import ResultsView from "./ResultsView";
import EvidenceViewer from "./EvidenceViewer";
import { Card, Icon, Pill, PrimaryButton, SecondaryButton, Spinner } from "./ui";

const DEMO_ID = "demo-alton";
const STORE_PREFIX = "bidlyze.submissionCheck.v1.";
const MAX_STORED_PAGE_CHARS = 1_500_000;

function storeKey(id) {
  return `${STORE_PREFIX}${id}`;
}
function loadStored(id) {
  try {
    const raw = window.localStorage.getItem(storeKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveStored(id, value) {
  try {
    if (value) window.localStorage.setItem(storeKey(id), JSON.stringify(value));
    else window.localStorage.removeItem(storeKey(id));
  } catch {
    // Storage full or blocked: results stay on screen for this session only.
  }
}

function fmtSize(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const STAGES = [
  { at: 0, label: "Sending the proposal text for checking" },
  { at: 4, label: "Checking each requirement against the proposal (AI)" },
  { at: 30, label: "Verifying every quote word for word against both documents" },
  { at: 50, label: "Preparing the results" },
];

export default function SubmissionCheckWorkspace({ analysisId, demo = false }) {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const id = demo ? DEMO_ID : analysisId;

  const [tender, setTender] = useState(null);
  const [tenderError, setTenderError] = useState("");
  const [tenderPagesByFile, setTenderPagesByFile] = useState({}); // "F1" -> {pages, url, loading, error}

  const [proposal, setProposal] = useState(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInput = useRef(null);

  const [phase, setPhase] = useState("setup"); // setup | checking | done
  const [runError, setRunError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [reviews, setReviews] = useState({});
  const [restored, setRestored] = useState(false);
  const [viewer, setViewer] = useState(null);

  // ── Load the tender ────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        if (demo) {
          const res = await fetch("/api/submission-check/demo?part=tender");
          if (!res.ok) throw new Error("The sample tender is not available right now.");
          const d = await res.json();
          if (cancelled) return;
          setTender({ id: DEMO_ID, name: d.analysis.name, fileName: d.analysis.fileName, requirementsTotal: d.analysis.requirementsTotal, cited: d.analysis.requirementsTotal, demo: true, files: [] });
          setTenderPagesByFile({ F1: d.pages ? { pages: d.pages } : { error: "The tender text could not be loaded from the Council's website right now." } });
        } else {
          const sb = getSupabase();
          const { data, error } = await sb.from("analyses").select("id, project_name, file_name, file_path, analysis_data, created_at").eq("id", analysisId).eq("user_id", user.id).single();
          if (error || !data?.analysis_data) throw new Error("This tender analysis was not found, or you don't have access to it.");
          if (isDeletedAnalysis(data)) throw new Error("This tender has been deleted.");
          const { requirements, total, cited } = requirementsFromAnalysis(data.analysis_data);
          const { data: files } = await sb.from("analysis_files").select("storage_path, file_name, content_type, role, sort_order").eq("analysis_id", analysisId).eq("user_id", user.id).order("sort_order", { ascending: true });
          // Same order as the analysis used for its F1, F2, ... markers: primary first.
          const ordered = Array.isArray(files) && files.length
            ? [...files.filter((f) => f.role === "primary"), ...files.filter((f) => f.role !== "primary")]
            : data.file_path ? [{ storage_path: data.file_path, file_name: data.file_name, content_type: "" }] : [];
          if (cancelled) return;
          setTender({
            id: data.id,
            name: data.analysis_data?.summary?.projectName || data.project_name || "Tender",
            fileName: data.file_name,
            requirementsTotal: total,
            checkable: requirements.length,
            cited,
            files: ordered,
          });
        }
      } catch (e) {
        if (!cancelled) setTenderError(e.message || "The tender could not be loaded.");
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, demo, analysisId]);

  // ── Restore a previous check from this browser ─────────────────────────
  useEffect(() => {
    if (!tender) return;
    const s = loadStored(id);
    if (s?.result) {
      setResult(s.result);
      setReviews(s.reviews || {});
      if (s.proposal) setProposal({ ...s.proposal, objectUrl: null, restored: true });
      setPhase("done");
      setRestored(true);
    }
  }, [tender, id]);

  // ── Save the check and the review notes in this browser ────────────────
  useEffect(() => {
    if (phase !== "done" || !result) return;
    const pagesChars = (proposal?.pages || []).reduce((s, p) => s + p.text.length, 0);
    const storedProposal = proposal
      ? { filename: proposal.filename, contentType: proposal.contentType, sha256: proposal.sha256, size: proposal.size, scannedPages: proposal.scannedPages, pages: pagesChars <= MAX_STORED_PAGE_CHARS ? proposal.pages : null }
      : null;
    saveStored(id, { v: 1, savedAt: new Date().toISOString(), result, reviews, proposal: storedProposal });
  }, [phase, result, reviews, proposal, id]);

  // ── Elapsed timer while checking ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "checking") return;
    setElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(timer);
  }, [phase]);

  // ── Read the proposal (in the browser) ─────────────────────────────────
  const readFile = useCallback(async (file) => {
    setFileError("");
    setRunError("");
    const contentType = proposalContentType(file.name, file.type);
    if (!contentType) {
      setFileError(`“${file.name}” is not a supported file. Use a PDF, Word (.docx) or text file.`);
      return;
    }
    if (file.size > MAX_PROPOSAL_BYTES) {
      setFileError(`“${file.name}” is ${fmtSize(file.size)}. The beta accepts proposals up to 50 MB.`);
      return;
    }
    if (file.size === 0) {
      setFileError(`“${file.name}” is empty.`);
      return;
    }
    setReading(true);
    try {
      const buf = await file.arrayBuffer();
      const [sha256, extracted] = await Promise.all([sha256Hex(buf.slice(0)), extractProposalPages(buf, contentType)]);
      if (extracted.chars < 200) {
        throw new ExtractionError("No readable text was found in this file. If it is a scanned document, run it through OCR (text recognition) first.");
      }
      setProposal((old) => {
        if (old?.objectUrl) URL.revokeObjectURL(old.objectUrl);
        return {
          filename: file.name,
          contentType,
          size: file.size,
          sha256,
          pages: extracted.pages,
          scannedPages: extracted.scannedPages,
          chars: extracted.chars,
          objectUrl: contentType === "application/pdf" ? URL.createObjectURL(file) : null,
        };
      });
    } catch (e) {
      setFileError(e instanceof ExtractionError ? e.message : "This file could not be read. It may be damaged or password-protected.");
      setProposal(null);
    } finally {
      setReading(false);
    }
  }, []);

  async function loadSampleProposal() {
    setFileError("");
    setReading(true);
    try {
      const res = await fetch("/api/submission-check/demo?part=proposal");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      await readFile(new File([blob], "Halberd_Vision_Systems_Technical_Proposal_SAMPLE.pdf", { type: "application/pdf" }));
    } catch {
      setFileError("The sample proposal could not be loaded.");
      setReading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) readFile(f);
  }

  // ── Run the check ──────────────────────────────────────────────────────
  async function runCheck({ live = false } = {}) {
    if (!proposal?.pages) return;
    setRunError("");
    setPhase("checking");
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const res = await fetch("/api/submission-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          analysisId: id,
          live,
          response: {
            filename: proposal.filename,
            contentType: proposal.contentType,
            sha256: proposal.sha256,
            scannedPages: proposal.scannedPages,
            pages: proposal.pages.map((p) => ({ unit: p.unit, n: p.n, text: p.text })),
          },
        }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !data?.success) {
        const msg =
          res.status === 401 ? data?.error || "Your session has expired. Sign in again."
          : res.status === 413 ? data?.error || "The proposal is too large for the beta."
          : res.status === 504 ? "The check took too long and was stopped. Try again; if it keeps happening, the proposal may be too long for the beta."
          : data?.error || "The check could not be completed. Please try again in a few minutes.";
        throw new Error(msg);
      }
      setResult({ ...data, tender: { ...data.tender, name: tender?.name || data.tender?.name, fileName: tender?.fileName || data.tender?.fileName } });
      setReviews({});
      setRestored(false);
      setPhase("done");
    } catch (e) {
      setRunError(e.message || "The check could not be completed.");
      setPhase("setup");
    }
  }

  function newCheck() {
    if (result && !window.confirm("Start a new check? The current results and review notes on this device will be cleared (export them first if you need them).")) return;
    saveStored(id, null);
    setResult(null);
    setReviews({});
    setRestored(false);
    setPhase("setup");
    setProposal((old) => {
      if (old?.objectUrl) URL.revokeObjectURL(old.objectUrl);
      return null;
    });
  }

  const onReview = useCallback((itemId, patch) => {
    setReviews((r) => ({ ...r, [itemId]: { ...(r[itemId] || {}), ...patch } }));
  }, []);

  // ── Evidence viewer ────────────────────────────────────────────────────
  const loadTenderFile = useCallback(async (fileKey) => {
    if (demo || tenderPagesByFile[fileKey]?.pages || tenderPagesByFile[fileKey]?.loading) return;
    const idx = Number(String(fileKey).replace(/\D/g, "")) || 1;
    const f = tender?.files?.[idx - 1];
    if (!f?.storage_path) {
      setTenderPagesByFile((m) => ({ ...m, [fileKey]: { error: "The original tender file is not available for this analysis." } }));
      return;
    }
    setTenderPagesByFile((m) => ({ ...m, [fileKey]: { loading: true } }));
    try {
      const { data: blob, error } = await getSupabase().storage.from("tender-uploads").download(f.storage_path);
      if (error || !blob) throw new Error();
      const ct = proposalContentType(f.file_name, f.content_type || blob.type);
      if (!ct) throw new ExtractionError("A page preview is not available for this file type. Download the original from the analysis page.");
      const { pages } = await extractProposalPages(await blob.arrayBuffer(), ct);
      setTenderPagesByFile((m) => ({ ...m, [fileKey]: { pages, url: ct === "application/pdf" ? URL.createObjectURL(blob) : null } }));
    } catch (e) {
      setTenderPagesByFile((m) => ({ ...m, [fileKey]: { error: e instanceof ExtractionError ? e.message : "The tender file could not be opened right now." } }));
    }
  }, [demo, tender, tenderPagesByFile]);

  const onView = useCallback((v) => {
    setViewer(v);
    if (v.side === "tender") loadTenderFile(v.file || "F1");
  }, [loadTenderFile]);

  const viewerProps = useMemo(() => {
    if (!viewer) return null;
    if (viewer.side === "tender") {
      const t = tenderPagesByFile[viewer.file || "F1"] || {};
      return { title: viewer.fileName || tender?.fileName || "Tender", pages: t.pages, loading: t.loading, error: t.error, unitLabel: t.pages?.[0]?.unit === "page" || !t.pages ? "page" : "section", originalUrl: t.url };
    }
    return {
      title: proposal?.filename || result?.response?.filename || "Proposal",
      pages: proposal?.pages,
      error: proposal?.pages ? null : "Re-attach the proposal file to view its pages (page text was not kept in this browser).",
      unitLabel: (proposal?.pages?.[0]?.unit || result?.response?.unit) === "page" ? "page" : "section",
      originalUrl: proposal?.objectUrl,
    };
  }, [viewer, tenderPagesByFile, tender, proposal, result]);

  // ── Render ─────────────────────────────────────────────────────────────
  const breadcrumbs = [
    { label: "Dashboard", href: "/dashboard" },
    demo ? { label: "Submission Check", href: "/submission-check" } : { label: tender?.name || "Tender", href: `/analysis/${analysisId}` },
    { label: demo ? "Sample tender" : "Submission Check" },
  ];

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const stageIdx = STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={breadcrumbs}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">
        <header className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Submission Check</h1>
              <Pill tone="green">BETA</Pill>
              {demo && <Pill tone="blue">Sample data</Pill>}
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Check a draft technical proposal against every requirement of the tender, with quotes from both documents.
            </p>
          </div>
        </header>

        {tenderError ? (
          <Card className="p-8 text-center">
            <p className="font-semibold mb-1">{tenderError}</p>
            <SecondaryButton onClick={() => router.push("/submission-check")} className="mt-3">Choose another tender</SecondaryButton>
          </Card>
        ) : !tender ? (
          <Card className="p-8 flex items-center justify-center gap-3 text-sm" style={{ color: "var(--text-muted)" }}><Spinner /> Loading the tender…</Card>
        ) : (
          <>
            {/* Tender + proposal summary strip */}
            <div className="grid md:grid-cols-2 gap-3">
              <Card className="p-4 flex gap-3" data-testid="tender-card">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0"><Icon name="doc" className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>1 · Tender</p>
                  <p className="text-sm font-semibold truncate" title={tender.name}>{tender.name}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {tender.requirementsTotal} requirements{tender.cited ? `, ${tender.cited} with verified tender quotes` : ""} · {tender.fileName}
                  </p>
                  {!tender.demo && tender.cited === 0 && tender.requirementsTotal > 0 && (
                    <p className="text-[11px] mt-1 text-amber-500">Analysed before page-cited quotes: tender quotes will not be shown.</p>
                  )}
                </div>
                {phase !== "checking" && (
                  <button onClick={() => router.push("/submission-check")} className="text-xs font-medium text-emerald-500 hover:underline self-start shrink-0">Change</button>
                )}
              </Card>

              <Card className="p-4 flex gap-3" data-testid="proposal-card">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><Icon name="clipboard" className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>2 · Supplier proposal</p>
                  {proposal ? (
                    <>
                      <p className="text-sm font-semibold truncate" title={proposal.filename}>{proposal.filename}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {proposal.pages ? `${proposal.pages.length} ${proposal.pages[0]?.unit === "page" ? "pages" : "sections"} read` : "Page text not kept on this device"}
                        {proposal.size ? ` · ${fmtSize(proposal.size)}` : ""}
                        {proposal.scannedPages?.length ? ` · ${proposal.scannedPages.length} page(s) without text` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Not selected yet</p>
                  )}
                </div>
                {proposal && phase === "setup" && (
                  <button onClick={() => setProposal(null)} className="text-xs font-medium hover:underline self-start shrink-0" style={{ color: "var(--text-secondary)" }}>Remove</button>
                )}
              </Card>
            </div>

            {phase === "setup" && (
              <>
                {!proposal && (
                  <div
                    onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    onDrop={onDrop}
                    onClick={() => !reading && fileInput.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${dragActive ? "scale-[1.01]" : ""}`}
                    style={{ borderColor: dragActive ? "var(--accent)" : "var(--border-secondary)", background: dragActive ? "var(--accent-muted)" : "var(--bg-subtle)" }}
                    data-testid="dropzone"
                  >
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
                      data-testid="file-input"
                    />
                    {reading ? (
                      <div className="flex flex-col items-center gap-3"><Spinner className="w-7 h-7" /><p className="text-sm font-medium">Reading the proposal in your browser…</p></div>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4"><Icon name="upload" className="w-7 h-7" /></div>
                        <p className="font-semibold mb-1">Drop the supplier&apos;s technical proposal here, or click to choose</p>
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>PDF, Word (.docx) or text · up to 50 MB · scanned PDFs need OCR first</p>
                      </>
                    )}
                  </div>
                )}

                {demo && !proposal && !reading && (
                  <div className="text-center">
                    <SecondaryButton onClick={loadSampleProposal} data-testid="use-sample">Use the sample proposal (fictional supplier)</SecondaryButton>
                  </div>
                )}

                {fileError && <p className="text-sm px-4 py-3 rounded-xl bg-red-500/10 text-red-400" role="alert" data-testid="file-error">{fileError}</p>}

                {proposal && (
                  <Card className="p-5">
                    <p className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>3 · Run the check</p>
                    {proposal.scannedPages?.length > 0 && (
                      <p className="text-xs mb-3 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-500">
                        {proposal.scannedPages.length} page(s) have no readable text (pages {proposal.scannedPages.slice(0, 10).join(", ")}{proposal.scannedPages.length > 10 ? "…" : ""}). Anything on them will be reported as missing. OCR the file for a complete check.
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        Checks {tender.checkable ?? tender.requirementsTotal} requirements against {proposal.pages?.length} {proposal.pages?.[0]?.unit === "page" ? "pages" : "sections"}. Usually 30–60 seconds.
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          The proposal text is sent to the AI model for this check (provider data retention denied) and is not stored by Bidlyze.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <PrimaryButton onClick={() => runCheck()} disabled={!proposal.pages} data-testid="run-check">
                          <Icon name="shield" /> Run Submission Check
                        </PrimaryButton>
                      </div>
                    </div>
                    {demo && <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>The sample proposal returns a recorded live result instantly. Any other file runs a live check.</p>}
                  </Card>
                )}

                {runError && (
                  <div className="text-sm px-4 py-3 rounded-xl bg-red-500/10 text-red-400 flex items-start gap-2" role="alert" data-testid="run-error">
                    <Icon name="warning" className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="flex-1">{runError}</span>
                    {proposal && <button onClick={() => runCheck()} className="font-semibold hover:underline shrink-0">Try again</button>}
                  </div>
                )}

                <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
                  Beta: results are an automated aid for your review, not a compliance certificate. Nothing about the proposal is saved to your Bidlyze account.
                </p>
              </>
            )}

            {phase === "checking" && (
              <Card className="p-8" data-testid="checking">
                <div className="text-center mb-6">
                  <Spinner className="w-8 h-8 mx-auto mb-3" />
                  <h2 className="text-lg font-semibold">Checking the proposal</h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{elapsed}s elapsed · usually 30–60 seconds. Keep this tab open.</p>
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  {STAGES.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-lg" style={{ opacity: i > stageIdx ? 0.4 : 1, background: i === stageIdx ? "var(--bg-input)" : "transparent" }}>
                      {i < stageIdx ? <Icon name="check" className="w-4 h-4 text-emerald-500" strokeWidth={2.5} /> : i === stageIdx ? <Spinner className="w-4 h-4" /> : <span className="w-4 h-4 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--text-muted)" }} /></span>}
                      {s.label}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {phase === "done" && result && (
              <ResultsView
                result={result}
                reviews={reviews}
                onReview={onReview}
                onView={onView}
                onNewCheck={newCheck}
                restored={restored}
                demo={demo}
              />
            )}
          </>
        )}
      </div>

      <EvidenceViewer
        key={viewer ? `${viewer.side}:${viewer.file}:${viewer.page}:${(viewer.quote || "").slice(0, 40)}` : "closed"}
        open={!!viewer}
        onClose={() => setViewer(null)}
        side={viewer?.side}
        page={viewer?.page}
        quote={viewer?.quote}
        status={viewer?.status}
        {...(viewerProps || {})}
      />
    </AppShell>
  );
}
