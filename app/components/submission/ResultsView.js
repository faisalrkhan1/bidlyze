"use client";

// Results of a Submission Check: summary, human-review notice, filters,
// search, the findings list and the export.

import { useMemo, useState } from "react";
import { GROUPS, GROUP_ORDER, STATUS, TYPES, TYPE_ORDER, summarize, headline, filterItems, sortItems, locLabel } from "@/lib/submission/review";
import { buildReportWorkbook, reportFileName } from "@/lib/submission/report";
import { formatTimestamp } from "@/lib/submission/actions";
import FindingCard from "./FindingCard";
import { Card, Icon, Pill, PrimaryButton, SecondaryButton, Spinner, ProcessingNote } from "./ui";

const TILE = {
  attention: { ring: "rgba(239,68,68,0.35)", num: "text-red-500", bg: "rgba(239,68,68,0.06)" },
  manual: { ring: "rgba(14,165,233,0.35)", num: "text-sky-500", bg: "rgba(14,165,233,0.06)" },
  ok: { ring: "rgba(16,185,129,0.35)", num: "text-emerald-500", bg: "rgba(16,185,129,0.06)" },
};

const fmt = (iso) => formatTimestamp(iso);

const DOC_STATE = {
  described: { label: "Described in the proposal", tone: "green" },
  separate: { label: "Referred to as a separate document", tone: "blue" },
  not_found: { label: "No mention found: confirm", tone: "blue" },
  not_checked: { label: "Not checked", tone: "gray" },
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
      {/* Human review notice — always visible */}
      <div className="px-5 py-3 rounded-xl flex items-start gap-3" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)" }} data-testid="human-review-notice">
        <Icon name="shield" className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
        <div>
          <p className="text-sm font-semibold mb-0.5 text-amber-500">Automated review: a person must confirm every finding</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Bidlyze checks quotes word for word against both documents, but whether a quote meets a requirement is an AI judgement and can be wrong.
            This report does not certify that the proposal is compliant.
          </p>
        </div>
      </div>

      {result.recorded && (
        <p className="text-xs px-4 py-2 rounded-lg bg-sky-500/10 text-sky-500" data-testid="recorded-notice">
          Sample result: recorded from a live check of the sample proposal on {fmt(result.recorded.checkedAt)} (same engine, no new AI run).
        </p>
      )}
      {restored && (
        <p className="text-xs px-4 py-2 rounded-lg" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }} data-testid="restored-notice">
          Restored from this browser. Results and review notes are saved only on this device until you start a new check.
        </p>
      )}
      {saveFailed && (
        <p className="text-xs px-4 py-2 rounded-lg bg-amber-500/10 text-amber-500" data-testid="save-failed">
          This browser could not save the results (storage is full or blocked). They will be lost if you close the tab: export the report to keep your review.
        </p>
      )}

      {/* Summary */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold" data-testid="headline">{headline(summary)}</h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {result.response?.filename} ({result.response?.pages} {result.response?.unit === "page" ? "pages" : "sections"}) checked {fmt(result.checkedAt)}
              {result.meta?.model ? ` · ${result.meta.model.replace("anthropic/", "")}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <PrimaryButton onClick={exportReport} disabled={exporting} data-testid="export">
              {exporting ? <Spinner className="w-4 h-4 text-white" /> : <Icon name="download" />} Export report (.xlsx)
            </PrimaryButton>
            <SecondaryButton onClick={onNewCheck} data-testid="new-check"><Icon name="refresh" /> New check</SecondaryButton>
          </div>
        </div>
        {exportError && <p className="text-xs text-red-400 mb-3">{exportError}</p>}

        <div className="grid grid-cols-3 gap-3">
          {GROUP_ORDER.map((g) => {
            const active = filters.group === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setF({ group: active ? "all" : g, status: "all" })}
                className="rounded-xl p-4 text-left transition-all"
                style={{ background: TILE[g].bg, border: `1px solid ${active ? TILE[g].ring : "var(--border-primary)"}`, boxShadow: active ? `0 0 0 2px ${TILE[g].ring}` : "none" }}
                data-testid={`tile-${g}`}
              >
                <p className={`text-3xl font-bold ${TILE[g].num}`}>{summary.byGroup[g]}</p>
                <p className="text-sm font-semibold mt-0.5">{GROUPS[g].label}</p>
                <p className="text-[11px] mt-1 hidden sm:block" style={{ color: "var(--text-muted)" }}>{GROUPS[g].hint}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-xs" style={{ color: "var(--text-secondary)" }}>
          {["conflict", "missing", "partial", "unproven", "not_checked", "doc_unconfirmed", "manual", "answered"].filter((k) => statusCounts[k] > 0).map((k) => (
            <span key={k}><span className="font-semibold">{statusCounts[k]}</span> {STATUS[k].label.toLowerCase()}</span>
          ))}
          <span className="ml-auto flex items-center gap-2" data-testid="reviewed-progress">
            Reviewed {summary.reviewed} of {summary.total}
            <span className="w-24 h-1.5 rounded-full overflow-hidden inline-block" style={{ background: "var(--border-primary)" }}>
              <span className="block h-full bg-emerald-500 transition-all" style={{ width: `${summary.total ? (summary.reviewed / summary.total) * 100 : 0}%` }} />
            </span>
          </span>
        </div>
      </Card>

      {(result.documents?.length > 0 || result.excluded?.length > 0 || adjustments.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-3">
          {result.documents?.length > 0 && (
            <Card className="p-4" data-testid="documents">
              <p className="text-sm font-semibold mb-1">Documents the tender asks for</p>
              <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
                Bidlyze read only the file you uploaded. It shows what the proposal says about each document; confirm every document is actually in your submission pack.
              </p>
              <ul className="space-y-1.5">
                {result.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 text-xs" data-testid={`document-${d.id}`}>
                    <span className="font-medium">{d.name}</span>
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{d.id}</span>
                    <Pill tone={DOC_STATE[d.state]?.tone}>{DOC_STATE[d.state]?.label || d.state}</Pill>
                    <span style={{ color: "var(--text-muted)" }}>
                      {[d.evidencePage ? locLabel(units, "R1", d.evidencePage) : "", d.mentionPage && d.mentionPage !== d.evidencePage ? `referred to on ${locLabel(units, "R1", d.mentionPage)}` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(result.excluded?.length > 0 || adjustments.length > 0) && (
            <Card className="p-4" data-testid="excluded">
              <p className="text-sm font-semibold mb-1">How the requirement list was prepared</p>
              <ul className="text-xs space-y-1 list-disc pl-4" style={{ color: "var(--text-secondary)" }}>
                {adjustments.map((a, i) => <li key={i}>{a}</li>)}
                {result.excluded?.length > 0 && (
                  <li>
                    {result.excluded.length} scoring or evaluation-guidance item{result.excluded.length === 1 ? " was" : "s were"} left out: a proposal cannot comply or fail to comply with them.{" "}
                    <button className="font-semibold hover:underline" onClick={() => setShowExcluded((v) => !v)} data-testid="toggle-excluded">{showExcluded ? "Hide" : "Show"}</button>
                  </li>
                )}
              </ul>
              {showExcluded && (
                <ul className="mt-2 space-y-2">
                  {result.excluded.map((e) => (
                    <li key={e.id} className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }} data-testid={`excluded-${e.id}`}>
                      <span className="font-mono text-[10px] mr-1.5" style={{ color: "var(--text-muted)" }}>{e.id}</span>
                      {e.tender?.quote ? `“${e.tender.quote}”` : e.requirement}
                      {e.tender?.page ? <span style={{ color: "var(--text-muted)" }}> · tender p.{e.tender.page}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      {warnings.map((w, i) => (
        <p key={i} className="text-xs px-4 py-2.5 rounded-lg bg-amber-500/10 text-amber-500 flex gap-2" data-testid="warning"><Icon name="warning" className="w-4 h-4 shrink-0" /> {w}</p>
      ))}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:sticky md:top-14 z-10 py-2 md:backdrop-blur-md" style={{ background: "var(--bg-primary-translucent)" }}>
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto max-w-full shrink-0" style={{ background: "var(--bg-input)" }} role="tablist">
          {["all", ...GROUP_ORDER].map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={filters.group === g}
              onClick={() => setF({ group: g, status: "all" })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${filters.group === g ? "shadow-sm" : ""}`}
              style={filters.group === g ? { background: "var(--bg-card)", color: "var(--text-primary)" } : { color: "var(--text-secondary)" }}
              data-testid={`tab-${g}`}
            >
              {g === "all" ? `All ${summary.total}` : `${GROUPS[g].label} ${summary.byGroup[g]}`}
            </button>
          ))}
        </div>
        <select
          value={filters.status}
          onChange={(e) => setF({ status: e.target.value })}
          className="text-xs px-2.5 py-2 rounded-lg focus:outline-none"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
          aria-label="Filter by classification"
          data-testid="status-filter"
        >
          <option value="all">All classifications</option>
          {Object.entries(STATUS).filter(([k]) => statusCounts[k] > 0).map(([k, s]) => <option key={k} value={k}>{s.label} ({statusCounts[k]})</option>)}
        </select>
        <select
          value={filters.type}
          onChange={(e) => setF({ type: e.target.value })}
          className="text-xs px-2.5 py-2 rounded-lg focus:outline-none"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
          aria-label="Filter by requirement type"
          data-testid="type-filter"
        >
          <option value="all">All types</option>
          {TYPE_ORDER.filter((k) => summary.byType[k] > 0).map((k) => <option key={k} value={k}>{TYPES[k].label} ({summary.byType[k]})</option>)}
        </select>
        <div className="relative flex-1">
          <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => setF({ query: e.target.value })}
            placeholder="Search findings and quotes"
            className="w-full text-sm pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
            data-testid="search"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={filters.unreviewedOnly} onChange={(e) => setF({ unreviewedOnly: e.target.checked })} className="accent-emerald-500" data-testid="unreviewed-only" />
          Not yet reviewed
        </label>
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span data-testid="shown-count">Showing {shown.length} of {summary.total}</span>
        <span className="flex gap-3">
          <button className="hover:underline" onClick={expandAll}>Expand all</button>
          <button className="hover:underline" onClick={collapseAll}>Collapse all</button>
        </span>
      </div>

      <div className="space-y-2" data-testid="findings">
        {shown.map((it) => (
          <FindingCard
            key={it.id}
            item={it}
            review={reviews[it.id]}
            onReview={(patch) => onReview(it.id, patch)}
            open={openIds.has(it.id)}
            onToggle={() => toggle(it.id)}
            onView={onView}
            units={units}
          />
        ))}
        {shown.length === 0 && (
          <Card className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No requirements match these filters.</Card>
        )}
      </div>

      <Card className="px-4 py-3">
        <ProcessingNote />
      </Card>

      {demo && (
        <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
          Sample data: the tender is Alton Town Council&apos;s public Invitation to Tender (fetched from the Council&apos;s website); the proposal is a fictional test document.
        </p>
      )}
    </div>
  );
}

