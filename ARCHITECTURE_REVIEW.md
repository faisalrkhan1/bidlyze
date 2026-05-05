# Bidlyze — Architecture Review

**Date prepared:** 2026-04-26
**Reviewer:** Claude (Opus 4.7, 1M context)
**Branch reviewed:** `feature/bid-readiness`
**Scope:** Full codebase audit for stability and readiness to add 6 planned features.

> **How to read this document.** It's split into 5 parts as you requested. Each part stands on its own — you can skim Part 1, focus on Part 4 (Recommendations) for action, and use Part 2 and Part 3 as reference when you actually start changing things. Where I use coding terms, I explain them in plain language with an analogy.

---

## A note on three things I observed that don't match your description

Before the review, three discrepancies between **what you said** and **what the code does** are worth flagging up-front, because a few of my findings depend on which one is true:

| You said | Code says | Why it matters |
| --- | --- | --- |
| Payments via **Paddle** | Code uses **Stripe** (`lib/stripe.js`, `app/api/stripe/checkout/route.js`, `app/api/stripe/webhook/route.js`) | Your legal pages (`app/privacy/page.js`, `app/terms/page.js`, `app/refund-policy/page.js`) all reference Paddle as merchant of record. Customers will see Stripe charges on their statements. This is a compliance / customer-trust risk, not just a code mismatch. |
| AI is **claude-sonnet-4** via OpenRouter | Code is hard-coded to `openai/gpt-5.4` (`lib/gemini.js:9`) | If you've already switched in OpenRouter dashboard to Claude, the code line is misleading but harmless. If you intend to *use* Claude, the model string is wrong. |
| (Filename) `lib/gemini.js` | Actually calls OpenRouter (Gemini SDK is gone) | Documented in the file header. Cosmetic, but confusing for any future contributor. |

I'll proceed assuming **Stripe is the real payment system** (because that's what works) and that **the AI provider is whatever OpenRouter routes to** — but you should resolve the Paddle/Stripe contradiction urgently as a separate task.

---

# PART 1 — Current State Audit

## 1.1 Folder Structure

Think of your project as a building. Here's the floor plan:

```
D:\Bidlyze\
├── app/                    ← The "front of house" — all pages and API routes
│   ├── api/                ← Server endpoints (the kitchen — does the work)
│   ├── components/         ← Reusable UI parts (chairs, tables, decor)
│   ├── utils/              ← UI-side helpers (PDF/Excel export)
│   └── (page folders)      ← Each user-visible URL = one folder
├── lib/                    ← Shared backend logic (the staff break room)
├── public/                 ← Static files (logos, icons, robots.txt)
├── supabase/migrations/    ← Database schema changes over time
├── images/                 ← Untracked working images
├── .claude/                ← Claude Code settings (untracked)
├── .next/                  ← Next.js build output (auto-generated)
├── node_modules/           ← Installed packages (auto-generated)
└── (config files)          ← package.json, tsconfig, eslint, etc.
```

### What each major directory does

| Directory | Purpose | Health |
| --- | --- | --- |
| `app/api/` | Server endpoints — the only code that talks to OpenRouter, Stripe, and Resend | Mostly healthy, but auth code is duplicated 7 times |
| `app/components/` | Reusable React components — buttons, cards, complex widgets like ComplianceMatrix | Mixed: some components do their own database calls (bad), some are pure UI (good) |
| `app/(pages)/` | One folder per URL. Each `page.js` is the entry point | Two pages are too big: `analysis/[id]/page.js` (1,215 lines) and `bid-compare/[id]/page.js` (~360 lines) |
| `lib/` | Shared logic: Supabase client, Stripe client, AI prompts, plan config, email templates | Healthy as a concept, but `lib/gemini.js` is a "god file" doing 5 jobs at once |
| `app/utils/` | Browser-side export utilities (PDF, Excel) | Small, focused, healthy |
| `supabase/migrations/` | Database schema changes — there is **only one migration file** here | **Major risk:** the `analyses` and `subscriptions` tables exist in production but their schema is **not** in version control. If you ever need to reset or recreate the DB, you'd have to reverse-engineer it from code |

---

## 1.2 API Routes — what each one does

All routes live under `app/api/`. Think of these as the back-of-house counter where the website hands work to a server.

| Route | File | Purpose | Auth | External calls |
| --- | --- | --- | --- | --- |
| `POST /api/analyze` | `app/api/analyze/route.js` | Upload single tender → extract text → AI analysis → save to DB → email user | Bearer JWT | OpenRouter, Supabase, Resend |
| `POST /api/workspace` | `app/api/workspace/route.js` | Multi-doc Tender Package upload → combined AI analysis | Bearer JWT | OpenRouter, Supabase |
| `POST /api/bid-compare` | `app/api/bid-compare/route.js` | Multi-doc bid comparison → AI matrix → save | Bearer JWT | OpenRouter, Supabase |
| `POST /api/compare` | `app/api/compare/route.js` | Two-doc amendment intelligence → AI diff | Bearer JWT | OpenRouter, Supabase |
| `POST /api/generate-proposal` | `app/api/generate-proposal/route.js` | Generate one of 6 proposal sections from an analysis | Bearer JWT | OpenRouter, Supabase |
| `POST /api/welcome` | `app/api/welcome/route.js` | Send welcome email on first dashboard visit | Bearer JWT | Resend |
| `POST /api/notify` | `app/api/notify/route.js` | Internal email-sending endpoint (used by other backend code) | Shared secret `INTERNAL_API_KEY` | Resend |
| `POST /api/stripe/checkout` | `app/api/stripe/checkout/route.js` | Create Stripe checkout session for upgrade | Bearer JWT | Stripe, Supabase |
| `POST /api/stripe/webhook` | `app/api/stripe/webhook/route.js` | Receive Stripe events, update subscription | Stripe signature | Stripe, Supabase (admin) |

**Pattern observation:** Three of these routes (`analyze`, `workspace`, `bid-compare`) do nearly identical work — extract files, build a prompt, call OpenRouter, parse JSON, save row — but they're written from scratch each time. See Part 2.6 (Duplicated Logic).

---

## 1.3 Database Tables

Only **one** migration file exists in `supabase/migrations/`:

- `20260420000000_bid_readiness.sql` — adds `analyses.compliance_weighting` column and creates the `bid_readiness_stages` table.

**The other tables exist in your live Supabase project but are not in version control.** I reconstructed their schemas by reading every `.from(...).select(...)` and `.from(...).insert(...)` call across the codebase:

### `analyses` (the main "everything" table)

| Column | Inferred type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `user_id` | UUID → auth.users | RLS-restricted |
| `file_name` | TEXT | Original upload filename (or "N submissions") |
| `file_path` | TEXT | Path in Supabase storage bucket `tenders/` |
| `project_name` | TEXT | Pulled from AI analysis or user input |
| `bid_score` | NUMERIC | AI-computed 0-100 |
| `analysis_data` | JSONB | **The entire AI output** — see warning below |
| `proposals` | JSONB | Generated proposal sections, keyed by section type |
| `notes` | TEXT | User's internal notes |
| `requirement_statuses` | JSONB | Per-requirement edits (status, owner, due date, notes) |
| `workflow_actions` | JSONB | Action items (id, title, owner, due, status…) |
| `workflow_decision` | JSONB | Bid/no-bid decision + approval status |
| `workflow_comments` | JSONB | Internal review thread |
| `audit_trail` | JSONB | Event log (last 100 events, trimmed client-side) |
| `compliance_edits` | JSONB | User edits to the AI-generated compliance matrix |
| `tender_status` | TEXT | Pipeline stage (analyzed/in_progress/submitted/won/lost/dropped/archived) |
| `compliance_weighting` | TEXT | NEW (this branch) — `equal | mandatory_only | weighted_2x` |
| `created_at` | TIMESTAMPTZ | |

> **The analyses table is a junk drawer.** Eleven of its columns are JSONB blobs — meaning the data inside them is invisible to the database. Supabase can't query "all analyses with high-severity risk" or "all requirements assigned to Alice." For Part 3 features (especially Multi-Document Intelligence and Team Collaboration), this becomes a hard wall. See Part 4 Recommendation #4.

### `subscriptions`

| Column | Inferred type | Notes |
| --- | --- | --- |
| `user_id` | UUID → auth.users | Unique (one sub per user) |
| `stripe_customer_id` | TEXT | |
| `stripe_subscription_id` | TEXT | |
| `plan` | TEXT | `free | pro | team | enterprise` |
| `analyses_limit` | INT | Cached from plan, used for usage gating |
| `status` | TEXT | `active | canceled | past_due` |
| `current_period_end` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `bid_readiness_stages` (new on this branch)

Documented in the migration file. 6 stages per analysis (kickoff → drafting → internal_review → client_review → finalization → submitted), with `manual_override` and timestamps. Has proper RLS policies and an `updated_at` trigger.

### Storage bucket

- **`tenders/`** — uploaded source documents, path format `{user_id}/{analysis_id}/{filename}`. Used by `app/api/analyze/route.js:182` and downloaded from dashboard.

### Tables that DO NOT exist yet but you'll need

For your planned features:
- `teams`, `team_members` (for collaboration)
- `requirements` (for Multi-Document Intelligence — currently only inside JSONB)
- `work_packages` (for Scope Decomposition)
- `proposal_responses` (for Compliance Response Matrix)

---

## 1.4 Environment Variables

| Variable | Where used | Purpose | In `.env.local`? |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.js`, all API routes | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.js`, all API routes | Supabase public client key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `app/api/stripe/webhook/route.js` | Admin DB access (bypasses RLS) | ✅ |
| `OPENROUTER_API_KEY` | `lib/gemini.js`, `bid-compare`, `workspace` | AI provider | ✅ |
| `NEXT_PUBLIC_APP_URL` | Many places | Used for redirects, email links | ✅ (set to prod URL) |
| `RESEND_API_KEY` | `lib/email.js` | Transactional email | ❌ **MISSING** |
| `STRIPE_SECRET_KEY` | `lib/stripe.js` | Stripe server SDK | ✅ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (not actually consumed in code) | | ✅ |
| `STRIPE_WEBHOOK_SECRET` | `app/api/stripe/webhook/route.js` | Verify Stripe events | ✅ |
| `STRIPE_PRO_PRICE_ID` | `app/api/stripe/checkout/route.js`, `lib/stripe.js` | Pro plan price ID | ❌ **MISSING** |
| `STRIPE_TEAM_PRICE_ID` | `app/api/stripe/checkout/route.js`, `lib/stripe.js` | Team plan price ID | ❌ **MISSING** |
| `INTERNAL_API_KEY` | `app/api/notify/route.js` | Shared secret for internal calls | ❌ **MISSING** |
| `GEMINI_API_KEY` | (no code references it) | Legacy from when you used Gemini SDK | ✅ but unused |

**Issues:**
- `.env.local` is missing 4 variables actually required by the code. This is why the upgrade flow we discussed earlier is broken locally.
- `README.md` lines 48-49 document `STRIPE_STARTER_PRICE_ID` / `STRIPE_PROFESSIONAL_PRICE_ID` — but the code uses `STRIPE_PRO_PRICE_ID` / `STRIPE_TEAM_PRICE_ID`. If you set Vercel env vars from the README, **production payments would silently fail too.**
- `GEMINI_API_KEY` is set but unused — safe to delete.

---

## 1.5 Core Data Flow: PDF Upload → Analysis → Display

Here is the step-by-step path of a single tender analysis. (I picked the most-used flow.)

```
┌─────────────────────────────────────────────────────────────────────┐
│ User on /upload selects a PDF                                       │
│ (app/upload/page.js)                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  fetch POST /api/analyze
                              │  with formData: file + rfxType
                              │  Authorization: Bearer <supabase JWT>
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ /api/analyze (app/api/analyze/route.js)                              │
│   1. Validate JWT, get user                                          │
│   2. Look up subscription, check monthly usage limit                 │
│   3. Read file buffer (max 3MB)                                      │
│   4. Branch on extension:                                            │
│        .pdf  → analyzeTenderFromPDF (lib/gemini.js)                  │
│        .docx → mammoth.extractRawText, then analyzeTender            │
│        .txt  → utf-8 decode, then analyzeTender                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  document text (capped at 100K chars)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ analyzeTender (lib/gemini.js)                                        │
│   1. Pick prompt based on rfxType (rfp/rfq/rfi/other)                │
│   2. POST to OpenRouter chat completions                             │
│   3. Strip markdown fences, extract first/last brace                 │
│   4. JSON.parse → return { success, data }                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  parsed analysis object
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ /api/analyze (continued)                                             │
│   5. INSERT into analyses (with full JSON in analysis_data)          │
│   6. Fire-and-forget: upload file to storage bucket                  │
│   7. Fire-and-forget: send analysis-summary email via Resend         │
│   8. Return { success, analysisId }                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  router.push("/analysis/" + id)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ /analysis/[id]/page.js (1,215 lines)                                 │
│   1. SELECT analyses WHERE id = X AND user_id = current              │
│   2. SELECT subscriptions to know what to gate                       │
│   3. Render the full UI: score badge, info cards, requirements,      │
│      win probability, competitors, pricing, compliance, risks,       │
│      action tracker, decision panel, comments, audit, notes...       │
│   4. Each child component (ActionTracker, ComplianceMatrix,          │
│      CommentThread, etc.) makes its OWN supabase queries             │
└─────────────────────────────────────────────────────────────────────┘
```

**What's good about this flow:**
- Auth is enforced at the API layer.
- File extraction is server-side (browser never sees pdf/docx parsing).
- Email is fire-and-forget, so user isn't blocked by a slow Resend call.
- The redirect-and-fetch pattern after save means the UI always reads the canonical row from DB, not from a stale in-memory result.

**What's risky about this flow:**
- The **only** persistence of the analysis is `analysis_data` JSONB. If the AI returns slightly malformed JSON, you save nothing useful. There's no schema validation between OpenRouter and `INSERT`.
- The **whole** AI response is saved as one blob. You can never query "show me all analyses where bid_score > 70 AND sector = 'IT'" using the sector — only the score, because score is its own column.
- The fire-and-forget storage upload means the file row may be created with `file_path = null` if the upload fails. There's no retry.
- Each child component on the analysis page makes its own DB call on mount. If the page loads `ActionTracker`, `AnalysisNotes`, `ComplianceMatrix`, `DecisionPanel`, `CommentThread`, and `AuditTrail`, that's **6 round-trips to Supabase** to render one page.

---

## 1.6 Third-Party Services & SDKs

| Service | Purpose | SDK / package | Critical to flow? |
| --- | --- | --- | --- |
| **Supabase** | Auth, Postgres, Storage | `@supabase/supabase-js@2.98.0` | Yes — outage = whole product down |
| **OpenRouter** | AI (model routed to GPT-5.4 today, Claude per your plan) | Plain `fetch()` (no SDK) | Yes — analyze/compare/workspace all need it |
| **Stripe** | Payments | `stripe@20.4.1`, `@stripe/stripe-js@8.9.0` | Only for paid users |
| **Resend** | Transactional email | `resend@6.9.3` | Optional (fire-and-forget) |
| **unpdf** | PDF text extraction (server-side) | `unpdf@1.4.0` | Yes for PDF uploads |
| **mammoth** | DOCX text extraction | `mammoth@1.11.0` | Yes for DOCX uploads |
| **xlsx** | Excel export (browser) | `xlsx@0.18.5` | Pro+ feature |
| **jsPDF + autotable** | PDF report export (browser) | `jspdf@4.2.0`, `jspdf-autotable@5.0.7` | Yes (free feature) |
| **Vercel** | Hosting | (no SDK) | Yes |

**Notable absences for a SaaS at this maturity:**
- No analytics (PostHog, Plausible) — you can't tell which features users actually use.
- No error tracking (Sentry) — when a user hits an error, you only know if they email you.
- No rate-limiting middleware — someone with a script could exhaust your OpenRouter budget.
- No background job queue (Inngest, Trigger.dev) — long AI calls block the API route, which Vercel will time out at 5 minutes. The `analyze` route already sets `maxDuration = 300`.

---

# PART 2 — Architecture Health Check

## 2.1 Tightly Coupled Code (Hard to Change Without Breaking Things)

**Analogy:** Tight coupling is when two rooms in a house share a single light switch — you can't repaint one without messing up the wiring of the other.

### Couplings I found

**Coupling A: Components → Database (high pain when adding teams)**
Six React components write directly to the database:
- `app/components/ActionTracker.js:38, 61` — reads/writes `analyses.workflow_actions`
- `app/components/AnalysisNotes.js:25, 46` — reads/writes `analyses.notes`
- `app/components/ComplianceMatrix.js:96, 102` — reads/writes `analyses.compliance_edits`
- `app/components/DecisionPanel.js:25, 31` — reads/writes `analyses.workflow_decision`
- `app/components/CommentThread.js:18, 27` — reads/writes `analyses.workflow_comments`
- `app/components/AuditTrail.js:38, 113` (and `addAuditEvent` helper) — reads/writes `analyses.audit_trail`

When you add team collaboration, **every one of these will need to change** to:
- Check whether the current user is allowed to edit this analysis (not just whether it's their own)
- Add team_id checks
- Possibly fetch role-scoped data

Right now they all assume `user_id = me`. That's the coupling.

**Coupling B: API routes → Identical AI HTTP logic**
- `lib/gemini.js:8-58` has a clean `callOpenRouter()` function
- But `app/api/bid-compare/route.js:86-103` re-implements the same fetch
- And `app/api/workspace/route.js:94-111` re-implements it again

Three copies of the same code that should be one. When you switch to Claude or change models, you'll have to remember all 3.

**Coupling C: Plan keys appear in 4+ places**
Strings like `"pro"`, `"team"`, `"free"`, `"enterprise"` are scattered across:
- `lib/plans.js` (canonical source)
- `lib/stripe.js` (duplicate definition)
- `app/dashboard/page.js:11-16` (`PLAN_LABELS`)
- `app/pricing/page.js`, `app/api/stripe/webhook/route.js`, `app/api/stripe/checkout/route.js`

Renaming `"pro"` to `"professional"` would require finding and updating ~15 places. Today this is fine; with i18n + teams, it's a footgun.

---

## 2.2 Mixed Concerns

**Analogy:** Mixed concerns are like a kitchen drawer that has spoons, screwdrivers, and bills in it — each item is fine, but you can't find anything fast.

### Mixings I found

**Mix A: `lib/gemini.js` is doing five jobs**
- Defining ~300 lines of prompts (RFP, comparison, 6 proposal sections)
- HTTP transport (`callOpenRouter`)
- JSON parsing (`parseJSONResponse`)
- PDF extraction (`extractTextFromPDF`)
- Public exports for 4 different feature flows (`analyzeTender`, `analyzeTenderFromPDF`, `generateProposalSection`, `compareTenderAmendments`, `compareTenderPDFs`)

When you add **Multi-Document Intelligence**, you'll either bolt onto this 600-line file (making it 800+) or split it. Better to split now.

**Mix B: API routes contain business logic**
- `app/api/analyze/route.js:60-81` decides plan limits inline:
  ```js
  const analysesLimit = (subscription?.status === "active" && subscription?.analyses_limit)
    ? subscription.analyses_limit : 3;
  ```
  This logic is repeated (slightly differently) in `app/dashboard/page.js`, `app/upload/page.js`, etc. It should live in one helper.

**Mix C: Page components contain everything**
- `app/analysis/[id]/page.js` is **1,215 lines**. It defines presentational components (ScoreBadge, RecommendationBadge, SeverityBadge, Section, InfoCard) inline, computes derived state, makes DB queries, handles auth, renders 12+ sections. Adding "language switcher" or "team owner picker" here means scrolling through 1,000+ lines to find the right insertion point.

---

## 2.3 Single Points of Failure

| File | Lines | Why it's a SPOF |
| --- | --- | --- |
| `lib/gemini.js` | 637 | All AI logic. A typo in `parseJSONResponse` breaks all 4 features that use AI. |
| `app/analysis/[id]/page.js` | 1,215 | Renders the highest-value page. A regression here = users can't see their analysis. |
| `analyses` table | (row) | Stores 11+ JSONB blobs. A bad migration or app bug that overwrites one column erases workflow state for every user. |
| `lib/stripe.js` PLANS object | — | Defines limits used everywhere. Drift from `lib/plans.js` will silently mis-bill users (you saw this in the upgrade bug). |
| `app/api/stripe/webhook/route.js` | 128 | Only place that updates subscription state. If it crashes or Vercel restarts, paying users may see "free plan" for hours. |

**Risk to be aware of:** there's no monitoring. If `lib/gemini.js`'s JSON parser fails on a quirky AI response, the API returns a generic error and you have no record. Add Sentry before users start paying meaningfully. (See Part 5.)

---

## 2.4 Error Handling

I read every API route and every component data-flow. Here's the pattern:

| Layer | Pattern | Health |
| --- | --- | --- |
| API routes | `try/catch` + `NextResponse.json({success, error})` | ✅ Consistent |
| AI calls | Wrapped in try/catch, returns generic error | ⚠️ User never learns *why* (token limit? model down? bad JSON?) |
| File extraction | Specific messages for password-protected/scanned PDFs | ✅ Good |
| Frontend fetch | Most routes show error in red banner | Mostly ✅ |
| Pricing page upgrade | **Silently swallows errors** (`else setLoadingPlan(null)`) | ❌ This is why you saw "doesn't upgrade" |
| Welcome email | Fire-and-forget, error only logged to console | ✅ Acceptable |
| Storage upload after analyze | Fire-and-forget, error only logged | ⚠️ User won't know their original file isn't downloadable |
| Auth failure (token expired) | `useAuth.js` redirects to `/login` | ✅ Good |
| Database write failure in components | Most just `console.error` and continue | ❌ User edits an action item, sees it on screen, but it's not saved |

**Specific bug I want to flag:**
`app/components/PermissionGate.js:30` uses `require("@/lib/permissions").PERMISSIONS?.[...]`. This is a **CommonJS `require` inside a client component**. It will *probably* work in dev because Next.js bundler tolerates it, but it can break in production builds, especially with newer Next.js versions. It should be a normal `import` at the top of the file.

---

## 2.5 Authentication & Authorization

### Authentication (who you are) — consistent ✅

Every authenticated API route follows this exact pattern:

```js
const authHeader = request.headers.get("authorization");
const token = authHeader.split(" ")[1];
const supabase = createClient(URL, ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } },
});
const { data: { user } } = await supabase.auth.getUser(token);
```

This is ~20 lines of identical code, copy-pasted in **7 routes**. The pattern is correct (it uses the user's JWT so RLS policies still apply) — but having it in 7 places means a single security improvement requires 7 edits.

**Recommendation:** extract to `lib/api-auth.js`. See Part 4 Recommendation #1.

### Authorization (what you can do) — inconsistent ⚠️

Three different permission systems coexist:

1. **Plan-based gating** (`lib/plans.js` + `app/components/UpgradeGate.js`): What features your subscription unlocks. Used in pages.
2. **Role-based permissions** (`lib/permissions.js` + `app/components/PermissionGate.js`): Designed for teams, but currently always returns "admin" for owners. Anticipates future use but **not enforced server-side anywhere.**
3. **Row-level security** (Supabase RLS): The actual security boundary. The migration adds RLS for `bid_readiness_stages`, but I don't have visibility into the RLS policies on `analyses` and `subscriptions` (they were created in the dashboard).

**Risk:** If your `analyses` RLS policy is `auth.uid() = user_id`, then **the moment you add team members**, every team member will see *nothing* because their `auth.uid()` isn't equal to the owner's `user_id`. RLS policies must be rewritten before teams ship.

---

## 2.6 Duplicated Logic

| What's duplicated | Where | Cost |
| --- | --- | --- |
| Bearer JWT auth boilerplate | 7 API routes | Edit cost x7 for any auth change |
| OpenRouter HTTP fetch | `lib/gemini.js`, `bid-compare/route.js`, `workspace/route.js` | Model swap = 3 edits |
| File extraction (PDF/DOCX/TXT) | `analyze`, `compare`, `bid-compare`, `workspace` | Adding XLSX support = 4 edits |
| AI JSON parsing (`parseJSONResponse` style cleanup) | `lib/gemini.js`, `bid-compare`, `workspace` | 3 copies |
| Plan definitions | `lib/plans.js` + `lib/stripe.js` | Already caused the upgrade bug |
| Date parsing for tender deadlines | `app/deadlines/page.js`, `app/history/page.js` | 2 copies of fragile `new Date(messy string)` logic |
| Status badges (severity, priority, plan, decision) | Defined inline in many components and pages | A new color theme = manual hunt |
| Stage progress bars (uploading → analyzing → done) | `upload`, `compare`, `bid-compare`, `workspace/new` | 4 copies of the same animation |

None of these are bugs today. All of them get more painful linearly with each new feature.

---

# PART 3 — Scalability Readiness for Planned Features

For each feature, I rate disruption on a 4-point scale:

| Rating | Meaning |
| --- | --- |
| **Low** | Drop-in. Existing patterns will absorb it. |
| **Medium** | New code + light edits to existing files. No data model changes. |
| **High** | New tables, schema changes, possibly RLS rewrite. Existing components need updates. |
| **Will-require-refactor** | Cannot ship cleanly without addressing structural issues first. |

---

## 3.1 Multi-Document Intelligence Engine

> Analyze multiple RFI/RFQ docs together, find patterns across them.

### Disruption: **Medium**

You already have a starting point: the Tender Package workspace (`app/api/workspace/route.js`) takes multiple files and gives one combined analysis. Bid Compare does similar work for vendor submissions.

### Will it break existing flows?
**No** — adding a new "intelligence" view is additive. Existing pages keep working.

### What to do BEFORE building it:
1. **Promote requirements out of JSONB into their own table.** Today, every requirement lives inside `analyses.analysis_data.requirements[i]` — invisible to SQL. To say "find all RFPs in my history that need ISO 27001," you need:
   ```
   requirements (
     id UUID PRIMARY KEY,
     analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
     user_id UUID,
     text TEXT,
     category TEXT,
     mandatory BOOLEAN,
     priority TEXT,
     source_ref TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   )
   ```
   And a one-time migration that walks all existing rows and back-fills.
2. **Tag analyses with a `document_set_id`** (nullable UUID). When the user runs intelligence across N docs, they all get the same set ID. Then a "Multi-Doc View" is just `WHERE document_set_id = X`.
3. **Decide where the cross-doc AI prompt lives.** I'd suggest `lib/prompts/cross-document.js` — keep it OUT of `lib/gemini.js`.

### Architectural decisions to lock in NOW:
- **Whether requirements are 1-per-tender or aggregated across-tender.** This determines the table shape. Lean toward 1-per-tender with a `document_set_id` join, because it preserves provenance.
- **Whether the cross-doc analysis is its own row in `analyses`** (with `analysis_data.crossDoc = true`) **or its own table.** I recommend its own table (`document_set_analyses`) so the `analyses` junk drawer doesn't get more junk.

---

## 3.2 Scope Decomposition

> Break tender scope into structured work packages.

### Disruption: **Low–Medium**

### Will it break existing flows?
**No** — additive. Existing analysis page just shows one more tab.

### What to do BEFORE building it:
1. **Create a `work_packages` table:**
   ```
   work_packages (
     id UUID PRIMARY KEY,
     analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
     title TEXT,
     description TEXT,
     estimated_effort TEXT,    -- "2 weeks", "40 hours"
     dependencies TEXT[],
     owner TEXT,
     position INT              -- for ordering
   )
   ```
2. **Add a new prompt file** `lib/prompts/scope-decomposition.js` that takes an analysis and returns work packages. Keep it separate from `lib/gemini.js`.
3. Use the same pattern as `ActionTracker` for the editable UI.

### Architectural decisions to lock in NOW:
- Stick with proper tables (not JSONB on `analyses.analysis_data.workPackages`) — this is the easiest place to break the JSONB habit cheaply.

---

## 3.3 Proposal Structure Generator

> Auto-generate proposal outlines.

### Disruption: **Low**

### Will it break existing flows?
**No.** You already have `/proposal/[id]` and `/api/generate-proposal` — this feature is essentially "generate one more thing" in that flow.

### What to do BEFORE building it:
1. Add a new section type to the existing `VALID_SECTIONS` array in `app/api/generate-proposal/route.js:7-14`.
2. Add a corresponding prompt to `PROPOSAL_PROMPTS` in `lib/gemini.js` (or, better, move the prompts to `lib/prompts/proposal.js` first — see Recommendation #2).
3. Add a sidebar entry in `app/proposal/[id]/page.js`.

### Architectural decisions to lock in NOW:
- **None critical.** This is the easiest of your 6 features to ship.

---

## 3.4 Compliance Response Matrix

> Map each tender requirement to a corresponding written response.

### Disruption: **Low–Medium**

### Will it break existing flows?
**No** — you already have `ComplianceMatrix.js` editing `compliance_edits`. This is the natural next step.

### What to do BEFORE building it:
1. **If you do nothing**, you can store responses in the existing `compliance_edits` JSONB. That works for ~50 requirements. Beyond that, JSONB updates start being slow and awkward.
2. **Better:** create a `compliance_responses` table:
   ```
   compliance_responses (
     id UUID PRIMARY KEY,
     analysis_id UUID,
     requirement_id UUID,           -- foreign key once requirements is a real table
     response_text TEXT,
     status TEXT,                   -- 'draft' | 'final' | 'needs_review'
     evidence_links TEXT[],
     last_updated_by UUID,
     updated_at TIMESTAMPTZ
   )
   ```
3. **Strongly recommended:** do this AFTER moving requirements out of JSONB (3.1's prep work). Otherwise the join target doesn't exist.

### Architectural decisions to lock in NOW:
- **Don't do this until requirements are a proper table.** Otherwise responses will reference array indices in JSONB, which break the moment you re-run analysis.

---

## 3.5 Team Collaboration (Multi-User Workspaces)

> Multiple people on one tender.

### Disruption: **HIGH — will require refactor**

This is the single feature that touches every layer of your app.

### Will it break existing flows?
**Yes**, in three big ways:
1. **The `analyses.user_id` model assumes single-owner.** Every query says `WHERE user_id = me`. If a team member is not the owner, they see nothing.
2. **RLS policies must be rewritten.** Currently (presumably) `auth.uid() = user_id`. You need policies that check team membership: `auth.uid() IN (SELECT user_id FROM team_members WHERE team_id = analyses.team_id)`.
3. **Six components** (ActionTracker, AnalysisNotes, ComplianceMatrix, CommentThread, DecisionPanel, AuditTrail) hard-code `eq("user_id", user.id)` in their queries. All six need to change.

### What to do BEFORE building it:
1. **Introduce the data layer FIRST** (Recommendation #3). Once data access is centralized in one file, switching from "owner check" to "team membership check" is a one-place edit instead of 30.
2. **Add `team_id` column to `analyses` (nullable for backward compat).** Migrate existing rows: `team_id = NULL` (treated as personal). New rows after team feature ships have `team_id = ...`.
3. **Plan the migration of RLS policies in advance.** This is the highest-risk part. Test in a staging Supabase project first.
4. **Decide your role model.** `lib/permissions.js` already defines roles (Viewer/Contributor/Reviewer/Approver/Admin). Use that — don't reinvent.

### Architectural decisions to lock in NOW:
- **Add the data layer (Recommendation #3) before this feature.** Without it, you'll spend a week chasing every `eq("user_id", ...)` call and breaking things.
- **Decide `team_id` is on `analyses`** (so each tender belongs to exactly one team) **vs. a separate `team_analyses` join table** (allowing analyses to be shared across teams). I recommend the simpler option: `analyses.team_id` (nullable).
- **Plan invitation flow:** email-based invite with token, magic-link signup. This is its own subproject — budget a sprint for it.

### Disruption rating reasoning:
This is "Will-require-refactor" because:
- 6 components need rewrites
- 1+ RLS policy needs rewriting (the highest-risk thing in your stack)
- New tables: `teams`, `team_members`, `invitations`
- New API routes: `/api/teams`, `/api/teams/invite`, etc.
- New UI: team picker, member management, role assignment
- Notification system (someone invited you, decision approved, etc.)

---

## 3.6 Multi-Language Support (Arabic + English)

> Bilingual UI. Arabic needs RTL.

### Disruption: **Medium–High**

### Will it break existing flows?
**Yes**, in subtle ways:
1. **No i18n infrastructure exists.** Every visible string is a JSX literal: `<h1>Welcome back</h1>`, `"Analyze Document"`, etc. There are ~2,500+ such strings.
2. **AI prompts are English.** Output language depends on the input document. An Arabic tender uploaded today might get an English JSON response (or might not — it's unspecified).
3. **No RTL CSS.** Arabic text reads right-to-left. Every `flex-row`, `pl-3`, `mr-2`, `text-left` becomes asymmetric and possibly broken.
4. **Date and number formatting.** Currently `toLocaleDateString("en-US", ...)` — hard-coded. Arabic users expect Arabic numerals or AH calendar in some contexts.
5. **Email templates** in `lib/email.js` are English HTML.

### What to do BEFORE building it:
1. **Pick an i18n library now** before adding more features. `next-intl` is the standard for Next.js App Router. Adding it later means re-reviewing every page.
2. **Set up a `messages/` folder** with `en.json` and `ar.json`. Initially populate `en.json` with current strings, leave `ar.json` empty for translation later.
3. **Decide AI strategy for non-English inputs:** either (a) detect language and ask the model to respond in that language, or (b) translate input to English, analyze, translate output back. Option (a) is simpler; Claude/GPT handle Arabic well.
4. **Wrap layout in a locale-aware `<html dir={locale === 'ar' ? 'rtl' : 'ltr'}>`** — this single attribute makes Tailwind's `rtl:` variants work.
5. **Audit hard-coded date formats** before they multiply.

### Architectural decisions to lock in NOW:
- **Adopt `next-intl` BEFORE building any of features 1-5.** Every new feature you ship without it adds more strings to retrofit. This is a "tax compounds" situation.
- **Decide whether Arabic is for the UI only, or also for AI input/output.** They're different scopes of work.

---

## 3.7 Disruption summary table

| Feature | Disruption | Blockers | Build order suggestion |
| --- | --- | --- | --- |
| Proposal Structure Generator | Low | None | 1st (warm-up) |
| Scope Decomposition | Low–Medium | New table | 2nd |
| Multi-Document Intelligence | Medium | Requirements as a table | 3rd |
| Compliance Response Matrix | Low–Medium | Requirements as a table | 4th (after MDI) |
| Multi-Language | Medium–High | i18n library, RTL audit | **Set up infra now**; full rollout later |
| Team Collaboration | **Will-require-refactor** | Data layer, RLS rewrite | **Last**, after Recs 1, 3 |

---

# PART 4 — Recommendations

## 4.1 Top 5 Architectural Improvements (Priority Order)

### Recommendation #1: Extract API auth helper

**Time:** 1–2 hours
**Why:** The same 20-line auth block is in 7 API routes. Every security improvement requires 7 edits. Adding teams will require 7 more.

**What to do:**
Create `lib/api-auth.js`:
```js
// lib/api-auth.js
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function authenticateRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const token = authHeader.split(" ")[1];
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, supabase };
}
```

Then in any route:
```js
const auth = await authenticateRequest(request);
if (auth.error) return auth.error;
const { user, supabase } = auth;
```

**Disruption to existing code:** None if you migrate routes one at a time.

---

### Recommendation #2: Move all AI prompts into `lib/prompts/`

**Time:** 2 hours
**Why:** `lib/gemini.js` is 637 lines. Half of that is prompt strings. Adding multi-doc intelligence, scope decomposition, response matrix means another 200–300 lines of prompts. The file becomes unmaintainable.

**What to do:**
Create:
```
lib/prompts/
  ├── analyze-rfp.js          (move ANALYSIS_PROMPT from gemini.js)
  ├── analyze-rfi.js          (move from rfx-prompts.js)
  ├── analyze-rfq.js          (move from rfx-prompts.js)
  ├── analyze-other.js        (move from rfx-prompts.js)
  ├── compare-amendments.js   (move COMPARISON_PROMPT)
  ├── compare-bids.js         (move from compare-prompt.js)
  ├── package-analysis.js     (move from package-prompt.js)
  ├── proposal-sections.js    (move PROPOSAL_PROMPTS)
  └── system-prompts.js       (move RFX_SYSTEM_PROMPTS)
```

Then `lib/gemini.js` becomes ~150 lines of just transport + parsing. Rename it to `lib/ai.js` while you're there.

**Disruption to existing code:** Just import path updates.

---

### Recommendation #3: Create a thin "data layer" for `analyses`

**Time:** 4–6 hours
**Why:** This is the **single highest-leverage improvement** for your planned features, especially Team Collaboration. Six components currently hit Supabase directly; that means switching from "owner check" to "team membership check" is a 6-component edit. With a data layer, it's one edit.

**Analogy:** Right now every room in your house has its own front door. You want one front door that everyone uses, with a doorman who decides who can come in.

**What to do:**
Create `lib/repositories/analyses.js`:
```js
// lib/repositories/analyses.js
import { getSupabase } from "@/lib/supabase";

export async function getAnalysisField(analysisId, userId, field) {
  const { data, error } = await getSupabase()
    .from("analyses")
    .select(field)
    .eq("id", analysisId)
    .eq("user_id", userId)        // ← when teams ship, change just this line
    .single();
  return { data: data?.[field], error };
}

export async function updateAnalysisField(analysisId, userId, field, value) {
  return getSupabase()
    .from("analyses")
    .update({ [field]: value })
    .eq("id", analysisId)
    .eq("user_id", userId);
}

// Convenience exports for each JSONB column:
export const getActions = (id, uid) => getAnalysisField(id, uid, "workflow_actions");
export const setActions = (id, uid, v) => updateAnalysisField(id, uid, "workflow_actions", v);
export const getNotes = (id, uid) => getAnalysisField(id, uid, "notes");
export const setNotes = (id, uid, v) => updateAnalysisField(id, uid, "notes", v);
// ... etc for compliance_edits, workflow_decision, workflow_comments, audit_trail
```

Then in `app/components/ActionTracker.js`:
```js
// before
getSupabase().from("analyses").select("workflow_actions").eq("id", analysisId).eq("user_id", userId).single()
// after
import { getActions, setActions } from "@/lib/repositories/analyses";
getActions(analysisId, userId).then(({ data }) => ...);
```

When you ship teams, you change `eq("user_id", userId)` to `.in("id", teamAnalysisIds)` once in `lib/repositories/analyses.js` — and all 6 components inherit the new behavior.

**Disruption to existing code:** Medium — touches 6 components, but each edit is ~5 lines.

---

### Recommendation #4: Plan the requirements-table migration

**Time:** 1 day to write, ½ day to test, ½ day to roll out (with backup plan)
**Why:** Multi-Document Intelligence and Compliance Response Matrix both need requirements as queryable rows, not as JSONB array elements. Doing this **once, before** those features, is far cheaper than ad-hoc patching twice.

**What to do — three steps:**

1. **Add the table** (new migration, doesn't change existing data):
   ```sql
   -- supabase/migrations/20260427000000_requirements_table.sql
   CREATE TABLE IF NOT EXISTS requirements (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     text TEXT NOT NULL,
     category TEXT,
     mandatory BOOLEAN DEFAULT false,
     priority TEXT,
     source_ref TEXT,
     position INT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users see own requirements" ON requirements FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users insert own requirements" ON requirements FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users update own requirements" ON requirements FOR UPDATE USING (auth.uid() = user_id);
   CREATE INDEX idx_requirements_analysis ON requirements(analysis_id);
   ```

2. **Backfill from JSONB** (one-off script, doesn't delete the JSONB version):
   ```sql
   INSERT INTO requirements (analysis_id, user_id, text, category, mandatory, priority, source_ref, position)
   SELECT
     a.id, a.user_id, r->>'requirement', r->>'category',
     (r->>'mandatory')::boolean, r->>'priority', r->>'sourceRef',
     idx
   FROM analyses a, jsonb_array_elements(a.analysis_data->'requirements') WITH ORDINALITY arr(r, idx)
   WHERE a.analysis_data->'requirements' IS NOT NULL;
   ```

3. **Update `app/api/analyze/route.js`** to insert into both `analyses.analysis_data` (for backward compat) AND the new `requirements` table for the next ~3 months. Then delete the JSONB version once nothing reads it.

**Disruption:** Low (new table is additive). The risky step is changing what reads from where — do this when you have time, not under pressure.

---

### Recommendation #5: Reconcile Stripe vs Paddle

**Time:** Depends on direction.
- If keeping Stripe (which works today): rewrite legal pages — ½ day.
- If switching to Paddle (which your terms reference): rewrite `app/api/stripe/*` and `lib/stripe.js`, set up Paddle webhook, migrate existing Stripe customers (ouch) — 3–5 days.

**Why:** Customers reading your Privacy Policy / Refund Policy expect Paddle to be on their bank statement. If they see "Stripe", they'll dispute the charge. Refund flows reference Paddle support process that doesn't exist in your code.

**Recommendation:** **Keep Stripe, update legal pages.** Stripe works, has more flexibility, and Paddle's value (tax handling for international customers) you can add later via Stripe Tax.

**Disruption:** Low (legal pages only).

---

## 4.2 Recommended Folder Structure (Aspiration, Not Mandate)

You said no rewrites. So this is **how I'd suggest organizing new code**, not a directive to move existing files.

```
app/
├── (auth)/                  ← Public routes (landing, login, legal)
├── (app)/                   ← Authenticated routes (dashboard, analysis, etc.)
└── api/                     ← Thin route handlers — delegate to features

features/                    ← NEW: domain-organized code
├── analysis/
│   ├── repository.js        ← All Supabase queries for analyses
│   ├── service.js           ← Business logic (limits, scoring, etc.)
│   ├── components/          ← Components used only by analysis feature
│   └── prompts/             ← Just the analysis prompts
├── billing/
│   ├── repository.js        ← All subscription queries
│   ├── service.js           ← Plan logic (consolidate plans.js + stripe.js)
│   └── stripe-client.js
├── proposals/
├── compare/
├── workspace/
└── teams/                   ← New, when you build it

lib/                          ← Cross-cutting infrastructure only
├── supabase.js
├── ai.js                    ← The renamed gemini.js (transport only)
├── api-auth.js              ← Recommendation #1
├── prompts/                 ← All AI prompts (Recommendation #2)
└── email.js

shared/                       ← UI primitives used by 3+ features
├── components/
│   ├── badges/
│   ├── empty-states/
│   └── stage-progress/      ← The 4 duplicates
└── utils/
```

**Don't move existing files to match this overnight.** Apply the pattern when you create new folders. Over 6 months, the codebase naturally migrates.

---

## 4.3 Technical Debt That's Small Now, Painful Later

| Debt | Cost today | Cost in 6 months | Fix cost now |
| --- | --- | --- | --- |
| `analyses` JSONB junk drawer | None | High (blocks MDI, search, reporting) | 1 day per column extracted |
| Duplicate `PLANS` definitions | Caused 1 bug already | Will mis-bill on plan changes | 1 hour |
| `lib/gemini.js` god file | None | Hard to add Multi-Doc prompts | 2 hours (Recommendation #2) |
| Auth boilerplate x7 | None | 7 edits per security change | 1 hour (Recommendation #1) |
| Direct DB writes from components | None | Blocks Team feature entirely | 4 hours (Recommendation #3) |
| `PermissionGate.js:30` `require()` | Probably none | Production build failure on Next 17+ | 5 minutes |
| Plan keys hard-coded as strings everywhere | None | Renaming = a hunt | Use a constant: 1 hour |
| Hard-coded English strings | None | Multi-language = retrofit 2,500 strings | Add `next-intl` now: 2 hours |
| Two pages > 1,000 lines | Mild (slow to navigate) | Painful when adding features | Split when you touch them |
| Date parsing duplicated in deadlines/history | None | Bug fixed in one place won't fix the other | 30 minutes |
| Storage upload is fire-and-forget without retry | Some users have orphaned analyses | Same | Add error handling: 1 hour |
| `GEMINI_API_KEY` env var unused | None | Confusion for a future contributor | Delete from `.env.local` and README: 2 minutes |
| README env vars list is wrong | Bad onboarding | Production deploys may miss vars | 5 minutes |

---

# PART 5 — Safety Net

## 5.1 Tests to Add

You have **zero** tests today. That's fine for an MVP. Before adding any of the 6 planned features, I recommend adding the following — not full coverage, just **smoke tests** so you know if a basic flow breaks.

**Analogy:** Smoke tests are like the bell at a shop entrance. You don't need to know who walked in — just that someone did. If the bell stops ringing, something's wrong.

### Tier 1 — Essential before you touch anything (~½ day to set up)

Add these using **Vitest** (lightweight, integrates with Next.js):

| Test | What it checks |
| --- | --- |
| `lib/plans.test.js` | `PLANS` and `lib/stripe.js` PLANS have matching keys and limits |
| `lib/auth-redirect.test.js` | The `next` URL parsing rejects external origins (you wrote it correctly, this just protects against regression) |
| `lib/permissions.test.js` | `hasPermission()` returns expected values for each role/permission combination |
| `lib/prompts/parse.test.js` | Your JSON cleanup logic handles markdown fences, leading text, trailing commas (real failure modes) |

### Tier 2 — Recommended before shipping teams (~1 day)

| Test | What it checks |
| --- | --- |
| `app/api/analyze/route.test.js` | POST without auth → 401; POST with invalid file type → 400; POST while at usage limit → 403 |
| `app/api/stripe/checkout/route.test.js` | POST without `STRIPE_PRO_PRICE_ID` env → returns clear error (would have caught the upgrade bug) |
| `app/api/stripe/webhook/route.test.js` | Invalid signature → 400; valid `checkout.session.completed` → upserts subscription |

### Tier 3 — Nice to have

End-to-end with Playwright: signup → upload PDF → see analysis. One golden-path test. Run on every deploy.

**Don't aim for high test coverage.** Aim for *the 5 tests that catch the bugs you'll actually ship*.

---

## 5.2 What to Back Up Before Major Changes

| What | How | Frequency |
| --- | --- | --- |
| **Supabase database** | Enable Point-in-Time Recovery (PITR) on Supabase Pro plan, or schedule daily `pg_dump` to S3 | Daily; before any migration |
| **Supabase storage bucket `tenders/`** | Bucket-level snapshot via Supabase API, or rely on PITR | Weekly |
| **Stripe data** | Stripe is the source of truth and is itself backed up. Just keep a list of price IDs in a note. | Once |
| **`.env.local`** | Copy to a password manager (1Password, Bitwarden) — **don't commit** | Whenever it changes |
| **Vercel env vars** | Export from Vercel dashboard to a secure note | Whenever it changes |

**Critical:** Before running the requirements-table migration (Recommendation #4) or any RLS policy change (when teams ship), **take a fresh `pg_dump` first**. Schema changes are the highest-risk thing you'll do.

---

## 5.3 Git Branching Strategy

You're solo or near-solo. Don't over-engineer this. Here's the minimum viable safe workflow:

```
main                    ← Always deployable. Vercel auto-deploys this to production.
└── feature/<name>      ← One per feature. Branch from main.
```

### Rules I'd suggest

1. **Never commit directly to `main`.** Always go through a PR (even if you self-merge).
2. **Every PR triggers a Vercel preview deploy.** Click the preview URL, click around, *then* merge.
3. **Migrations live on the same branch as the code that uses them.** Don't push a migration to `main` before the code that needs it.
4. **Use `feature/` prefix consistently.** You're already doing this (`feature/bid-readiness`).
5. **For the bigger features (teams, multi-language), use a long-lived branch and merge `main` into it weekly** to avoid drift.

### Optional but useful

Add a `staging` branch that mirrors production data shape (separate Supabase project, separate Stripe test mode). Ship features there for a week before promoting to `main`. This costs ~$25/month extra in Supabase but catches data-shape bugs that previews miss.

### What to do for the planned features specifically

- **Teams + RLS rewrite** is the single most dangerous change you'll ever make to this codebase. Plan it as: branch → staging → 1 week of canary testing → main. Not optional.
- **Multi-language rollout** can be feature-flagged: `i18n` library is in place, but `<html lang>` always says English. Flip the switch when translations are ready.

---

# Closing Summary

**Bidlyze is a competent solo build.** The architecture isn't broken; it just hasn't been organized for the next phase of growth. The biggest risks are:

1. **Stripe / Paddle mismatch** — fix this week.
2. **Direct database writes from React components** — blocks teams; fix before that feature.
3. **`analyses.analysis_data` JSONB junk drawer** — limits what AI features you can build; start extracting requirements first.
4. **No tests, no error tracking, no analytics** — you're flying blind. Add Sentry and one Playwright test before serious paying customers arrive.

If you address Recommendations #1, #2, and #3 in that order — about **1.5 days of work total** — your codebase will absorb features 1-4 without drama. Features 5 (Teams) and 6 (i18n) are bigger projects regardless and need their own planning sprints.

**My one piece of unsolicited advice:** ship the Stripe/Paddle reconciliation and the missing env vars **before any new feature work**. Both are 1-day tasks and they'll save you a customer dispute or two.

---

*End of review. No code was changed. Awaiting your direction on which recommendations to action.*
