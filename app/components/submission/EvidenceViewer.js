"use client";

// Page viewer for evidence: shows the extracted text of a tender or proposal
// page with the quoted passage highlighted, lets the reviewer step through
// pages, and opens the original PDF at that page when the file is available.

import { useEffect, useMemo, useState } from "react";
import { Icon, Spinner, QuoteCheckPill } from "./ui";

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find the quote in the page text, tolerant of line breaks and spacing. */
export function findQuote(text, quote) {
  if (!text || !quote) return null;
  const words = quote.replace(/[“”"]/g, "").split(/\s+/).filter(Boolean);
  for (const take of [words.length, Math.min(words.length, 10), Math.min(words.length, 6)]) {
    if (take < 3) break;
    const re = new RegExp(words.slice(0, take).map(escapeRe).join("[\\s\\-–—]*\\s*"), "i");
    const m = re.exec(text);
    if (m) {
      // Extend a partial match to the length of the full quote where possible.
      return { start: m.index, end: take === words.length ? m.index + m[0].length : Math.min(text.length, m.index + quote.length) };
    }
  }
  return null;
}

export default function EvidenceViewer({ open, onClose, side, title, pages, loading, error, page, quote, status, unitLabel, originalUrl }) {
  // The parent remounts this viewer (key) for every new quote, so the start page is just the initial state.
  const [current, setCurrent] = useState(page);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const list = pages || [];
  const idx = list.findIndex((p) => p.n === current);
  const pageObj = idx >= 0 ? list[idx] : null;
  const hit = useMemo(() => (pageObj && current === page ? findQuote(pageObj.text, quote) : null), [pageObj, current, page, quote]);

  if (!open) return null;
  const label = (n) => (unitLabel === "section" ? `Section ${n}` : `Page ${n}`);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" role="dialog" aria-modal="true" aria-label={`${side === "tender" ? "Tender" : "Proposal"} ${label(current)}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full flex flex-col shadow-2xl animate-fade-in" style={{ background: "var(--bg-card)", borderLeft: "1px solid var(--border-secondary)" }}>
        <div className="flex items-center gap-3 px-5 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${side === "tender" ? "bg-violet-500/10 text-violet-400" : "bg-emerald-500/10 text-emerald-500"}`}>
            {side === "tender" ? "Tender" : "Proposal"}
          </span>
          <span className="text-sm font-medium truncate" title={title}>{title}</span>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <button disabled={idx <= 0} onClick={() => setCurrent(list[idx - 1].n)} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: "1px solid var(--border-secondary)" }} aria-label="Previous page">
            <Icon name="left" />
          </button>
          <span className="text-sm font-semibold w-28 text-center" data-testid="viewer-page">{label(current)}{list.length ? <span className="font-normal" style={{ color: "var(--text-muted)" }}> / {list.length}</span> : null}</span>
          <button disabled={idx < 0 || idx >= list.length - 1} onClick={() => setCurrent(list[idx + 1].n)} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: "1px solid var(--border-secondary)" }} aria-label="Next page">
            <Icon name="right" />
          </button>
          {current === page && status && <QuoteCheckPill status={status} />}
          {originalUrl && (
            <a href={`${originalUrl}#page=${current}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:underline">
              Open original at this page <Icon name="external" className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-muted)" }}><Spinner /> Loading the document…</div>
          ) : error ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</p>
          ) : !pageObj ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>This page is not available.</p>
          ) : (
            <>
              {current === page && quote && !hit && (
                <p className="text-xs mb-3 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-500">
                  The quote could not be highlighted on this page{status === "unverified" ? " (it was not found in the document)." : " (spacing in the document differs). Search the page for it."}
                </p>
              )}
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }} data-testid="viewer-text">
                {hit ? (
                  <>
                    {pageObj.text.slice(0, hit.start)}
                    <mark data-testid="viewer-highlight" className="rounded px-0.5" style={{ background: "rgba(16,185,129,0.25)", color: "var(--text-primary)" }}>
                      {pageObj.text.slice(hit.start, hit.end)}
                    </mark>
                    {pageObj.text.slice(hit.end)}
                  </>
                ) : (
                  pageObj.text || "(No text on this page. It may be an image or a scanned page.)"
                )}
              </pre>
            </>
          )}
        </div>
        <div className="px-6 py-3 text-[11px] shrink-0" style={{ borderTop: "1px solid var(--border-primary)", color: "var(--text-muted)" }}>
          Text as Bidlyze read it from the document. Layout, tables and images are shown in the original.
        </div>
      </div>
    </div>
  );
}
