# Real-world benchmark: Alton Town Council CCTV tender

**Tender (authentic, public):** Alton Town Council, *Invitation to Tender: CCTV review of
current system, design to meet new requirements, install and ongoing maintenance support
contract for 3 years to 2029* (7 pages, 2026).
<https://www.alton.gov.uk/wp-content/uploads/2026/06/Alton-Town-Council-Invitation-to-Tender-CCTV-system.pdf>
SHA-256 `a530a1eaddb41cb36a78b5bdd268508ac9cf3f446d457c79151ed518193a14f5` (retrieved 21 Nov 2026).

The tender is **not stored in this repository** (it belongs to the Council and the repo is
public). The preview-only self-test downloads it from the Council's own URL and refuses to run
if the fingerprint has changed (`lib/benchmarks/sources.js`).

**Supplier response (fictional):** `supplier_proposal.pdf`, made by `make_proposal.py`.
A 10-page technical proposal from "Halberd Vision Systems Ltd". The company, staff and
references are invented. Phone numbers are Ofcom drama numbers and e-mails use `.example`
domains.

**Answer key:** `answer_key.json`, made by `make_answer_key.py`. It has 38 requirements, each
with the expected status, an exact tender quote and page, exact response quote(s) and page(s),
a justification and the trap type:

- Expected statuses: 19 answered, 4 partial, 11 conflict, 4 missing.
- Every quote is checked in code by `lib/benchmarks/validateKey.js`, offline in `npm test`
  and against the live tender in `mode=bench-validate`.

## Folders (kept separate, as agreed)

| What | Where |
|---|---|
| Benchmark construction | `make_proposal.py`, `make_answer_key.py`, `answer_key.json`, `supplier_proposal.pdf` |
| Test execution (raw results of each live run) | `runs/` |
| Findings and proposed fixes | `FINDINGS.md` |
| Report with metrics and recommendation | `BENCHMARK_REPORT.md` |

## Running it (preview only)

Each URL below is opened on a preview deployment:

- `/api/selftest?mode=bench-validate&bench=alton-cctv-2026`: checks the answer key against the
  live tender. No AI is used.
- `/api/selftest?mode=bench-submission&bench=alton-cctv-2026`: runs Submission Check on the 38
  answer-key requirements.
- `/api/selftest?mode=bench-readiness&bench=alton-cctv-2026`: runs Tender Intelligence on the
  tender.
- `/api/selftest?mode=bench-chained&bench=alton-cctv-2026`: feeds the requirements Tender
  Intelligence extracted into Submission Check, in a single request. It takes about 2 minutes, which is too long for some clients.
- `/api/selftest?mode=bench-readiness&bench=alton-cctv-2026&emit=requirements`: returns the extracted requirements, to
  save as `runs/ti-runN.requirements.json`.
- `/api/selftest?mode=bench-chained-fixture&bench=alton-cctv-2026&ti=ti-run3`: runs Submission Check on a saved
  Tender Intelligence output. It is repeatable and is scored per extracted requirement.
