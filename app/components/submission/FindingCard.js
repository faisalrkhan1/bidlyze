"use client";

// One requirement's finding: the requirement and its tender quote, the
// proposal evidence (both sides of a contradiction when there is one), the
// AI's explanation, the code checks, and the reviewer's decision.

import { STATUS, GROUPS, displayStatus, groupOf, effectiveGroup, contradiction, locLabel } from "@/lib/submission/review";
import { Pill, StatusPill, GroupPill, Quote, Icon, GROUP_BAR } from "./ui";

const VERDICTS = [
  { value: "agree", label: "Agree with result" },
  { value: "ok", label: "Override: OK" },
  { value: "attention", label: "Override: needs attention" },
];

export default function FindingCard({ item, review = {}, onReview, open, onToggle, onView, units }) {
  const st = displayStatus(item);
  const autoGroup = groupOf(item);
  const group = effectiveGroup(item, review);
  const contra = contradiction(item);
  const evidence = item.evidence || [];
  const valueChecks = (item.checks || []).filter((c) => c.type !== "evidence");
  const pagesUsed = [...new Set(evidence.filter((e) => e.status !== "unverified").map((e) => locLabel(units, e.file, e.page)))];
  const tenderLoc = item.tender?.page ? `Tender p.${item.tender.page}` : item.sourceRef ? `Tender ${item.sourceRef}` : "";

  return (
    <article
      className="rounded-xl overflow-hidden transition-colors"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderLeft: `3px solid ${GROUP_BAR[group]}` }}
      data-testid={`finding-${item.id}`}
      data-group={group}
      data-status={st}
    >
      <button type="button" onClick={onToggle} className="w-full text-left px-4 py-3 flex items-start gap-3" aria-expanded={open}>
        <span className="text-[11px] font-mono pt-0.5 w-9 shrink-0" style={{ color: "var(--text-muted)" }}>{item.id}</span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm leading-snug ${open ? "" : "line-clamp-2"}`}>{item.requirement}</span>
          <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <StatusPill status={st} />
            {group !== autoGroup && <Pill tone="gray" title="A reviewer changed this result">Reviewer: {GROUPS[group].label}</Pill>}
            {contra && <Pill tone="red"><Icon name="arrows" className="w-3 h-3" /> Contradiction</Pill>}
            {item.mandatory === false && <Pill tone="gray">Optional</Pill>}
            {!open && item.gap && <span className="text-[12px] line-clamp-2 sm:line-clamp-1 basis-full sm:basis-auto sm:flex-1 min-w-0" style={{ color: "var(--text-muted)" }}>{item.gap}</span>}
          </span>
        </span>
        <span className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {tenderLoc && <span>{tenderLoc}</span>}
          {pagesUsed.length > 0 && <span>Proposal {pagesUsed.join(", ")}</span>}
        </span>
        {review.reviewed && (
          <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center" title="Reviewed">
            <Icon name="check" className="w-3 h-3" strokeWidth={2.5} />
          </span>
        )}
        <Icon name="chevron" className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <p className="text-xs pt-3" style={{ color: "var(--text-secondary)" }}>
            <GroupPill group={autoGroup} /> <span className="ml-1">{STATUS[st].help}</span>
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-violet-400">Tender requirement</p>
              {item.tender?.quote ? (
                <Quote
                  text={item.tender.quote}
                  location={item.tender.page ? `Tender p.${item.tender.page}` : "Tender"}
                  status={item.tender.status}
                  accent="#a78bfa"
                  onView={item.tender.page ? () => onView({ side: "tender", file: item.tender.file || "F1", fileName: item.tender.fileName, page: item.tender.page, quote: item.tender.quote, status: item.tender.status }) : undefined}
                  testId={`tender-quote-${item.id}`}
                />
              ) : (
                <div className="rounded-xl p-3 text-[13px]" style={{ background: "var(--bg-card)", border: "1px dashed var(--border-secondary)", color: "var(--text-secondary)" }}>
                  {item.requirement}
                  <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                    No verified tender quote for this requirement{item.sourceRef ? ` (source: ${item.sourceRef})` : ""}. Check the wording in the tender.
                  </p>
                </div>
              )}
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-emerald-500">
                {contra ? "Proposal: statements that need to be read together" : "Proposal evidence"}
              </p>
              {contra && (
                <p className="text-xs mb-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400" data-testid={`contradiction-${item.id}`}>
                  The proposal says different things in different places. Both statements are shown; decide which one is meant and fix the other.
                </p>
              )}
              {evidence.length === 0 ? (
                <div className="rounded-xl p-3 text-[13px]" style={{ background: "var(--bg-card)", border: "1px dashed var(--border-secondary)", color: "var(--text-muted)" }}>
                  {st === "manual"
                    ? "Nothing to quote: this is about how or when the bid is submitted."
                    : st === "not_checked"
                    ? "Not checked because of a processing error."
                    : "No supporting text was found in the proposal."}
                </div>
              ) : (
                <div className="space-y-2">
                  {evidence.map((e, i) => (
                    <Quote
                      key={i}
                      text={e.quote}
                      location={`${contra ? `Statement ${String.fromCharCode(65 + i)} · ` : ""}Proposal ${locLabel(units, e.file, e.page)}`}
                      status={e.status}
                      accent={contra ? "#f87171" : "#10b981"}
                      onView={e.status !== "unverified" ? () => onView({ side: "proposal", file: e.file, page: e.page, quote: e.quote, status: e.status }) : undefined}
                      testId={`evidence-${item.id}-${i}`}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {item.gap && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Why (AI explanation)</p>
              <p className="text-[13px] leading-relaxed">{item.gap}</p>
            </div>
          )}

          {(valueChecks.length > 0 || (item.flags || []).length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {valueChecks.length > 0 && (
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Checked by Bidlyze&apos;s code</p>
                  {valueChecks.map((c, i) => <p key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}><span className="capitalize font-medium">{c.type}</span>: {c.result}</p>)}
                </div>
              )}
              {(item.flags || []).length > 0 && (
                <div className="rounded-lg px-3 py-2 bg-amber-500/5" style={{ border: "1px solid rgba(245,158,11,0.2)" }}>
                  <p className="text-[11px] font-semibold mb-1 text-amber-500">Notes for the reviewer</p>
                  {item.flags.map((f, i) => <p key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>{f}</p>)}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-3" style={{ borderTop: "1px solid var(--border-primary)" }}>
            <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!review.reviewed}
                onChange={(e) => onReview({ reviewed: e.target.checked })}
                className="w-4 h-4 accent-emerald-500"
                data-testid={`reviewed-${item.id}`}
              />
              Reviewed
            </label>
            <select
              value={review.verdict || "agree"}
              onChange={(e) => onReview({ verdict: e.target.value, reviewed: true })}
              className="text-xs px-2 py-1.5 rounded-lg focus:outline-none"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
              aria-label="Reviewer decision"
              data-testid={`verdict-${item.id}`}
            >
              {VERDICTS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
            <input
              type="text"
              value={review.note || ""}
              onChange={(e) => onReview({ note: e.target.value })}
              placeholder="Reviewer note (included in the export)"
              className="flex-1 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
              data-testid={`note-${item.id}`}
            />
          </div>
        </div>
      )}
    </article>
  );
}
