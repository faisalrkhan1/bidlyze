// How Submission Check results are grouped, labelled, filtered and summarised
// in the beta UI and in the exported report. Pure functions (no React), so
// the UI and the export say exactly the same thing and both are unit-tested.
//
// Wording rules (agreed with Faisal):
//  - Never say a proposal is "compliant" or "fully compliant". The best result
//    is "OK", which means the automated check found supporting evidence.
//  - Every result needs human review; the UI and the report say so.

export const GROUPS = {
  attention: { key: "attention", label: "Needs attention", tone: "red", hint: "Partial, conflicting, missing or unconfirmed: fix or confirm before you submit." },
  manual: { key: "manual", label: "Check manually", tone: "blue", hint: "Things the proposal alone cannot settle: submission steps, documents not in the uploaded file, and optional, recommended or scored items that are not fully answered." },
  ok: { key: "ok", label: "OK", tone: "green", hint: "Supporting evidence was found in the proposal. Still review it." },
};
export const GROUP_ORDER = ["attention", "manual", "ok"];

export const STATUS = {
  conflict: { label: "Conflict", group: "attention", rank: 0, help: "The proposal states something that does not meet the requirement, or contradicts itself." },
  missing: { label: "Missing", group: "attention", rank: 1, help: "The proposal does not address this requirement." },
  partial: { label: "Partial", group: "attention", rank: 2, help: "Only part of the requirement is addressed." },
  unproven: { label: "Evidence not found", group: "attention", rank: 3, help: "The AI's supporting quote could not be found in the proposal, so this is not confirmed." },
  not_checked: { label: "Not checked", group: "attention", rank: 4, help: "This requirement could not be checked because of a processing error. Run the check again or review it yourself." },
  doc_unconfirmed: { label: "Not in uploaded file", group: "manual", rank: 5, help: "The tender asks for this document and it was not found in the file you uploaded. It may be a separate document: confirm it is in your submission pack. This is not a confirmed violation." },
  manual: { label: "Check manually", group: "manual", rank: 6, help: "A submission instruction or condition that a proposal document cannot show." },
  answered: { label: "Answered", group: "ok", rank: 7, help: "The proposal addresses this requirement; the quoted evidence was found on the cited page." },
};

export const QUOTE_CHECK = {
  verified: { label: "Found on this page", tone: "green" },
  relocated: { label: "Found (on a different page than the AI cited)", tone: "green" },
  approximate: { label: "Close match only", tone: "amber" },
  unverified: { label: "Not found in the document", tone: "red" },
  none: { label: "No tender quote in this analysis", tone: "gray" },
};

// Requirement types (lib/submission/obligations.js decides them from the tender's own words).
export const TYPES = {
  mandatory: { label: "Mandatory", help: "An obligation the bid must meet." },
  conditional: { label: "Conditional", help: "Applies only when its condition holds (for example \u201cwhere existing cameras are retained\u201d). Confirm whether it applies." },
  optional: { label: "Optional", help: "The tender invites a response but does not require one. Not answering it is not a compliance failure." },
  recommendation: { label: "Recommendation", help: "Advice from the buyer, such as a recommended site visit. It is not an obligation." },
  submission: { label: "Submission process", help: "How, when or where to submit, or how to behave during the tender. A proposal document cannot prove it: confirm it when you submit." },
  evaluation: { label: "Scored criterion", help: "Used to score the bid, not a pass/fail requirement. A weak answer may lose marks." },
};
export const TYPE_ORDER = ["mandatory", "conditional", "submission", "evaluation", "optional", "recommendation"];

export function typeOf(item) {
  return TYPES[item?.type] ? item.type : "mandatory";
}

/** The status shown to the user (separates processing errors from weak evidence). */
export function displayStatus(item) {
  if (item?.notChecked) return "not_checked";
  // A returnable document with no evidence in the uploaded file may simply be a separate file.
  if (item?.document && item.status === "missing") return "doc_unconfirmed";
  return STATUS[item?.status] ? item.status : "unproven";
}

const verifiedEvidence = (item) => (item?.evidence || []).some((e) => e.status && e.status !== "unverified");

/** Bidlyze's (automated) group, before any reviewer decision. */
export function groupOf(item) {
  const st = displayStatus(item);
  if (st === "not_checked") return "attention";
  const type = typeOf(item);
  // Submission steps are never "OK" from a proposal; a stated conflict (e.g. a late date) is still flagged.
  if (type === "submission") return st === "conflict" && verifiedEvidence(item) ? "attention" : "manual";
  // Optional, recommended and scored items are never compliance failures.
  if (type === "optional" || type === "recommendation" || type === "evaluation") return st === "answered" ? "ok" : "manual";
  return STATUS[st].group;
}

/** Reviewer override wins over the automated group, but is shown as an override. */
export function effectiveGroup(item, review) {
  if (review?.verdict === "ok") return "ok";
  if (review?.verdict === "attention") return "attention";
  return groupOf(item);
}

/** "p.9" for PDFs, "§3" for Word/text sections. */
export function locLabel(units, file, page) {
  if (page === null || page === undefined || page === "") return "";
  const unit = units?.[file] || "page";
  return unit === "page" ? `p.${page}` : unit === "sheet" ? `sheet ${page}` : `§${page}`;
}

/** Evidence on two or more different pages of a conflict = the proposal contradicts itself (or must be read together). */
export function contradiction(item) {
  if (displayStatus(item) !== "conflict") return null;
  const found = (item.evidence || []).filter((e) => e.status !== "unverified");
  const pages = [...new Set(found.map((e) => `${e.file}:${e.page}`))];
  return pages.length >= 2 ? found : null;
}

export function summarize(items, reviews = {}) {
  const byGroup = { attention: 0, manual: 0, ok: 0 };
  const byStatus = Object.fromEntries(Object.keys(STATUS).map((k) => [k, 0]));
  const byType = Object.fromEntries(Object.keys(TYPES).map((k) => [k, 0]));
  let reviewed = 0;
  let overridden = 0;
  for (const it of items || []) {
    const r = reviews[it.id];
    byGroup[effectiveGroup(it, r)] += 1;
    byStatus[displayStatus(it)] += 1;
    byType[typeOf(it)] += 1;
    if (r?.reviewed) reviewed += 1;
    if (r?.verdict && r.verdict !== "agree") overridden += 1;
  }
  const total = (items || []).length;
  return { total, byGroup, byStatus, byType, reviewed, overridden };
}

/** Headline sentence. Never claims compliance. */
export function headline(summary) {
  const { total, byGroup } = summary;
  if (!total) return "No requirements were checked.";
  if (byGroup.attention === 0 && byGroup.manual === 0) {
    return `No issues were flagged in ${total} requirements. This is not a confirmation of compliance: review each finding before you submit.`;
  }
  const parts = [];
  if (byGroup.attention) parts.push(`${byGroup.attention} need${byGroup.attention === 1 ? "s" : ""} attention`);
  if (byGroup.manual) parts.push(`${byGroup.manual} to check manually`);
  parts.push(`${byGroup.ok} OK`);
  return `Of ${total} requirements: ${parts.join(", ")}.`;
}

function haystack(item) {
  return [
    item.id,
    item.requirement,
    item.gap,
    item.tender?.quote,
    ...(item.evidence || []).map((e) => e.quote),
    ...(item.flags || []),
    STATUS[displayStatus(item)].label,
    TYPES[typeOf(item)].label,
    item.document?.name,
  ].join(" ").toLowerCase();
}

/**
 * @param {object[]} items
 * @param {{group?: string, status?: string, type?: string, query?: string, unreviewedOnly?: boolean}} f
 * @param {object} reviews  id -> {reviewed, verdict, note}
 */
export function filterItems(items, f = {}, reviews = {}) {
  const terms = String(f.query || "").toLowerCase().split(/\s+/).filter(Boolean);
  return (items || []).filter((it) => {
    const r = reviews[it.id];
    if (f.group && f.group !== "all" && effectiveGroup(it, r) !== f.group) return false;
    if (f.status && f.status !== "all" && displayStatus(it) !== f.status) return false;
    if (f.type && f.type !== "all" && typeOf(it) !== f.type) return false;
    if (f.unreviewedOnly && r?.reviewed) return false;
    if (terms.length) {
      const h = haystack(it);
      if (!terms.every((t) => h.includes(t))) return false;
    }
    return true;
  });
}

/** Needs attention first (most serious first), then check manually, then OK; stable by requirement order. */
export function sortItems(items, reviews = {}) {
  const order = new Map((items || []).map((it, i) => [it.id, i]));
  return [...(items || [])].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(effectiveGroup(a, reviews[a.id]));
    const gb = GROUP_ORDER.indexOf(effectiveGroup(b, reviews[b.id]));
    if (ga !== gb) return ga - gb;
    const ra = STATUS[displayStatus(a)].rank;
    const rb = STATUS[displayStatus(b)].rank;
    if (ra !== rb) return ra - rb;
    return order.get(a.id) - order.get(b.id);
  });
}
