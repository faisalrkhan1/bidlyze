"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AnalyzeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // This page previously displayed transient analysis results from sessionStorage.
    // Analyses are now saved to the database and users are redirected to /analysis/[id].
    // Redirect any visitors to the dashboard.
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
