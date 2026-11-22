"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getLoginRedirectTarget } from "@/lib/auth-redirect";
import { LogoFull, LogoMark, LogoWordmark } from "@/app/components/Logo";
import ThemeToggle from "@/app/components/ThemeToggle";
import { PLANS } from "@/lib/plans";
import { submissionCheckBetaClient } from "@/lib/submission/beta";

// With Submission Check switched on, this page speaks about that one product and its closed beta.
const PRODUCT = submissionCheckBetaClient();

// Free allowance shown to new users: pre-launch tier until payments go live.
const FREE_ANALYSES =
  process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true" ? PLANS.free.analysesLimit : PLANS.prelaunch.analysesLimit;

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: "Bid / No-Bid Recommendation",
    description: "A recommendation with reasons and top actions, built from the findings",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    ),
    title: "Page-Cited Compliance Matrix",
    description: "Every requirement with the page it came from, exported to Excel",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    title: "GCC Disqualification Check",
    description: "20 common knockout items, such as bid bonds, ICV and OEM letters",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    title: "Clarification Questions",
    description: "Draft questions for the buyer, each tied to its page",
  },
];

const SC_COPY = {
  features: [
    { title: "Requirements listed, then checked", description: "Bidlyze lists the tender's requirements and checks the proposal against each one, quoting both documents." },
    { title: "Quotes verified word for word", description: "Bidlyze confirms each quote is on the page it cites. Your team decides what the findings mean." },
    { title: "Files stay with you", description: "Documents are read in your browser; only their text is sent for the check." },
  ],
  chips: ["Closed beta for invited teams", "Free during the beta", "Files read in your browser"],
  tagline: "Submission Check",
};

export default function LoginPageClient() {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = getLoginRedirectTarget(
    searchParams.get("next"),
    typeof window === "undefined" ? undefined : window.location.origin
  );

  useEffect(() => {
    let mounted = true;

    getSupabase().auth.getUser().then(({ data: { user } }) => {
      if (mounted && user) {
        router.replace(nextTarget);
      }
    }).catch(() => {
      // Auth check failed — stay on login page
    });

    return () => {
      mounted = false;
    };
  }, [nextTarget, router]);

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message === "Invalid login credentials") {
          setError("Invalid email or password. Please try again.");
        } else if (error.message.includes("Email not confirmed")) {
          setError("Please confirm your email before signing in. Check your inbox.");
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      router.push(nextTarget);
    } catch (err) {
      setError(err.message || "Sign in failed. Please try again.");
      setLoading(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await getSupabase().auth.signUp({ email, password });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setMessage("Check your email for a confirmation link, then sign in.");
      setTab("signin");
      setPassword("");
      setConfirmPassword("");
      setLoading(false);
    } catch (err) {
      setError(err.message || "Sign up failed. Please try again.");
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setMessage("Password reset link sent. Check your email.");
      setForgotMode(false);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to send reset email. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Theme toggle */}
      <div className="absolute top-5 right-6 z-10">
        <ThemeToggle />
      </div>

      {/* Left Panel - Product Highlights */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between p-10 relative overflow-hidden" style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-primary)" }}>

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center mb-12" style={{ color: "var(--ink)" }}>
            <LogoFull size={36} />
          </div>

          {/* Headline */}
          {PRODUCT ? (
            <>
              <h1 className="text-3xl xl:text-4xl font-semibold tracking-[-0.02em] leading-tight mb-4">Find the gaps in a proposal before the buyer does.</h1>
              <p className="text-sm leading-relaxed mb-10 max-w-sm" style={{ color: "var(--text-secondary)" }}>
                Check a supplier&apos;s proposal against the tender&apos;s requirements, with both documents quoted and page numbers, for your team to review.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight mb-4">
                From raw RFx documents<br />to structured bid<br />
                <span className="text-emerald-500">intelligence</span>
              </h1>
              <p className="text-sm leading-relaxed mb-10 max-w-sm" style={{ color: "var(--text-secondary)" }}>
                Upload an RFI, RFQ, RFP or tender package and get a page-cited readiness report: requirements, GCC disqualification checks and clarification questions.
              </p>
            </>
          )}

          {/* Feature list */}
          <div className="space-y-4">
            {(PRODUCT ? SC_COPY.features.map((f, i) => ({ ...f, icon: FEATURES[i % FEATURES.length].icon })) : FEATURES).map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold mb-0.5">{f.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="relative mt-8 pt-6" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <div className="flex items-center gap-4 flex-wrap">
            {(PRODUCT ? SC_COPY.chips : ["No credit card required", `${FREE_ANALYSES} free analyses per month`, "Data encrypted at rest"]).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo + trust */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="mb-4"><LogoMark size={52} /></div>
            <span style={{ color: "var(--ink)" }}><LogoWordmark capHeight={20} /></span>
            <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{PRODUCT ? SC_COPY.tagline : "AI RFx & Tender Intelligence"}</p>
            <div className="flex items-center gap-4 mt-4 flex-wrap justify-center">
              {(PRODUCT ? SC_COPY.chips : ["No credit card required", `${FREE_ANALYSES} free analyses`, "Results in minutes"]).map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-xl font-bold tracking-tight mb-1">
              {forgotMode ? "Reset your password" : tab === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {forgotMode
                ? "Enter your email and we'll send you a reset link"
                : tab === "signin"
                ? "Sign in to continue to Bidlyze"
                : PRODUCT
                ? "Anyone can try the sample tender. Invited teams can check their own documents."
                : `${FREE_ANALYSES} free analyses per month. No credit card required.`}
            </p>
          </div>

          {/* Tab Switcher (hidden in forgot mode) */}
          {!forgotMode && (
            <div className="flex mb-6 rounded-xl overflow-hidden transition-colors duration-300" style={{ border: "1px solid var(--border-secondary)" }}>
              <button
                onClick={() => { setTab("signin"); setError(""); setMessage(""); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === "signin" ? "bg-emerald-500 text-white" : ""
                }`}
                style={tab !== "signin" ? { color: "var(--text-secondary)" } : {}}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab("signup"); setError(""); setMessage(""); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === "signup" ? "bg-emerald-500 text-white" : ""
                }`}
                style={tab !== "signup" ? { color: "var(--text-secondary)" } : {}}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Forgot Password Form */}
          {forgotMode && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors duration-300"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setError(""); }}
                className="w-full text-center text-sm transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Back to sign in
              </button>
            </form>
          )}

          {/* Sign In Form */}
          {!forgotMode && tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors duration-300"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm" style={{ color: "var(--text-secondary)" }}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(""); setMessage(""); }}
                    className="text-xs font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors duration-300"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                  placeholder="Enter your password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {!forgotMode && tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors duration-300"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors duration-300"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors duration-300"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }}
                  placeholder="Confirm your password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
