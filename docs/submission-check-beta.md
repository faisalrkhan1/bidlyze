# Submission Check (beta)

Check a supplier's draft technical proposal against every requirement of an
analysed tender, with the exact wording from both documents and page numbers.

**Status:** preview deployments only. It is off in production: the pages and
the API return 404 unless `SUBMISSION_CHECK_BETA=on` is set in production,
which needs Faisal's approval. Branch: `feat/submission-check-beta`.

## User workflow

1. **Choose the tender:** Sidebar → *Submission Check* (BETA), or the
   *Check a proposal against this tender* card on any analysis page. The list
   shows the user's analysed tenders. A sample tender is available for demos:
   Alton Town Council's public CCTV tender with a fictional supplier proposal.
2. **Upload the proposal:** PDF, Word (.docx) or text, up to 50 MB. The file
   is read **in the browser**: only its page text is sent for checking. It is
   never uploaded to storage, and nothing is written to the database.
3. **Run Submission Check:** usually 30–60 seconds.
4. **Review the results**
   - Summary: **Needs attention** / **Check manually** / **OK**, with a
     breakdown into *Conflict, Missing, Partial, Evidence not found,
     Not checked, Check manually, Answered*.
   - Each finding shows:
     - the tender requirement and its quote, with the tender page and
       Bidlyze's word-for-word check of that quote;
     - the proposal evidence with pages and the same check;
     - the AI's explanation, and any value checks made by code (e.g.
       "tender: 24 hours · response: 48 hours").
   - When the proposal contradicts itself (e.g. 31 days in the text, 30 days
     in an appendix), both statements are shown as *Statement A* and
     *Statement B*.
   - *View page* opens the page text with the quote highlighted, and
     *Open original at this page* opens the PDF at that page.
   - Filter by group or classification, search all text, show *Not yet
     reviewed* only.
   - Reviewer decisions: *Reviewed*, *Agree / Override: OK / Override: needs
     attention*, and a note. Overrides are shown as overrides, never silently.
5. **Export:** `.xlsx` report with two sheets.
   - **Summary:** counts, warnings and the disclaimer.
   - **Findings:** one row per requirement, most serious first, with quotes
     from both documents, pages, checks, the AI explanation and the
     reviewer's decisions and notes.
6. Results and review notes are kept **in this browser only** until *New check*.

## Safety and honesty rules built in

- Never calls a proposal "compliant". With no flags, the headline says
  *"No issues were flagged … This is not a confirmation of compliance"*.
- A human-review notice is on every result screen and in every export.
- Processing errors are **Not checked**, never OK. Quotes that cannot be found
  in the document become **Evidence not found**.
- Submission-process items (deadline, sealed pack, e-mail subject) are
  **Check manually**, never OK.
- Tender quotes use the code verification already stored with the analysis.
  Proposal quotes are verified in code against the exact text the browser
  extracted.
- Analyses made before page-cited quotes still work. Tender quotes are not
  shown for them, and a note explains why.
- API: user's own analyses only (Bearer token + RLS + owner filter). Request
  limits: 2,000 pages, 1.5 M characters, 4 MB body. Clear 4xx messages.
- The sample proposal replays a recorded live result, so demos cost nothing.
  Live runs on the sample tender require sign-in.

## Code

| Area | Files |
|---|---|
| Pages | `app/submission-check/page.js`, `app/submission-check/demo/page.js`, `app/analysis/[id]/submission-check/page.js` |
| UI | `app/components/submission/*` (Workspace, ResultsView, FindingCard, EvidenceViewer, Home, ui) |
| API | `app/api/submission-check/route.js` (check), `app/api/submission-check/demo/route.js` (sample data, preview only) |
| Logic | `lib/submission/{beta,fromAnalysis,extractClient,service,review,report,demo}.js`. The engine (`check.js`, `gates.js`, `prompts.js`) is the one validated on the benchmarks. |
| Shared extraction | `lib/readiness/sections.js` (same section rules in the browser and on the server) |

## Tests

- `npm test`: 102 unit and integration tests, no AI and no network. They cover:
  - the analysis adapter (new and older formats);
  - grouping and wording rules;
  - filters and search;
  - the xlsx report, read back;
  - **browser/server extraction parity** for PDF, Word and text;
  - service validation;
  - API safety: 404 in production, 400/401/413/422 before any AI call, and
    the recorded demo making no AI call.
- `npm run test:ui`: 6 UI end-to-end tests in real Chrome (Playwright) against
  a local production build, with Supabase mocked in the browser (no
  production data; any write attempt fails the test). They cover:
  - the start page;
  - the full workflow: upload, run, summary, filters, search, evidence, page
    viewer, reviewer notes, export parsed back, restore and new check;
  - an older analysis;
  - errors: unsupported file, scanned PDF, AI failure and retry, partly
    unchecked results;
  - the sample flow;
  - mobile (390 px) with no sideways scrolling.

  Build first:
  `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key npx next build`
- Fixtures: `tests/fixtures/submission/make_fixtures.mjs` regenerates the
  deterministic fixtures by running the real engine with a fake AI.

## Known limitations (beta)

- Results are not saved to the account (by design for now: no schema change).
  They live in one browser until exported.
- Proposal is one file. Multi-file bids and scanned PDFs (OCR) are not supported.
- Up to 150 requirements per check, and the first 600,000 characters of the
  proposal (anything beyond is listed as not read).
- Severity labels (partial vs conflict vs missing) vary between runs on about
  5% of verdicts. Problem vs no problem has been stable on the benchmarks.
- The tender page viewer for real analyses downloads the original tender
  file in the browser. It needs the stored file, and works for PDF, Word and
  text only.
- Not yet tested by a real user on a real bid. Independent benchmark #2 is
  not done.
