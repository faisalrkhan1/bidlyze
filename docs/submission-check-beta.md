# Submission Check (beta)

Check a supplier's draft technical proposal against every requirement of an
analysed tender, with the exact wording from both documents and page numbers.

**Status:** preview deployments only. Off in production: pages and API return
404 unless `SUBMISSION_CHECK_BETA=on` is set in production (needs Faisal's
approval). Branch: `feat/submission-check-beta`.

## User workflow

1. **Choose the tender:** Sidebar → *Submission Check* (BETA), or the
   *Check a proposal against this tender* card on an analysis page. A sample
   tender is available: Alton Town Council's public CCTV tender with a
   fictional supplier proposal.
2. **Upload the proposal:** PDF, Word (.docx) or text, up to 50 MB. The file
   is read in the browser; only its page text is sent. *How your proposal is
   processed and stored* explains this on screen.
3. **Run Submission Check:** usually 30–60 seconds. After 90 s a "taking longer
   than usual" note appears; the check stops after 5 minutes with a clear message.
4. **Review the results**
   - **Needs attention / Check manually / OK**, classifications
     (*Conflict, Missing, Partial, Evidence not found, Not checked, Not in
     uploaded file, Check manually, Answered*) and **requirement types**
     (*Mandatory, Conditional, Optional, Recommendation, Submission process,
     Scored criterion*).
   - Both documents quoted with pages. Contradictions show both statements.
   - *View page* opens the page text with the quote highlighted.
   - Suggested action and priority on every finding.
   - **Documents the tender asks for:** what the uploaded proposal says about
     each one (*described*, *referred to as a separate document*, *no mention
     found: confirm*).
   - **How the requirement list was prepared:** narrowed, split, merged and
     left-out items, with reasons.
   - Filter by group, classification and type; search; *Not yet reviewed*.
   - Reviewer decisions: *Reviewed*, *Agree / Override: OK / Override: needs
     attention*, and a note.
5. **Export (.xlsx):**
   - **Summary** dashboard: automated vs after review, priorities, types,
     documents, warnings, timestamps with time zone, disclaimer.
   - **Action register:** 16 columns. Bidlyze's columns (dark headers) are
     kept apart from *your team* columns (yellow: owner, status, reviewer
     decision, note). *Final result* follows the reviewer decision, including
     when it is changed in Excel.
   - **Evidence:** every tender and proposal quote, untruncated, with pages and
     quote checks.
   - **Not checked:** scoring guidance left out, with reasons.
   - Frozen headings, filters, wrapped text, dropdowns, Arial.
6. Results and review notes are kept **in this browser only** until *New
   check*. If the browser cannot store them, the screen says so: export to keep them.

## How requirements are prepared (`lib/submission/obligations.js`)

This runs at check time, as code with no AI. Saved analyses are neither changed nor migrated.

- **Type** is decided from the tender's own words: the code-verified tender
  quote, or the requirement text when an older analysis has no quote.
  - *Recommendation*: "recommended", "encouraged", "desirable".
  - *Optional*: "outside the scope", "invited to comment", "optional".
  - *Conditional*: "where/if … ".
  - *Submission process*: how, when or where to submit, sealed packs, email
    subject, no canvassing.
  - *Scored criterion*: named in the evaluation criteria.
  - *Scoring guidance* ("will be judged against", "to achieve the highest
    scores") is **left out**: a proposal cannot comply or fail with it.
- **Grouping rules**
  - Recommendation, optional and scored items are never compliance failures:
    if answered they are OK, otherwise *Check manually*.
  - Submission steps are *Check manually* unless the proposal states a
    conflict.
- **No double counting**
  - A clause of one requirement that is another requirement's obligation is
    moved out (Alton R6 → R7).
  - Exact duplicates are merged.
  - A tender quote with two independent obligations (each with its own
    "shall/must") is split (Alton R16 → R16.1, R16.2).
  - A sentence that depends on the previous one ("… this arrangement") is
    not split.
- **Returnable documents** (price schedule, bid bond, certificates to
  *submit*, references, compliance statement…).
  - With no evidence in the uploaded file, the status is **Not in uploaded
    file**, grouped as *Check manually* with High priority. That is a
    confirmation item, not a proven violation.
  - A qualification to *hold* (e.g. "shall hold the HERS certificate") is an
    obligation, not a document.

## Safety, privacy and cost controls

- Never calls a proposal "compliant". A human-review notice is on every
  result and every export.
- Live (paid) checks:
  - must be signed in;
  - **production is default-deny**: only e-mails in
    `SUBMISSION_CHECK_ALLOWED_EMAILS` can run them, so free or unlisted
    accounts cannot trigger paid AI checks;
  - preview deployments are behind Vercel Authentication;
  - per-user limits: one check at a time, 5 per hour, 15 per day
    (`SUBMISSION_CHECK_MAX_PER_HOUR`, `SUBMISSION_CHECK_MAX_PER_DAY`). These
    are in memory per server instance: they stop repeats and loops, not a
    determined abuser.
  - A durable monthly quota needs one new table, proposed in
    `docs/proposals/submission-check-usage.sql`. It is **not applied**.
- Users can only check their own analyses (Bearer token + RLS + owner filter).
- Request limits: 4 MB body (re-checked after reading), 2,000 pages, 1.5 M
  characters, 150 requirements.
- The sample proposal replays a recorded live result (no AI cost).
- The recording endpoint (`/api/submission-check/demo?part=record`) and
  `/api/selftest` return 404 in production whatever the beta switch says.
- Server logs hold only size, duration and cost: no proposal text, no findings.
- The AI provider is reached through OpenRouter with `data_collection: deny`
  (only providers that do not collect user data). Providers may still keep
  requests briefly under their own terms. Zero-data-retention routing
  (`AI_ZDR=true`) is available but not switched on by this branch.

## Tests

- `npm test`: 125 tests, no AI and no network.
  - Requirement types, splitting and documents on the real Alton analysis
    and the ECTA test tender.
  - **Regression over 13 recorded live runs:** no answer-key issue lost.
  - Grouping and wording rules, filters.
  - Export: read back with ExcelJS.
  - Browser/server extraction parity.
  - API safety: 404 in production, 400/401/403/413/422/429 before any AI
    call; recording endpoint closed.
  - Dashboard average.
- `npm run test:ui`: 9 Playwright tests in real Chrome against a local
  production build. Supabase is mocked in the browser; any write fails the test.
  - The full workflow, including export (parsed back) and restore of
    decisions and notes.
  - The sample with the four reported Alton problems.
  - Older analyses.
  - Errors: wrong file, scanned PDF, AI failure, network loss, rate limit,
    slow check, 5-minute time-out, browser storage full.
  - Mobile at 390 px.
  - Dashboard with no NaN.

  Build first:
  `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key npx next build`
- Screenshot walkthrough (local only): `SCREENSHOTS=1 npx playwright test -c tests/ui/playwright.config.mjs zz-screenshots.spec.mjs`

## Known limitations (beta)

- Results are not saved to the account; they live in one browser until exported.
- One proposal file per check. Separate files (price schedule, annexes) are
  not read: Bidlyze shows what the proposal *says* about them.
- No OCR for scanned PDFs.
- Type rules are wording-based (English). They were tuned on two tenders
  (Alton, ECTA) and will mis-type some unusual wording; the reviewer can
  override the result.
- Severity labels (partial vs conflict) vary between runs on a few items.
  Problem vs no problem has been stable on the benchmarks.
- Not yet tested by a real user on a real bid; independent benchmark #2 not done.
