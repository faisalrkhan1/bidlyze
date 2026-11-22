import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { RECOVERY_FORWARD_SCRIPT } from "@/lib/auth-recovery";

// Public Sans (interface) and Source Serif 4 (quoted document text), both SIL OFL,
// served from the app itself (no Google Fonts request).
const sans = localFont({ src: "./fonts/PublicSans-Variable.woff2", variable: "--font-sans", weight: "100 900", display: "swap" });
const serif = localFont({ src: "./fonts/SourceSerif4-Variable.woff2", variable: "--font-serif", weight: "200 900", display: "swap" });

export const metadata = {
  title: {
    default: "Bidlyze",
    template: "Bidlyze",
  },
  description:
    "Analyze RFI, RFQ, RFP, and tender packages with AI. Compliance mapping, requirement extraction, risk assessment, pricing analysis, and response planning in one platform.",
  keywords: [
    "RFx analysis",
    "RFP analysis",
    "RFQ analysis",
    "RFI analysis",
    "tender intelligence",
    "bid management",
    "procurement intelligence",
    "tender compliance",
    "bid scoring",
    "proposal automation",
    "requirement extraction",
    "bid qualification",
  ],
  authors: [{ name: "Bidlyze" }],
  creator: "Bidlyze",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://bidlyze.com"),
  openGraph: {
    title: "Bidlyze",
    description: "From raw RFx documents to structured bid intelligence. Compliance, requirements, risks, and response planning in one platform.",
    type: "website",
    locale: "en_US",
    siteName: "Bidlyze",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bidlyze",
    description: "From raw RFx documents to structured bid intelligence in minutes.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* A password-reset link that lands on another page (Supabase falls back to the
            Site URL when the reset address is not allowed) is handed to /reset-password
            before that page's own code can use up the one-time tokens. */}
        <script dangerouslySetInnerHTML={{ __html: RECOVERY_FORWARD_SCRIPT }} />
      </head>
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
