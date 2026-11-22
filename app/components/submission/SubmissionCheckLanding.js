// Public landing page when the Submission Check product is switched on.
// One promise, one workflow, honest about the closed beta (no prices, no sign-up pitch).

import Link from "next/link";
import { LogoFull } from "@/app/components/Logo";

const ACCESS = "mailto:support@bidlyze.com?subject=Submission%20Check%20beta%20access&body=Company%3A%0AYour%20role%3A%0AWhat%20you%20bid%20for%3A";

const STEPS = [
  ["Add the tender", "The ITT, RFP or RFQ, with its annexes. Bidlyze lists the requirements it finds and the page each comes from. The list can miss items, so your team checks it."],
  ["Add the proposal", "The supplier's technical proposal and any separate parts, such as the price schedule."],
  ["Run the check", "Each listed requirement is checked against the proposal. Usually two to three minutes."],
  ["Review the findings", "Needs attention, check manually or OK, each with the words from both documents and their pages."],
  ["Export the report", "An Excel action register with owners and your team's decisions, ready to work from."],
];

const TRUST = [
  ["Quotes checked in code", "Bidlyze checks that each quote appears word for word in the document, on the page it cites, and marks any quote it cannot find. This proves the words are there; whether they meet the requirement is a judgement your team confirms."],
  ["People make the call", "Findings are a starting point. Your reviewers agree or override each one, and the report keeps their decisions apart from the AI's."],
  ["Files stay with you", "Documents are read in your browser and the files are not uploaded. Their text is sent to Bidlyze and its AI provider (Anthropic's Claude, through OpenRouter) for the check. The proposal and the results are not stored on Bidlyze's servers."],
];

function Mark({ children }) {
  return <span style={{ backgroundImage: "linear-gradient(transparent 58%, var(--highlight) 58%, var(--highlight) 92%, transparent 92%)" }}>{children}</span>;
}

export default function SubmissionCheckLanding() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-[1080px] mx-auto px-5 sm:px-6 h-16 flex items-center gap-6">
          <Link href="/" aria-label="Bidlyze home" style={{ color: "var(--ink)" }}><LogoFull size={30} /></Link>
          <nav className="hidden sm:flex items-center gap-5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            <a href="#how" className="hover:underline underline-offset-4">How it works</a>
            <a href="#trust" className="hover:underline underline-offset-4">Evidence and privacy</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/login" className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }} data-testid="landing-signin">Sign in</Link>
            <a href={ACCESS} className="hidden sm:inline-flex items-center h-9 px-4 rounded-lg text-[14px] font-semibold text-white" style={{ background: "var(--accent)" }}>Request beta access</a>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-[1080px] mx-auto px-5 sm:px-6 pt-14 sm:pt-20 pb-16 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-start">
          <div className="space-y-6">
            <p className="text-[13px] font-medium inline-flex items-center gap-2 px-2.5 py-1 rounded-md" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>Submission Check, closed beta</p>
            <h1 className="text-[38px] sm:text-[48px] leading-[1.08] font-semibold tracking-[-0.025em] max-w-[16ch]">Find the gaps in a proposal before the buyer does.</h1>
            <p className="text-[17px] leading-relaxed max-w-[52ch]" style={{ color: "var(--text-secondary)" }}>
              Bidlyze lists the requirements in a tender, checks the supplier&apos;s proposal against each one, and quotes both documents with page numbers, so your team can see each finding for itself.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href={ACCESS} className="inline-flex items-center h-11 px-5 rounded-lg text-[15px] font-semibold text-white" style={{ background: "var(--accent)" }} data-testid="landing-access">Request beta access</a>
              <Link href="/login" className="inline-flex items-center h-11 px-5 rounded-lg text-[15px] font-medium" style={{ border: "1px solid var(--border-secondary)" }}>Sign in</Link>
            </div>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>For invited bid, presales and procurement teams. Free during the beta. An early beta: it can miss or misjudge a requirement, so your team reviews every finding.</p>
          </div>

          {/* A real finding from the sample check (public Alton Town Council tender, fictional supplier). */}
          <figure className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }} aria-label="Example finding">
            <div className="flex items-center gap-2 px-4 py-3 text-[13px]" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <span className="w-1 self-stretch rounded-full" style={{ background: "var(--st-attention)" }} aria-hidden="true" />
              <span className="font-semibold tabular" style={{ color: "var(--text-secondary)" }}>R14</span>
              <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[12px] font-semibold" style={{ color: "var(--st-attention)", background: "var(--st-attention-bg)", border: "1px solid var(--st-attention-border)" }}>Needs attention</span>
              <span className="text-[12px] ml-auto" style={{ color: "var(--text-muted)" }}>Contradiction in the proposal</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Tender, p.3</p>
                <blockquote className="font-document text-[15px] leading-[1.6] pl-3" style={{ borderLeft: "3px solid var(--border-secondary)" }}><Mark>Ensure the system stores at least 31 days of recordings</Mark> to be viewed by Officers and the Police.</blockquote>
              </div>
              <div>
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Proposal, p.6 and p.10</p>
                <blockquote className="font-document text-[15px] leading-[1.6] pl-3 space-y-2" style={{ borderLeft: "3px solid var(--st-attention)" }}>
                  <span className="block">Recorders are configured to <Mark>store at least 31 days</Mark> of continuous recordings from every camera.</span>
                  <span className="block">Recording retention <Mark>30 days</Mark> at full resolution from all cameras.</span>
                </blockquote>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>The equipment schedule states 30 days, contradicting the 31-day commitment and falling below the requirement.</p>
            </div>
            <figcaption className="px-4 py-2.5 text-[12px] flex items-center gap-2" style={{ borderTop: "1px solid var(--border-primary)", color: "var(--text-muted)" }}>
              Both quotes found word for word on the cited pages. From the sample check: a public UK tender and a fictional supplier.
            </figcaption>
          </figure>
        </section>

        <section id="how" className="py-16" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <div className="max-w-[1080px] mx-auto px-5 sm:px-6">
            <h2 className="text-[26px] font-semibold tracking-[-0.015em] mb-8">How a check works</h2>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="space-y-2">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold tabular" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>{i + 1}</span>
                  <p className="text-[15px] font-semibold">{t}</p>
                  <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="trust" className="py-16" style={{ borderTop: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
          <div className="max-w-[1080px] mx-auto px-5 sm:px-6">
            <h2 className="text-[26px] font-semibold tracking-[-0.015em] mb-8">Evidence, review and privacy</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {TRUST.map(([t, d]) => (
                <div key={t} className="space-y-2">
                  <p className="text-[15px] font-semibold">{t}</p>
                  <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{d}</p>
                </div>
              ))}
            </div>
            <p className="text-[13px] mt-10 max-w-[70ch]" style={{ color: "var(--text-muted)" }}>
              Bidlyze is an aid for your own review, not a compliance certificate. The requirement list is read by AI and can be incomplete, and whether a quote meets a requirement is an AI judgement that can be wrong: every finding needs a person to confirm it. <Link href="/privacy#submission-check" className="underline underline-offset-2">How documents are processed</Link>.
            </p>
          </div>
        </section>

        <section className="py-16" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <div className="max-w-[1080px] mx-auto px-5 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1">
              <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Try it on your next bid</h2>
              <p className="text-[15px] mt-1" style={{ color: "var(--text-secondary)" }}>We are inviting a small number of bid teams. Tell us what you bid for and we will set up your account.</p>
            </div>
            <a href={ACCESS} className="inline-flex items-center h-11 px-5 rounded-lg text-[15px] font-semibold text-white self-start sm:self-auto" style={{ background: "var(--accent)" }}>Request beta access</a>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-[1080px] mx-auto px-5 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center gap-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <p className="flex-1">&copy; {new Date().getFullYear()} Bidlyze</p>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:underline underline-offset-4">Terms</Link>
            <Link href="/privacy" className="hover:underline underline-offset-4">Privacy</Link>
            <a href="mailto:support@bidlyze.com" className="hover:underline underline-offset-4">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
