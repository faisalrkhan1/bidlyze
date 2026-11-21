# Real-world benchmark report: Submission Check and Tender Intelligence

**Date:** 21 November 2026
**Branch:** `bench/realistic-alton` (preview only; nothing merged or deployed to production)
**Model:** Claude Sonnet 5.5 via OpenRouter (`anthropic/claude-sonnet-5.5`, `data_collection: deny`)
**Environment:** Vercel preview deployments (preview-only `/api/selftest`; production returns 404). The benchmark reads and writes no database data.

## 1. What was tested

| | |
|---|---|
| **Tender (authentic, public)** | Alton Town Council (Hampshire, UK), *Invitation to Tender: CCTV review of current system, design to meet new requirements, install and ongoing maintenance support contract for 3 years to 2029*. 7-page PDF, text layer, 225,404 bytes, SHA-256 `a530a1ea…a14f5`. Fetched at run time from alton.gov.uk and not stored in the public repository. |
| **Supplier response (fictional)** | 10-page technical proposal from "Halberd Vision Systems Ltd" (`supplier_proposal.pdf`). All names, staff, references, phone numbers (Ofcom drama range) and e-mails (`.example`) are invented. |
| **Answer key** | 38 requirements taken from the tender by hand: **19 answered, 4 partial, 11 conflict, 4 missing**. Each has the exact tender quote and page, exact response quote(s) and page(s), a one-line justification and a trap type. A written rubric (answered / partial / conflict / missing) was fixed **before** any AI run. |
| **Key validation (code, no AI)** | 38/38 tender quotes found on their stated page in the **live** download, 39/39 response quotes on their stated page, and every term behind a "missing" verdict confirmed absent. This runs offline in `npm test` and live in `mode=bench-validate`. |

**Traps in the proposal (19 problems).**

- **Contradictions inside the bid** (4):
  - 31 days of recordings in the text vs 30 days in the appendix.
  - Three Officers trained in the summary vs two in the training section.
  - "In time for 1 November" vs handover in the week of 16 November.
  - HERS certificates held by the lead engineers, with the rest "to follow".
- **Wrong technical or commercial values:**
  - Fault assessment within 48 h, where 24 h is required.
  - Professional Indemnity of £5m, where £10m is required.
  - A two-year maintenance price, where three years are required.
- **Commercial qualifications:**
  - 50% payment in advance.
  - Vandalism call-outs charged extra.
  - Column repairs billed as a variation.
  - Hardware upgrades to retained cameras excluded.
- **Date reasoning:** one of the two references ended in March 2024, outside the 12-month window.
- **Scope gaps and missing items:**
  - The rear car park and the Council compound are left out.
  - The tree check covers today only, not the contract period.
  - Testing follows an in-house procedure instead of ISO.
  - Plans/records, signage and a real retention-policy review are missing.

**Traps for false alarms (correct answers in different words).**

- "72 hours" for "three days".
- "£10,000,000" for "£10m".
- "IPAF PAL 3a/3b" for the working-at-height certificates.
- "Hampshire Constabulary" for "the Police".
- Evidence inside tables.

## 2. Results: Submission Check (38 requirements given from the answer key)

| Metric | Before fixes (3 runs, `18f2661`) | After fixes (5 runs, `f46e302`→`f33c7bd`) |
|---|---|---|
| Exact verdict (4 statuses) | 107/114 (93.9%); AI alone 108/114 | **180/190 (94.7%)** |
| Problems flagged (not reported as compliant) | 57/57 | **95/95** |
| **Missed problems** (a non-compliant item reported as compliant) | **0** | **0** |
| **False alarms** (a compliant item flagged) | 1/57 (caused by the code checks) | **0/95** |
| Response quotes found on the page the AI cited | 125/125 | 217/217 |
| Evidence on the expected page | 100/100 | 172/172 |
| Both sides of a self-contradiction quoted | 7/12 | **20/20** |
| Tender quotes verified | 114/114 | 190/190 |
| Verdicts the code checks changed | 2 (both wrong) | 0 |
| Time per check (38 requirements, 10-page response) | 19–51 s | 38–48 s (median 42 s) |
| Tokens per check | 7.7k in / 3.8–9.4k out | 7.8–8.0k in / 6.9–9.1k out |
| **AI cost per check** | $0.055–0.10 | **$0.076–0.109 (average $0.089)** |

**Remaining wrong verdicts after the fixes (10/190).** All are severity differences, and every one is still flagged as a problem:

- **A35** (one of two references outside 12 months): partial in 4/5 runs, against expected conflict. The key notes partial as defensible.
- **A03** (Council compound): partial in 4/5 runs, against expected missing. The AI counts the general "covers … Anstey Park" sentence as partial evidence.
- **A19** (retention-policy review "to be discussed"): partial in 2/5 runs, against expected missing.

**Regression check on the original fictional ECTA test (18 requirements).** Over 4 runs during the fixes the scores were 18/18, 17/18, 16/18 and 18/18. Problems flagged were always 12/12, with 0 missed. The single false alarms were:

- Q04 (portal registration) once marked "check manually" (fixed).
- Q04 once marked partial, because the response did not state the closing date.

Q07 (two of three certificates) was once rated conflict instead of partial.

## 3. Results: chained workflow (Tender Intelligence requirements → Submission Check)

This is how the product will actually be used. Tender Intelligence run 3's 39 extracted requirements were saved as a fixed input (`runs/ti-run3.requirements.json`). The expected status for each was derived mechanically from the answer key (`runs/ti-run3.expected.json`).

| Metric | Before "check manually" status | After (2 runs) |
|---|---|---|
| Exact (39 extracted requirements) | 30/39 | 37/39, 36/39 |
| Substantive requirements (31) | 30/31 | 31/31, 31/31 |
| Submission-process items shown as "check manually" (8) | 0/8 (shown as missing/partial: noise) | 6/8, 5/8 |
| Missed problems | 0 | 0 |
| False alarms on compliant requirements | 0/12 | 0/12 |
| Tender quotes re-verified | 39/39 | 39/39 |
| Response quotes verified | 43/43 | 39/39, 40/40 |
| Time / cost | 56 s / $0.116 | 47–57 s / $0.103–0.116 |

The items still not marked "check manually" are: R5, a recommended site visit (the bid mentions a survey); R34, "submit a compliant tender", which the AI judged against all the bid's deviations; and once R36, the scoring guidance.

## 4. Results: Tender Intelligence (same tender, 3 runs)

| Metric | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Requirements extracted | 39 | 39 | 39 |
| Citation quote on the page the AI cited | 39/39 | 38/39 (1 page wrong; code moved it to the right page) | 39/39 |
| Answer-key requirements covered (hand review) | 36/38 | 36/38 | 38/38 |
| Requirements invented (not in the tender) | 0 | 0 | 0 |
| Key dates (deadline, award, operational date, start, end) | 5/5 | 5/5 | 5/5 |
| Evaluation weights (20/10/20/50) | 4/4 | 4/4 | 4/4 |
| Clarification questions (all with verified citations) | 15 | 15 | n/a |
| Bid/no-bid | 60, conditional | 58, conditional | n/a |
| Time | 69 s | 70 s | 64 s |
| Tokens (5 AI calls) | 21.9k in / 29.1k out | 22.0k in / 29.5k out | 21.7k in / 28.2k out |
| **AI cost** | $0.342 | $0.311 | $0.332 |

Not covered in runs 1–2: "the locations covered by this contract" (in the summary only) and "supply time" (in the evaluation criteria only). Compound sentences are merged into one requirement, for example public plus professional insurance, and monitoring plus 24-hour evaluation. The merged verdicts were correct, but one verdict then covers two obligations (see finding T1).

## 5. Every wrong verdict and its cause

All 17 wrong final verdicts across 8 Submission Check runs (304 verdicts), plus the chained and Tender Intelligence findings. Full table in `FINDINGS.md`.

| Cause | Count | Examples | Status |
|---|---|---|---|
| Deterministic validation (code checks) | 2 verdicts + 2 latent bugs | Echo check turned correct verdicts into "missing" (A31, A34). "h**eight**" read as 8 certificates. "within 24 h" treated as a minimum. 72 h could not be compared with 3 days. | **Fixed**, with regression tests that fail on the old code |
| Prompting (severity rubric) | 8 | A34 Year-3 deferral rated partial; A35 rated partial | A34 fixed (5/5 conflict since). A35 not fixed (1/5) |
| Prompting (product gap) | 8 noise flags in the chained flow | Deadline, sealed pack, e-mail subject, no lobbying reported as "missing" | **Fixed** with the "check manually" status (5–6/8); one regression found and fixed |
| AI reasoning | 7 | A03 and A19 rated partial instead of missing (on the ECTA test, Q04 was also once rated partial) | Not fixed. Always flagged; severity only |
| Extraction | 0 verdicts | Page 4 of the tender loses a few words of the deadline line; Tender Intelligence used page 7 instead | n/a |
| Answer key | 0 changed | A19 and A35 were marked as defensible either way before the runs | Key not edited after seeing results |

## 6. Limits of this benchmark

- **One tender, one response, and both written with the same AI family as the engine.** The proposal and answer key were written by Claude, and the engine runs on Claude. Shared blind spots could make the results look better than they would on a human-written bid.
- **A clean, text-based, 10-page proposal.** Real bids are longer, mix scanned annexes and spreadsheets, and use messier tables. Long documents, OCR and multi-file bids were not tested here.
- **A UK local-authority tender.** The fixed disqualification checklist in Tender Intelligence is GCC-specific, and only 2 of its 20 items applied. The dynamic findings did the work.
- **Severity varies** between runs on about 5% of verdicts. Whether a requirement has a problem did not vary.
- **No accuracy guarantee.** These numbers describe this benchmark only.

## 7. Recommendation

**Submission Check is ready for UI development, as a beta, not as a finished product.** On realistic traps, including self-contradictions, wrong values, commercial qualifications and date reasoning, it missed no problem in 304 verdicts. After the fixes it raised no false alarms, and every quote it showed was verified in code on the cited page. Those are the properties a reviewer needs to trust the screen.

Conditions:

1. **Design the UI around "needs attention / OK / check manually"**, with partial, conflict and missing as a secondary label. Severity is the unstable part; flagging is not. Always show both quotes with page links. Never show a score as a guarantee.
2. **Before any accuracy claim in marketing, run a second, independent benchmark.** It should use a different authentic tender (ideally GCC) and a response written by a person, not by Claude: for example, an anonymised real bid from your own work, or one written by a colleague. It should also include a long, multi-file bid.
3. **Split compound requirements in Tender Intelligence** (e.g. public vs professional insurance). This changes the production compliance matrix, so it needs your decision.
4. Tune the "deviation wording" flag during the UI work. It fires on ordinary phrases such as "not blocked by trees".
5. Budget about **$0.09 per Submission Check** (38 requirements) and **$0.33 per Tender Intelligence analysis** (7-page tender), plus about 40–60 s and about 65–75 s of processing.

## 8. Total AI spend for this benchmark

Submission Check: 8 runs, $0.69. Chained: 3 runs, $0.33. ECTA regression: 4 runs, $0.09. Tender Intelligence: 4 runs, $1.31. **Total about $2.42.**
