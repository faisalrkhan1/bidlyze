// Shared constants for file upload + analysis flow.
// Tuning text-truncation limits? Change them here only.

export const FILE_LIMITS = {
  // Per-file maximum size (bytes)
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB

  // Tender Package limits
  MAX_FILES_PER_PACKAGE: 10,
  MAX_TOTAL_SIZE: 150 * 1024 * 1024, // 150 MB combined

  // Allowed MIME types
  ALLOWED_CONTENT_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
};

export const TEXT_LIMITS = {
  // Single-file analysis (legacy + backward-compat path)
  MAX_TEXT_CHARS_SINGLE: 400_000,

  // Multi-file analysis (GPT-5.4, 922K input token budget)
  MAX_TEXT_CHARS_PRIMARY: 800_000,
  MAX_TEXT_CHARS_SUPPORTING_TOTAL: 400_000,
  MAX_TEXT_CHARS_TOTAL: 1_200_000,

  // Per-sheet cap for XLSX text extraction
  MAX_XLSX_SHEET_CHARS: 50_000,
};

export const TENDER_FILE_ROLES = ["primary", "boq", "annex", "tc", "drawing", "other"];

export const TENDER_FILE_ROLE_LABELS = {
  primary: "Primary RFP",
  boq: "BOQ / Pricing",
  annex: "Annex",
  tc: "Terms & Conditions",
  drawing: "Drawings",
  other: "Other",
};
