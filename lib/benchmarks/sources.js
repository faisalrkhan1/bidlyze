// Public tender documents used as real-world benchmarks.
//
// The documents are NOT stored in this (public) repository: they belong to
// their publishers. The preview-only self-test downloads them from the
// publisher's own URL at run time and checks the SHA-256 fingerprint, so a
// changed document is detected instead of silently changing the benchmark.
// Only the URLs listed here can be fetched (no arbitrary URLs).

export const BENCHMARK_SOURCES = {
  "alton-cctv-2026": {
    title: "Alton Town Council — Invitation to Tender: CCTV review of current system, design to meet new requirements, install and ongoing maintenance support contract for 3 years to 2029",
    publisher: "Alton Town Council (Hampshire, UK)",
    url: "https://www.alton.gov.uk/wp-content/uploads/2026/06/Alton-Town-Council-Invitation-to-Tender-CCTV-system.pdf",
    contentType: "application/pdf",
    retrieved: "2026-11-21",
    // Filled in from the first fetch; null = not pinned yet.
    sha256: null,
  },
};
