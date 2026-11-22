// Password recovery helpers: link parsing, password rules, error wording, and the
// <head> script that forwards a recovery link from another page to /reset-password.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  RECOVERY_FORWARD_SCRIPT,
  makeRecoveryFlag,
  newPasswordProblem,
  parseRecoveryUrl,
  passwordUpdateError,
  readRecoveryFlag,
  recoveryLinkErrorMessage,
  resetRedirectUrl,
  resetRequestError,
  shouldForwardToReset,
} from "../../lib/auth-recovery.js";

const IMPLICIT = "#access_token=eyJ.a.b&expires_at=1795340000&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery";
const EXPIRED = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

test("the reset e-mail returns to the dedicated page on the same site", () => {
  assert.equal(resetRedirectUrl("https://bidlyze.com"), "https://bidlyze.com/reset-password");
  assert.equal(resetRedirectUrl("https://app.bidlyze.com/"), "https://app.bidlyze.com/reset-password");
});

test("parses every shape a Supabase recovery redirect can take", () => {
  assert.deepEqual(parseRecoveryUrl(`https://bidlyze.com/reset-password${IMPLICIT}`), { kind: "implicit", type: "recovery", accessToken: "eyJ.a.b" });
  assert.deepEqual(parseRecoveryUrl(`https://bidlyze.com/reset-password${EXPIRED}`), {
    kind: "error",
    errorCode: "otp_expired",
    errorDescription: "Email link is invalid or has expired",
  });
  assert.deepEqual(parseRecoveryUrl("https://bidlyze.com/reset-password?error=access_denied&error_description=Bad"), {
    kind: "error",
    errorCode: "access_denied",
    errorDescription: "Bad",
  });
  assert.deepEqual(parseRecoveryUrl("https://bidlyze.com/reset-password?token_hash=pkce_abc&type=recovery"), { kind: "token_hash", type: "recovery", tokenHash: "pkce_abc" });
  assert.deepEqual(parseRecoveryUrl("https://bidlyze.com/reset-password?code=123"), { kind: "code", code: "123" });
  assert.deepEqual(parseRecoveryUrl("https://bidlyze.com/reset-password"), { kind: "none" });
  assert.deepEqual(parseRecoveryUrl("not a url"), { kind: "none" });
  // An error wins over tokens in the same address.
  assert.equal(parseRecoveryUrl(`https://x.test/reset-password${IMPLICIT}&error_code=otp_expired`).kind, "error");
});

test("expired and invalid links get plain-language messages", () => {
  assert.match(recoveryLinkErrorMessage("otp_expired", "Email link is invalid or has expired"), /expired or has already been used/);
  assert.match(recoveryLinkErrorMessage("access_denied", "Email link is invalid or has expired"), /expired or has already been used/);
  assert.match(recoveryLinkErrorMessage("bad_code_verifier"), /same browser/);
  assert.match(recoveryLinkErrorMessage("something_else", ""), /not valid/);
});

test("new password rules: length, not blank, both entries match", () => {
  assert.match(newPasswordProblem("short", "short"), /at least 8/);
  assert.match(newPasswordProblem("x".repeat(73), "x".repeat(73)), /at most 72/);
  assert.match(newPasswordProblem("        ", "        "), /only spaces/);
  assert.match(newPasswordProblem("correct horse", "correct hors"), /do not match/);
  assert.equal(newPasswordProblem("correct horse battery", "correct horse battery"), null);
});

test("Supabase errors on saving the password map to clear guidance", () => {
  assert.deepEqual(passwordUpdateError({ code: "same_password", status: 422 }), {
    expired: false,
    message: "Your new password must be different from your current password.",
  });
  const weak = passwordUpdateError({ name: "AuthWeakPasswordError", code: "weak_password", status: 422, reasons: ["pwned", "length"] });
  assert.equal(weak.expired, false);
  assert.match(weak.message, /known data breach/);
  assert.match(weak.message, /too short/);
  assert.equal(passwordUpdateError({ name: "AuthSessionMissingError", status: 400 }).expired, true);
  assert.equal(passwordUpdateError({ code: "session_not_found", status: 403 }).expired, true);
  assert.equal(passwordUpdateError({ code: "otp_expired", status: 403 }).expired, true);
  assert.equal(passwordUpdateError({ code: "reauthentication_needed", status: 400 }).expired, true);
  assert.match(passwordUpdateError({ code: "over_request_rate_limit", status: 429 }).message, /Wait a minute/);
  assert.match(passwordUpdateError({ name: "AuthRetryableFetchError", status: 0 }).message, /connection/);
});

test("reset e-mail request errors", () => {
  assert.match(resetRequestError({ code: "over_email_send_rate_limit", status: 429, message: "email rate limit exceeded" }), /Wait a few minutes/);
  assert.equal(
    resetRequestError({ code: "over_request_rate_limit", status: 429, message: "For security purposes, you can only request this after 41 seconds." }),
    "For security purposes, you can only request this after 41 seconds. Then try again."
  );
  assert.match(resetRequestError({ name: "AuthRetryableFetchError" }), /connection/);
});

test("forwarding rules: recovery tokens anywhere, link errors on home or sign-in only", () => {
  assert.equal(shouldForwardToReset("/", IMPLICIT), true, "Supabase fell back to the Site URL");
  assert.equal(shouldForwardToReset("/login", IMPLICIT), true, "old e-mails pointed at /login");
  assert.equal(shouldForwardToReset("/submission-check", IMPLICIT), true);
  assert.equal(shouldForwardToReset("/reset-password", IMPLICIT), false, "already there");
  assert.equal(shouldForwardToReset("/", EXPIRED), true);
  assert.equal(shouldForwardToReset("/login", EXPIRED), true);
  assert.equal(shouldForwardToReset("/pricing", EXPIRED), false);
  assert.equal(shouldForwardToReset("/", "#access_token=a&type=signup&refresh_token=r"), false, "not a reset link");
  assert.equal(shouldForwardToReset("/", "#how"), false, "ordinary page anchors are left alone");
  assert.equal(shouldForwardToReset("/", ""), false);
});

test("the <head> script makes the same decision as shouldForwardToReset", () => {
  const cases = [
    ["/", IMPLICIT, "?x=1"],
    ["/login", IMPLICIT, ""],
    ["/reset-password", IMPLICIT, ""],
    ["/", EXPIRED, ""],
    ["/pricing", EXPIRED, ""],
    ["/", "#trust", ""],
    ["/", "", ""],
    ["/history", "#access_token=a&type=magiclink&refresh_token=r", ""],
  ];
  for (const [pathname, hash, search] of cases) {
    let replaced = null;
    const location = { pathname, hash, search, replace: (u) => (replaced = u) };
    vm.runInNewContext(RECOVERY_FORWARD_SCRIPT, { window: { location }, URLSearchParams });
    const expected = shouldForwardToReset(pathname, hash);
    assert.equal(replaced !== null, expected, `${pathname}${hash}`);
    if (expected) assert.equal(replaced, `/reset-password${search}${hash}`, "keeps the whole address so the tokens arrive intact");
  }
  // Never throws, even without URLSearchParams.
  assert.doesNotThrow(() => vm.runInNewContext(RECOVERY_FORWARD_SCRIPT, { window: { location: { pathname: "/", hash: IMPLICIT, search: "" } } }));
});

test("the per-tab recovery flag expires and ignores bad values", () => {
  const now = 1_800_000_000_000;
  const raw = makeRecoveryFlag("user-1", now);
  assert.equal(readRecoveryFlag(raw, now + 1000), "user-1");
  assert.equal(readRecoveryFlag(raw, now + 61 * 60 * 1000), null);
  assert.equal(readRecoveryFlag("{bad json", now), null);
  assert.equal(readRecoveryFlag(null, now), null);
  assert.equal(readRecoveryFlag(JSON.stringify({ uid: 5, exp: now + 1 }), now), null);
});

test("a same-password error is recognised even without an error code", () => {
  assert.match(passwordUpdateError({ status: 422, message: "New password should be different from the old password." }).message, /must be different/);
});
