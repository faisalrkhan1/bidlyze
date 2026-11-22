import Link from "next/link";
import { LogoFull } from "@/app/components/Logo";
import LandingPricingCards from "@/app/components/LandingPricingCards";

// Pre-launch flag — read once at build time so the banner/chip render
// statically on the public landing page. To flip back to "live payments"
// posture, set NEXT_PUBLIC_PAYMENTS_ENABLED=true in Vercel and redeploy.
const PAYMENTS_LIVE = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

export const metadata = {
  title: "Bidlyze",
  description:
    "Upload an RFI, RFQ, RFP or tender package and get a page-cited compliance matrix, a 20-point GCC disqualification check, clarification questions and a bid / no-bid recommendation.",
  keywords: "RFx analysis, RFP analysis, RFQ analysis, RFI analysis, tender intelligence, bid management, procurement intelligence, tender compliance, bid scoring, proposal automation, tender risk assessment, go no-go decision",
  openGraph: {
    title: "Bidlyze",
    description: "From raw RFx documents to a page-cited tender readiness report: requirements, GCC disqualification checks and clarification questions.",
    type: "website",
    locale: "en_US",
    siteName: "Bidlyze",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bidlyze",
    description: "From raw RFx documents to structured bid intelligence in minutes.",
  },
};

const FEATURES = [
  {
    title: "Page-Cited Compliance Matrix",
    description: "Every requirement in the RFP or tender package is listed with the file and page it came from, marked mandatory or desirable, and exported to Excel.",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  },
  {
    title: "Every Quote Checked Against the Document",
    description: "Bidlyze checks each quoted sentence against the tender text itself, not with AI, and labels it verified or unverified so you know what to double-check.",
    icon: "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
  },
  {
    title: "GCC Disqualification Check",
    description: "20 common GCC knockout items, such as bid bonds, ICV certificates, portal registration, OEM authorisation letters, site visits and stamped or Arabic documents, checked against your tender.",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  },
  {
    title: "Bid / No-Bid Recommendation",
    description: "A Bid, Conditional Bid or No-Bid recommendation with the reasons and the top actions, built from the findings in the report. The decision stays yours.",
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  },
  {
    title: "Clarification Questions",
    description: "Draft questions for the buyer about ambiguous or conflicting requirements, each tied to the page it refers to, ready to send before the clarification deadline.",
    icon: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  },
];

const STEPS = [
  { step: "01", title: "Upload Your Tender", description: "Upload the RFP or the full tender package: PDF, DOCX, XLSX or TXT files." },
  { step: "02", title: "Get a Cited Readiness Report", description: "Requirements, disqualification checks, key dates and clarification questions, each linked to the page it came from." },
  { step: "03", title: "Review and Decide", description: "Check anything flagged as unverified, export the Excel compliance matrix, and make the bid / no-bid call." },
];

const METRICS = [
  { value: "20", label: "GCC disqualification checks" },
  { value: "Page", label: "Citation on every finding" },
  { value: "4", label: "File types: PDF, DOCX, XLSX, TXT" },
  { value: "Excel", label: "Compliance matrix export" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Pre-launch banner — auto-hidden when NEXT_PUBLIC_PAYMENTS_ENABLED=true */}
      {!PAYMENTS_LIVE && (
        <div className="w-full text-center text-[13px] py-2.5 px-4" style={{ background: "var(--accent-muted)", color: "var(--accent-text)", borderBottom: "1px solid var(--accent-border)" }}>
          <span aria-hidden="true">🎁 </span>
          Bidlyze is in pre-launch — every signed-up user gets Pro features with 10 analyses/month, free.{" "}
          <a href="#pricing" className="font-semibold underline decoration-emerald-500/40 underline-offset-4 hover:decoration-emerald-500 transition-colors">
            Join waitlist for paid plans →
          </a>
        </div>
      )}

      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md" style={{ background: "var(--bg-primary-translucent)", borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center" style={{ color: "var(--ink)" }}>
            <LogoFull size={30} />
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: "var(--text-secondary)" }}>
            <a href="#features" className="hover:text-emerald-500 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-emerald-500 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-emerald-500 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}>
              Sign In
            </Link>
            <Link href="/login?tab=signup" className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #10b981, transparent 70%)" }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #10b981, transparent 70%)" }} />
        </div>

        <div className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center relative">
          <div className="flex items-center justify-center gap-2 flex-wrap mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: "var(--accent-muted)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              AI RFx & Tender Intelligence Platform
            </div>
            {!PAYMENTS_LIVE && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                <span aria-hidden="true">🎁</span>
                Free during pre-launch • Pro features included
              </div>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            From raw RFx documents<br />
            to structured bid intelligence<br />
            <span className="text-emerald-500">in minutes.</span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Upload any RFI, RFQ, RFP, or tender package and get AI-powered compliance mapping,
            requirement extraction, risk assessment, pricing analysis, and response planning — all in one platform.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login?tab=signup" className="px-7 py-3.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30">
              Start Analyzing — It&apos;s Free
            </Link>
            <a href="#how-it-works" className="px-7 py-3.5 rounded-xl text-sm font-semibold transition-all" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>
              See How It Works
            </a>
          </div>

          {/* Metrics bar */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {METRICS.map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-emerald-500">{m.value}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="py-20" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                RFx review is still <span style={{ color: "var(--text-muted)" }}>manual, slow, and inconsistent</span>
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
                Bid teams spend days reading dense RFP packages, manually extracting requirements into spreadsheets, and making pursuit decisions without structured data. Compliance gaps surface too late. Pricing is guesswork. Proposals start from scratch.
              </p>
              <div className="space-y-3">
                {["3–5 days to review a single RFP or tender package", "Requirements scattered across 50+ page documents", "No structured go/no-go qualification framework", "Response planning restarts from zero every time"].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
              <h3 className="text-lg font-bold mb-4 text-emerald-500">Bidlyze turns raw documents into structured intelligence</h3>
              <div className="space-y-4">
                {[
                  { label: "RFI / RFQ / RFP / Tender", detail: "One platform for every RFx document type in your pipeline" },
                  { label: "Requirement Extraction", detail: "Structured table with mandatory / desirable flags, status tracking and page citations" },
                  { label: "Disqualification Check", detail: "20 common GCC knockout items checked against the tender" },
                  { label: "Bid / No-Bid", detail: "A recommendation with reasons and top actions, built from the verified findings" },
                ].map((d) => (
                  <div key={d.label} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{d.label}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              One platform for the <span className="text-emerald-500">entire RFx workflow</span>
            </h2>
            <p className="text-sm max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              From document intake to response planning — Bidlyze covers qualification, compliance, commercial analysis, and proposal generation in one place.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl transition-all duration-300 group" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Three steps from document to decision
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
              No training required. Upload a document and get a structured report in a few minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-4xl font-bold text-emerald-500/20 mb-3">{s.step}</div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{s.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/login?tab=signup" className="inline-flex px-7 py-3.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-all shadow-lg shadow-emerald-500/20">
              Try Your First Analysis Free
            </Link>
          </div>
        </div>
      </section>

      {/* How findings are checked (replaces placeholder testimonials until real customers agree to be quoted) */}
      <section className="py-16" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-8 text-center">How Bidlyze keeps findings honest</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                title: "Every finding shows its page",
                body: "Each requirement and risk links to the file and page it came from, so a reviewer can check it in seconds.",
              },
              {
                title: "Quotes are checked by code",
                body: "After the AI reads the tender, Bidlyze searches the document text for every quoted sentence. Anything it cannot find is marked unverified.",
              },
              {
                title: "You make the call",
                body: "Bidlyze is a review aid, not a guarantee. Always confirm requirements against the tender documents before you submit.",
              },
            ].map((t) => (
              <div key={t.title} className="p-6 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                <h3 className="font-semibold mb-2">{t.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Plans built for RFx workflows
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
              All plans support RFI, RFQ, RFP, and other tender documents. Scale by workflow depth, not document types.
            </p>
          </div>

          <LandingPricingCards />

          <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
            All plans include RFI, RFQ, RFP, and tender document support.{" "}
            <a href="mailto:sales@bidlyze.com" className="text-emerald-500 hover:text-emerald-400 transition-colors">Contact sales</a>{" "}
            for custom enterprise pricing.
          </p>
        </div>
      </section>

      {/* Security & Trust */}
      <section className="py-16" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { icon: "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z", label: "Encrypted at rest & in transit" },
              { icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z", label: "Your data stays private" },
              { icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125", label: "No training on your data" },
              { icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", label: "Data retention policies apply" },
            ].map((item) => (
              <div key={item.label}>
                <div className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
                  <svg className="w-5 h-5" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Ready to turn RFx documents into structured intelligence?
          </h2>
          <p className="text-sm mb-8 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
            Join bid teams, consultants, and contractors who use Bidlyze to qualify, analyze, and respond to tenders faster.
          </p>
          <Link href="/login?tab=signup" className="inline-flex px-8 py-4 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-all shadow-lg shadow-emerald-500/20">
            Create Free Account
          </Link>
          <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            No credit card required. 3 free analyses per month.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center" style={{ color: "var(--ink)" }}>
              <LogoFull size={24} />
            </div>
            <div className="flex items-center gap-6 text-xs" style={{ color: "var(--text-muted)" }}>
              <a href="#pricing" className="hover:text-emerald-500 transition-colors">Pricing</a>
              <a href="mailto:support@bidlyze.com" className="hover:text-emerald-500 transition-colors">Support</a>
              <a href="mailto:sales@bidlyze.com" className="hover:text-emerald-500 transition-colors">Sales</a>
              <Link href="/login" className="hover:text-emerald-500 transition-colors">Sign In</Link>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-6">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              &copy; {new Date().getFullYear()} Bidlyze. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-xs" style={{ color: "var(--text-muted)" }}>
              <Link href="/terms" className="hover:text-emerald-500 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-emerald-500 transition-colors">Privacy</Link>
              <Link href="/refund-policy" className="hover:text-emerald-500 transition-colors">Refunds</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
