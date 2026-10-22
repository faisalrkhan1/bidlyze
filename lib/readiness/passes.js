// The five focused AI passes behind a Tender Readiness Report.
//
// Passes 1–4 read the tender and run in parallel. Pass 5 (decision) only reads
// the verified results of 1–3, so it cannot invent facts that aren't cited.

import { DISQUALIFICATION_CHECKLIST } from "@/lib/disqualificationChecklist";

export const SYSTEM = `You are a senior GCC (UAE, KSA, Qatar, Oman, Kuwait, Bahrain) tender and bid-compliance analyst working for the BIDDER. You read tender packs for system integrators and contractors and tell them exactly what they must submit and what could get them disqualified.

STRICT EVIDENCE RULES:
1. Use ONLY the text inside <tender_documents>. Never use outside knowledge to state what the tender requires.
2. The documents are split into blocks headed by markers like [F1 P12] (file 1, page or section 12).
3. Every finding must include a "citation" object: {"quote": "...", "file": "F1", "page": 12}.
   - "quote" must be copied EXACTLY, word for word, from ONE block — 8 to 40 words. Do not paraphrase, fix typos, or join separate sentences.
   - "file" and "page" must be the marker of the block the quote was copied from.
4. If the documents do not state something, say "Not specified" and set "citation" to null. Never guess.
5. Documents may mix English and Arabic. Write your output in English; quotes stay in the original language.
6. Return ONLY one valid JSON object. No markdown, no commentary.`;

const CITATION = `{"quote": "exact words from the document", "file": "F1", "page": 12}`;

export const OVERVIEW_TASK = `TASK: Extract the tender's key facts.

Return JSON:
{
  "summary": {
    "projectName": "string",
    "issuingAuthority": "string",
    "tenderReference": "string",
    "estimatedValue": "string or 'Not specified'",
    "currency": "string or 'Not specified'",
    "submissionDeadline": "date/time as written, or 'Not specified'",
    "projectDuration": "string",
    "location": "string",
    "sector": "string",
    "briefDescription": "2-3 plain sentences: what the buyer wants delivered",
    "citation": ${CITATION}
  },
  "keyDates": [ { "event": "e.g. Clarification deadline / Site visit / Submission / Bid opening", "date": "as written", "citation": ${CITATION} } ],
  "submission": {
    "method": "portal / sealed envelopes / email / hand delivery — as written",
    "envelopes": "e.g. separate technical and commercial envelopes, or 'Not specified'",
    "copies": "number and format of copies, or 'Not specified'",
    "language": "string",
    "bidValidity": "string",
    "citation": ${CITATION}
  },
  "evaluationCriteria": [ { "criterion": "string", "weight": "as written or 'Not specified'", "details": "short", "citation": ${CITATION} } ],
  "financialRequirements": {
    "bidBond": { "text": "amount/percentage/form, or 'Not specified'", "citation": ${CITATION} },
    "performanceBond": { "text": "string", "citation": ${CITATION} },
    "minimumTurnover": { "text": "string", "citation": ${CITATION} },
    "paymentTerms": { "text": "string", "citation": ${CITATION} },
    "penalties": { "text": "liquidated damages / penalties, or 'Not specified'", "citation": ${CITATION} }
  }
}`;

export const REQUIREMENTS_TASK = `TASK: Build the compliance matrix — every requirement the bidder must meet or respond to.

Include: every "shall", "must", "is required", "mandatory", "the bidder shall submit", technical specification lines, deliverables, staffing/CV requirements, certifications, warranty/SLA terms, and submission documents.
Merge exact duplicates. Keep each requirement as one testable statement. Order them as they appear. Up to 150 items.

Return JSON:
{
  "requirements": [
    {
      "category": "Technical | Commercial | Legal | Administrative | Documentation | Submission | Staffing | Warranty & Support",
      "requirement": "short, plain-English statement of what the bidder must do or provide",
      "mandatory": true,
      "priority": "HIGH | MEDIUM | LOW",
      "responseNeeded": "what the bidder should prepare to prove compliance (document, statement, datasheet, CV...)",
      "citation": ${CITATION}
    }
  ]
}

priority: HIGH = mandatory and could cause rejection or heavy scoring loss; MEDIUM = mandatory but routine; LOW = desirable/optional.`;

export function disqualificationTask() {
  const checklist = DISQUALIFICATION_CHECKLIST
    .map((c) => `- ${c.id} (${c.severity}) — ${c.label}: ${c.description}`)
    .join("\n");
  return `TASK: Find everything that could get this bid DISQUALIFIED at the eligibility / pass-fail stage, before price is even looked at.

PART A — For EACH checklist item below, decide:
  "required"      the tender requires it (cite it)
  "not_required"  the tender explicitly says it is not needed (cite it)
  "not_specified" the tender is silent (citation null)

CHECKLIST:
${checklist}

PART B — Other disqualification-grade conditions not covered above (e.g. specific forms that must be used unchanged, minimum years of experience, minimum number of similar projects, key-staff qualifications, country-of-origin rules, joint-venture rules, late-submission rules, alternative-offer bans). Up to 15.

Return JSON:
{
  "fixed_checks": [ { "id": "checklist id", "status": "required | not_required | not_specified", "details": "what exactly is required (amount, form, validity, issuer)", "citation": ${CITATION} or null } ],
  "dynamic_findings": [ { "title": "short title", "severity": "critical | high | medium", "details": "what is required and why missing it is fatal", "citation": ${CITATION} } ],
  "summary": "2-3 sentences: the biggest disqualification risks for this bid"
}
fixed_checks must contain exactly one entry per checklist id, in order.`;
}

export const CLARIFICATIONS_TASK = `TASK: Draft clarification questions the bidder should send to the buyer before the clarification deadline.

Look for: contradictions between sections or files, missing quantities or specs, unclear scope boundaries, unrealistic timelines, ambiguous evaluation method, brand names without "or equivalent", missing drawings/BOQ items, unclear payment or penalty terms, and requirements that conflict with UAE/GCC practice.
Only raise genuine issues found in the text. Up to 15, most important first.

Return JSON:
{
  "clarifications": [
    {
      "question": "the question exactly as the bidder would submit it — polite, specific, references the clause",
      "reason": "why it matters to the bidder (risk, cost, compliance)",
      "priority": "HIGH | MEDIUM | LOW",
      "citation": ${CITATION}
    }
  ]
}`;

export const DECISION_SYSTEM = `You are a senior GCC bid manager giving a bid/no-bid recommendation. You only have the verified findings below — do not assume anything else about the tender. You do NOT know the bidder's company, so frame readiness as "what must be true for this bid to be compliant", not as a judgement of the bidder. Return ONLY valid JSON.`;

export function decisionTask(findings) {
  return `VERIFIED FINDINGS (JSON):
${JSON.stringify(findings)}

Return JSON:
{
  "recommendation": "BID | CONDITIONAL BID | NO-BID",
  "score": 0-100 (attractiveness and feasibility of bidding, given the findings),
  "reasoning": "3-5 sentences in plain English",
  "conditions": ["things that must be true to bid, e.g. 'Valid ICV certificate in hand', 'OEM MAF obtainable before <date>'"],
  "topActions": [ { "action": "specific action", "deadline": "relative to the key dates", "owner": "Presales | Commercial | Legal | Management" } ],
  "showstoppers": ["only items that would make the bid impossible or pointless; empty array if none"]
}
Use CONDITIONAL BID when the tender is worth pursuing but has hard prerequisites (certificates, registrations, OEM letters, site visits) the bidder must confirm.`;
}
