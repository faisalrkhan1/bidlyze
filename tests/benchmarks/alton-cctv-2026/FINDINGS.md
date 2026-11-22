# Findings log: Alton benchmark

Each finding records how it was found, its root cause (extraction / prompt / AI reasoning /
deterministic validation / answer key) and whether it was fixed.

## Found during construction (before any AI run)

- **F0-1 Tender extraction drops text on page 4.** The live extraction reads
  "by 4:30pm on Friday 14th August\nposting or emailing", so the year and a word or two are
  missing from that line. Page 7 restates the date in full ("Friday 14th August 2026").
  Cause: extraction (PDF text layer). Impact: low, because the deadline is restated. Not fixed;
  it shows that real PDFs lose text.
- **F0-2 Code checks treat "within N hours/days" as a minimum.** The value checker reads a
  number as a minimum unless words such as "maximum" or "not exceed" appear before it.
  "within 24 hours" is a maximum. A response promising "within 48 hours" therefore passes the
  check, and a better promise such as "within 12 hours" would be marked a conflict. Cause:
  deterministic validation. Found by code review, to be confirmed by the live runs (A15, A16).
- **F0-3 Offline perfect-reviewer test.** The answer key's own verdicts and quotes were passed
  through the real pipeline. The code checks changed none of the 38 verdicts, and all 4
  two-sided contradictions keep both quotes.

## Found by the live runs (Sonnet 5.5 via OpenRouter, preview `dpl_GEejFxErGSqLXJ6FZp29PGs4pXSF`, commit 18f2661)

Submission Check: 3 runs × 38 requirements = 114 verdicts (raw records in `runs/sc-run*.json`).

| # | Requirement | Runs | Expected → got | Root cause | Fix |
|---|---|---|---|---|---|
| F1 | A31 six locations | run 3 | answered → **missing** (AI said answered) | **Deterministic validation.** The echo check marked the quote "Street ANPR camera, the Market Square, … Anstey Park." as a copy of the requirement, because it shares words and has no "we/our". The commitment ("Our proposal covers…") sat just before the quote. This is a false alarm caused by code. | Echo now means a *literal copy*: one unbroken run of the requirement's words covering at least 70% of the quote (minimum 6 words). Regression test added. |
| F2 | A34 price for 3 years | run 3 | conflict → **missing** (AI said partial) | **Deterministic validation**, same echo flaw ("It covers the initial installation and annual maintenance for Years 1 and 2."). | Same fix. |
| F3 | A30 working at height | runs 1–3 | answered → answered, with a bogus flag "confirm eight certificates" | **Deterministic validation.** Number words were matched inside other words: h-**eight**, at-**ten**-d, some-**one**. With a different response this could have produced a wrong "partial". | Number words must be whole words. Regression test added. |
| F4 | (latent) A15/A16 | n/a | n/a | **Deterministic validation** (F0-2 confirmed offline). "within 24 hours" was treated as a minimum, so a *faster* promise (12 h) was a conflict, and 72 hours could not be compared with three days. | "within" counts as a maximum, the nearest min/max word wins, and hours/days/weeks and months/years are compared in a common unit. Regression tests added. |
| F5 | A35 references (one outside 12 months) | runs 1–3 | conflict → partial | **Prompting.** The prompt's "partial" examples ("fewer items than required") steer an out-of-window reference to partial. Still flagged as an issue every time. | Prompt now says a *stated* value, date, period, exclusion, deferral, extra charge or self-contradiction is a conflict even if other parts comply; partial means part is covered and the rest is not mentioned. |
| F6 | A34 price for 3 years | runs 1, 3 (AI) | conflict → partial | **Prompting**, same as F5 (an explicitly deferred Year 3). | Same prompt fix. |
| F7 | A03 Council compound | run 2 | missing → partial | **AI reasoning.** The general claim "covers … Anstey Park" was treated as partial evidence for a specific new location. Still flagged as an issue. | Not fixed (1 of 3 runs, no missed issue). Watch it in the re-runs. |
| F8 | Self-contradictions (A11, A12, A17, A29) | all runs | n/a | **Prompting.** Both sides of a contradiction were quoted in only 1/4, 3/4 and 3/4 cases (the gap text usually mentions the other side). | Prompt now asks for 1–3 quotes, including both statements when the response contradicts itself. |

Summary before fixes: AI-only verdicts were 108/114 exact, 114/114 issue agreement, **0 missed issues and 0 false alarms**. After the code checks: 107/114 exact and **1 false alarm, created by the code** (F1). Across the 3 live runs the code checks changed 2 verdicts, and both changes were wrong.

Tender Intelligence: 3 runs (`runs/ti-run*.json`).

| # | Finding | Root cause | Action |
|---|---|---|---|
| T1 | Compound tender sentences are merged into one requirement: new camera locations (A01–A03), monitor + evaluate (A14/A15), storage + viewing (A17/A18), public + professional insurance (A24/A25), trees folded into the system review (A06/A07). | **Prompting** (requirements pass). | Recommend only. Splitting changes the existing compliance matrix in production, so it needs your decision. It matters for chained Submission Check, where one merged verdict covers two obligations. |
| T2 | "The locations covered by this contract" (A31) is not extracted as a requirement (it appears in the summary). "Supply time" (A37) appears only under evaluation criteria. | **AI extraction choice.** | Not fixed; minor. |
| T3 | 1 of 39 page citations was wrong in run 2 (HERS; quote on p.4, AI cited another page). The code relocated it to the right page. | **AI reasoning**; caught by deterministic validation. | Working as designed. |
| T4 | The fixed 20-item disqualification checklist is GCC-specific: on this UK tender only 2 items apply. The dynamic findings (13–15, all verified) carried the analysis. | **Product scope.** | Matches the plan for regional editions later. |
| T5 | The page-4 extraction gap (F0-1) was handled: the AI took the full deadline from p.7. | n/a | n/a |

## Found by the chained run (TI run 3 requirements → Submission Check, `runs/sc-chained-pre.json`)

| # | Finding | Root cause | Fix |
|---|---|---|---|
| C1 | 8 of the 39 extracted requirements are submission instructions or conduct rules (deadline, sealed pack, e-mail subject, postal address, no lobbying, "submit a compliant tender", scoring guidance, recommended site visit). Submission Check reported them as missing or partial. In the real chained workflow that is about 1 in 5 flags as noise. | **Prompting / product design.** Submission Check had no status for "a response document cannot evidence this". | New status `manual` ("check this yourself"). The prompt restricts it to process and conduct items and forbids it for anything the response can state, sign, attach, price or commit to. It is never counted as answered: the scorer treats it as flagged, and as a false alarm on a real, answered requirement. Regression test added. |
| C2 | Merged requirements (T1) get one verdict. The verdict was correct for the merged requirement (e.g. insurance R20 = conflict because professional indemnity is £5m), but scoring against the 38 atomic items counts the good half as a false alarm. | **Measurement artefact**, plus TI granularity (T1). | Chained runs are now scored per extracted requirement (`runs/ti-run3.expected.json`, derived mechanically from the answer key). Splitting compound requirements in TI is left as a recommendation. |
| C3 | HERS "certificates for the remaining four engineers will follow on award" was rated conflict (key: partial). | **Prompting side effect.** The new conflict rule lists "deferred"; the given-requirements runs still said partial 3/3. | Not changed; it is flagged either way. Watch it. |
| C4 | **Regression caused by C1:** on the ECTA test, Q04 (supplier registered on the e-procurement portal) was marked `manual` although the response evidences it in an annex table. It was a false alarm (1/6) and the correct "answered" was lost. | **Prompting.** The first `manual` wording let the model use it for an item the response *does* address. | `manual` now requires both conditions: a process or conduct instruction **and** silence in the response ("if the response mentions the item at all, judge it"). Registrations were added to the never-manual list. Re-tested below. |

**Re-test of C4 on the final build (`f33c7bd`):** ECTA 16/18 and 18/18. "Check manually" was not misused. In one run Q04 was rated partial instead, because the response did not state the closing date (AI reasoning), and Q07 was rated conflict instead of partial (severity). Alton given-requirements: 35/38, with 0 uses of "check manually" on real requirements. Chained: 36/39, 5/8 process items shown as "check manually".

## Status at the end of this round

| Area | Fixed | Open |
|---|---|---|
| Code checks | F1–F4 (echo, whole-word numbers, "within", unit conversion) | Deviation-word flag is noisy ("not blocked by trees"); tune in the UI phase |
| Prompt | F6 (Year-3 deferral now conflict 5/5), F8 (both quotes 20/20), C1/C4 ("check manually") | F5: A35 still partial in 4/5 runs. Severity varies on about 5% of verdicts |
| AI reasoning | n/a | A03 and A19 rated partial instead of missing (always flagged) |
| Tender Intelligence | n/a | T1: split compound requirements (needs approval; changes the production matrix). T4: GCC-only fixed checklist |

Full metrics and the recommendation are in `BENCHMARK_REPORT.md`.
