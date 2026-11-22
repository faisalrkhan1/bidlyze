# Submission Check: controlled beta launch pack (22 Nov 2026)

Status: built and tested on the preview branch `feat/submission-check-beta`. **Nothing is merged, deployed to production, or changed in the production database or settings.** Each production step below needs Faisal's approval.

- Preview: https://bidlyze-app-git-feat-sub-6ca6f0-faisalremaan-gmailcoms-projects.vercel.app (Vercel sign-in required)
- Current production deployment (rollback target): `dpl_AoWgzYJW64ZpTyroq9p9k3hrq8Wn` (main at `68f2979`)
- The branch contains main, so the merge is clean (17 commits ahead).

## 1. What changes for users when it is switched on
- **The app becomes one product:** Home, New check, History, Account.
  - Tender Intelligence pages still work at their addresses, and older analyses open from History.
  - They are no longer in the menu.
- **New check:**
  1. Add the tender (read in the browser; its requirements are read when the check runs).
  2. Add one or more proposal files.
  3. Run.
  4. Review.
  5. Export.
- **Public pages describe the closed beta:**
  - the landing page;
  - the login page;
  - Pricing becomes "Beta access", with no prices or payment buttons.
- **Who may run checks:** invited e-mails only.
  - Anyone signed in can try the sample tender for free.
  - Existing users (about 30) keep their data. They see the new menu; their old analyses are in History.

## 2. Deployment plan (in this order)
Each step is separate and needs a yes from Faisal.

**Step 1: database migration (Supabase project "bidlyze").**
1. In Supabase, open the project, then SQL Editor, then New query.
2. Paste the whole file `docs/proposals/2026-11-22_submission_check_beta_quota.sql` and click Run. It should finish with "Success. No rows returned".
3. Check it worked:
   ```sql
   select count(*) from public.submission_check_runs;
   ```
   The answer must be `0`.
4. Add the invited testers, one line each:
   ```sql
   insert into public.submission_check_beta_users (email, note) values
     ('faisal@your-email.com', 'Owner'),
     ('prospect1@company.com', 'Prospect 1')
   on conflict (email) do update set enabled = true;
   ```

What the migration does:
- It adds 2 tables and 3 functions. It changes no existing table or row.
- The preview shares this database. Once the migration is applied, the preview switches to the durable limits by itself; no redeploy is needed.

**Step 2: check it on the preview.**
1. Sign in on the preview.
2. Account should show "This month's usage: 0 of 30".
3. Run one check with your own non-confidential documents.
4. Account should then show the check counted.

**Step 3: Vercel production settings.** In Vercel, open the project, then Settings, then Environment Variables, and add for Production only:
- `SUBMISSION_CHECK_BETA` = `on` (required).
- Optional: `AI_PROVIDER_ONLY` = `anthropic`. This sends AI requests only to Anthropic, which makes the privacy policy precise. Test it on the preview first.
- Optional limits. These are the defaults:
  - `SUBMISSION_CHECK_CHECKS_PER_MONTH` = 30
  - `SUBMISSION_CHECK_TENDERS_PER_MONTH` = 15
  - `SUBMISSION_CHECK_COST_CAP_USD_PER_MONTH` = 10
  - `SUBMISSION_CHECK_GLOBAL_COST_CAP_USD_PER_DAY` = 15

**Step 4: merge.**
1. On GitHub, open a pull request from `feat/submission-check-beta` to `main`.
2. Review it, then click "Merge pull request".
3. Vercel deploys production by itself in about 3 minutes.

**Step 5: check production (10 minutes).**
1. bidlyze.com shows "Find the gaps in a proposal before the buyer does".
2. As an invited tester, run the sample tender, then a real check.
3. Account shows the usage.
4. A non-invited account sees "closed beta" when it tries a real check.
5. `bidlyze.com/api/selftest` returns 404.
6. Vercel shows no new runtime errors.

Safe order: without Step 1, production refuses all paid checks (by design; see section 4). Turning it on without the migration therefore cannot run up AI costs, but checks will not work.

## 3. Rollback plan
| Problem | What to do | Time |
|---|---|---|
| Anything wrong after the merge | In Vercel, open Deployments and find `dpl_AoWgzYJW64ZpTyroq9p9k3hrq8Wn` (main at 68f2979). From its "…" menu, choose "Promote to Production". | 1 minute, instant |
| Want the old interface but keep the code | Set `SUBMISSION_CHECK_BETA` = `off` in Production, then redeploy. | 5 minutes |
| Stop paid checks for everyone right now | In Supabase, run `update public.submission_check_beta_users set enabled = false;`. Unless the e-mails are also in `SUBMISSION_CHECK_ALLOWED_EMAILS`, nobody can start a paid run. | 1 minute |
| Remove the database change | Run the rollback block at the end of the migration file. It removes only the 2 new tables and 3 functions. Do this only after rolling back the code: the new code refuses paid checks without them. | 2 minutes |

Saved analyses are never changed or migrated. A rollback loses only the beta usage records.

## 4. Security and cost protection (evidence)
**Dependencies** (`npm audit`):
- Before: 17 advisories, 2 of them critical (jsPDF, Next.js). After: 0.
- jsPDF went to 4.2.1, Next.js to 16.4.6 and resend to 6.39.0, and uuid is pinned to 11.1.1 (the version exceljs uses).
- SheetJS `xlsx` has no fixed npm release. It parsed uploaded spreadsheets on the server, so it was replaced by exceljs for both reading and export (`tests/security/xlsx.test.mjs`).

**Durable limits** (`lib/submission/quota.js` and the migration):
- Every paid AI run is claimed in the database before the AI is called, and finished afterwards with its real cost.
- The same request id is never a second run.
- One run at a time per account; 6 runs an hour; 30 checks and 15 tender readings a month per tester; a $10 a month cost cap per tester; a $15 a day cap across all accounts.
- Database tests on Postgres 16 (`tests/db/run_quota_tests.sh`) cover:
  - 34 behaviour checks;
  - 8 simultaneous claims for one account, of which exactly 1 is allowed;
  - users unable to read the beta list, write runs or call the functions;
  - the migration running twice safely;
  - rollback.

**Fail closed:** production refuses every paid run if the limits cannot be checked: the migration is missing, the database is down, or there is no service key. Tested in `tests/submission/beta_api.test.mjs`.

**Beta access:** in production, only e-mails in `submission_check_beta_users`, or in the `SUBMISSION_CHECK_ALLOWED_EMAILS` variable, can run paid checks. Free sign-ups cannot.

**Duplicates, retries and errors:**
- A double click cannot start two runs.
- After a lost connection, the tender request is resent with the same id. If the server had already finished, it returns the saved tender rather than reading it again.
- AI calls have a time limit (270 s), are not retried on errors a retry cannot fix (bad key, no credit, request too large), and record the cost even when they fail.
- A tender whose requirement list failed is never saved half-done.

**Documents:**
- Up to 5 files per side, 50 MB each: PDF, DOCX, XLSX, TXT.
- .doc, .xls, .pptx, .zip, images and e-mails are refused, with what to do instead.
- Scanned files with no text are refused; files with some scanned pages are flagged page by page.
- A limit of 600,000 characters (about 250 pages) per side replaces the old behaviour of silently skipping pages.

**Privacy:**
- Files are read in the browser. Only page text is sent.
- The proposal text and the results are never stored on the server.
- The tender's requirement list is saved to the account, and can be deleted from History.
- The privacy policy (section 2.5 and section 5) and the terms (section 8A) say this.
- Not changed by this work: preview deployments are behind Vercel Authentication; `/api/selftest` and the recording endpoint return 404 in production.

## 5. Test results
**Automated:**
- 150 unit and API tests: `npm test`.
- 15 browser tests: `npm run test:ui` (first-time workflow and failure cases), plus the database tests.

Successful checks covered:
- the full first-time flow: tender, two proposal files, run, review, export, History;
- the sample tender;
- older analyses;
- multi-file proposals;
- restore after reload;
- desktop, tablet (820 px) and mobile (390 px);
- light and dark.

Failures covered:
- tender reading failure, then retry;
- lost connection (same request id reused);
- check refused after the tender was read (retry runs only the check);
- unsupported, old-format, archive and image files;
- scanned PDFs;
- an over-long proposal;
- more than 5 files;
- AI failure, time-out, rate limit and monthly allowance;
- storage full;
- signed-out requests;
- another user's tender;
- production with no usage limits available.

**Live, on the preview (22 Nov):** public Alton Town Council tender plus the fictional supplier proposal, through the same code as New check, with nothing saved.

Reading the tender:
- 37 requirements, all 37 tender quotes verified on their page;
- 34 of the 38 answer-key requirements listed separately;
- key dates 5/5;
- 58 s, $0.15.

Checking the proposal:
- 36 requirements checked: 18 need attention, 6 to check manually, 12 OK;
- 35/35 proposal quotes and 36/36 tender quotes found word for word;
- 46 s, $0.09.

Against the answer key:
- **All 19 planted problems were flagged.** Five of them appear under a neighbouring requirement, because the tender reading merged two requirements into one (for example, tree growth is reported with the site review).
- The finer status agreement is 28/38 in this full flow, against 36–37/39 when checking the answer key's own requirement list. The gap is mostly merging and grouping, not missed problems.
- The first live run's answer was lost to a fetch time-out after it had finished. The cost was spent all the same.

**AI spend this round:** about $0.49 (two live runs). Total spend against the $5 allowance: about $0.72.

## 6. Unresolved launch blockers (need Faisal)
1. **Approvals:** run the migration, set `SUBMISSION_CHECK_BETA=on` in production, and merge (section 2).
2. **support@bidlyze.com must receive mail.** Every "Request beta access" and "Contact support" link uses it. Check it with a test e-mail.
3. **Legal review:** the privacy policy and terms were updated to match how the code behaves, but they are not legal advice. A short review by a lawyer is advisable before strangers rely on them.
4. **OpenRouter account setting:** confirm in OpenRouter's settings that "prompt logging" and "training" opt-ins are off. The code asks only for providers that do not collect data, but the account setting cannot be seen from here. Consider `AI_PROVIDER_ONLY=anthropic`.
5. **Accuracy is not independently validated.** The only benchmark tender is public, but the proposal and its answer key were written by Claude. Say "early beta, every finding needs review" to prospects. Make no accuracy claims.
6. **Long tenders:** reading takes about 60 s for 7 pages. A 100+ page tender has not been timed; Vercel stops a request at 300 s. Ask prospects for tenders under about 60 pages for the first demos, or test one long public tender first.
7. **Transactional e-mails** still use the old green, and RESEND_API_KEY is missing, so no e-mails are sent at all. Not needed for an invited beta.
8. **Results live in one browser.** A tester who changes laptop loses their review notes unless they exported the report. Say so when onboarding.
9. **Existing users** see the new menu when it is switched on. If any of the 30 existing accounts rely on Tender Intelligence, tell them it is still available from History.

## 7. Preparing the five prospect demos
- **Use public documents only:** for example the Alton Town Council ITT (public), or tenders from public portals (UK Contracts Finder, Dubai eSupply public notices). Do not use Tatweer or customer documents.
- **Before each demo:**
  - add the prospect's e-mail to `submission_check_beta_users`;
  - run the check once yourself on the documents you will show.
- **What to show:**
  1. New check.
  2. A finding with both quotes and the page viewer.
  3. Override one finding.
  4. Export, and open the Excel file.
  5. History.
  6. The privacy note.
- **What to learn:**
  - Would they use it on a live bid next month?
  - Who in their team would run it?
  - What would they pay per check or per month?
  - What stopped them trusting a finding?
