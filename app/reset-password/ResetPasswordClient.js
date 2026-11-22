"use client";

// Set a new password after following a password-reset e-mail.
//
// The Supabase recovery link signs the browser in with a short recovery session
// (see lib/auth-recovery.js for every shape the link can arrive in). This page
// checks that session, asks for the new password twice, saves it with
// supabase.auth.updateUser({ password }), and then signs out the account's other
// devices. Expired, used or invalid links get a clear message and a way to ask
// for a new e-mail. Nothing else on the account changes.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getLoginRedirectTarget } from "@/lib/auth-redirect";
import { LogoMark, LogoWordmark } from "@/app/components/Logo";
import ThemeToggle from "@/app/components/ThemeToggle";
import {
  MIN_PASSWORD_LENGTH,
  RECOVERY_FLAG_KEY,
  RESET_PATH,
  makeRecoveryFlag,
  newPasswordProblem,
  parseRecoveryUrl,
  passwordUpdateError,
  readRecoveryFlag,
  recoveryLinkErrorMessage,
  resetRedirectUrl,
  resetRequestError,
} from "@/lib/auth-recovery";

const INPUT =
  "w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors duration-300";
const INPUT_STYLE = { background: "var(--bg-input)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" };
const PRIMARY =
  "w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white";

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export default function ResetPasswordClient() {
  const router = useRouter();
  // checking | form | done | invalid | request | sent
  const [view, setView] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkProblem, setLinkProblem] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [othersSignedOut, setOthersSignedOut] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  // A token hash (custom e-mail template) is only exchanged when the new password
  // is submitted, so a mail scanner that opens the link cannot use it up.
  const pendingTokenHash = useRef(null);

  function established(session) {
    setAccount(session.user?.email || "");
    setEmail(session.user?.email || "");
    storage()?.setItem(RECOVERY_FLAG_KEY, makeRecoveryFlag(session.user.id));
  }

  function linkFailed(message) {
    storage()?.removeItem(RECOVERY_FLAG_KEY);
    setLinkProblem(message);
    setError("");
    setView("invalid");
  }

  useEffect(() => {
    let cancelled = false;
    // Read the address before anything else on this page touches the Supabase client.
    const link = parseRecoveryUrl(window.location.href);
    const cleanAddress = () => window.history.replaceState(window.history.state, "", RESET_PATH);

    async function start() {
      if (link.kind === "error") {
        cleanAddress();
        linkFailed(recoveryLinkErrorMessage(link.errorCode, link.errorDescription));
        return;
      }
      if (link.kind === "token_hash") {
        cleanAddress();
        if (link.type !== "recovery") {
          linkFailed(recoveryLinkErrorMessage("invalid"));
          return;
        }
        pendingTokenHash.current = link.tokenHash;
        setView("form");
        return;
      }

      const sb = getSupabase();

      if (link.kind === "code") {
        const { data, error: codeError } = await sb.auth.exchangeCodeForSession(link.code);
        cleanAddress();
        if (cancelled) return;
        if (codeError || !data?.session) {
          linkFailed(recoveryLinkErrorMessage("bad_code_verifier"));
          return;
        }
        established(data.session);
        setView("form");
        return;
      }

      if (link.kind === "implicit") {
        // The Supabase client reads the tokens from the address while it starts,
        // checks them with Supabase (GET /auth/v1/user) and stores the session.
        const { error: initError } = await sb.auth.initialize();
        const {
          data: { session },
        } = await sb.auth.getSession();
        cleanAddress();
        if (cancelled) return;
        if (initError || !session || session.access_token !== link.accessToken) {
          linkFailed(recoveryLinkErrorMessage(initError?.code || initError?.details?.code, initError?.message || "invalid"));
          return;
        }
        if (link.type !== "recovery") {
          // A sign-in link rather than a reset link: just continue into the app.
          router.replace(getLoginRedirectTarget(null, window.location.origin));
          return;
        }
        established(session);
        setView("form");
        return;
      }

      // No link in the address: still in a recovery session from this tab (page refreshed)?
      const uid = readRecoveryFlag(storage()?.getItem(RECOVERY_FLAG_KEY));
      if (uid) {
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (cancelled) return;
        if (session?.user?.id === uid) {
          established(session);
          setView("form");
          return;
        }
        storage()?.removeItem(RECOVERY_FLAG_KEY);
      }
      if (!cancelled) setView("request");
    }

    start().catch(() => {
      if (!cancelled) linkFailed(recoveryLinkErrorMessage("invalid"));
    });
    // A new link opened in this same tab only changes the part after "#": start again.
    const onHashChange = () => {
      if (parseRecoveryUrl(window.location.href).kind !== "none") window.location.reload();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHashChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function saveNewPassword(e) {
    e.preventDefault();
    setError("");
    const problem = newPasswordProblem(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const sb = getSupabase();
    try {
      if (pendingTokenHash.current) {
        const { data, error: verifyError } = await sb.auth.verifyOtp({ token_hash: pendingTokenHash.current, type: "recovery" });
        if (verifyError || !data?.session) {
          const m = passwordUpdateError(verifyError || { code: "otp_expired" });
          if (m.expired) linkFailed(m.message);
          else setError(m.message);
          return;
        }
        pendingTokenHash.current = null;
        established(data.session);
      }

      const { error: updateError } = await sb.auth.updateUser({ password });
      if (updateError) {
        const m = passwordUpdateError(updateError);
        if (m.expired) linkFailed(m.message);
        else setError(m.message);
        return;
      }

      storage()?.removeItem(RECOVERY_FLAG_KEY);
      // The password is saved. End the account's sessions on other devices, keep this one.
      const { error: signOutError } = await sb.auth.signOut({ scope: "others" });
      setOthersSignedOut(!signOutError);
      setPassword("");
      setConfirm("");
      setView("done");
    } catch (err) {
      setError(passwordUpdateError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendResetLink(e, address = email) {
    e?.preventDefault?.();
    setError("");
    const to = String(address || "").trim();
    if (!to) {
      setError("Enter the e-mail address of your Bidlyze account.");
      return;
    }
    setBusy(true);
    try {
      const { error: sendError } = await getSupabase().auth.resetPasswordForEmail(to, {
        redirectTo: resetRedirectUrl(window.location.origin),
      });
      if (sendError) {
        setError(resetRequestError(sendError));
        return;
      }
      setSentTo(to);
      setCooldown(60);
      setView("sent");
    } catch (err) {
      setError(resetRequestError(err));
    } finally {
      setBusy(false);
    }
  }

  const requestForm = (
    <form onSubmit={sendResetLink} className="space-y-4" data-testid="reset-request-form">
      <div>
        <label htmlFor="reset-email" className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
          E-mail
        </label>
        <input
          id="reset-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
          style={INPUT_STYLE}
          placeholder="you@example.com"
        />
      </div>
      <button type="submit" disabled={busy} className={PRIMARY} data-testid="reset-send">
        {busy ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );

  let title;
  let intro;
  let body;
  if (view === "checking") {
    title = "Checking your reset link";
    intro = "One moment.";
    body = (
      <div className="flex justify-center py-6" role="status" aria-live="polite">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        <span className="sr-only">Checking your reset link</span>
      </div>
    );
  } else if (view === "form") {
    title = "Set a new password";
    intro = account ? (
      <>
        For <strong data-testid="reset-account">{account}</strong>. Your documents and checks stay as they are.
      </>
    ) : (
      "Choose a new password for your Bidlyze account. Your documents and checks stay as they are."
    );
    body = (
      <form onSubmit={saveNewPassword} noValidate className="space-y-4" data-testid="reset-password-form">
        {/* Lets password managers file the new password under the right account. */}
        <input type="text" name="username" autoComplete="username" value={account} readOnly hidden />
        <div>
          <label htmlFor="new-password" className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
            New password
          </label>
          <input
            id="new-password"
            type={showPasswords ? "text" : "password"}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
            style={INPUT_STYLE}
            aria-describedby="new-password-hint"
          />
          <p id="new-password-hint" className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            At least {MIN_PASSWORD_LENGTH} characters. A longer phrase is stronger.
          </p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type={showPasswords ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={INPUT}
            style={INPUT_STYLE}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} />
          Show passwords
        </label>
        <button type="submit" disabled={busy} className={PRIMARY} data-testid="reset-save">
          {busy ? "Saving..." : "Save new password"}
        </button>
      </form>
    );
  } else if (view === "done") {
    title = "Password changed";
    intro = othersSignedOut
      ? "Your new password is saved and you are signed in. Any other devices signed in to this account have been signed out."
      : "Your new password is saved and you are signed in.";
    body = (
      <button
        type="button"
        className={PRIMARY}
        data-testid="reset-continue"
        onClick={() => router.push(getLoginRedirectTarget(null, window.location.origin))}
      >
        Continue to Bidlyze
      </button>
    );
  } else if (view === "invalid") {
    title = "This link can't be used";
    intro = (
      <>
        <span data-testid="reset-link-problem">{linkProblem}</span> Enter your e-mail to get a new link.
      </>
    );
    body = requestForm;
  } else if (view === "sent") {
    title = "Check your e-mail";
    intro = (
      <>
        If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. Open the newest e-mail and use its link
        soon: each link works once and expires. Check your spam folder if it has not arrived in a few minutes.
      </>
    );
    body = (
      <button
        type="button"
        disabled={busy || cooldown > 0}
        className={PRIMARY}
        data-testid="reset-send-again"
        onClick={() => sendResetLink(null, sentTo)}
      >
        {busy ? "Sending..." : cooldown > 0 ? `Send again in ${cooldown} s` : "Send again"}
      </button>
    );
  } else {
    title = "Reset your password";
    intro = "Enter the e-mail address of your Bidlyze account. We will send you a link to set a new password.";
    body = requestForm;
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="absolute top-5 right-6 z-10">
        <ThemeToggle />
      </div>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]" data-testid={`reset-view-${view}`}>
          <Link href="/" className="flex flex-col items-center mb-10" aria-label="Bidlyze home">
            <div className="mb-4">
              <LogoMark size={44} />
            </div>
            <span style={{ color: "var(--ink)" }}>
              <LogoWordmark capHeight={18} />
            </span>
          </Link>

          <h1 className="text-xl font-bold tracking-tight mb-1">{title}</h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {intro}
          </p>

          {body}

          {error && (
            <div role="alert" data-testid="reset-error" className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {view !== "checking" && view !== "done" && (
            <p className="mt-6 text-center text-sm">
              <Link href="/login" className="transition-colors" style={{ color: "var(--text-muted)" }}>
                Back to sign in
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
