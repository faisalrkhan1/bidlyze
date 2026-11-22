"use client";

// Submission Check workspace: the whole customer workflow on one screen.
//
//   1. Add the tender   upload it (read in this browser; its requirements are
//                        extracted when the check runs) or pick one checked before
//   2. Add the proposal  one or more files (technical proposal, price schedule...)
//   3. Run the check     reads the tender's requirements (new tenders only), then
//                        checks the proposal against every requirement
//   4. Review findings   both-side quotes with pages; reviewers agree or override
//   5. Export the report Excel, with AI findings and the team's decisions kept apart
//
// Privacy and safety by design for the beta:
//  - files are read in this browser; only their page text is sent
//  - the tender's requirement list is saved to the user's account (like any
//    Tender Intelligence analysis); the proposal and the results are not stored
//    on the server. Results and review notes stay in this browser (localStorage)
//  - every screen says the results need human review; nothing is called "compliant"

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import AppShell from "@/app/components/AppShell";
import { requirementsFromAnalysis } from "@/lib/submission/fromAnalysis";
import { proposalContentType, extractProposalPages, readDocumentFile, newRequestId, totalChars, ExtractionError, ACCEPT_ATTR, MAX_FILES } from "@/lib/submission/extractClient";
import { isDeletedAnalysis } from "@/lib/deleteTender";
import ResultsView from "./ResultsView";
import EvidenceViewer from "./EvidenceViewer";
import { Card, EmptyState, Icon, Notice, Pill, PrimaryButton, ProcessingNote, SecondaryButton, Skeleton, Spinner, Stepper, TextButton } from "./ui";
import { prepareRequirements } from "@/lib/submission/obligations";
import { AI_SERVICE_PROBLEMS } from "@/lib/readiness/ai";
import { supportMailto } from "@/lib/contact";

const DEMO_ID = "demo-alton";
const STORE_PREFIX = "bidlyze.submissionCheck.v1.";
const MAX_STORED_PAGE_CHARS = 1_500_000;
const MAX_TEXT_CHARS = 600_000; // what the check reads in one go (lib/submission/documents.js)
const LARGE_TEXT_CHARS = 250_000;
const CLIENT_TIMEOUT_MS = 310_000; // a little over the server's 300 s limit

export function storeKey(id) {
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
    return true;
  } catch {
    // Storage full or blocked: results stay on screen for this session only (the UI says so).
    return false;
  }
}

function fmtSize(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
const unitWord = (unit, n) => (unit === "page" ? (n === 1 ? "page" : "pages") : unit === "sheet" ? (n === 1 ? "sheet" : "sheets") : n === 1 ? "section" : "sections");

const TENDER_STAGES = [
  { at: 0, label: "Sending the tender text" },
  { at: 4, label: "Reading the tender's requirements (AI)" },
  { at: 45, label: "Checking every tender quote against its page" },
];
const CHECK_STAGES = [
  { at: 0, label: "Sending the proposal text" },
  { at: 4, label: "Checking each requirement against the proposal (AI)" },
  { at: 30, label: "Verifying every quote word for word against both documents" },
  { at: 50, label: "Preparing the results" },
];

/** Turn a failed API answer into a message a bid manager can act on. */
function apiError(res, data, what) {
  if (res.status === 401) return data?.error || "Your session has expired. Sign in again.";
  if (res.status === 504) return `The ${what} took too long and was stopped. Try again; if it happens again, upload a shorter document.`;
  return data?.error || `The ${what} could not be completed. Please try again in a few minutes.`;
}

async function postJson(url, body, signal) {
  const { data: { session } } = await getSupabase().auth.getSession();
  let res;
  try {
    res = await fetch(url, {
      signal,
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch (netErr) {
    const e = new Error(
      netErr?.name === "AbortError"
        ? "This took too long and was stopped. Try again; if it keeps happening, upload a shorter document."
        : "Bidlyze could not be reached (network problem). Check your connection and try again."
    );
    e.ambiguous = true; // the server may still have finished the work
    throw e;
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { res, data };
}

const pagesForSend = (f) => ({
  filename: f.filename,
  contentType: f.contentType,
  sha256: f.sha256,
  scannedPages: f.scannedPages,
  pages: f.pages.map((p) => ({ unit: p.unit, n: p.n, ...(p.label ? { label: p.label } : {}), text: p.text })),
});

// ── File drop zone ─────────────────────────────────────────────────────────
function FileDrop({ testId, inputTestId, onFiles, reading, readingLabel, title, hint, multiple = true, compact = false }) {
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const pick = () => !reading && input.current?.click();
  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const list = [...(e.dataTransfer?.files || [])]; if (list.length) onFiles(list); }}
      onClick={pick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
      role="button"
      tabIndex={0}
      aria-label={title}
      className={`rounded-xl text-center cursor-pointer transition-colors duration-150 ${compact ? "px-4 py-5" : "px-6 py-10"}`}
      style={{ border: `1.5px dashed ${drag ? "var(--accent)" : "var(--border-secondary)"}`, background: drag ? "var(--accent-muted)" : "var(--bg-card)" }}
      data-testid={testId}
    >
      <input
        ref={input}
        type="file"
        multiple={multiple}
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => { const list = [...(e.target.files || [])]; if (list.length) onFiles(list); e.target.value = ""; }}
        data-testid={inputTestId}
      />
      {reading ? (
        <div className="flex flex-col items-center gap-3"><Spinner className="w-7 h-7" /><p className="text-[15px] font-medium">{readingLabel}</p></div>
      ) : compact ? (
        <p className="text-[14px] font-medium inline-flex items-center gap-2" style={{ color: "var(--accent-text)" }}><Icon name="upload" /> {title}</p>
      ) : (
        <>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-muted)", color: "var(--accent-text)" }}><Icon name="upload" className="w-6 h-6" /></div>
          <p className="text-[16px] font-semibold mb-1">{title}</p>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{hint}</p>
          <p className="text-[12px] mt-3 inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><Icon name="lock" className="w-3.5 h-3.5" /> Read in your browser. The files themselves are not uploaded.</p>
        </>
      )}
    </div>
  );
}

function FileRows({ files, onRemove, testIdPrefix, disabled }) {
  return (
    <ul className="divide-y" style={{ borderColor: "var(--border-primary)" }}>
      {files.map((f, i) => (
        <li key={`${f.filename}-${i}`} className="flex items-center gap-3 py-2.5 min-w-0" data-testid={`${testIdPrefix}-${i}`} style={{ borderColor: "var(--border-primary)" }}>
          <span className="text-[12px] font-medium tabular w-7 shrink-0" style={{ color: "var(--text-muted)" }}>{i === 0 && files.length > 1 ? "Main" : `${i + 1}`}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium truncate" title={f.filename}>{f.filename}</p>
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {f.pages ? `${f.pages.length} ${unitWord(f.pages[0]?.unit, f.pages.length)} read` : "Page text not kept on this device"}
              {f.size ? `, ${fmtSize(f.size)}` : ""}
              {f.scannedPages?.length ? <span style={{ color: "var(--st-manual)" }}>, {f.scannedPages.length} without text</span> : null}
            </p>
          </div>
          {!disabled && onRemove && (
            <button onClick={() => onRemove(i)} className="text-[13px] font-medium hover:underline underline-offset-2 shrink-0" style={{ color: "var(--text-secondary)" }} aria-label={`Remove ${f.filename}`}>Remove</button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function SubmissionCheckWorkspace({ analysisId, demo = false, startNew = false }) {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  // The tender: a saved one (tender), or files read in this browser that are not analysed yet (tenderDraft).
  const [activeId, setActiveId] = useState(demo ? DEMO_ID : analysisId || null);
  const [tender, setTender] = useState(null);
  const [tenderError, setTenderError] = useState("");
  const [tenderDraft, setTenderDraft] = useState([]); // read files
  const [tenderLocal, setTenderLocal] = useState(null); // page text of the tender files, if read in this browser
  const [tenderPagesByFile, setTenderPagesByFile] = useState({}); // "F1" -> {pages, url, loading, error}
  const [savedTenders, setSavedTenders] = useState(null);

  const [proposals, setProposals] = useState([]);
  const [reading, setReading] = useState(""); // "" | "tender" | "proposal"
  const [fileError, setFileError] = useState({ tender: "", proposal: "" });

  const [phase, setPhase] = useState("setup"); // setup | checking | done
  const [stage, setStage] = useState("check"); // tender | check
  const [runError, setRunError] = useState("");
  const [runErrorCode, setRunErrorCode] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [reviews, setReviews] = useState({});
  const [restored, setRestored] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [viewer, setViewer] = useState(null);
  const tenderRequestId = useRef(null);
  const running = useRef(false);

  // ── Load a saved tender (or the sample) ────────────────────────────────
  useEffect(() => {
    if (authLoading || !user || startNew) return;
    let cancelled = false;
    (async () => {
      try {
        if (demo) {
          const res = await fetch("/api/submission-check/demo?part=tender");
          if (!res.ok) throw new Error("The sample tender is not available right now.");
          const d = await res.json();
          if (cancelled) return;
          setTender({ id: DEMO_ID, name: d.analysis.name, fileName: d.analysis.fileName, requirementsTotal: d.analysis.requirementsTotal, checkable: d.analysis.checkable, notCheckable: d.analysis.notCheckable, cited: d.analysis.requirementsTotal, demo: true, files: [] });
          setTenderPagesByFile({ F1: d.pages ? { pages: d.pages } : { error: "The tender text could not be loaded from the Council's website right now." } });
        } else {
          const sb = getSupabase();
          const { data, error } = await sb.from("analyses").select("id, project_name, file_name, file_path, analysis_data, created_at").eq("id", analysisId).eq("user_id", user.id).single();
          if (error || !data?.analysis_data) throw new Error("This tender was not found, or you don't have access to it.");
          if (isDeletedAnalysis(data)) throw new Error("This tender has been deleted.");
          const { requirements, total, cited } = requirementsFromAnalysis(data.analysis_data);
          const prep = prepareRequirements(requirements);
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
            checkable: prep.checked.length,
            notCheckable: prep.excluded.length,
            cited,
            files: ordered,
            source: data.analysis_data?.meta?.source || "tender-intelligence",
            createdAt: data.created_at,
          });
        }
      } catch (e) {
        if (!cancelled) setTenderError(e.message || "The tender could not be loaded.");
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, demo, analysisId, startNew]);

  // ── Tenders checked before (to pick instead of uploading) ──────────────
  useEffect(() => {
    if (!startNew || authLoading || !user) return;
    getSupabase()
      .from("analyses")
      .select("id, project_name, file_name, created_at, analysis_data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setSavedTenders(
          (data || [])
            .filter((r) => r.analysis_data && !isDeletedAnalysis(r))
            .map((r) => ({ id: r.id, name: r.analysis_data?.summary?.projectName || r.project_name || "Untitled tender", createdAt: r.created_at, total: requirementsFromAnalysis(r.analysis_data).total }))
            .filter((r) => r.total > 0)
        );
      });
  }, [startNew, authLoading, user]);

  // ── Restore a previous check of this tender from this browser ──────────
  useEffect(() => {
    if (!tender || !activeId || result) return;
    const s = loadStored(activeId);
    if (s?.result) {
      setResult(s.result);
      setReviews(s.reviews || {});
      const files = s.proposal?.files || (s.proposal ? [s.proposal] : []);
      setProposals(files.map((f) => ({ ...f, objectUrl: null, restored: true })));
      if (s.tenderFiles?.length && !tenderLocal) setTenderLocal(s.tenderFiles);
      setPhase("done");
      setRestored(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tender, activeId]);

  // ── Save the check and the review notes in this browser ────────────────
  useEffect(() => {
    if (phase !== "done" || !result || !activeId) return;
    const pagesChars = totalChars(proposals) + totalChars(tenderLocal || []);
    const keepPages = pagesChars <= MAX_STORED_PAGE_CHARS;
    const strip = (f) => ({ filename: f.filename, contentType: f.contentType, sha256: f.sha256, size: f.size, scannedPages: f.scannedPages, pages: keepPages ? f.pages : null });
    const value = (withPages) => ({
      v: 2,
      savedAt: new Date().toISOString(),
      result,
      reviews,
      proposal: { files: proposals.map((f) => (withPages ? strip(f) : { ...strip(f), pages: null })) },
      tenderFiles: withPages && keepPages && tenderLocal ? tenderLocal.map((f) => ({ filename: f.filename, pages: f.pages })) : null,
    });
    let ok = saveStored(activeId, value(true));
    // If the page text does not fit, keep at least the results and the review notes.
    if (!ok) ok = saveStored(activeId, value(false));
    setSaveFailed(!ok);
  }, [phase, result, reviews, proposals, tenderLocal, activeId]);

  // ── Elapsed timer while running ────────────────────────────────────────
  useEffect(() => {
    if (phase !== "checking") return;
    setElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(timer);
  }, [phase, stage]);

  // ── Read files in the browser ──────────────────────────────────────────
  const addFiles = useCallback(async (which, list) => {
    setFileError((e) => ({ ...e, [which]: "" }));
    setRunError("");
    const current = which === "tender" ? tenderDraft : proposals;
    const room = MAX_FILES - current.length;
    if (room <= 0) {
      setFileError((e) => ({ ...e, [which]: `You can add up to ${MAX_FILES} files. Remove one first.` }));
      return;
    }
    const take = list.slice(0, room);
    const errors = [];
    if (list.length > room) errors.push(`Only ${room} more file${room === 1 ? "" : "s"} can be added (up to ${MAX_FILES}).`);
    setReading(which);
    const read = [];
    for (const file of take) {
      if (current.some((f) => f.filename === file.name && f.size === file.size)) {
        errors.push(`“${file.name}” is already added.`);
        continue;
      }
      try {
        read.push(await readDocumentFile(file));
      } catch (e) {
        errors.push(e instanceof ExtractionError ? e.message : `“${file.name}” could not be read. It may be damaged or password-protected.`);
      }
    }
    setReading("");
    if (read.length) {
      if (which === "tender") setTenderDraft((d) => [...d, ...read]);
      else setProposals((p) => [...p, ...read]);
    }
    if (errors.length) setFileError((e) => ({ ...e, [which]: errors.join(" ") }));
  }, [tenderDraft, proposals]);

  function removeFile(which, i) {
    const setter = which === "tender" ? setTenderDraft : setProposals;
    setter((list) => {
      const f = list[i];
      if (f?.objectUrl) URL.revokeObjectURL(f.objectUrl);
      return list.filter((_, k) => k !== i);
    });
    setFileError((e) => ({ ...e, [which]: "" }));
  }

  async function loadSampleProposal() {
    setFileError((e) => ({ ...e, proposal: "" }));
    setReading("proposal");
    try {
      const res = await fetch("/api/submission-check/demo?part=proposal");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const f = await readDocumentFile(new File([blob], "Halberd_Vision_Systems_Technical_Proposal_SAMPLE.pdf", { type: "application/pdf" }));
      setProposals([f]);
    } catch {
      setFileError((e) => ({ ...e, proposal: "The sample proposal could not be loaded." }));
    } finally {
      setReading("");
    }
  }

  // ── Run: read the tender's requirements (new tenders), then check ───────
  async function runCheck({ live = false } = {}) {
    if (running.current || proposals.length === 0 || (!tender && tenderDraft.length === 0)) return;
    running.current = true;
    setRunError("");
    setPhase("checking");
    const controller = new AbortController();
    let timer = null;
    try {
      let id = activeId;
      // Step 1: the tender's requirements (only for a tender added in this browser).
      if (!tender && tenderDraft.length) {
        setStage("tender");
        // Keep the id after a dropped connection: the server may have finished, and the
        // same id hands back that tender instead of reading (and charging) it again.
        tenderRequestId.current = tenderRequestId.current || newRequestId();
        timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
        const { res, data } = await postJson("/api/submission-check/tender", { requestId: tenderRequestId.current, tender: { files: tenderDraft.map(pagesForSend) } }, controller.signal);
        clearTimeout(timer);
        if (!res.ok || !data?.success) {
          if (res.status !== 409) tenderRequestId.current = null; // a definite answer: next try is a new request
          throw Object.assign(new Error(apiError(res, data, "reading of the tender")), { code: data?.code });
        }
        tenderRequestId.current = null;
        id = data.analysisId;
        const t = data.tender;
        setTender({ id, name: t.name, fileName: tenderDraft[0].filename, requirementsTotal: t.requirementsTotal, checkable: t.checkable, notCheckable: t.notCheckable, cited: t.cited, files: [], source: "submission-check", justRead: true, capped: t.capped, truncated: t.truncated, scannedPages: t.scannedPages });
        setTenderLocal(tenderDraft.map((f) => ({ filename: f.filename, pages: f.pages, objectUrl: f.objectUrl })));
        setTenderDraft([]);
        setActiveId(id);
        // The address now points at this tender, so a refresh restores the results.
        window.history.replaceState(null, "", `/submission-check/${id}`);
      }

      // Step 2: the check.
      setStage("check");
      const ctl = new AbortController();
      timer = setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS);
      const { res, data } = await postJson("/api/submission-check", { requestId: newRequestId(), analysisId: id, live, response: { files: proposals.map(pagesForSend) } }, ctl.signal);
      clearTimeout(timer);
      if (!res.ok || !data?.success) throw Object.assign(new Error(apiError(res, data, "check")), { code: data?.code });
      setResult({ ...data, tender: { ...data.tender, name: tender?.name || data.tender?.name } });
      setReviews({});
      setRestored(false);
      setPhase("done");
    } catch (e) {
      setRunError(e.message || "The check could not be completed.");
      // A problem on Bidlyze's side (for example its AI usage limit): retrying cannot help.
      setRunErrorCode(e.code || "");
      setPhase("setup");
    } finally {
      clearTimeout(timer);
      running.current = false;
    }
  }

  function newCheck() {
    if (result && !window.confirm("Check another proposal against this tender? The current results and review notes on this device will be cleared (export them first if you need them).")) return;
    if (activeId) saveStored(activeId, null);
    setResult(null);
    setReviews({});
    setRestored(false);
    setPhase("setup");
    setProposals((old) => {
      old.forEach((f) => f.objectUrl && URL.revokeObjectURL(f.objectUrl));
      return [];
    });
  }

  const onReview = useCallback((itemId, patch) => {
    setReviews((r) => ({ ...r, [itemId]: { ...(r[itemId] || {}), ...patch } }));
  }, []);

  // ── Evidence viewer ────────────────────────────────────────────────────
  const loadTenderFile = useCallback(async (fileKey) => {
    if (demo || tenderLocal || tenderPagesByFile[fileKey]?.pages || tenderPagesByFile[fileKey]?.loading) return;
    const idx = Number(String(fileKey).replace(/\D/g, "")) || 1;
    const f = tender?.files?.[idx - 1];
    if (!f?.storage_path) {
      setTenderPagesByFile((m) => ({ ...m, [fileKey]: { error: tender?.source === "submission-check" ? "The tender's pages are not kept on this device. Add the tender file again to see its pages; the quotes above were checked when it was read." : "The original tender file is not available for this analysis." } }));
      return;
    }
    setTenderPagesByFile((m) => ({ ...m, [fileKey]: { loading: true } }));
    try {
      const { data: blob, error } = await getSupabase().storage.from("tender-uploads").download(f.storage_path);
      if (error || !blob) throw new Error();
      const ct = proposalContentType(f.file_name, f.content_type || blob.type);
      if (!ct) throw new ExtractionError("A page preview is not available for this file type.");
      const { pages } = await extractProposalPages(await blob.arrayBuffer(), ct);
      setTenderPagesByFile((m) => ({ ...m, [fileKey]: { pages, url: ct === "application/pdf" ? URL.createObjectURL(blob) : null } }));
    } catch (e) {
      setTenderPagesByFile((m) => ({ ...m, [fileKey]: { error: e instanceof ExtractionError ? e.message : "The tender file could not be opened right now." } }));
    }
  }, [demo, tender, tenderLocal, tenderPagesByFile]);

  const onView = useCallback((v) => {
    setViewer(v);
    if (v.side === "tender") loadTenderFile(v.file || "F1");
  }, [loadTenderFile]);

  const viewerProps = useMemo(() => {
    if (!viewer) return null;
    if (viewer.side === "tender") {
      const idx = Number(String(viewer.file || "F1").replace(/\D/g, "")) || 1;
      const local = tenderLocal?.[idx - 1];
      if (local) return { title: local.filename, pages: local.pages || undefined, error: local.pages ? null : "The tender's pages are not kept on this device.", unitLabel: local.pages?.[0]?.unit === "page" || !local.pages ? "page" : "section", originalUrl: local.objectUrl || null };
      const t = tenderPagesByFile[viewer.file || "F1"] || {};
      return { title: viewer.fileName || tender?.fileName || "Tender", pages: t.pages, loading: t.loading, error: t.error, unitLabel: t.pages?.[0]?.unit === "page" || !t.pages ? "page" : "section", originalUrl: t.url };
    }
    const idx = Number(String(viewer.file || "R1").replace(/\D/g, "")) || 1;
    const p = proposals[idx - 1];
    return {
      title: p?.filename || result?.response?.files?.[idx - 1]?.filename || result?.response?.filename || "Proposal",
      pages: p?.pages || undefined,
      error: p?.pages ? null : "Add the proposal file again to view its pages (page text was not kept in this browser).",
      unitLabel: (p?.pages?.[0]?.unit || result?.response?.unit) === "page" ? "page" : "section",
      originalUrl: p?.objectUrl,
    };
  }, [viewer, tenderPagesByFile, tender, tenderLocal, proposals, result]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const hasTender = Boolean(tender) || tenderDraft.length > 0;
  const stepNow = !hasTender ? 0 : phase === "done" ? 3 : proposals.length ? 2 : 1;
  const stages = stage === "tender" ? TENDER_STAGES : CHECK_STAGES;
  const stageIdx = stages.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);
  const proposalChars = totalChars(proposals);
  const draftChars = totalChars(tenderDraft);
  const tooLong = proposalChars > MAX_TEXT_CHARS || draftChars > MAX_TEXT_CHARS;
  const breadcrumbs = [{ label: "Home", href: "/submission-check" }, { label: demo ? "Sample tender" : startNew && !tender ? "New check" : tender?.name || "Check" }];

  return (
    <AppShell user={user} onLogout={logout} breadcrumbs={breadcrumbs}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em]">{startNew && !tender ? "New check" : "Submission Check"}</h1>
            <Pill tone="outline">Beta</Pill>
            {demo && <Pill tone="blue">Sample data</Pill>}
          </div>
          <p className="text-[15px] max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Check a supplier&apos;s proposal against the tender&apos;s requirements before it is submitted. Each finding quotes both documents with page numbers, for your team to review.
          </p>
          <Stepper current={stepNow} />
        </header>

        {tenderError ? (
          <Card>
            <EmptyState icon="warning" title={tenderError} action={<SecondaryButton onClick={() => router.push("/submission-check/new")}>Start a new check</SecondaryButton>}>
              The tender could not be opened. It may have been deleted, or it belongs to another account.
            </EmptyState>
          </Card>
        ) : !startNew && !tender ? (
          <Card className="p-5" data-testid="tender-loading"><Skeleton rows={2} /><span className="sr-only">Loading the tender</span></Card>
        ) : (
          <>
            {/* ── 1. Tender ── */}
            <section aria-labelledby="tender-h">
              <Card className="p-5 space-y-4" data-testid="tender-card">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: hasTender ? "var(--accent-muted)" : "var(--st-neutral-bg)", color: hasTender ? "var(--accent-text)" : "var(--text-secondary)" }}><Icon name="doc" className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h2 id="tender-h" className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>1. Tender</h2>
                    {tender ? (
                      <>
                        <p className="text-[15px] font-semibold truncate" title={tender.name}>{tender.name}</p>
                        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                          <span className="tabular">{tender.requirementsTotal}</span> requirements{tender.cited ? `, ${tender.cited} with verified tender quotes` : ""}
                          {tender.justRead ? ", read just now" : ""}
                        </p>
                        {tender.source === "submission-check" && (
                          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }} data-testid="list-caveat">Read by AI: check the list covers the tender. Requirements can be missed, especially in long or scanned documents.</p>
                        )}
                        {!tender.demo && tender.cited === 0 && tender.requirementsTotal > 0 && (
                          <p className="text-[12px] mt-1" style={{ color: "var(--st-manual)" }}>Analysed before page-cited quotes: tender quotes will not be shown.</p>
                        )}
                      </>
                    ) : tenderDraft.length ? (
                      <>
                        <p className="text-[15px] font-semibold truncate" title={tenderDraft[0].filename}>{tenderDraft.length === 1 ? tenderDraft[0].filename : `${tenderDraft.length} tender files`}</p>
                        {tenderDraft.length === 1 && (
                          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                            {tenderDraft[0].pages.length} {unitWord(tenderDraft[0].pages[0]?.unit, tenderDraft[0].pages.length)} read, {fmtSize(tenderDraft[0].size)}
                            {tenderDraft[0].scannedPages?.length ? <span style={{ color: "var(--st-manual)" }}>, {tenderDraft[0].scannedPages.length} without text</span> : null}
                          </p>
                        )}
                        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Its requirements are read when you run the check (about 1–2 minutes).</p>
                      </>
                    ) : (
                      <p className="text-[15px]" style={{ color: "var(--text-muted)" }}>Add the tender documents (ITT, RFP or RFQ)</p>
                    )}
                  </div>
                  {tender && phase !== "checking" && (
                    <TextButton onClick={() => router.push("/submission-check/new")} className="self-start shrink-0">Change</TextButton>
                  )}
                  {!tender && phase === "setup" && tenderDraft.length === 1 && (
                    <button onClick={() => removeFile("tender", 0)} className="text-[13px] font-medium hover:underline underline-offset-2 self-start shrink-0" style={{ color: "var(--text-secondary)" }} aria-label={`Remove ${tenderDraft[0].filename}`}>Remove</button>
                  )}
                </div>

                {!tender && phase === "setup" && (
                  <>
                    {tenderDraft.length > 1 && <FileRows files={tenderDraft} onRemove={(i) => removeFile("tender", i)} testIdPrefix="tender-file" />}
                    <FileDrop
                      testId="tender-dropzone"
                      inputTestId="tender-file-input"
                      onFiles={(l) => addFiles("tender", l)}
                      reading={reading === "tender"}
                      readingLabel="Reading the tender in your browser…"
                      title={tenderDraft.length ? "Add another tender file (annex, specification, returnables list)" : "Drop the tender here, or choose files"}
                      hint="PDF, Word (.docx), Excel (.xlsx) or text. Up to 5 files, 50 MB each. Scanned PDFs need OCR first."
                      compact={tenderDraft.length > 0}
                    />
                    {fileError.tender && <Notice tone="red" icon="warning" title="A tender file could not be added" role="alert" data-testid="tender-file-error">{fileError.tender}</Notice>}
                    {draftChars > MAX_TEXT_CHARS && (
                      <Notice tone="red" icon="warning" data-testid="tender-too-long">The tender is too long to check in one go (about {Math.round(draftChars / 2400)} pages of text; the limit is about 250). Remove files that hold no requirements, such as drawings or standard terms.</Notice>
                    )}
                    {draftChars > LARGE_TEXT_CHARS && draftChars <= MAX_TEXT_CHARS && (
                      <Notice tone="amber" icon="clock">A long tender: reading its requirements can take up to 5 minutes. If it times out, remove files that hold no requirements.</Notice>
                    )}
                    {tenderDraft.some((f) => f.scannedPages?.length) && (
                      <Notice tone="amber" icon="warning">Some tender pages have no readable text (scanned images). Requirements on those pages will be missed: OCR the file for a complete check.</Notice>
                    )}
                    {startNew && tenderDraft.length === 0 && (
                      <div className="pt-1 space-y-2" data-testid="tender-pick">
                        {savedTenders?.length > 0 && (
                          <>
                            <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Or check against a tender you added before</p>
                            <ul className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
                              {savedTenders.slice(0, 5).map((t, i) => (
                                <li key={t.id} style={i ? { borderTop: "1px solid var(--border-primary)" } : undefined}>
                                  <button onClick={() => router.push(`/submission-check/${t.id}`)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-card-hover)]" data-testid={`tender-pick-${t.id}`}>
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-[14px] font-medium truncate">{t.name}</span>
                                      <span className="block text-[12px]" style={{ color: "var(--text-secondary)" }}><span className="tabular">{t.total}</span> requirements</span>
                                    </span>
                                    <Icon name="right" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                          No tender to hand? <button onClick={() => router.push("/submission-check/demo")} className="font-medium underline underline-offset-2" style={{ color: "var(--accent-text)" }} data-testid="try-sample">Try the sample tender</button> (no AI cost).
                        </p>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </section>

            {/* ── 2. Proposal ── */}
            {phase !== "done" && (
              <section aria-labelledby="proposal-h">
                <Card className={`p-5 space-y-4 ${hasTender ? "" : "opacity-60"}`} data-testid="proposal-card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={proposals.length ? { background: "var(--accent-muted)", color: "var(--accent-text)" } : { background: "var(--st-neutral-bg)", color: "var(--text-muted)" }}><Icon name="clipboard" className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <h2 id="proposal-h" className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>2. Supplier proposal</h2>
                      {proposals.length ? (
                        <p className="text-[15px] font-semibold">{proposals.length === 1 ? proposals[0].filename : `${proposals.length} files`}</p>
                      ) : (
                        <p className="text-[15px]" style={{ color: "var(--text-muted)" }}>{hasTender ? "Add the proposal to check" : "Add the tender first"}</p>
                      )}
                      {proposals.length === 1 && proposals[0].pages && (
                        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                          {proposals[0].pages.length} {unitWord(proposals[0].pages[0]?.unit, proposals[0].pages.length)} read{proposals[0].size ? `, ${fmtSize(proposals[0].size)}` : ""}
                          {proposals[0].scannedPages?.length ? `, ${proposals[0].scannedPages.length} page(s) without text` : ""}
                        </p>
                      )}
                    </div>
                    {hasTender && phase === "setup" && proposals.length === 1 && (
                      <button onClick={() => removeFile("proposal", 0)} className="text-[13px] font-medium hover:underline underline-offset-2 self-start shrink-0" style={{ color: "var(--text-secondary)" }} aria-label={`Remove ${proposals[0].filename}`}>Remove</button>
                    )}
                  </div>
                  {hasTender && phase === "setup" && (
                    <>
                      {proposals.length > 1 && <FileRows files={proposals} onRemove={(i) => removeFile("proposal", i)} testIdPrefix="proposal-file" />}
                      {proposals.length < MAX_FILES && (
                        <FileDrop
                          testId="dropzone"
                          inputTestId="file-input"
                          onFiles={(l) => addFiles("proposal", l)}
                          reading={reading === "proposal"}
                          readingLabel="Reading the proposal in your browser…"
                          title={proposals.length ? "Add another proposal file (for example the price schedule)" : "Drop the supplier's proposal here, or choose files"}
                          hint="PDF, Word (.docx), Excel (.xlsx) or text. Add the technical proposal and any separate parts, such as the price schedule (up to 5 files)."
                          compact={proposals.length > 0}
                        />
                      )}
                      {demo && proposals.length === 0 && reading !== "proposal" && (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                          <span>No proposal to hand?</span>
                          <SecondaryButton onClick={loadSampleProposal} data-testid="use-sample">Use the sample proposal (fictional supplier)</SecondaryButton>
                        </div>
                      )}
                      {fileError.proposal && <Notice tone="red" icon="warning" title="A proposal file could not be added" role="alert" data-testid="file-error">{fileError.proposal}</Notice>}
                      {proposalChars > MAX_TEXT_CHARS && (
                        <Notice tone="red" icon="warning" data-testid="proposal-too-long">The proposal is too long to check in one go (about {Math.round(proposalChars / 2400)} pages of text; the limit is about 250). Add only the parts that answer the tender, such as the technical and compliance sections.</Notice>
                      )}
                      {proposals.some((f) => f.scannedPages?.length) && (
                        <Notice tone="amber" icon="warning">
                          Some proposal pages have no readable text ({proposals.filter((f) => f.scannedPages?.length).map((f) => `${f.filename}: page${f.scannedPages.length === 1 ? "" : "s"} ${f.scannedPages.slice(0, 8).join(", ")}${f.scannedPages.length > 8 ? "…" : ""}`).join("; ")}). Anything on them will be reported as missing. OCR the file for a complete check.
                        </Notice>
                      )}
                    </>
                  )}
                </Card>
              </section>
            )}

            {/* ── 3. Run ── */}
            {phase === "setup" && hasTender && proposals.length > 0 && (
              <Card className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="text-[16px] font-semibold">Ready to check</p>
                    <p className="text-[14px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {tender
                        ? <>Checks {tender.checkable ?? tender.requirementsTotal} requirements{tender.notCheckable ? ` (${tender.notCheckable} scoring-guidance item${tender.notCheckable === 1 ? "" : "s"} left out)` : ""} against {proposals.reduce((n, f) => n + (f.pages?.length || 0), 0)} pages of the proposal. Usually 30–60 seconds.</>
                        : <>First reads the tender&apos;s requirements, then checks the proposal against each one. Usually 2–3 minutes in total.</>}
                    </p>
                  </div>
                  <PrimaryButton onClick={() => runCheck()} disabled={tooLong || proposals.some((f) => !f.pages) || Boolean(reading)} data-testid="run-check" className="sm:self-center">
                    <Icon name="shield" /> Run Submission Check
                  </PrimaryButton>
                </div>
                <div className="pt-3" style={{ borderTop: "1px solid var(--border-primary)" }}>
                  <ProcessingNote />
                </div>
                {demo && <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>The sample proposal replays a recorded live result instantly. Any other file runs a live check.</p>}
              </Card>
            )}

            {runError && phase === "setup" && (
              <Notice
                tone="red"
                icon="warning"
                title={tender ? "The check did not finish" : "The tender could not be read"}
                role="alert"
                data-testid="run-error"
                action={
                  AI_SERVICE_PROBLEMS.has(runErrorCode) ? (
                    <a href={supportMailto("Submission Check could not run", `Error code: ${runErrorCode}`)} className="inline-flex items-center h-8 px-3 rounded-lg text-[13px] font-medium shrink-0" style={{ border: "1px solid var(--border-secondary)" }} data-testid="contact-support">
                      Contact support
                    </a>
                  ) : (
                    proposals.length > 0 && <SecondaryButton onClick={() => runCheck()} className="h-8 shrink-0">Try again</SecondaryButton>
                  )
                }
              >
                {runError}
                {tender?.justRead ? " The tender's requirements were read and saved, so trying again only re-runs the check." : ""}
              </Notice>
            )}

            {phase === "setup" && (
              <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
                Beta: results are an aid for your review, not a compliance certificate. The requirement list and the findings can be incomplete or wrong.
              </p>
            )}

            {phase === "checking" && (
              <Card className="px-6 py-10" data-testid="checking">
                <div className="max-w-md mx-auto">
                  <div className="flex items-center gap-3 mb-1">
                    <Spinner className="w-6 h-6" />
                    <h2 className="text-[18px] font-semibold">{stage === "tender" ? "Reading the tender" : "Checking the proposal"}</h2>
                  </div>
                  <p className="text-[13px] mb-6" style={{ color: "var(--text-secondary)" }}>
                    {stage === "tender" ? "Step 1 of 2. " : tender?.justRead ? "Step 2 of 2. " : ""}<span className="tabular">{elapsed}</span>s elapsed. {stage === "tender" ? "Usually 1–2 minutes" : "Usually 30–60 seconds"}; keep this tab open.
                  </p>
                  <ol className="space-y-1">
                    {stages.map((s, i) => (
                      <li key={s.label} className="flex items-center gap-3 text-[14px] py-2 px-3 rounded-lg" style={{ color: i > stageIdx ? "var(--text-muted)" : "var(--text-primary)", background: i === stageIdx ? "var(--bg-card-hover)" : "transparent" }}>
                        {i < stageIdx ? <Icon name="check" className="w-4 h-4" strokeWidth={2.5} /> : i === stageIdx ? <Spinner className="w-4 h-4" /> : <span className="w-4 h-4 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--border-hover)" }} /></span>}
                        {s.label}
                      </li>
                    ))}
                  </ol>
                  {elapsed >= 90 && (
                    <Notice tone="amber" icon="clock" className="mt-5" data-testid="slow-notice">
                      This is taking longer than usual (a long document or a busy AI service). It stops automatically after 5 minutes; you can keep waiting.
                    </Notice>
                  )}
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
                saveFailed={saveFailed}
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
