import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Bidlyze — AI RFx & Tender Intelligence Platform",
    template: "%s | Bidlyze",
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
    title: "Bidlyze — AI RFx & Tender Intelligence Platform",
    description: "From raw RFx documents to structured bid intelligence. Compliance, requirements, risks, and response planning in one platform.",
    type: "website",
    locale: "en_US",
    siteName: "Bidlyze",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bidlyze — AI RFx & Tender Intelligence",
    description: "From raw RFx documents to structured bid intelligence in minutes.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} font-[family-name:var(--font-outfit)] antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
