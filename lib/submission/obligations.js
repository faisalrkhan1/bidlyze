// Prepares a tender's requirement list for Submission Check, at check time.
//
//  1. Types each requirement from the tender's own words (the code-verified
//     tender quote; the requirement text only when there is no quote):
//       mandatory · conditional · optional · recommendation · submission
//       (process) · evaluation (scored criterion or scoring guidance)
//  2. Removes double counting: a clause of one requirement that is really
//     another requirement's obligation is moved out (R6/R7 in the Alton
//     tender), and exact duplicates are merged.
//  3. Splits a requirement whose tender quote contains two separate
//     obligations ("Testing shall include … Testing shall be carried out to ISO
//     standards.") into one item per obligation, using the tender's sentences.
//  4. Leaves out scoring guidance ("to achieve the highest scores …"): a
//     proposal cannot comply or fail to comply with it.
//  5. Marks returnable documents (price schedule, certificates, references …)
//     so a document that is not in the uploaded file is shown as "confirm",
//     not as a proven violation.
//
// Deterministic and offline: no AI, nothing written back to the saved
// analysis, so it works for every saved analysis (old and new formats).

export const TYPE_KEYS = ["mandatory", "conditional", "optional", "recommendation", "submission", "evaluation"];

// ── Text helpers ─────────────────────────────────────────────────────────────

const STOP = new Set(
  "a an the and or of for to in on at by with from as is are be been being this that these those it its their there which who whom whose any all each every such than then so if when where while into onto per via our your we you they he she not no nor shall must will should may can could would also only very more most other others same own etc".split(" ")
);

export function stem(w) {
  let s = String(w).toLowerCase().replace(/[^a-z0-9£$%]/g, "");
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ied")) s = s.slice(0, -3) + "y";
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("es") && !s.endsWith("ses")) s = s.slice(0, -1);
  if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  if (s.length > 4 && s.endsWith("e")) s = s.slice(0, -1);
  return s;
}

export function contentStems(text) {
  return new Set(
    String(text || "")
      .split(/[^A-Za-z0-9£$%']+/)
      .map((w) => w.replace(/'/g, ""))
      .filter((w) => w && !STOP.has(w.toLowerCase()))
      .map(stem)
      .filter((s) => s.length > 1)
  );
}

/** Share of `a`'s content words that also appear in `b` (0..1). */
export function coverage(a, b) {
  const sa = a instanceof Set ? a : contentStems(a);
  const sb = b instanceof Set ? b : contentStems(b);
  if (!sa.size) return 0;
  let n = 0;
  for (const w of sa) if (sb.has(w)) n += 1;
  return n / sa.size;
}

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

// ── 1. Requirement type ──────────────────────────────────────────────────────

const STRONG = /\b(shall|must|is required|are required|mandatory|compulsory|obligatory)\b/i;

const EVAL_GUIDANCE = /\b(will be (judged|evaluated|scored|assessed|marked|ranked)|evaluation (criteria|procedure|process|methodology)|scoring (guidelines?|criteria|system|matrix|scheme)|highest (possible )?scores?|maximum (score|marks)|marking (system|scheme)|weighting|weighted (at|score)|award criteria|scores? (of|out of|between) \d)/i;
const EVAL_CRITERION = /(:\s*\d{1,3}\s?%|\b\d{1,3}\s?%\s*:|\b(general|commercial|technical|financial) suitability\b|\(scored\b|\bscored (under|as part of|against|in)\b|\b(evaluated|assessed|marked) (under|as part of|against)\b|\bevaluation criteri(on|a)\b|\bscoring criteri(on|a)\b)/i;

const OPTIONAL = /\b(optional(ly)?|outside (of )?the scope|not (part of|within) the scope|invited to (comment|propose|suggest|submit|offer|provide)|may (optionally|also) (offer|propose|submit|provide|include|quote|suggest)|at (the )?(bidder|tenderer|supplier|contractor|applicant)'?s? (own )?(discretion|option)|if (the )?(bidders?|tenderers?|suppliers?|contractors?|applicants?) (so )?(wish|wishes|choose|chooses|prefer|prefers)|alternative (offers?|bids?|proposals?|solutions?) (are|is|will be|may be) (welcome|welcomed|considered|accepted|permitted)|(is|are) interested in the concept)\b/i;

const RECOMMEND = /\b(recommended|it is (strongly )?(advised|suggested)|(bidders|tenderers|suppliers|contractors|applicants) are (strongly )?(advised|encouraged)|(is|are) (strongly )?encouraged|advisable|desirable|preferabl[ey]|ideally|would be (welcome|welcomed|advantageous|beneficial|an advantage))\b/i;

const CONDITIONAL_START = /^\s*(where|if|when|in the event|in case|should (the|a|an|any)|unless|subject to|in cases where)\b/i;
const CONDITIONAL_ANY = /\b(where|if) (applicable|relevant|required|necessary|appropriate|any)\b|\bas applicable\b/i;

const SUBMIT_SUBJECT = /\b(bids?|tenders?|proposals?|offers?|submissions?|responses?|tender (information|documents?|packs?))\b[^.;]{0,40}?\b(shall|must|should|will|are to|is to|to)\s+(be\s+)?(submitted|delivered|sent|received|uploaded|addressed|marked|sealed|lodged|returned)\b/i;
const SUBMIT_VERB = /\b(submit|deliver|send|upload|lodge|return)\s+(the |your |their |a |an |all |one |two |three |\d+ )?(written |sealed |electronic |hard[- ]copy |signed )?(bids?|tenders?|proposals?|offers?)\b/i;
const SUBMIT_OTHER = /\b(sealed|envelopes?|external (means of identif\w*|markings?)|packs? shall not|subject (line|heading)?\s*['‘’"“]|prohibited from contacting|must not contact|not (to )?contact (any )?(councillors|members|staff|officials)|canvass\w*|closing (date|time) for (receipt|submission))/i;
const ELIGIBILITY = /\b(registered|registration|eligib\w*|qualif\w*|pre-?qualif\w*)\b/i;

const DOC_NOUN = /\b(separate (document|envelope|file|schedule|cover)|price (schedule|breakdown|document|proposal|list)|pricing (schedule|document|proposal)|financial (proposal|offer|bid)|bill of quantit(y|ies)|boq|form of tender|tender form|bid form|forms?|bid bond|bank guarantee|tender security|bid security|performance (bond|guarantee)|certificates?|cop(y|ies) of|annex(ure)?|appendix|signed (declaration|letter|statement)|declarations?|undertakings?|authori[sz]ation letter|letter of authori[sz]ation|power of attorney|cvs?|curricul(um|a) vitae|references?|data ?sheets?|brochures?|catalogues?|company profile|audited (accounts|financial statements)|financial statements|technical (specification|proposal|submission|offer|bid)|method statement|compliance (statement|matrix|sheet)|work programme|programme of works)\b/i;
const DOC_VERB = /\b(submit(ted)?|provide[ds]?|provided|include[ds]?|attach(ed)?|enclose[ds]?|accompan(y|ied)|furnish(ed)?|send|sent|with (the|your|their) (tender|bid|proposal|offer))\b/i;
const FINITE = /\b(shall|must|will|should|may|can|is|are|was|were|be|been|has|have|had|do|does|need|needs)\b/i;
// "The names … of two references who have received …": the verb is in a relative clause.
const mainClause = (s) => s.split(/\b(who|which|that|whose|where)\b/i)[0];

/**
 * @param {{requirement: string, tenderQuote?: string, category?: string, mandatory?: boolean}} r
 * @returns {{type: string, reason: string, excluded?: boolean}}
 */
export function classifyRequirement(r) {
  const quote = norm(r.tenderQuote);
  const text = norm(r.requirement);
  const src = quote || text;

  if (quote && EVAL_GUIDANCE.test(quote)) {
    return { type: "evaluation", excluded: true, reason: "Scoring or evaluation guidance in the tender, not a requirement a proposal can meet or fail." };
  }
  if (!quote && EVAL_GUIDANCE.test(text) && !STRONG.test(text)) {
    return { type: "evaluation", excluded: true, reason: "Scoring or evaluation guidance, not a requirement a proposal can meet or fail." };
  }
  if (OPTIONAL.test(src) && !/\bmandatory\b/i.test(src)) {
    return { type: "optional", reason: "The tender invites a response but does not require one." };
  }
  if (RECOMMEND.test(src) && !STRONG.test(src)) {
    return { type: "recommendation", reason: "The tender recommends this; it is not an obligation." };
  }
  if ((SUBMIT_SUBJECT.test(src) || SUBMIT_VERB.test(src) || SUBMIT_OTHER.test(src)) && !ELIGIBILITY.test(src) && !documentName(r)) {
    return { type: "submission", reason: "How, when or where to submit (or conduct during the tender). A proposal cannot prove it." };
  }
  if (!quote && /^submission$/i.test(String(r.category || "")) && !documentName(r)) {
    return { type: "submission", reason: "Listed as a submission instruction in the analysis." };
  }
  if (CONDITIONAL_START.test(src) || CONDITIONAL_ANY.test(src)) {
    return { type: "conditional", reason: "Applies only when its condition holds." };
  }
  if (EVAL_CRITERION.test(text) || EVAL_CRITERION.test(quote)) {
    return { type: "evaluation", reason: "A scored criterion: a weak answer may lose marks but is not a compliance failure." };
  }
  if (r.mandatory === false && !STRONG.test(src)) {
    return { type: "optional", reason: "Marked as not mandatory in the analysis." };
  }
  return { type: "mandatory", reason: "" };
}

// ── 5. Returnable documents ──────────────────────────────────────────────────

const DOC_NAMES = [
  [/\b(price|pricing|financial (proposal|offer|bid)|bill of quantit|boq)\b/i, "Price schedule", ["price", "pricing", "priced", "bill of quantities", "boq"]],
  [/\b(bid bond|bank guarantee|tender security|bid security)\b/i, "Bid bond / tender security", ["bid bond", "bank guarantee", "tender security", "bid security"]],
  [/\bperformance (bond|guarantee)\b/i, "Performance bond", ["performance bond", "performance guarantee"]],
  [/\b(authori[sz]ation letter|letter of authori[sz]ation|\bMAL\b)/i, "Manufacturer authorisation letter", ["authorisation letter", "authorization letter", "mal"]],
  [/\bcompliance (statement|matrix|sheet)\b/i, "Compliance statement", ["compliance statement", "compliance matrix", "compliance sheet"]],
  [/\b(audited (accounts|financial statements)|financial statements)\b/i, "Audited financial statements", ["financial statements", "audited accounts"]],
  [/\breferences?\b/i, "References", ["reference"]],
  [/\b(cvs?|curricul(um|a) vitae)\b/i, "CVs", ["cv", "curriculum vitae"]],
  [/\bmethod statement\b/i, "Method statement", ["method statement"]],
  [/\b(work programme|programme of works)\b/i, "Work programme", ["programme"]],
  [/\btechnical (specification|proposal|submission|offer|bid)\b/i, "Technical proposal", ["technical"]],
  [/\b(form of tender|tender form|bid form)\b/i, "Form of tender", ["form of tender", "tender form", "bid form"]],
];

const LEAD = /^(a|an|the|valid|all|any|of|at|least|one|two|three|four|five|\(\d+\)|\d+|copy|copies|signed|original|required|relevant|submit|provide|include|attach)\s+/i;
function stripLead(s) {
  let t = norm(s);
  while (LEAD.test(t)) t = t.replace(LEAD, "");
  return t;
}

function certificateName(src) {
  const m = src.match(/((?:[\w-]+|\([A-Z]{2,}\))\s+){1,5}certificates?/i);
  const name = m ? stripLead(m[0]) : "";
  return name && !/^certificates?$/i.test(name) ? name[0].toUpperCase() + name.slice(1) : null;
}

/** Name of the document the tender asks the bidder to hand in, or null. */
export function documentName(r) {
  const quote = norm(r.tenderQuote);
  const text = norm(r.requirement);
  const src = quote || text;
  if (!DOC_NOUN.test(src)) return null;
  // "shall hold a certificate" is a qualification; "shall submit / provide a certificate" or a
  // bare list item ("A separate document confirming the total price …") is a returnable document.
  const nounPhrase = quote && !FINITE.test(mainClause(quote));
  if (!DOC_VERB.test(src) && !nounPhrase) return null;
  for (const [re, name] of DOC_NAMES) if (re.test(src)) return name;
  if (/certificates?/i.test(src)) return certificateName(src) || "Certificate";
  const m = src.match(new RegExp(`((?:[\\w-]+\\s+){0,2})${DOC_NOUN.source}`, "i"));
  const name = m ? stripLead(m[0]) : "";
  return name ? name[0].toUpperCase() + name.slice(1) : "Document";
}

function docKeywords(name) {
  const hit = DOC_NAMES.find(([, n]) => n === name);
  if (hit) return hit[2];
  return [...contentStems(name)].filter((s) => s.length > 2 && s !== "certificat");
}

const SEPARATE = /\b(separate(ly)?|under separate cover|document \d+|enclosed|attached|appendix|annex|accompanying|submitted with|provided in)\b/i;

/**
 * Where the uploaded proposal mentions a returnable document as something
 * handed in separately (e.g. "Our pricing is provided separately in Document 2").
 * @returns {{page: number, text: string} | null}
 */
export function findSeparateMention(name, pages) {
  // The technical proposal is normally the uploaded file itself.
  if (name === "Technical proposal") return null;
  const keys = docKeywords(name).map((k) => k.toLowerCase());
  if (!keys.length) return null;
  for (const p of pages || []) {
    const sentences = String(p.text || "").replace(/\s+/g, " ").split(/(?<=[.;!?])\s+/);
    for (const sentence of sentences) {
      const m = sentence.match(SEPARATE);
      if (!m) continue;
      // The document's name and the "separately / annex / Document 2" wording must be in the
      // same sentence (or close together in a long run of text without full stops).
      const scope = sentence.length <= 300 ? sentence : sentence.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80);
      const low = scope.toLowerCase();
      if (keys.some((k) => low.includes(k))) return { page: p.n, text: scope.trim().slice(0, 300) };
    }
  }
  return null;
}

// ── 2. Duplicates and clauses that belong to another requirement ────────────

function splitClauses(text) {
  return norm(text)
    .replace(/\.$/, "")
    .split(/;\s+|,\s+(?:and|plus)\s+|\s+and also\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

function sentenceCase(s) {
  const t = norm(s).replace(/[,;:\s]+$/, "");
  return t ? t[0].toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".") : t;
}

/**
 * @param {object[]} reqs  requirements (requirementsFromAnalysis shape)
 * @returns {{ requirements: object[], merged: object[], narrowed: object[] }}
 */
export function resolveOverlaps(reqs) {
  const list = reqs.map((r) => ({ ...r }));
  const merged = [];
  const narrowed = [];

  // Exact duplicates: same tender quote and (almost) the same wording.
  const drop = new Set();
  for (let i = 0; i < list.length; i++) {
    if (drop.has(i)) continue;
    for (let j = i + 1; j < list.length; j++) {
      if (drop.has(j)) continue;
      const a = list[i];
      const b = list[j];
      const sameQuote = a.tenderQuote && b.tenderQuote && norm(a.tenderQuote).toLowerCase() === norm(b.tenderQuote).toLowerCase();
      const simText = Math.min(coverage(a.requirement, b.requirement), coverage(b.requirement, a.requirement));
      if ((sameQuote && simText >= 0.8) || (!a.tenderQuote && !b.tenderQuote && simText >= 0.9)) {
        drop.add(j);
        a.duplicates = [...(a.duplicates || []), b.id];
        merged.push({ kept: a.id, removed: b.id });
      }
    }
  }
  const kept = list.filter((_, i) => !drop.has(i));

  // A clause of A that is another requirement's obligation (and not in A's own quote).
  for (const a of kept) {
    if (!a.tenderQuote) continue;
    const clauses = splitClauses(a.requirement);
    if (clauses.length < 2) continue;
    const keep = [];
    const moved = [];
    for (const c of clauses) {
      const cs = contentStems(c);
      if (cs.size < 3) {
        keep.push(c);
        continue;
      }
      const own = coverage(cs, a.tenderQuote);
      const owner = own <= 0.34
        ? kept.find((b) => b !== a && b.tenderQuote && coverage(cs, b.tenderQuote) >= 0.75 && coverage(cs, b.requirement) >= 0.5)
        : null;
      if (owner) moved.push({ clause: c, to: owner.id });
      else keep.push(c);
    }
    if (moved.length && keep.length && coverage(keep.join(" "), a.tenderQuote) >= 0.3) {
      const before = a.requirement;
      a.requirement = sentenceCase(keep.join(", "));
      a.narrowed = moved.map((m) => ({ part: m.clause, checkedUnder: m.to }));
      narrowed.push({ id: a.id, before, after: a.requirement, moved });
    }
  }
  return { requirements: kept, merged, narrowed };
}

// ── 3. Compound requirements ─────────────────────────────────────────────────

const MODAL = /\b(shall|must|will|should|is to|are to|is required|are required)\b/i;
const ANAPHOR_START = /^(this|these|that|those|it|they|such|the same|also|in addition|however|otherwise|thereafter|then)\b/i;
const ANAPHOR_ANY = /\b(this|these|such|the above|above-mentioned|aforementioned|the same)\s+(arrangements?|requirements?|items?|clauses?|obligations?|services?|works?|conditions?|periods?|provisions?|systems?)\b/i;

function quoteSentences(q) {
  return norm(q)
    .split(/(?<=[.;])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One item per separate obligation in the tender quote (or the requirement unchanged). */
export function splitCompound(r, others = []) {
  if (!r.tenderQuote || r.narrowed) return [r];
  const sents = quoteSentences(r.tenderQuote);
  if (sents.length < 2) return [r];
  const ok = sents.every((s, i) =>
    MODAL.test(s) &&
    s.split(/\s+/).length >= 5 &&
    !ANAPHOR_ANY.test(s) &&
    (i === 0 || !ANAPHOR_START.test(s)) &&
    coverage(s, r.requirement) >= 0.3 &&
    !others.some((o) => o !== r && o.tenderQuote && norm(o.tenderQuote).toLowerCase() === s.toLowerCase())
  );
  if (!ok) return [r];
  return sents.map((s, i) => ({
    ...r,
    id: `${r.id}.${i + 1}`,
    requirement: sentenceCase(s),
    tenderQuote: s,
    splitFrom: { id: r.id, requirement: r.requirement },
  }));
}

// ── All together ─────────────────────────────────────────────────────────────

/**
 * @param {object[]} requirements  from requirementsFromAnalysis()
 * @param {{max?: number}} [opts]
 * @returns {{ checked: object[], excluded: object[], prep: object }}
 */
export function prepareRequirements(requirements, { max = 150 } = {}) {
  const { requirements: deduped, merged, narrowed } = resolveOverlaps(requirements || []);
  const split = [];
  const expanded = [];
  for (const r of deduped) {
    const parts = splitCompound(r, deduped);
    if (parts.length > 1) split.push({ id: r.id, into: parts.map((p) => p.id) });
    expanded.push(...parts);
  }
  const checked = [];
  const excluded = [];
  for (const r of expanded) {
    const t = classifyRequirement(r);
    const doc = t.type === "mandatory" || t.type === "conditional" ? documentName(r) : null;
    const item = { ...r, type: t.type, typeReason: t.reason, ...(doc ? { document: { name: doc } } : {}) };
    if (t.excluded) excluded.push(item);
    else checked.push(item);
  }
  return {
    checked: checked.slice(0, max),
    excluded,
    prep: {
      merged,
      narrowed,
      split,
      excluded: excluded.map((e) => e.id),
      overLimit: Math.max(0, checked.length - max),
    },
  };
}
