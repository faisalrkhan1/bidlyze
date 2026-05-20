// GCC-universal disqualification checklist.
//
// Each item is a fixed pass/fail check the Disqualification Risk Detector
// looks for in every tender. Keep these as data (not embedded in a prompt)
// so the API, UI, and any future export share a single source of truth.

export const DISQUALIFICATION_CHECKLIST = [
  {
    id: "bid_bond",
    label: "Bid Bond / Tender Security",
    description: "Bid bond or tender security required for submission.",
    severity: "critical",
    keywords: ["bid bond", "tender security", "tender bond", "bid guarantee", "earnest money"],
  },
  {
    id: "trade_license",
    label: "Valid Trade Licence",
    description: "Valid UAE/GCC trade licence required, including classification grade where applicable.",
    severity: "critical",
    keywords: ["trade licence", "trade license", "commercial registration", "CR number", "DED licence"],
  },
  {
    id: "previous_experience",
    label: "Previous Experience Certificates",
    description: "Previous experience certificates or similar project references required.",
    severity: "high",
    keywords: ["experience certificate", "previous projects", "similar projects", "track record", "project references"],
  },
  {
    id: "manufacturer_authorization",
    label: "Manufacturer Authorisation Letter (MAL)",
    description: "Manufacturer Authorisation Letter (MAL) required from the OEM.",
    severity: "high",
    keywords: ["manufacturer authorisation", "manufacturer authorization", "MAL", "OEM letter", "authorised distributor"],
  },
  {
    id: "arabic_documents",
    label: "Arabic Documents / Translation",
    description: "Arabic-language documents or certified translations required.",
    severity: "high",
    keywords: ["Arabic", "translation", "bilingual", "certified translation"],
  },
  {
    id: "stamped_signed_forms",
    label: "Stamped & Signed Forms",
    description: "Stamped and signed forms / company seal required on submission documents.",
    severity: "high",
    keywords: ["stamped", "signed", "company seal", "company stamp", "authorised signatory"],
  },
  {
    id: "submission_format",
    label: "Submission Format",
    description: "Specific submission format required (hard copy, soft copy, portal, sealed envelopes).",
    severity: "critical",
    keywords: ["hard copy", "soft copy", "sealed envelope", "submission portal", "e-tendering", "USB", "CD-ROM"],
  },
  {
    id: "clarification_deadline",
    label: "Clarification Question Deadline",
    description: "Deadline for submitting clarification questions to the issuing authority.",
    severity: "medium",
    keywords: ["clarification deadline", "queries deadline", "questions deadline", "clarification period"],
  },
  {
    id: "mandatory_site_visit",
    label: "Mandatory Site Visit",
    description: "Mandatory site visit / attendance certificate required.",
    severity: "critical",
    keywords: ["site visit", "site inspection", "site survey", "attendance certificate", "mandatory visit"],
  },
  {
    id: "pre_bid_meeting",
    label: "Mandatory Pre-Bid Meeting",
    description: "Mandatory pre-bid meeting attendance required.",
    severity: "high",
    keywords: ["pre-bid meeting", "pre bid meeting", "pre-tender meeting", "bidders conference"],
  },
  {
    id: "iso_certifications",
    label: "ISO Certifications",
    description: "Required ISO certifications (e.g. 9001, 14001, 45001, 27001).",
    severity: "high",
    keywords: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO certification", "quality management"],
  },
  {
    id: "local_authority_approvals",
    label: "Local Authority Approvals",
    description: "Approvals from local authorities (ADM, RTA, DMT, Civil Defence, etc.).",
    severity: "high",
    keywords: ["ADM", "RTA", "DMT", "Civil Defence", "Municipality", "Ministry approval", "regulator approval"],
  },
  {
    id: "financial_statements",
    label: "Audited Financial Statements",
    description: "Audited financial statements for the last N years required.",
    severity: "medium",
    keywords: ["audited financial", "financial statements", "audited accounts", "last three years", "last 3 years"],
  },
  {
    id: "mofa_attestation",
    label: "MOFA / Ministry Attestation",
    description: "MOFA or Ministry attestation of documents required.",
    severity: "medium",
    keywords: ["MOFA", "Ministry of Foreign Affairs", "attestation", "attested", "legalisation"],
  },
  {
    id: "classification_grade",
    label: "Contractor Classification Grade",
    description: "Contractor classification grade requirement (e.g. Grade A, Special Grade).",
    severity: "high",
    keywords: ["classification grade", "Grade A", "Special Grade", "contractor classification", "classification certificate"],
  },
];

export const DISQUALIFICATION_CHECK_IDS = DISQUALIFICATION_CHECKLIST.map((c) => c.id);

export function getChecklistItem(id) {
  return DISQUALIFICATION_CHECKLIST.find((c) => c.id === id) || null;
}
