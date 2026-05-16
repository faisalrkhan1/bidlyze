import Link from "next/link";
import { LogoMark } from "@/app/components/Logo";

export const metadata = {
  title: "Privacy Policy — Bidlyze",
  description: "Privacy Policy for Bidlyze, the AI-powered RFx and tender intelligence platform.",
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
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
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>1. Introduction</h2>
            <p>
              Bidlyze (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your privacy and is committed to protecting
              your personal data. This Privacy Policy explains what information we collect, how we use it, and
              your choices regarding your data when you use our platform at{" "}
              <a href="https://bidlyze.com" className="text-emerald-500 hover:underline">bidlyze.com</a>.
            </p>
            <p className="mt-3">
              Bidlyze is operated by an individual founder based in Abu Dhabi, United Arab Emirates. A formal
              company registration is in progress. Once registered, this policy will be updated with the full
              legal entity details and customers will be notified.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>2. Information We Collect</h2>

            <h3 className="text-base font-semibold mt-4 mb-2" style={{ color: "var(--text-primary)" }}>2.1 Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Email address</li>
              <li>Name (if provided)</li>
              <li>Authentication credentials (managed securely by our authentication service provider — we never see or store your password directly)</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-2" style={{ color: "var(--text-primary)" }}>2.2 Documents You Upload</h3>
            <p>
              When you use Bidlyze to analyze RFx and tender documents, you upload files (PDF, DOCX, or TXT).
              The text content of these documents is sent to a third-party AI service via API to generate
              your analysis. We store your analysis results in your account so you can access them later.
            </p>

            <h3 className="text-base font-semibold mt-4 mb-2" style={{ color: "var(--text-primary)" }}>2.3 Usage Data</h3>
            <p>
              Our hosting infrastructure automatically collects standard server logs when you use the
              Service, which may include:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Pages requested and response times</li>
              <li>Time and date of requests</li>
              <li>Referring URL</li>
            </ul>
            <p className="mt-3">
              We do not currently use any third-party analytics or tracking services beyond standard
              server logs. If we add analytics tools in the future, we will update this policy.
            </p>

            <h3 className="text-base font-semibold mt-4 mb-2" style={{ color: "var(--text-primary)" }}>2.4 Payment Information</h3>
            <p>
              Bidlyze does not currently accept payments. When paid plans launch, payments will be processed
              by Stripe Inc., a third-party payment processor. Customers will be notified before any payment
              processing begins. Bidlyze will not store credit card numbers, CVVs, or bank account details on
              its servers — the payment processor will handle all card data in accordance with applicable PCI
              standards, and Bidlyze will receive only the transaction reference, plan type, and billing status.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, operate, and improve the Bidlyze platform</li>
              <li>Process your document analyses and deliver results</li>
              <li>Manage your account and subscription</li>
              <li>Process payments (when paid plans launch; not applicable during pre-launch)</li>
              <li>Send transactional emails (account verification, analysis summaries, usage notifications, and important service updates)</li>
              <li>Monitor usage to enforce plan limits and detect abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              <strong style={{ color: "var(--text-primary)" }}>We do not use your uploaded documents or analysis data to train AI models.</strong>{" "}
              Your document content is sent to our AI provider solely to generate your analysis results, then
              is not retained by the AI provider beyond what is needed to process the request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>4. Cookies & Local Storage</h2>
            <p>
              Bidlyze uses only <strong>essential cookies</strong> required for authentication and session
              management. These are set by our authentication service and are necessary for the
              platform to function. We do not use advertising cookies, tracking pixels, or third-party
              analytics cookies.
            </p>
            <p className="mt-3">
              We also use browser local storage to save your theme preference (light/dark mode). This data
              stays on your device and is not transmitted to our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>5. Third-Party Services</h2>
            <p>
              To operate the Service, we work with trusted third-party providers in the following categories:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Authentication & data storage</strong> — We use a third-party service to manage user accounts, secure authentication, and store your account data and analysis results.</li>
              <li><strong>AI & document processing</strong> — We use third-party AI services to analyze uploaded document content and generate structured outputs for you. These providers process data only to the extent necessary to deliver the requested analysis, subject to their own privacy and data processing terms.</li>
              <li><strong>Payment processing (when paid plans launch)</strong> — When paid plans launch, payments will be processed by Stripe Inc., a third-party payment processor. Stripe will handle all billing, invoicing, and tax-related processing on our behalf. Customers will be notified before any payment processing begins.</li>
              <li><strong>Hosting & infrastructure</strong> — We use a third-party cloud platform to host the Bidlyze application, serve web requests, and maintain standard server logs.</li>
              <li><strong>Email delivery</strong> — We use a third-party provider to deliver transactional emails, including account notifications and analysis summaries.</li>
            </ul>
            <p className="mt-3">
              Each provider operates under its own privacy policy and terms of service. We share data with
              third parties only to the extent necessary to provide the Service to you. We may use additional
              service providers and subprocessors to support the operation of the Service. Information about
              relevant subprocessors may be provided upon reasonable request by contacting{" "}
              <a href="mailto:support@bidlyze.com" className="text-emerald-500 hover:underline">support@bidlyze.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>6. International Data Processing</h2>
            <p>
              Bidlyze is operated from and our primary infrastructure is hosted in the United States. Our
              third-party service providers may process data in the United States and other countries. By
              using the Service, you acknowledge that your data may be transferred to and processed in
              jurisdictions outside your country of residence, which may have different data protection
              laws than your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>7. Data Storage & Security</h2>
            <p>
              We take reasonable steps to protect your personal data. The security measures currently in
              place include:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>All data transmitted between your browser and our servers is encrypted via TLS (HTTPS)</li>
              <li>Authentication is managed by a dedicated service provider that handles password hashing and session tokens</li>
              <li>Database access is restricted using row-level security policies, ensuring users can only access their own data</li>
              <li>API endpoints verify user authentication before processing requests</li>
              <li>We do not store payment credentials — when paid plans launch, all card data will be handled by the payment processor and never reaches Bidlyze servers</li>
            </ul>
            <p className="mt-3">
              Our infrastructure providers maintain their own security certifications and encrypt data at
              rest on their platforms. While we rely on these providers&apos; security measures and take
              care in our own application design, no system is 100% secure. We cannot guarantee absolute
              security and will notify affected users promptly if a data breach occurs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>8. Data Retention</h2>
            <p>
              We retain your account data and analysis results for as long as your account is active.
              Retention periods vary by plan:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Free plan:</strong> Analysis history is accessible for 30 days from creation.</li>
              <li><strong>Paid plans:</strong> Analysis history is retained for as long as your subscription is active.</li>
            </ul>
            <p className="mt-3">
              If you wish to delete your account and associated data, please contact us at{" "}
              <a href="mailto:support@bidlyze.com" className="text-emerald-500 hover:underline">support@bidlyze.com</a>.
              We will process deletion requests within 30 days, except where we are required to retain
              certain data for legal or regulatory purposes (such as billing records).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>9. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Access</strong> the personal data we hold about you</li>
              <li><strong>Correct</strong> inaccurate or incomplete data</li>
              <li><strong>Delete</strong> your personal data (&quot;right to be forgotten&quot;)</li>
              <li><strong>Export</strong> your data in a commonly used format</li>
              <li><strong>Withdraw consent</strong> for data processing where consent is the legal basis</li>
              <li><strong>Object</strong> to processing of your personal data</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please email{" "}
              <a href="mailto:support@bidlyze.com" className="text-emerald-500 hover:underline">support@bidlyze.com</a>{" "}
              with the subject line &quot;Privacy Request.&quot; We will respond within 30 days. Note that some
              requests are handled manually at this stage, so please allow reasonable time for processing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>10. Children&apos;s Privacy</h2>
            <p>
              Bidlyze is a business tool designed for professionals. It is not directed at individuals under
              18 years of age. We do not knowingly collect personal data from children. If we learn that we
              have collected data from a child, we will promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by
              posting the revised policy on this page and updating the &quot;Last updated&quot; date. Your continued use
              of the Service after changes are posted constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>12. Contact</h2>
            <p>If you have any questions about this Privacy Policy or your personal data, please contact us:</p>
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
            <Link href="/privacy" className="text-emerald-500 font-medium">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-emerald-500 transition-colors">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
