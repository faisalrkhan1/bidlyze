"use client";

// One requirement's finding: the requirement and its tender quote, the
// proposal evidence (both sides of a contradiction when there is one), the
// AI's explanation, the code checks, and the reviewer's decision.

import { STATUS, GROUPS, TYPES, displayStatus, groupOf, effectiveGroup, contradiction, locLabel, typeOf } from "@/lib/submission/review";
import { recommendedAction, priorityOf } from "@/lib/submission/actions";
import { Notice, Pill, StatusPill, GroupPill, TypePill, Quote, Icon, GROUP_BAR } from "./ui";

function SectionLabel({ children, className = "" }) {
  return <p className={`text-[13px] font-semibold mb-2 ${className}`} style={{ color: "var(--text-secondary)" }}>{children}</p>;
}

const VERDICTS = [
  { value: "agree", label: "Agree with result" },
  { value: "ok", label: "Override: OK" },
  { value: "attention", label: "Override: needs attention" },
];

export default function FindingCard({ item, review = {}, onReview, open, onToggle, onView, units, first = false }) {
  const st = displayStatus(item);
  const autoGroup = groupOf(item);
  const group = effectiveGroup(item, review);
  const contra = contradiction(item);
  const evidence = item.evidence || [];
  const valueChecks = (item.checks || []).filter((c) => c.type !== "evidence");
  const pagesUsed = [...new Set(evidence.filter((e) => e.status !== "unverified").map((e) => locLabel(units, e.file, e.page)))];
  const tenderLoc = item.tender?.page ? `Tender p.${item.tender.page}` : item.sourceRef ? `Tender ${item.sourceRef}` : "";
  const type = typeOf(item);
  const notObligation = ["optional", "recommendation", "evaluation", "submission"].includes(type) && autoGroup !== "attention";
  const priority = priorityOf(item);
  const notes = [];
  // The type's explanation is already the headline help for optional/recommended/scored items that are not answered.
  if (type !== "mandatory" && !(notObligation && st !== "answered")) notes.push(`${TYPES[type].label}: ${item.typeReason || TYPES[type].help}`);
  if (item.splitFrom) notes.push(`Split from ${item.splitFrom.id}: the tender sentence for ${item.splitFrom.id} contains separate obligations, so each is checked on its own.`);
  if (item.narrowed?.length) notes.push(...item.narrowed.map((n) => `The part “${n.part}” is checked under ${n.checkedUnder}, so the same obligation is not counted twice.`));
  if (item.duplicates?.length) notes.push(`Also listed in the analysis as ${item.duplicates.join(", ")} (same tender wording): checked once.`);
  if (item.document) {
    notes.push(
      item.documentMention
        ? `Required document: ${item.document.name}. The proposal refers to it (${locLabel(units, "R1", item.documentMention.page)}: “${item.documentMention.text}”). If it is a separate file, Bidlyze did not see it: confirm it is in your submission pack.`
        : `Required document: ${item.document.name}.${st === "doc_unconfirmed" ? " No mention found in the uploaded file; it may be a separate document. Confirm it is in your submission pack." : " Confirm the document itself is in your submission pack."}`
    );
  }

  return (
    <article
      className="relative transition-colors"
      style={{ borderTop: first ? "none" : "1px solid var(--border-primary)", background: open ? "var(--bg-card-hover)" : "transparent" }}
      data-testid={`finding-${item.id}`}
      data-group={group}
      data-status={st}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: GROUP_BAR[group] }} aria-hidden="true" />
      <button type="button" onClick={onToggle} className="w-full text-left pl-5 pr-4 py-3.5 flex items-start gap-3 hover:bg-[var(--bg-card-hover)] transition-colors" aria-expanded={open}>
        <span className="text-[12px] font-medium pt-0.5 w-11 shrink-0 tabular" style={{ color: "var(--text-muted)" }}>{item.id}</span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[14px] leading-snug ${open ? "font-medium" : "line-clamp-2"}`}>{item.requirement}</span>
          <span className="flex flex-wrap items-center gap-1.5 mt-2">
            <StatusPill status={st} group={autoGroup} muted={notObligation} />
            {type !== "mandatory" && <TypePill type={type} />}
            {item.document && <Pill tone="outline" title="A document the tender asks you to hand in"><Icon name="doc" className="w-3 h-3" /> {item.document.name}</Pill>}
            {group !== autoGroup && <Pill tone="blue" title="A reviewer changed this result"><Icon name="user" className="w-3 h-3" /> Reviewer: {GROUPS[group].label}</Pill>}
            {contra && <Pill tone="red"><Icon name="arrows" className="w-3 h-3" /> Contradiction</Pill>}
            {!open && item.gap && <span className="text-[13px] line-clamp-2 sm:line-clamp-1 basis-full sm:basis-auto sm:flex-1 min-w-0 sm:ml-1" style={{ color: "var(--text-secondary)" }}>{item.gap}</span>}
          </span>
        </span>
        <span className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-[12px] tabular" style={{ color: "var(--text-muted)" }}>
          {tenderLoc && <span>{tenderLoc}</span>}
          {pagesUsed.length > 0 && <span>Proposal {pagesUsed.join(", ")}</span>}
        </span>
        {review.reviewed && (
          <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full flex items-center justify-center" style={{ background: "var(--accent-muted)", color: "var(--accent-text)" }} title="Reviewed">
            <Icon name="check" className="w-3 h-3" strokeWidth={2.6} />
          </span>
        )}
        <Icon name="chevron" className={`w-4 h-4 shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="pl-5 pr-4 pb-5 sm:pl-[4.75rem] space-y-5">
          <div className="flex flex-wrap items-start gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            <GroupPill group={autoGroup} />
            <span className="flex-1 min-w-[14rem] pt-0.5">{notObligation && st !== "answered" ? TYPES[type].help : STATUS[st].help}</span>
          </div>

          {notes.length > 0 && (
            <ul className="text-[13px] space-y-1 px-3 py-2.5 rounded-lg leading-relaxed" style={{ background: "var(--st-neutral-bg)", color: "var(--text-secondary)" }} data-testid={`notes-${item.id}`}>
              {notes.map((n, i) => <li key={i} className="flex gap-2"><Icon name="info" className="w-4 h-4 shrink-0 mt-0.5" /><span>{n}</span></li>)}
            </ul>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <section>
              <SectionLabel>Tender requirement</SectionLabel>
              {item.tender?.quote ? (
                <Quote
                  text={item.tender.quote}
                  location={item.tender.page ? `Tender p.${item.tender.page}` : "Tender"}
                  status={item.tender.status}
                  accent="var(--border-hover)"
                  onView={item.tender.page ? () => onView({ side: "tender", file: item.tender.file || "F1", fileName: item.tender.fileName, page: item.tender.page, quote: item.tender.quote, status: item.tender.status }) : undefined}
                  testId={`tender-quote-${item.id}`}
                />
              ) : (
                <div className="rounded-lg p-3 text-[14px]" style={{ border: "1px dashed var(--border-secondary)", color: "var(--text-secondary)" }}>
                  {item.requirement}
                  <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
                    No verified tender quote for this requirement{item.sourceRef ? ` (source: ${item.sourceRef})` : ""}. Check the wording in the tender.
                  </p>
                </div>
              )}
            </section>

            <section>
              <SectionLabel>{contra ? "Proposal: statements to read together" : "Proposal evidence"}</SectionLabel>
              {contra && (
                <Notice tone="red" icon="arrows" className="mb-2 !py-2" data-testid={`contradiction-${item.id}`}>
                  The proposal says different things in different places. Both statements are shown; decide which one is meant and fix the other.
                </Notice>
              )}
              {evidence.length === 0 ? (
                <div className="rounded-lg p-3 text-[14px]" style={{ border: "1px dashed var(--border-secondary)", color: "var(--text-secondary)" }}>
                  {st === "doc_unconfirmed"
                    ? "Not found in the uploaded file. If it is a separate document, confirm it is in your submission pack."
                    : st === "manual" || type === "submission"
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
                      location={`${contra ? `Statement ${String.fromCharCode(65 + i)}, ` : ""}Proposal ${locLabel(units, e.file, e.page)}`}
                      status={e.status}
                      accent={contra ? "var(--st-attention)" : "var(--accent)"}
                      onView={e.status !== "unverified" ? () => onView({ side: "proposal", file: e.file, page: e.page, quote: e.quote, status: e.status }) : undefined}
                      testId={`evidence-${item.id}-${i}`}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {item.gap ? (
              <div>
                <SectionLabel className="!mb-1">Why (AI explanation)</SectionLabel>
                <p className="text-[14px] leading-relaxed">{item.gap}</p>
              </div>
            ) : <div className="hidden sm:block" />}
            <div data-testid={`action-${item.id}`}>
              <SectionLabel className="!mb-1">Suggested action{priority !== "None" ? `, ${priority.toLowerCase()} priority` : ""}</SectionLabel>
              <p className="text-[14px] leading-relaxed">{recommendedAction(item, units)}</p>
            </div>
          </div>

          {(valueChecks.length > 0 || (item.flags || []).length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {valueChecks.length > 0 && (
                <div className="rounded-lg px-3 py-2.5" style={{ border: "1px solid var(--border-primary)" }}>
                  <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Checked by Bidlyze&apos;s code</p>
                  {valueChecks.map((c, i) => <p key={i} className="text-[13px] tabular" style={{ color: "var(--text-secondary)" }}><span className="capitalize font-medium">{c.type}</span>: {c.result}</p>)}
                </div>
              )}
              {(item.flags || []).length > 0 && (
                <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--st-manual-bg)", border: "1px solid var(--st-manual-border)" }}>
                  <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--st-manual)" }}>Notes for the reviewer</p>
                  {item.flags.map((f, i) => <p key={i} className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{f}</p>)}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
            <span className="text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0" style={{ color: "var(--text-secondary)" }}><Icon name="user" className="w-4 h-4" /> Your review</span>
            <label className="inline-flex items-center gap-2 text-[13px] font-medium cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={!!review.reviewed}
                onChange={(e) => onReview({ reviewed: e.target.checked })}
                className="w-4 h-4 accent-[var(--accent)]"
                data-testid={`reviewed-${item.id}`}
              />
              Reviewed
            </label>
            <select
              value={review.verdict || "agree"}
              onChange={(e) => onReview({ verdict: e.target.value, reviewed: true })}
              className="h-9 text-[13px] px-2 rounded-lg focus:outline-none shrink-0"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
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
              aria-label="Reviewer note"
              className="flex-1 h-9 text-[13px] px-3 rounded-lg focus:outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
              data-testid={`note-${item.id}`}
            />
          </div>
        </div>
      )}
    </article>
  );
}
