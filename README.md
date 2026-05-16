# Bidlyze

Professional tender workflow platform: upload tenders, extract structured requirements, manage compliance, build a bid recommendation, and export workspace deliverables.

## Features

- Upload tender documents (PDF, DOCX, TXT — up to 45MB)
- Structured analysis for RFP, RFI, RFQ, and Other document types
- Requirements tracker (editable, source-referenced, exportable)
- Compliance matrix (editable status, owner, evidence, due date — persisted)
- Risk radar with severity, likelihood, and mitigation
- Bid/no-bid scoring with reasoning
- Win probability and competitor intelligence (clearly marked as inferred)
- Pricing advisor with strategy recommendations
- Action / RACI tracker (persisted)
- Clarifications register
- Internal decision panel with approval workflow
- Internal comments and audit trail (Team plan)
- Amendment intelligence (compare tender versions)
- Tender package workspace (multi-document analysis)
- Bid comparison (multi-vendor submissions)
- Proposal writer — generate sections in markdown, export to .docx
- Export Center — PDF executive report, DOCX proposal, XLSX compliance / RACI / clarifications / requirements

## Tech Stack

- **Framework:** Next.js 16 (App Router) — Turbopack
- **Auth & Database:** Supabase (Postgres + RLS + Storage)
- **AI:** OpenRouter (model routed via `OPENROUTER_API_KEY`)
- **Payments:** Stripe
- **Email:** Resend
- **Styling:** Tailwind CSS 4

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with the following. Variables marked **required** must be present in any environment that serves the app; the rest are required only for the corresponding feature.

```
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI (required for analysis)
OPENROUTER_API_KEY=

# App URL — used for redirects, email links, OpenRouter referer header
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (required for paid plan checkout + webhook)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=

# Email (required for transactional email — analysis summary, usage warnings)
RESEND_API_KEY=

# Internal email-send endpoint shared secret (required by /api/notify callers)
INTERNAL_API_KEY=

# Pre-launch gating (see "Pre-launch mode" section below)
PAYMENTS_ENABLED=false
NEXT_PUBLIC_PAYMENTS_ENABLED=false
```

> **Storage bucket:** the analyze route uploads tender files to a Supabase Storage bucket named `tender-uploads`. Create this bucket (private) in your Supabase project.

## Pre-launch mode (current)

Bidlyze is in pre-launch while a legal entity is being registered to accept payments. The Stripe integration is fully wired but switched off until the entity is ready. The gate is controlled by two environment variables:

```env
PAYMENTS_ENABLED=false
NEXT_PUBLIC_PAYMENTS_ENABLED=false
```

Both variables default to `false` when unset. Only the exact literal string `true` enables payments — values like `1`, `yes`, or `TRUE` are treated as disabled.

### What each variable controls

- `PAYMENTS_ENABLED` (server-only)
  - `false` → `/api/stripe/checkout` returns HTTP 403 with `"Payments are not yet enabled. Please join the waitlist."` before any Stripe SDK call.
  - `false` → new users provisioned through `/api/welcome` get `plan = 'prelaunch'`, `analyses_limit = 10`, `status = 'active'`.
  - `true` → the Stripe checkout route accepts requests as before.
  - `true` → new users provisioned through `/api/welcome` get `plan = 'free'`, `analyses_limit = 3`, `status = 'active'` (original behaviour).

- `NEXT_PUBLIC_PAYMENTS_ENABLED` (client-safe)
  - `false` → `/pricing` shows the pre-launch banner, Pro/Team buttons become **Join Pro Waitlist** / **Join Team Waitlist**, and the Free plan card shows the note "Available after pre-launch".
  - `false` → in-app upgrade prompts (`UpgradeGate`) and CTA copy route users to waitlist messaging via `lib/upgradeCopy.js`.
  - `true` → pre-launch banner is hidden, Free plan card returns to normal, and Pro/Team buttons trigger the Stripe checkout flow.

### Prelaunch tier

- Plan key: `prelaunch`
- Analyses limit: **10 / month**
- Features: every Pro feature flag set to `true`; Team-only features (`auditTrail`, `brandedExport`) remain `false`.
- Stripe Price ID: none (`stripePriceIdEnv` is `null`, so the webhook never resolves a Stripe Price to `prelaunch`).

### Behaviour when both env vars are set to `true`

- `/api/stripe/checkout` accepts requests and creates a Stripe Checkout Session as before.
- New signups default to `free` with `analyses_limit = 3`.
- The pricing page shows the original **Upgrade** buttons and hides the pre-launch banner.
- In-app `UpgradeGate` CTAs render as **Upgrade to Pro / Team** instead of waitlist copy.
- The Stripe webhook continues to upsert `subscriptions` rows with the limits defined in `lib/plans.js`.

No code change is required to switch modes — only the env vars.

> **Note:** `NEXT_PUBLIC_PAYMENTS_ENABLED` is baked into the client bundle at build time. Toggling its value in Vercel requires triggering a redeploy before the change takes effect on the live frontend. `PAYMENTS_ENABLED` (server-only) takes effect immediately.

### Going-live checklist

- Register UAE company entity for Bidlyze
- Update legal pages with real company name, address, and trade licence number
- Connect Stripe account to the registered entity for business verification
- Set `PAYMENTS_ENABLED=true` and `NEXT_PUBLIC_PAYMENTS_ENABLED=true` in Vercel environment variables
- Verify `STRIPE_SECRET_KEY` is in live mode, not test mode
- Verify `STRIPE_PRO_PRICE_ID` and `STRIPE_TEAM_PRICE_ID` point to live Stripe Price objects
- Verify `STRIPE_WEBHOOK_SECRET` matches the live-mode webhook endpoint
- Decide migration policy for existing prelaunch users: grandfather, downgrade, or early-bird upgrade offer
- Email waitlist users with launch announcement and early-bird code

## Deployment

Deploy on any Node.js hosting platform (Vercel, Railway, AWS, etc.) with the environment variables configured in your project settings.

`maxDuration` is set to 300s on `/api/analyze` — make sure your hosting plan permits long-running serverless functions for large tender uploads.
