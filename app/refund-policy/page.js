import Link from "next/link";
import { LogoMark } from "@/app/components/Logo";

export const metadata = {
  title: "Refund Policy — Bidlyze",
  description: "Refund Policy for Bidlyze, the AI-powered RFx and tender intelligence platform.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md" style={{ background: "var(--bg-primary-translucent)", borderBottom: "1px solid var(--border-primary)" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-base font-semibold tracking-tight">Bidlyze</span>
          </Link>
          <Link href="/login" className="text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}>
            Sign In
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Refund Policy</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Last updated: May 16, 2026</p>

        <div className="mb-10 rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent-text)" }}>
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm leading-relaxed">
            <strong>Pre-launch notice:</strong> Bidlyze is currently in pre-launch and does not yet accept payments. All signed-up users receive Pro features with a monthly usage cap, free of charge. These terms will be updated with full merchant and payment-processor details before any paid plans go live.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>1. Overview</h2>
            <p>
              Bidlyze is operated by an individual founder based in Abu Dhabi, United Arab Emirates. A formal
              company registration is in progress. Once registered, this policy will be updated with the full
              legal entity details and customers will be notified.
            </p>
            <p className="mt-3">
              Refund procedures will be published when paid plans become available. The current pre-launch
              service is provided free of charge.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>2. Billing (pre-launch)</h2>
            <p>
              Bidlyze does not currently charge for any plan. Every signed-up user is on the pre-launch tier,
              which includes Pro features with a monthly usage cap and is free of charge. Current plan details
              are listed on our{" "}
              <Link href="/pricing" className="text-emerald-500 hover:underline">Pricing page</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>3. Refunds (when paid plans launch)</h2>
            <p>
              A refund policy will be published before paid plans become available. We will notify users by
              email and update this page with refund eligibility windows, request procedures, and processing
              times at that time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>4. Cancellation</h2>
            <p>
              Because the pre-launch service is free of charge, no cancellation is required. You may stop using
              the service at any time. If you wish to delete your account, contact{" "}
              <a href="mailto:support@bidlyze.com" className="text-emerald-500 hover:underline">support@bidlyze.com</a>.
              Cancellation behaviour for paid plans will be described here when those plans launch.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>5. Billing Issues</h2>
            <p>
              While Bidlyze is in pre-launch, no charges are made. If you have any other billing or account
              questions, please contact us at{" "}
              <a href="mailto:support@bidlyze.com" className="text-emerald-500 hover:underline">support@bidlyze.com</a>{" "}
              and we will respond as quickly as possible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>6. Changes to This Policy</h2>
            <p>
              We may update this Refund Policy from time to time. Changes will be posted on this page with an
              updated &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>7. Contact</h2>
            <p>For billing questions or refund requests:</p>
            <ul className="list-none mt-2 space-y-1">
              <li>Email: <a href="mailto:support@bidlyze.com" className="text-emerald-500 hover:underline">support@bidlyze.com</a></li>
              <li>Website: <a href="https://bidlyze.com" className="text-emerald-500 hover:underline">bidlyze.com</a></li>
            </ul>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            &copy; {new Date().getFullYear()} Bidlyze. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs" style={{ color: "var(--text-muted)" }}>
            <Link href="/terms" className="hover:text-emerald-500 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-emerald-500 transition-colors">Privacy</Link>
            <Link href="/refund-policy" className="text-emerald-500 font-medium">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
