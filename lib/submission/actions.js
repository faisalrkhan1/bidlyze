// Priority, recommended action and timestamps for Submission Check findings.
// Deterministic rules (no AI), shared by the screen and the Excel report.

import { displayStatus, groupOf, typeOf, contradiction, locLabel, TYPES } from "./review.js";

export const PRIORITY_ORDER = ["High", "Medium", "Low", "None"];

/**
 * Bidlyze's suggested priority for acting on a finding.
 *  High    mandatory/conditional item in conflict or missing; a required document
 *          not found in the uploaded file; anything that could not be checked
 *  Medium  partial or unconfirmed evidence; submission steps; scored criteria not fully answered
 *  Low     optional or recommended items that are not fully answered
 *  None    no issue flagged
 */
export function priorityOf(item) {
  const st = displayStatus(item);
  const type = typeOf(item);
  const group = groupOf(item);
  if (st === "not_checked") return "High";
  if (group === "ok") return "None";
  if (type === "optional" || type === "recommendation") return "Low";
  if (type === "submission" || type === "evaluation") return group === "attention" ? "High" : "Medium";
  if (st === "conflict" || st === "missing" || st === "doc_unconfirmed") return "High";
  return "Medium";
}

const clip = (s, n = 220) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t;
};

/** A short, specific next step for the bid team. */
export function recommendedAction(item, units = {}) {
  const st = displayStatus(item);
  const type = typeOf(item);
  // The AI's explanation is shown next to the action, so the action stays short and does not repeat it.
  const req = item.tender?.page ? `the requirement on tender ${locLabel({ F1: "page" }, "F1", item.tender.page)}` : "the requirement";
  if (st === "not_checked") return "Run the check again, or review this requirement against the proposal yourself.";
  if (type === "optional" && st !== "answered") return "Optional: decide whether to respond. Not answering is not a compliance failure.";
  if (type === "recommendation" && st !== "answered") return "Recommendation only: decide whether to follow it. Not a compliance failure.";
  if (type === "evaluation" && st !== "answered") return "Scored criterion: strengthen the answer to protect marks. Not a compliance failure.";
  if (type === "submission" && !(st === "conflict" && groupOf(item) === "attention")) {
    return `Confirm when you submit: ${clip(item.requirement, 160)}`;
  }
  if (st === "doc_unconfirmed") return `Confirm the ${item.document?.name || "document"} is in the submission pack. It was not found in the uploaded file${item.documentMention ? `; the proposal refers to it as a separate document (${locLabel(units, "R1", item.documentMention.page)})` : ""}.`;
  if (st === "conflict") {
    const c = contradiction(item);
    if (c) {
      const pages = [...new Set(c.map((e) => locLabel(units, e.file, e.page)))].join(" and ");
      return `Make the statements on ${pages} consistent with each other and with ${req}.`;
    }
    return `Change the proposal so it meets ${req}, or record an agreed deviation.`;
  }
  if (st === "missing") return `Add a response that meets ${req}.`;
  if (st === "partial") return `Complete the response so it fully meets ${req}.`;
  if (st === "unproven") return "Find and cite the supporting text: the AI's quote was not found in the proposal.";
  if (st === "manual") return `Confirm manually against ${req}: ${clip(item.requirement, 160)}`;
  if (type === "conditional") return "No issue flagged. Confirm the condition applies and check the quoted evidence.";
  return "No issue flagged. Check the quoted evidence.";
}

export function typeLabel(item) {
  return TYPES[typeOf(item)].label;
}

// ── Timestamps ───────────────────────────────────────────────────────────────

/** "22 Nov 2026, 10:14 (UTC+04:00, Asia/Dubai)". */
export function formatTimestamp(iso, timeZone) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  let tz = timeZone;
  try {
    tz = tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "longOffset" }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    let off = get("timeZoneName").replace("GMT", "UTC");
    if (off === "UTC") off = "UTC+00:00";
    return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} (${off}${tz !== "UTC" && tz !== "Etc/UTC" ? `, ${tz}` : ""})`;
  } catch {
    return `${d.toISOString().replace("T", " ").slice(0, 16)} (UTC)`;
  }
}

/** "2026-11-22 06:14 UTC" — unambiguous, for the report. */
export function formatUtc(iso) {
  const d = new Date(iso);
  return !iso || Number.isNaN(d.getTime()) ? "" : `${d.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
