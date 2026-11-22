// Password recovery helpers (pure functions, shared by the reset page, the login
// page and the tests).
//
// How a Supabase recovery link reaches us. The e-mail link goes to Supabase
// (/auth/v1/verify), which checks the one-time token and then redirects the
// browser to the `redirectTo` address we passed to resetPasswordForEmail(),
// provided that address is allowed in Supabase (Authentication, URL
// Configuration). If it is not allowed, Supabase uses the Site URL instead.
// We handle every shape the redirect can take:
//   - success, implicit flow (this app's client):  #access_token=…&refresh_token=…&type=recovery
//   - failure (expired, used, invalid):            #error=access_denied&error_code=otp_expired&error_description=…
//   - custom e-mail template using the token hash: ?token_hash=…&type=recovery
//   - PKCE flow (not used by this app today):      ?code=…

export const RESET_PATH = "/reset-password";
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // Supabase Auth refuses longer passwords (bcrypt limit).

// Remembers, for this browser tab only, that the current session came from a
// recovery link, so a page refresh still shows the new-password form.
export const RECOVERY_FLAG_KEY = "bidlyze-recovery";
export const RECOVERY_FLAG_TTL_MS = 60 * 60 * 1000;

/** Where the recovery e-mail sends people back to. */
export function resetRedirectUrl(origin) {
  return `${String(origin || "").replace(/\/+$/, "")}${RESET_PATH}`;
}

function params(fragmentOrSearch) {
  const s = String(fragmentOrSearch || "").replace(/^[#?]/, "");
  return new URLSearchParams(s);
}

/**
 * Reads what a recovery redirect put in the address.
 * @returns {{kind: "error"|"implicit"|"token_hash"|"code"|"none", type?: string, accessToken?: string,
 *   tokenHash?: string, code?: string, errorCode?: string, errorDescription?: string}}
 */
export function parseRecoveryUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return { kind: "none" };
  }
  const h = params(url.hash);
  const q = url.searchParams;
  const pick = (k) => h.get(k) || q.get(k) || "";

  const errorCode = pick("error_code");
  const errorDescription = pick("error_description");
  if (pick("error") || errorCode || errorDescription) {
    return { kind: "error", errorCode: errorCode || pick("error") || "unknown", errorDescription };
  }
  if (h.get("access_token")) {
    return { kind: "implicit", type: h.get("type") || "", accessToken: h.get("access_token") };
  }
  if (q.get("token_hash")) {
    return { kind: "token_hash", type: q.get("type") || "recovery", tokenHash: q.get("token_hash") };
  }
  if (q.get("code")) {
    return { kind: "code", code: q.get("code") };
  }
  return { kind: "none" };
}

/** Plain-language explanation of a link that cannot be used. */
export function recoveryLinkErrorMessage(errorCode, errorDescription) {
  const code = String(errorCode || "").toLowerCase();
  if (code === "otp_expired" || /expired|invalid/i.test(String(errorDescription || ""))) {
    return "This link has expired or has already been used. Each reset link works once, for a limited time.";
  }
  if (code === "flow_state_expired" || code === "flow_state_not_found" || code === "bad_code_verifier") {
    return "This link could not be used. Open the newest reset e-mail in the same browser where you asked for it.";
  }
  return "This link is not valid. It may be incomplete: copy the whole link from the e-mail, or ask for a new one.";
}

/** Checks a new password before it is sent. Returns a message, or null when it is acceptable. */
export function newPasswordProblem(password, confirm) {
  const p = String(password || "");
  if (p.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (p.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  if (!p.trim()) return "The password cannot be only spaces.";
  if (p !== String(confirm || "")) return "The two passwords do not match.";
  return null;
}

const WEAK_REASONS = {
  length: "it is too short",
  characters: "it needs a wider mix of characters (for example upper and lower case letters, numbers and symbols)",
  pwned: "it has appeared in a known data breach",
};

function isRateLimit(error) {
  const code = String(error?.code || "");
  return error?.status === 429 || code === "over_email_send_rate_limit" || code === "over_request_rate_limit";
}

/**
 * Turns a Supabase Auth error from updateUser / verifyOtp / exchangeCodeForSession
 * into what the page should do and say.
 * @returns {{expired: boolean, message: string}}
 */
export function passwordUpdateError(error) {
  const code = String(error?.code || "");
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  if (code === "same_password" || /different from the old password/i.test(message)) {
    return { expired: false, message: "Your new password must be different from your current password." };
  }
  if (code === "weak_password" || name === "AuthWeakPasswordError") {
    const reasons = (error?.reasons || []).map((r) => WEAK_REASONS[r]).filter(Boolean);
    return {
      expired: false,
      message: reasons.length ? `Choose a stronger password: ${reasons.join("; ")}.` : "Choose a stronger password.",
    };
  }
  if (code === "otp_expired" || code === "otp_disabled") {
    return { expired: true, message: recoveryLinkErrorMessage("otp_expired") };
  }
  if (
    name === "AuthSessionMissingError" ||
    ["session_not_found", "session_expired", "bad_jwt", "no_authorization", "reauthentication_needed", "user_not_found"].includes(code) ||
    error?.status === 401 ||
    error?.status === 403
  ) {
    return { expired: true, message: "Your reset session has ended. Ask for a new reset link below." };
  }
  if (isRateLimit(error)) {
    return { expired: false, message: "Too many attempts. Wait a minute, then try again." };
  }
  if (name === "AuthRetryableFetchError" || error?.status === 0) {
    return { expired: false, message: "Could not reach Bidlyze. Check your connection and try again." };
  }
  return { expired: false, message: error?.message ? `The password was not changed: ${error.message}` : "The password was not changed. Please try again." };
}

/** Message for a failed "send me a reset link" request. */
export function resetRequestError(error) {
  const msg = String(error?.message || "");
  if (/^For security purposes/i.test(msg)) return `${msg} Then try again.`;
  if (isRateLimit(error)) {
    return "Too many reset e-mails have been sent recently. Wait a few minutes, then try again.";
  }
  if (String(error?.code || "") === "email_address_invalid") return "Enter a valid e-mail address.";
  if (String(error?.name || "") === "AuthRetryableFetchError") return "Could not reach Bidlyze. Check your connection and try again.";
  return msg || "The reset e-mail could not be sent. Please try again.";
}

/**
 * Should a page that is not the reset page hand its address over to it?
 * True for a successful recovery redirect anywhere (Supabase falls back to the
 * Site URL when the reset address is not allowed), and for a link error that
 * lands on the home or sign-in page.
 */
export function shouldForwardToReset(pathname, hash) {
  if (!hash || pathname === RESET_PATH) return false;
  const h = params(hash);
  if (h.get("access_token") && h.get("type") === "recovery") return true;
  if ((pathname === "/" || pathname === "/login") && (h.get("error_code") || h.get("error_description"))) return true;
  return false;
}

// Runs in <head> before the page's own code, so the Supabase client on that page
// cannot use up the recovery tokens first. Mirrors shouldForwardToReset().
export const RECOVERY_FORWARD_SCRIPT = `(function(){try{var l=window.location,h=l.hash;if(!h||l.pathname===${JSON.stringify(
  RESET_PATH
)})return;var p=new URLSearchParams(h.slice(1));var r=p.get("access_token")&&p.get("type")==="recovery";var e=(l.pathname==="/"||l.pathname==="/login")&&(p.get("error_code")||p.get("error_description"));if(r||e)l.replace(${JSON.stringify(
  RESET_PATH
)}+l.search+h);}catch(x){}})();`;

/** Reads the per-tab recovery flag; returns the user id it was set for, or null when absent or stale. */
export function readRecoveryFlag(raw, now = Date.now()) {
  try {
    const f = JSON.parse(raw || "null");
    if (f && typeof f.uid === "string" && typeof f.exp === "number" && f.exp > now) return f.uid;
  } catch {
    // ignore a corrupt value
  }
  return null;
}

export function makeRecoveryFlag(uid, now = Date.now()) {
  return JSON.stringify({ uid, exp: now + RECOVERY_FLAG_TTL_MS });
}
