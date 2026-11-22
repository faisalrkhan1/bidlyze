"use client";

// Results of a Submission Check: summary, human-review notice, filters,
// search, the findings list and the export.

import { useMemo, useState } from "react";
import { GROUPS, GROUP_ORDER, STATUS, TYPES, TYPE_ORDER, summarize, headline, filterItems, sortItems, locLabel } from "@/lib/submission/review";
import { buildReportWorkbook, reportFileName } from "@/lib/submission/report";
import { formatTimestamp } from "@/lib/submission/actions";
import FindingCard from "./FindingCard";
import { Card, Dot, GROUP_COLOR, Icon, Notice, PrimaryButton, ProcessingNote, SecondaryButton, Spinner } from "./ui";

const TILE_BG = { attention: "var(--st-attention-bg)", manual: "var(--st-manual-bg)", ok: "var(--st-ok-bg)" };
const TILE_BORDER = { attention: "var(--st-attention-border)", manual: "var(--st-manual-border)", ok: "var(--st-ok-border)" };

/** How many quotes Bidlyze matched word for word on the cited page (tender and proposal). */
function quoteStats(items) {
  let found = 0;
  let total = 0;
  for (const it of items) {
    for (const e of it.evidence || []) {
      total += 1;
      if (e.status === "verified" || e.status === "relocated") found += 1;
    }
    if (it.tender?.quote) {
      total += 1;
      if (it.tender.status === "verified" || it.tender.status === "relocated") found += 1;
    }
  }
  return { found, total };
}

const fmt = (iso) => formatTimestamp(iso);

const DOC_STATE = {
  described: { label: "Described in the proposal", color: "var(--st-ok)" },
  separate: { label: "Referred to as a separate document", color: "var(--st-manual)" },
  not_found: { label: "No mention found: confirm", color: "var(--st-manual)" },
  not_checked: { label: "Not checked", color: "var(--st-attention)" },
};

export default function ResultsView({ result, reviews, onReview, onView, onNewCheck, restored, saveFailed, demo }) {
  const [filters, setFilters] = useState({ group: "all", status: "all", type: "all", query: "", unreviewedOnly: false });
  const [showExcluded, setShowExcluded] = useState(false);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const items = useMemo(() => result.items || [], [result.items]);
  const summary = useMemo(() => summarize(items, reviews), [items, reviews]);
  const shown = useMemo(() => sortItems(filterItems(items, filters, reviews), reviews), [items, filters, reviews]);
  const units = { R1: result.response?.unit || "page", F1: "page" };
  const statusCounts = summary.byStatus;
  const qs = useMemo(() => quoteStats(items), [items]);
  const [exported, setExported] = useState(false);

  const setF = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = (id) =>
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const expandAll = () => setOpenIds(new Set(shown.map((i) => i.id)));
  const collapseAll = () => setOpenIds(new Set());

  async function exportReport() {
    setExporting(true);
    setExportError("");
    try {
      const mod = await import("exceljs");
      const ExcelJS = mod.default || mod;
      const wb = buildReportWorkbook(ExcelJS, result, reviews);
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = reportFileName(result);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExported(true);
    } catch (e) {
      console.error(e);
      setExportError("The report could not be created. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const prep = result.prep || {};
  const adjustments = [];
  if (prep.narrowed?.length) adjustments.push(...prep.narrowed.map((n) => `${n.id} was narrowed: “${n.moved.map((m) => m.clause).join("; ")}” is checked under ${n.moved.map((m) => m.to).join(", ")}, so it is not counted twice.`));
  if (prep.split?.length) adjustments.push(...prep.split.map((x) => `${x.id} was split into ${x.into.join(" and ")}: its tender wording has separate obligations.`));
  if (prep.merged?.length) adjustments.push(...prep.merged.map((m) => `${m.removed} duplicates ${m.kept} and was checked once.`));

  const warnings = [];
  if (result.meta?.failedBatches?.length) warnings.push("Some requirements could not be checked because of a processing error. They are listed as “Not checked”; run the check again or review them yourself.");
  if (result.meta?.skipped?.length) warnings.push(`The proposal is longer than the beta reads in one go; these parts were not read: ${result.meta.skipped.slice(0, 8).join(", ")}${result.meta.skipped.length > 8 ? "…" : ""}.`);
  if (result.response?.scannedPages?.length) warnings.push(`${result.response.scannedPages.length} page(s) of the proposal had no readable text (scanned images?) and could not be checked: ${result.response.scannedPages.slice(0, 12).join(", ")}${result.response.scannedPages.length > 12 ? "…" : ""}.`);
  if (result.truncated) warnings.push(`This tender has ${result.tender?.requirementsTotal} requirements; the beta checks the first ${items.length}.`);
  if (result.legacy) warnings.push("This tender was analysed before page-cited quotes were added, so tender quotes are not shown. Re-analyse the tender for two-sided evidence.");

  return (
    <div className="space-y-5" data-testid="results">
      {/* Human review notice: always visible */}
      <Notice tone="amber" icon="shield" title="Review required: a person must confirm every finding" data-testid="human-review-notice">
        Bidlyze checks that each quote appears word for word on the cited page. Whether a quote meets the requirement is an AI judgement and can be wrong. This report does not certify that the proposal is compliant.
      </Notice>

      {result.recorded && (
        <p className="text-[13px] px-4 py-2.5 rounded-lg flex items-center gap-2" style={{ background: "var(--accent-muted)", color: "var(--accent-text)" }} data-testid="recorded-notice">
          <Icon name="info" className="w-4 h-4 shrink-0" /> Sample result, recorded from a live check of the sample proposal on {fmt(result.recorded.checkedAt)}. No new AI run.
        </p>
      )}
      {restored && (
        <p className="text-[13px] px-4 py-2.5 rounded-lg flex items-center gap-2" style={{ background: "var(--st-neutral-bg)", color: "var(--text-secondary)" }} data-testid="restored-notice">
          <Icon name="clock" className="w-4 h-4 shrink-0" /> Restored from this browser. Results and review notes are saved only on this device until you start a new check.
        </p>
      )}
      {saveFailed && (
        <Notice tone="amber" icon="warning" data-testid="save-failed">
          This browser could not save the results (storage is full or blocked). They will be lost if you close the tab: export the report to keep your review.
        </Notice>
      )}

      {/* Summary */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] leading-snug font-semibold tracking-[-0.01em]" data-testid="headline">{headline(summary)}</h2>
            <p className="text-[13px] mt-1.5 flex flex-wrap gap-x-4 gap-y-1" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-flex items-center gap-1.5 min-w-0"><Icon name="clipboard" className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{result.response?.filename}</span> ({result.response?.pages} {result.response?.unit === "page" ? "pages" : "sections"})</span>
              <span className="inline-flex items-center gap-1.5"><Icon name="clock" className="w-3.5 h-3.5" />checked {fmt(result.checkedAt)}</span>
              {result.meta?.model && <span className="inline-flex items-center gap-1.5"><Icon name="info" className="w-3.5 h-3.5" />{result.meta.model.replace("anthropic/", "")}</span>}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <PrimaryButton onClick={exportReport} disabled={exporting} data-testid="export">
              {exporting ? <Spinner className="w-4 h-4" color="#fff" /> : <Icon name="download" />} Export report (.xlsx)
            </PrimaryButton>
            <SecondaryButton onClick={onNewCheck} data-testid="new-check"><Icon name="refresh" /> New check</SecondaryButton>
          </div>
        </div>
        {exportError && <Notice tone="red" icon="warning" className="mb-4">{exportError}</Notice>}
        {exported && !exportError && (
          <p className="text-[13px] mb-4 inline-flex items-center gap-1.5" style={{ color: "var(--st-ok)" }} data-testid="export-done">
            <Icon name="check" className="w-4 h-4" strokeWidth={2.4} /> Report exported. It includes your review decisions and notes.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {GROUP_ORDER.map((g) => {
            const active = filters.group === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setF({ group: active ? "all" : g, status: "all" })}
                aria-pressed={active}
                className="relative rounded-lg p-3 sm:p-4 text-left transition-colors overflow-hidden flex flex-col justify-start items-start"
                style={{ background: active ? TILE_BG[g] : "var(--bg-card)", border: `1px solid ${active ? TILE_BORDER[g] : "var(--border-primary)"}` }}
                data-testid={`tile-${g}`}
              >
                <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: GROUP_COLOR[g] }} aria-hidden="true" />
                <p className="text-[28px] leading-none font-semibold tabular" style={{ color: GROUP_COLOR[g] }}>{summary.byGroup[g]}</p>
                <p className="text-[14px] font-semibold mt-2">{GROUPS[g].label}</p>
                <p className="text-[12px] mt-1 hidden sm:block leading-snug" style={{ color: "var(--text-secondary)" }}>{GROUPS[g].hint}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 pt-4 text-[13px]" style={{ borderTop: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--st-ok)" }} data-testid="quote-verification" title="Matched word for word on the cited page by Bidlyze's code (not by AI)">
            <Icon name="check" className="w-4 h-4" strokeWidth={2.4} />
            <span><span className="font-semibold tabular">{qs.found}</span> of <span className="tabular">{qs.total}</span> quotes found word for word on the cited page</span>
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {["conflict", "missing", "partial", "unproven", "not_checked", "doc_unconfirmed", "manual", "answered"].filter((k) => statusCounts[k] > 0).map((k) => (
              <span key={k}><span className="font-semibold tabular" style={{ color: "var(--text-primary)" }}>{statusCounts[k]}</span> {STATUS[k].label.toLowerCase()}</span>
            ))}
          </span>
          <span className="ml-auto flex items-center gap-2" data-testid="reviewed-progress">
            <span className="tabular">{`Reviewed ${summary.reviewed} of ${summary.total}`}</span>
            <span className="w-24 h-1.5 rounded-full overflow-hidden inline-block" style={{ background: "var(--st-neutral-bg)" }}>
              <span className="block h-full transition-all" style={{ width: `${summary.total ? (summary.reviewed / summary.total) * 100 : 0}%`, background: "var(--accent)" }} />
            </span>
          </span>
        </div>
      </Card>

      {warnings.map((w, i) => (
        <Notice key={i} tone="amber" icon="warning" data-testid="warning">{w}</Notice>
      ))}

      {(result.documents?.length > 0 || result.excluded?.length > 0 || adjustments.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-3">
          {result.documents?.length > 0 && (
            <Card className="p-5" data-testid="documents">
              <p className="text-[15px] font-semibold">Documents the tender asks for</p>
              <p className="text-[13px] mt-1 mb-3" style={{ color: "var(--text-secondary)" }}>
                Bidlyze read only the file you uploaded. This shows what the proposal says about each document; confirm every document is in your submission pack.
              </p>
              <ul className="divide-y" style={{ borderColor: "var(--border-primary)" }}>
                {result.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]" style={{ borderColor: "var(--border-primary)" }} data-testid={`document-${d.id}`}>
                    <span className="font-medium min-w-[9rem]">{d.name}</span>
                    <span className="inline-flex items-center gap-1.5"><Dot color={DOC_STATE[d.state]?.color} />{DOC_STATE[d.state]?.label || d.state}</span>
                    <span className="ml-auto tabular" style={{ color: "var(--text-muted)" }}>
                      {[d.evidencePage ? locLabel(units, "R1", d.evidencePage) : "", d.mentionPage && d.mentionPage !== d.evidencePage ? `referred to on ${locLabel(units, "R1", d.mentionPage)}` : ""].filter(Boolean).join(", ")}
                      <span className="ml-2">{d.id}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(result.excluded?.length > 0 || adjustments.length > 0) && (
            <Card className="p-5" data-testid="excluded">
              <p className="text-[15px] font-semibold">How the requirement list was prepared</p>
              <ul className="text-[13px] mt-2 space-y-1.5 list-disc pl-5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {adjustments.map((a, i) => <li key={i}>{a}</li>)}
                {result.excluded?.length > 0 && (
                  <li>
                    {result.excluded.length} scoring or evaluation-guidance item{result.excluded.length === 1 ? " was" : "s were"} left out: a proposal cannot comply or fail to comply with them.{" "}
                    <button className="font-medium hover:underline underline-offset-2" style={{ color: "var(--accent-text)" }} onClick={() => setShowExcluded((v) => !v)} data-testid="toggle-excluded">{showExcluded ? "Hide" : "Show"}</button>
                  </li>
                )}
              </ul>
              {showExcluded && (
                <ul className="mt-3 space-y-2">
                  {result.excluded.map((e) => (
                    <li key={e.id} className="text-[13px] rounded-lg px-3 py-2" style={{ background: "var(--excerpt-bg)", border: "1px solid var(--border-primary)" }} data-testid={`excluded-${e.id}`}>
                      <span className="font-document text-[14px]">{e.tender?.quote ? `“${e.tender.quote}”` : e.requirement}</span>
                      <span className="block text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>{e.id}{e.tender?.page ? `, tender p.${e.tender.page}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Findings */}
      <section aria-label="Findings" className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:sticky lg:top-14 z-10 py-2 lg:backdrop-blur-md" style={{ background: "var(--bg-primary-translucent)" }}>
          <div className="flex gap-0.5 p-0.5 rounded-lg overflow-x-auto max-w-full shrink-0" style={{ background: "var(--st-neutral-bg)", border: "1px solid var(--border-primary)" }} role="tablist" aria-label="Review result">
            {["all", ...GROUP_ORDER].map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={filters.group === g}
                onClick={() => setF({ group: g, status: "all" })}
                className="h-8 px-3 rounded-md text-[13px] font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors"
                style={filters.group === g ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "0 1px 2px rgba(16,24,40,0.08)", border: "1px solid var(--border-primary)" } : { color: "var(--text-secondary)", border: "1px solid transparent" }}
                data-testid={`tab-${g}`}
              >
                {g !== "all" && <Dot color={GROUP_COLOR[g]} />}
                {g === "all" ? "All" : GROUPS[g].label}
                <span className="tabular" style={{ color: "var(--text-muted)" }}>{g === "all" ? summary.total : summary.byGroup[g]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 flex-1 min-w-0">
            <select
              value={filters.status}
              onChange={(e) => setF({ status: e.target.value })}
              className="h-9 text-[13px] pl-2.5 pr-7 rounded-lg focus:outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
              aria-label="Filter by classification"
              data-testid="status-filter"
            >
              <option value="all">All classifications</option>
              {Object.entries(STATUS).filter(([k]) => statusCounts[k] > 0).map(([k, s]) => <option key={k} value={k}>{s.label} ({statusCounts[k]})</option>)}
            </select>
            <select
              value={filters.type}
              onChange={(e) => setF({ type: e.target.value })}
              className="h-9 text-[13px] pl-2.5 pr-7 rounded-lg focus:outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
              aria-label="Filter by requirement type"
              data-testid="type-filter"
            >
              <option value="all">All types</option>
              {TYPE_ORDER.filter((k) => summary.byType[k] > 0).map((k) => <option key={k} value={k}>{TYPES[k].label} ({summary.byType[k]})</option>)}
            </select>
            <div className="relative flex-1 min-w-[12rem]">
              <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => setF({ query: e.target.value })}
                placeholder="Search findings and quotes"
                aria-label="Search findings and quotes"
                className="w-full h-9 text-[13px] pl-9 pr-3 rounded-lg focus:outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                data-testid="search"
              />
            </div>
            <label className="h-9 inline-flex items-center gap-2 text-[13px] whitespace-nowrap cursor-pointer px-1" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={filters.unreviewedOnly} onChange={(e) => setF({ unreviewedOnly: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" data-testid="unreviewed-only" />
              Not yet reviewed
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--text-secondary)" }}>
          <span data-testid="shown-count">Showing {shown.length} of {summary.total}</span>
          <span className="flex gap-4">
            <button className="hover:underline underline-offset-2" onClick={expandAll}>Expand all</button>
            <button className="hover:underline underline-offset-2" onClick={collapseAll}>Collapse all</button>
          </span>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }} data-testid="findings">
          {shown.map((it, i) => (
            <FindingCard
              key={it.id}
              item={it}
              review={reviews[it.id]}
              onReview={(patch) => onReview(it.id, patch)}
              open={openIds.has(it.id)}
              onToggle={() => toggle(it.id)}
              onView={onView}
              units={units}
              first={i === 0}
            />
          ))}
          {shown.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="text-[15px] font-semibold">No findings match these filters</p>
              <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Clear the search or choose another tab.</p>
            </div>
          )}
        </div>
      </section>

      <Card className="px-5 py-4">
        <ProcessingNote />
      </Card>

      {demo && (
        <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
          Sample data: the tender is Alton Town Council&apos;s public Invitation to Tender (fetched from the Council&apos;s website); the proposal is a fictional test document.
        </p>
      )}
    </div>
  );
}
