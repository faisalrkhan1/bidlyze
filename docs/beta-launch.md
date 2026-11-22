# Submission Check: controlled beta launch pack

Updated 22 Nov 2026 after the final release-safety review.

**Status:** built and tested on the preview branch `feat/submission-check-beta` (latest commit `75e0f65`, preview deployment `dpl_JB3M1MEP519U8gNYKDiF6S9tap8g`, READY). **Nothing is merged or deployed to production. The migration has not been run. No production setting, database record or secret was changed.** Each production step below needs Faisal's approval.

- Preview: https://bidlyze-app-git-feat-sub-6ca6f0-faisalremaan-gmailcoms-projects.vercel.app (Vercel sign-in required)
- Production now (rollback target): `dpl_AoWgzYJW64ZpTyroq9p9k3hrq8Wn` (main at `68f2979`)

## 0. Go / No-Go

**Decision: GO for an invited beta of 5 testers, once the four blockers below are cleared. NO-GO for a public beta.**

| # | Blocker | Who | How long |
|---|---|---|---|
| B1 | **support@bidlyze.com cannot receive mail.** bidlyze.com has no MX record (checked 22 Nov). Every "Request beta access" and "Support" link goes there. | Faisal | 15 min, section 6A |
| B2 | **Testers cannot get the Supabase confirmation e-mail** unless custom SMTP is set up. Supabase's built-in sender only delivers to members of your Supabase team. Workaround: create each tester's account yourself. | Faisal | 2 min per tester, section 6B |
| B3 | **Your own signed-in click-through on the preview.** I cannot sign in for you, so the signed-in journey was proven on a production build of the same code with simulated accounts, not on the preview itself. | Faisal | 10 min, about $0.25, section 6C |
| B4 | **Approvals:** run the migration, set `SUBMISSION_CHECK_BETA=on` in production, merge. | Faisal | section 2 |
| B5 | **Password reset is broken in production** until this branch is merged (fixed on the preview, commit `4b6f2c0`). Add the reset addresses to Supabase's Redirect URLs (Step 3b). | Faisal | 3 min |

Not blocking, but do before or during the beta: see section 8.

## 1. What changes for users when it is switched on
- **The app becomes one product:** Home, New check, History, Account.
  - Tender Intelligence pages still work at their addresses, and older analyses open from History.
  - They are no longer in the menu.
- **New check:** add the tender, add one or more proposal files, run, review, export.
- **Public pages describe the closed beta:** the landing page, the login page, and Pricing, which becomes "Beta access" with no prices or payment buttons.
- **Who may run checks:** invited e-mails only. Anyone signed in can open the sample check for free.
- **Existing users (about 30)** keep their data. They see the new menu; their old analyses are in History.

## 2. Deployment plan (in this order; each step needs your yes)

**Step 1: database migration (Supabase project "bidlyze").**
1. In Supabase, open the project, then **SQL Editor**, then **New query**.
2. Paste **PART A** of `docs/proposals/2026-11-22_preflight_postflight_READ_ONLY.sql` (everything from `── PART A` down to `── PART B`) and click **Run**. It only reads. Write down the three numbers (users, analyses, subscriptions). Every `..._must_be_...` column must show what its name says (`0` or `true`). If not, stop and send me the result.
3. New query. Paste the whole file `docs/proposals/2026-11-22_submission_check_beta_quota.sql` and click **Run**. Expect "Success. No rows returned".
4. New query. Paste **PART B** of the pre/post-flight file and click **Run**. The three numbers must equal the ones from PART A, and every `..._must_be_...` column must hold. If not, run the rollback block at the end of the migration file and send me the result.
5. Add yourself and the first tester (section 6B shows the exact SQL).

What the migration does:
- It adds 2 tables and 3 functions. It changes no existing table, row, policy or permission (proven in section 4.2).
- It runs in one transaction: if any line fails, nothing is kept.
- The preview shares this database. Once the migration is applied, the preview switches to the durable limits by itself; no redeploy is needed.

**Step 2: check it on the preview.** Sign in, open Account. It should show "Proposal checks 0 of 10" and "Tenders read 0 of 5".

**Step 3: Vercel production settings.** In Vercel, open the project **bidlyze-app**, then **Settings**, then **Environment Variables**. Click **Add New**, tick **Production** only:
- `SUBMISSION_CHECK_BETA` = `on` (required).
- `NEXT_PUBLIC_SUPPORT_EMAIL` = a mailbox that works, **only if** you choose option 2 in section 6A.
- No limit variables are needed: the recommended limits (section 5) are now the built-in defaults.
- Optional: `AI_PROVIDER_ONLY` = `anthropic` (section 8). Test it on the preview first.

**Step 3b: Supabase URL Configuration (password reset).** In Supabase, open **Authentication**, then **URL Configuration**.
- **Site URL:** leave it as it is (`https://app.bidlyze.com`, as Supabase's redirects show).
- **Redirect URLs:** click **Add URL** and add each of these exactly, then **Save**:
  - `https://bidlyze.com/reset-password`
  - `https://www.bidlyze.com/reset-password`
  - `https://app.bidlyze.com/reset-password`
  - for testing on the preview only (remove after the merge): `https://bidlyze-app-git-feat-sub-6ca6f0-faisalremaan-gmailcoms-projects.vercel.app/reset-password`
- In **Authentication**, then **Emails**, open the **Reset Password** template and check its link still uses `{{ .ConfirmationURL }}`. Do not change anything else there.

Why: the reset e-mail returns to `/reset-password` on the site where it was requested. An address that is not on this list is replaced by the Site URL. The new code copes with that too (it forwards the link to the reset page), but listing the addresses keeps people on the domain they started from.

**Step 4: merge.**
1. On GitHub, open a pull request from `feat/submission-check-beta` to `main`.
2. Click **Merge pull request**. Vercel deploys production by itself in about 3 minutes, using the Step 3 settings.

**Step 5: check production (10 minutes).**
1. bidlyze.com shows "Find the gaps in a proposal before the buyer does".
2. As an invited tester, open the sample check, then run a real check.
3. Account shows the usage.
4. A non-invited account sees "closed beta" when it tries a real check.
5. `bidlyze.com/api/selftest` returns 404.
6. In Vercel, **Logs** shows no new errors.
7. Password reset: on bidlyze.com/login, click **Forgot password?**, request a link, open the e-mail and set a new password. The "Set a new password" page must open (not the landing page).

Safe order: without Step 1, production refuses all paid checks (fail closed). Turning the beta on without the migration therefore cannot run up AI costs, but checks will not work.

## 3. Rollback plan
| Problem | What to do | Time |
|---|---|---|
| Anything wrong after the merge | In Vercel, open **Deployments**, find `dpl_AoWgzYJW64ZpTyroq9p9k3hrq8Wn` (main at 68f2979), open its **…** menu and choose **Promote to Production**. | 1 minute |
| Want the old interface but keep the code | Set `SUBMISSION_CHECK_BETA` = `off` in Production, then redeploy. | 5 minutes |
| Stop paid checks for everyone now | In Supabase SQL Editor: `update public.submission_check_beta_users set enabled = false;` | 1 minute |
| Remove the database change | Run the rollback block at the end of the migration file. It removes only the 2 new tables and 3 functions. Roll back the code first: the new code refuses paid checks without them. | 2 minutes |

Saved analyses are never changed or migrated. A rollback loses only the beta usage records.

## 4. Release-safety review results

### 4.1 Usage limits under concurrent use, including runs still in progress
**Problem found:** the daily cost cap (all accounts) and the monthly cap (per tester) counted only *finished* runs. Runs in progress cost $0 until they ended, so several testers starting at once could all pass the cap.

**Fix (in the migration and `lib/submission/quota.js`):**
- Every paid run books a **reservation** when it starts: a deliberately pessimistic cost estimate from the document size (at least 3 times the real costs we measured). Example: a 20,000-character tender reserves $0.75 (real: about $0.15); a 30,000-character proposal reserves $1.32 (real: about $0.09).
- Both caps count running runs at their reservation and finished runs at their real cost.
- All claims queue on one database lock, so two accounts can never both see the same "room left".
- A crashed run is released after 10 minutes but still counts its reservation, so a crash cannot reset the budget.
- Bad inputs are safe: no estimate is booked as $1; any value is kept between $0.05 and $20.

**Proof (Postgres 16, `tests/db/run_quota_tests.sh`, 45 checks, all pass):**
- 8 different accounts claimed at the same moment against $5 of daily room, each reserving $1: **exactly 5 allowed**, $5.00 in flight, cap never exceeded. The previous SQL allowed **8 of 8** in the same race.
- 8 simultaneous claims by one account: exactly 1 allowed.
- A $4 run in progress blocks a $2 run by someone else; once it finishes at $0.20, the second run is allowed.

### 4.2 The migration does not touch existing users or data
`tests/db/run_migration_safety.sh` builds a copy of the live schema (the real core migration plus the Supabase roles), adds 30 users and 50 analyses, then:
- runs the read-only PART A, the migration and PART B;
- takes **6 fingerprints** before and after: all existing rows, policies, row-level security switches, table permissions, functions and triggers. **Identical.** A control edit of one row changes the fingerprint, so the comparison is real;
- confirms existing app access still works (read own analyses, save edits, read plan, download own file);
- confirms a migration that fails half-way leaves nothing behind;
- migration time: 57 ms.

Limit: this is a faithful copy of the schema, not the live database (which I cannot reach). PART A and PART B are your check on the real one.

### 4.3 First-time journey
| What | Where verified | Result |
|---|---|---|
| Landing, login, pricing, privacy, terms; new wording | Live preview `75e0f65` | Pass |
| Signed-out requests refused (401), bad documents refused (422), `/api/selftest` | Live preview | Pass |
| Sign in, sample, tender plus 2 proposal files, run, review, reviewer notes and overrides, Excel export (file opened and checked), History, Account | 15 browser tests on a production build of the same commit, simulated accounts and AI | Pass |
| Errors: unsupported, old-format, archive, image and scanned files, more than 5 files, over-long proposal, AI failure, time-out, rate limit, allowance used up, lost connection, retry | Same browser tests plus 154 unit and API tests | Pass |
| Real AI run through the same server code | Live preview, earlier today ($0.24) | Pass (section 7) |
| **Signed-in click-through on the real preview** | **Not done: needs your sign-in** | Blocker B3 |

### 4.4 Landing page: no claim of complete coverage or guaranteed accuracy
Changed and verified on the live preview:
- Hero: "lists the requirements in a tender, checks the supplier's proposal against each one…" (no longer implies every requirement is found).
- Under the button: "An early beta: it can miss or misjudge a requirement, so your team reviews every finding."
- Step 1: "lists the requirements it finds… The list can miss items, so your team checks it."
- "Quotes checked in code": now says this proves the words are there; whether they meet the requirement is the team's judgement.
- Footer note: the requirement list can be incomplete and every finding needs a person to confirm it.
- The same caveat is on Home, the login page, the check results ("list-caveat") and the page title and description.

### 4.5 Privacy wording matches what the code sends
What actually happens:
1. Files are read in the browser. The files themselves are never uploaded; only their extracted page text is sent.
2. Text goes over HTTPS to Bidlyze's server (Vercel, United States).
3. The server sends it to OpenRouter, which passes it to Claude, served by Anthropic or by a cloud host of Claude (such as Amazon or Google).
4. Reading a tender sends the full tender text in 2 AI requests. A check sends the proposal text, the requirement list and short tender quotes in 1 to 4 requests.
5. Every request asks OpenRouter to use only providers that do not collect or train on data (`data_collection: "deny"`, checked by a test). Zero-data-retention routing is not switched on.
6. The proposal text and the results are not stored on Bidlyze's servers. The tender's requirement list is saved to the account and can be deleted from History.

The landing page, the login page, the in-app note, the privacy policy (sections 2.5 and 5) and the terms now say exactly this. Earlier wording that implied only Anthropic handles the text was corrected.

## 5. Recommended limits for the first 5 testers (now the built-in defaults)
| Limit | Value | Why |
|---|---|---|
| Proposal checks per tester per month | 10 | About 2 real bids a week; real cost about $0.09 each |
| Tenders read per tester per month | 5 | One tender usually serves several checks; real cost about $0.15 each |
| Runs per tester per hour | 4 | Two full checks an hour, with room for a retry |
| Runs at once per tester | 1 | Stops double clicks and scripts |
| Cost cap per tester per month | $5 | Actual use at the limits above is about $1.65 |
| Cost cap for all accounts per day | $8 | Even if every tester misbehaves, one day costs at most $8 |
| Beta access ends | 31 Jan 2027 (set per tester) | Forces a review of the beta and pricing |

Worst case for the month: 6 accounts (5 testers plus you) x $5 = **$30**. Expected: about **$10**.

A tester near their $5 cap may be refused a very large check, because the reservation is pessimistic. To give one tester more room:
```sql
update public.submission_check_beta_users set cost_cap_usd_per_month = 10 where email = 'tester@company.com';
```

## 6. Manual checklists

### 6A. Support e-mail (blocker B1), 15 minutes
Choose one:

**Option 1 (recommended): forward support@bidlyze.com to your own inbox.** A forwarding service with a free plan, such as ImprovMX, works with Vercel DNS. Check its current free plan before signing up; do not choose a paid plan.
1. Sign up at the forwarding service and add the domain `bidlyze.com`. Create the alias `support` forwarding to your own e-mail.
2. In Vercel, open **Domains** (team level), click **bidlyze.com**, then **DNS Records**, and add:
   | Type | Name | Value | Priority |
   |---|---|---|---|
   | MX | (leave empty) | `mx1.improvmx.com` | 10 |
   | MX | (leave empty) | `mx2.improvmx.com` | 20 |
   | TXT | (leave empty) | `v=spf1 include:spf.improvmx.com ~all` | |
   Use the exact values the service shows you if they differ.
3. Wait until the service says the domain is verified (often minutes, up to 24 hours).
4. No code change or redeploy is needed.

**Option 2: use a mailbox you already have.** In Vercel, add `NEXT_PUBLIC_SUPPORT_EMAIL` = your address for **Production** (and **Preview** if you want to test it). It is read at build time, so redeploy afterwards. The landing page, Account, Pricing, Privacy and Terms all switch to it. Prospects will see this address.

**Then test it (either option):**
1. From a different e-mail account (for example your phone's), send "Test" to the support address. It must arrive within a few minutes. Check spam.
2. On the preview, click **Request beta access**. Your mail app must open with the subject "Submission Check beta access" and the address above.
3. Click **Support** in the page footer, and the address in Account and in Privacy. Each must open a mail to the same address.
4. Reply to the test e-mail, so you know how replies will look to a prospect (they will come from your own address).

### 6B. Onboarding the first tester (after Steps 1 to 4 are approved and done)
1. **Check the Supabase e-mail setting.** In Supabase, open **Authentication**, then **Sign In / Providers**, then **Email**. "Confirm email" must be **on**. If it is off, anyone could sign up with a tester's address and use their allowance: switch it on.
2. **Add the tester to the beta list.** SQL Editor, new query:
   ```sql
   insert into public.submission_check_beta_users (email, note, expires_at) values
     ('tester@company.com', 'Prospect 1 - Company name', '2027-02-01')
   on conflict (email) do update set enabled = true, expires_at = excluded.expires_at;
   ```
   Use their exact work e-mail in lower case. `2027-02-01` means access ends when 31 January is over. Add yourself the same way (note 'Owner').
3. **Create their account** (because of blocker B2). In Supabase, open **Authentication**, then **Users**, then **Add user**, then **Create new user**. Enter their e-mail and a temporary password, tick **Auto Confirm User**, click **Create user**.
   - Send the password by a different channel from the invitation (for example WhatsApp or a call), never in the same e-mail.
   - If you later set up custom SMTP for Supabase, testers can sign up themselves instead.
4. **Send the invitation** from your mailbox: the link `https://bidlyze.com/login`, their e-mail, and three lines:
   - use public or non-confidential documents only during the beta;
   - every finding needs their own review; it can miss or misjudge a requirement;
   - results and review notes are kept in the browser they use, so export the Excel report to keep it.
5. **First session (ideally on a call, 20 minutes):** they sign in, open the sample check, then run one real check with a tender under about 60 pages, review two findings, add one reviewer note, export.
6. **After the session:** in Supabase SQL Editor, check what it cost:
   ```sql
   select kind, status, ai_cost_usd, reserved_usd, started_at from public.submission_check_runs order by started_at desc limit 10;
   ```
   Their Account page should show the same counts.
7. **Collect feedback within 48 hours:** Would they use it on a live bid next month? Who in their team would run it? What would they pay, per check or per month? Which finding did they not trust, and why?
8. **To remove a tester:** `update public.submission_check_beta_users set enabled = false where email = 'tester@company.com';`

### 6C. Your own click-through on the preview (blocker B3), 10 minutes, about $0.25
Before the migration, the preview uses temporary limits per server. It shares the production database, so the tender you read is saved to your real account (delete it from History afterwards if you like).
1. Open the preview link, sign in to Vercel if asked, then sign in to Bidlyze.
2. **New check.** Add a public tender PDF. Add **two** proposal files (for example a PDF and a DOCX).
3. Try adding a `.doc`, `.zip` or photo: it must be refused with a clear reason.
4. Run. It should finish in about 2 to 3 minutes.
5. Open one finding: both quotes and their pages must be shown. Agree with one finding, override another, add a reviewer note.
6. Export. Open the Excel file: your override and note must be in it.
7. Open History: the tender is there. Open Account: your e-mail and usage are shown.
8. Reload the results page: your notes must still be there.
Send me any step that fails, with a screenshot.

## 7. Evidence from earlier rounds (unchanged code paths)
**Dependencies:** `npm audit` went from 17 advisories (2 critical: jsPDF, Next.js) to 0. SheetJS `xlsx` was replaced by exceljs.

**Durable limits:** every paid AI run is claimed in the database before the AI is called and finished afterwards with its real cost; a repeated request id never becomes a second run; production refuses every paid run if the limits cannot be checked (missing migration, database down, no service key).

**Beta access:** in production, only e-mails in `submission_check_beta_users` (or in `SUBMISSION_CHECK_ALLOWED_EMAILS`) can run paid checks.

**Documents:** up to 5 files per side, 50 MB each: PDF, DOCX, XLSX, TXT. Old formats, archives, images and e-mails are refused with what to do instead. Scanned pages are flagged. A limit of 600,000 characters (about 250 pages) per side.

**Live run on the preview (22 Nov, public Alton Town Council tender plus a fictional supplier proposal):** 37 requirements listed, all tender quotes verified; 36 checked; all 19 planted problems flagged; reading 58 s and $0.15, checking 46 s and $0.09.

**Tests now:** 154 unit and API tests (`npm test`), 15 browser tests (`npm run test:ui`), 45 quota database checks, 8 migration-safety checks.

**AI spend:** about $0.72 of the $5 allowance in total. This review round used none.

## 8. Not blocking, but plan for them
1. **Legal review** of the privacy policy and terms. They match how the code behaves, but they are not legal advice.
2. **OpenRouter account:** in OpenRouter's settings, confirm that prompt logging and any training opt-ins are off. Consider `AI_PROVIDER_ONLY=anthropic` so requests go only to Anthropic.
3. **Accuracy is not independently validated.** The benchmark proposal and its answer key were written by Claude. Tell prospects "early beta, every finding needs review". Make no accuracy claims.
4. **Long tenders:** a 100+ page tender has not been timed; Vercel stops a request at 300 s. Ask for tenders under about 60 pages in the first demos.
5. **Results live in one browser.** A tester who changes laptop loses review notes unless they exported the report.
6. **Existing 30 users** see the new menu. Tell any who use Tender Intelligence that their analyses are in History.
7. **No transactional e-mails** (RESEND_API_KEY is missing). Not needed for an invited beta.

## 9. The five prospect demos
- **Public documents only** (for example the Alton Town Council ITT, UK Contracts Finder, Dubai eSupply public notices). No Tatweer or customer documents.
- **Before each demo:** add the prospect (section 6B) and run the check once yourself on the documents you will show.
- **Show:** New check; a finding with both quotes and the page viewer; an override; the Excel export; History; the privacy note.
- **Learn:** would they use it on a live bid next month, who would run it, what would they pay, and what stopped them trusting a finding.
