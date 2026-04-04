import Link from "next/link";
import { LogoMark } from "@/app/components/Logo";

export const metadata = {
  title: "Terms of Service — Bidlyze",
  description: "Terms of Service for Bidlyze, the AI-powered RFx and tender intelligence platform.",
};

export default function TermsPage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm mb-12" style={{ color: "var(--text-muted)" }}>Last updated: April 4, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>1. About Bidlyze</h2>
            <p>
              Bidlyze (&quot;we,&quot; &quot;us,&quot; or &quot;the Service&quot;) is a software-as-a-service (SaaS) platform
              that uses artificial intelligence to analyze RFI, RFQ, RFP, and tender documents. Bidlyze provides
              compliance mapping, requirement extraction, risk assessment, bid scoring, pricing analysis, and
              proposal generation to help procurement professionals and bid teams make faster, data-driven decisions.
            </p>
            <p className="mt-3">
              The Service is operated by Bidlyze and is accessible at{" "}
              <a href="https://bidlyze.com" className="text-emerald-500 hover:underline">bidlyze.com</a>.
              By accessing or using the Service, you agree to be bound by these Terms of Service. If you do not
              agree, you must not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>2. Eligibility</h2>
            <p>
              You must be at least 18 years of age and capable of forming a binding contract to use Bidlyze.
              By creating an account, you represent that the information you provide is accurate and complete,
              and that you will keep it up to date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>3. Subscription Plans & Billing</h2>
            <p>
              Bidlyze offers multiple subscription tiers, including a free plan and several paid plans with
              varying analysis volume, features, and collaboration capabilities. Current plan details and
              pricing are listed on our{" "}
              <Link href="/pricing" className="text-emerald-500 hover:underline">Pricing page</Link>.
              Enterprise plans are available with custom terms upon request.
            </p>
            <p className="mt-3">
              All paid subscriptions are billed on a monthly recurring basis. Payments are processed through
              our merchant of record, Paddle (Paddle.com Market Limited). By subscribing to a paid plan, you
              authorize Paddle to charge the applicable fees to your chosen payment method on a recurring basis
              until you cancel.
            </p>
            <p className="mt-3">
              Prices are displayed in USD and are exclusive of any applicable taxes. Paddle will calculate and
              collect applicable taxes at checkout based on your location.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>4. Free Plan</h2>
            <p>
              The Free plan provides access to core platform features with limited analysis volume. No credit
              card is required. The Free plan is offered at our discretion, and we reserve the right to modify
              its features or limits at any time with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>5. Cancellation</h2>
            <p>
              You may cancel your subscription at any time. Upon cancellation:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your subscription remains active until the end of the current billing period.</li>
              <li>You will not be charged for subsequent billing cycles.</li>
              <li>After the billing period ends, your account will transition to the Free plan with its associated features and limits.</li>
              <li>Data created during your paid subscription will remain accessible subject to Free plan retention limits.</li>
            </ul>
            <p className="mt-3">
              For details on refund eligibility, please refer to our{" "}
              <Link href="/refund-policy" className="text-emerald-500 hover:underline">Refund Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>6. Acceptable Use</h2>
            <p>You agree to use Bidlyze only for lawful purposes. You must not:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Upload or process documents that you do not have the right to use, share, or submit for analysis.</li>
              <li>Use the Service to process or store content that is unlawful, harmful, threatening, abusive, defamatory, or otherwise objectionable.</li>
              <li>Attempt to reverse-engineer, decompile, or disassemble any part of the Service.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service or its infrastructure.</li>
              <li>Use automated scripts, bots, or scrapers to access the Service beyond the provided interfaces.</li>
              <li>Share, resell, or sublicense access to the Service without written authorization.</li>
              <li>Upload documents containing malware, viruses, or malicious code.</li>
              <li>Violate any applicable local, national, or international law or regulation.</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these terms, with or without
              prior notice depending on the severity of the violation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>7. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the Service — including but not limited to the software,
              design, text, graphics, logos, and trademarks — are owned by Bidlyze and are protected by intellectual
              property laws.
            </p>
            <p className="mt-3">
              You retain ownership of any documents you upload. By uploading documents, you grant Bidlyze a
              limited, non-exclusive license to process those documents solely for the purpose of providing
              the analysis service to you. This includes transmitting document text to third-party AI services
              for processing. Bidlyze does not use your documents to train AI models, and we require that our
              AI service providers do not use your data for model training purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>8. Disclaimers</h2>
            <p>
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Bidlyze makes no warranties,
              express or implied, regarding the Service, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, or non-infringement.
            </p>
            <p className="mt-3">
              Bidlyze is an AI-powered analysis tool. All outputs generated by the Service — including
              compliance assessments, risk ratings, bid scores, proposal drafts, and any other analysis
              results — are intended solely as decision-support aids and do not constitute legal, financial,
              or professional advice. AI-generated outputs may contain inaccuracies, omissions, or errors.
              You are solely responsible for independently verifying all outputs before relying on them for
              any business, legal, or financial decision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Bidlyze and its officers, directors, employees,
              and agents shall not be liable for any indirect, incidental, special, consequential, or punitive
              damages, including but not limited to loss of profits, data, business opportunities, or goodwill,
              arising from or related to your use of (or inability to use) the Service.
            </p>
            <p className="mt-3">
              In no event shall our total aggregate liability exceed the total fees you paid for the Service in
              the twelve (12) months preceding the event giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>10. Modifications to the Service & Terms</h2>
            <p>
              We may update these Terms of Service from time to time. We will notify you of material changes by
              posting the revised terms on this page and updating the &quot;Last updated&quot; date. Your continued use of
              the Service after changes are posted constitutes acceptance of the revised terms.
            </p>
            <p className="mt-3">
              We reserve the right to modify, suspend, or discontinue any part of the Service at any time.
              Where practicable, we will provide reasonable notice of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>11. Governing Law & Disputes</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of
              Delaware, United States, without regard to conflict-of-law principles.
            </p>
            <p className="mt-3">
              Any dispute arising from these Terms or your use of the Service shall first be addressed through
              good-faith negotiation by contacting us at{" "}
              <a href="mailto:support@bidlyze.com" className="text-emerald-500 hover:underline">support@bidlyze.com</a>.
              If a resolution cannot be reached within thirty (30) days, either party may pursue resolution
              through the courts of the State of Delaware. Both parties consent to the exclusive jurisdiction
              and venue of those courts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>12. Contact</h2>
            <p>If you have any questions about these Terms of Service, please contact us:</p>
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
            <Link href="/terms" className="text-emerald-500 font-medium">Terms</Link>
            <Link href="/privacy" className="hover:text-emerald-500 transition-colors">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-emerald-500 transition-colors">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
