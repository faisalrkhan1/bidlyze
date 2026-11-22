// End-to-end tests of password recovery in real Chrome against a production build.
// The real supabase-js client runs in the page; Supabase Auth's HTTP API is
// simulated (same endpoints, status codes and error format as Supabase Auth), so
// no real account, password or e-mail is touched and no user is created.
import { test, expect } from "@playwright/test";

const SB = "http://localhost:54321";
const USER = {
  id: "7d0c2f4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  aud: "authenticated",
  role: "authenticated",
  email: "faisal@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-03-01T00:00:00Z",
};
const RECOVERY_TOKEN = "recovery-access-token";
const OTP_TOKEN = "otp-access-token";
const OLD_PASSWORD = "the-old-password";
const NEW_PASSWORD = "a brand new passphrase";

const recoveryHash = (token = RECOVERY_TOKEN) => {
  const now = Math.floor(Date.now() / 1000);
  return `#access_token=${token}&expires_at=${now + 3600}&expires_in=3600&refresh_token=recovery-refresh&token_type=bearer&type=recovery`;
};
const EXPIRED_HASH = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

/** Simulated Supabase Auth. Records every call so tests can prove what was (and was not) sent. */
async function mockAuth(page, { rateLimitRecover = false } = {}) {
  const state = { password: OLD_PASSWORD, calls: [], recover: [], updates: [], verifies: [], logouts: [], dataWrites: [] };
  const json = (route, status, body) =>
    route.fulfill({
      status,
      contentType: "application/json",
      // As Supabase Auth sends them: the API version (newer error format) and CORS headers that let the page read it.
      headers: { "x-supabase-api-version": "2024-01-01", "access-control-allow-origin": "*", "access-control-expose-headers": "x-supabase-api-version" },
      body: JSON.stringify(body),
    });
  await page.route("**/api/submission-check/usage", (route) => route.fulfill({ json: { success: true, tracked: false, environment: "preview" } }));
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const bearer = (req.headers()["authorization"] || "").replace(/^Bearer /, "");
    const valid = bearer === RECOVERY_TOKEN || bearer === OTP_TOKEN || bearer === "signed-in-token";
    state.calls.push(`${method} ${url.pathname}`);

    if (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/storage/v1/")) {
      if (method !== "GET" && method !== "HEAD") {
        state.dataWrites.push(`${method} ${url.pathname}`);
        return json(route, 403, { message: "writes are not allowed in this test" });
      }
      return json(route, 200, []);
    }
    if (url.pathname === "/auth/v1/user" && method === "GET") {
      return valid ? json(route, 200, USER) : json(route, 403, { code: "bad_jwt", message: "invalid JWT: unable to parse or verify signature" });
    }
    if (url.pathname === "/auth/v1/user" && method === "PUT") {
      if (!valid) return json(route, 401, { code: "no_authorization", message: "This endpoint requires a valid Bearer token" });
      const body = req.postDataJSON();
      state.updates.push(body);
      if (body.password === state.password) return json(route, 422, { code: "same_password", message: "New password should be different from the old password." });
      if (body.password === "password1234") {
        return json(route, 422, { code: "weak_password", message: "Password is known to be weak and easy to guess.", weak_password: { reasons: ["pwned"] } });
      }
      state.password = body.password;
      return json(route, 200, { ...USER, updated_at: new Date().toISOString() });
    }
    if (url.pathname === "/auth/v1/logout") {
      state.logouts.push(url.searchParams.get("scope"));
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === "/auth/v1/recover") {
      state.recover.push({ ...req.postDataJSON(), redirect_to: url.searchParams.get("redirect_to") });
      if (rateLimitRecover) return json(route, 429, { code: "over_email_send_rate_limit", message: "email rate limit exceeded" });
      return json(route, 200, {});
    }
    if (url.pathname === "/auth/v1/verify" && method === "POST") {
      const body = req.postDataJSON();
      state.verifies.push(body);
      if (body.type === "recovery" && body.token_hash === "good-hash") {
        const now = Math.floor(Date.now() / 1000);
        return json(route, 200, { access_token: OTP_TOKEN, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "otp-refresh", user: USER });
      }
      return json(route, 403, { code: "otp_expired", message: "Email link is invalid or has expired" });
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") {
      // What Supabase Auth answers for a code with no matching flow state in this browser.
      return json(route, 404, { code: "flow_state_not_found", message: "invalid flow state, no valid flow state found" });
    }
    // Anything else (sign-up, admin, token refresh) is not part of recovery.
    state.dataWrites.push(`${method} ${url.pathname}`);
    return json(route, 400, { code: "unexpected", message: `unexpected call ${url.pathname}` });
  });
  return state;
}

function assertNothingElseChanged(state) {
  expect(state.dataWrites, "no database writes, sign-ups or admin calls").toEqual([]);
  expect(state.calls.some((c) => c.includes("/signup") || c.includes("/admin"))).toBe(false);
}

test("forgot password on the sign-in page sends the link back to /reset-password", async ({ page, baseURL }) => {
  const auth = await mockAuth(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByPlaceholder("you@example.com").fill(" faisal@example.com ");
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.getByText("If an account exists for faisal@example.com")).toBeVisible();
  expect(auth.recover).toHaveLength(1);
  expect(auth.recover[0].email).toBe("faisal@example.com");
  expect(auth.recover[0].redirect_to).toBe(`${baseURL}/reset-password`);
  assertNothingElseChanged(auth);
});

test("recovery link: checks the link, validates the new password, saves it, signs out other devices", async ({ page }) => {
  const auth = await mockAuth(page);
  await page.goto(`/reset-password${recoveryHash()}`);
  await expect(page.getByTestId("reset-view-form")).toBeVisible();
  await expect(page.getByTestId("reset-account")).toHaveText("faisal@example.com");
  // The one-time tokens are removed from the address bar.
  expect(page.url()).not.toContain("access_token");
  expect(auth.calls).toContain("GET /auth/v1/user");

  const pw = page.locator("#new-password");
  const again = page.locator("#confirm-password");
  const save = page.getByTestId("reset-save");

  await pw.fill("short");
  await again.fill("short");
  await save.click();
  await expect(page.getByTestId("reset-error")).toHaveText("Use at least 8 characters.");

  await pw.fill(NEW_PASSWORD);
  await again.fill(`${NEW_PASSWORD}x`);
  await save.click();
  await expect(page.getByTestId("reset-error")).toHaveText("The two passwords do not match.");
  expect(auth.updates, "nothing sent while the form is invalid").toHaveLength(0);

  await pw.fill(OLD_PASSWORD);
  await again.fill(OLD_PASSWORD);
  await save.click();
  await expect(page.getByTestId("reset-error")).toHaveText("Your new password must be different from your current password.");

  await pw.fill("password1234");
  await again.fill("password1234");
  await save.click();
  await expect(page.getByTestId("reset-error")).toContainText("known data breach");

  await pw.fill(NEW_PASSWORD);
  await again.fill(NEW_PASSWORD);
  await page.getByLabel("Show passwords").check();
  await expect(pw).toHaveAttribute("type", "text");
  await save.click();
  await expect(page.getByTestId("reset-view-done")).toBeVisible();
  await expect(page.getByText("Any other devices signed in to this account have been signed out.")).toBeVisible();

  expect(auth.updates.at(-1)).toEqual(expect.objectContaining({ password: NEW_PASSWORD }));
  expect(auth.password).toBe(NEW_PASSWORD);
  expect(auth.logouts).toEqual(["others"]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("sb-localhost-auth-token") || "null"));
  expect(stored?.user?.email, "still signed in on this device").toBe("faisal@example.com");
  expect(await page.evaluate(() => sessionStorage.getItem("bidlyze-recovery"))).toBeNull();

  await page.getByTestId("reset-continue").click();
  await expect(page).toHaveURL(/\/submission-check$/);
  assertNothingElseChanged(auth);
});

test("a link that Supabase sent to the Site URL or the old /login address is forwarded to the reset page", async ({ page }) => {
  const auth = await mockAuth(page);
  await page.goto(`/${recoveryHash()}`);
  await expect(page).toHaveURL(/\/reset-password/);
  await expect(page.getByTestId("reset-view-form")).toBeVisible();

  await page.evaluate(() => localStorage.clear());
  await page.goto(`/login${recoveryHash()}`);
  await expect(page).toHaveURL(/\/reset-password/);
  await expect(page.getByTestId("reset-view-form")).toBeVisible();
  assertNothingElseChanged(auth);
});

test("expired or used link: clear message, then a new e-mail can be requested", async ({ page, baseURL }) => {
  const auth = await mockAuth(page);
  await page.goto(`/reset-password${EXPIRED_HASH}`);
  await expect(page.getByTestId("reset-view-invalid")).toBeVisible();
  await expect(page.getByTestId("reset-link-problem")).toHaveText(
    "This link has expired or has already been used. Each reset link works once, for a limited time."
  );
  expect(page.url()).not.toContain("error_code");
  await expect(page.locator("#new-password")).toHaveCount(0);

  await page.locator("#reset-email").fill("faisal@example.com");
  await page.getByTestId("reset-send").click();
  await expect(page.getByTestId("reset-view-sent")).toBeVisible();
  await expect(page.getByTestId("reset-send-again")).toBeDisabled();
  await expect(page.getByTestId("reset-send-again")).toContainText("Send again in");
  expect(auth.recover).toEqual([expect.objectContaining({ email: "faisal@example.com", redirect_to: `${baseURL}/reset-password` })]);
  expect(auth.updates).toHaveLength(0);

  // The same error landing on the home page (Site URL fallback) is shown here too.
  await page.goto(`/${EXPIRED_HASH}`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByTestId("reset-view-invalid")).toBeVisible();
  assertNothingElseChanged(auth);
});

test("a token Supabase rejects never reaches the password form", async ({ page }) => {
  const auth = await mockAuth(page);
  await page.goto(`/reset-password${recoveryHash("forged-token")}`);
  await expect(page.getByTestId("reset-view-invalid")).toBeVisible();
  await expect(page.locator("#new-password")).toHaveCount(0);
  expect(auth.updates).toHaveLength(0);
  const stored = await page.evaluate(() => localStorage.getItem("sb-localhost-auth-token"));
  expect(stored, "no session kept from a rejected link").toBeNull();
});

test("refreshing keeps the form; a normal signed-in session without a reset link does not get it", async ({ page, browser }) => {
  const auth = await mockAuth(page);
  await page.goto(`/reset-password${recoveryHash()}`);
  await expect(page.getByTestId("reset-view-form")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("reset-view-form")).toBeVisible();
  await expect(page.getByTestId("reset-account")).toHaveText("faisal@example.com");

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  const auth2 = await mockAuth(other);
  await other.addInitScript((user) => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify({ access_token: "signed-in-token", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user }));
  }, USER);
  await other.goto("/reset-password");
  await expect(other.getByTestId("reset-view-request")).toBeVisible();
  await expect(other.locator("#new-password")).toHaveCount(0);
  expect(auth2.updates).toHaveLength(0);
  await ctx.close();
  assertNothingElseChanged(auth);
});

test("token-hash link (custom e-mail template): verified only when the new password is submitted", async ({ page }) => {
  const auth = await mockAuth(page);
  await page.goto("/reset-password?token_hash=good-hash&type=recovery");
  await expect(page.getByTestId("reset-view-form")).toBeVisible();
  expect(page.url()).not.toContain("token_hash");
  expect(auth.verifies, "opening the link (or a mail scanner opening it) does not use it up").toHaveLength(0);
  await page.locator("#new-password").fill(NEW_PASSWORD);
  await page.locator("#confirm-password").fill(NEW_PASSWORD);
  await page.getByTestId("reset-save").click();
  await expect(page.getByTestId("reset-view-done")).toBeVisible();
  expect(auth.verifies).toEqual([expect.objectContaining({ type: "recovery", token_hash: "good-hash" })]);
  expect(auth.updates).toEqual([expect.objectContaining({ password: NEW_PASSWORD })]);

  const auth2 = await mockAuth(page);
  await page.evaluate(() => localStorage.clear());
  await page.goto("/reset-password?token_hash=used-hash&type=recovery");
  await page.locator("#new-password").fill(NEW_PASSWORD);
  await page.locator("#confirm-password").fill(NEW_PASSWORD);
  await page.getByTestId("reset-save").click();
  await expect(page.getByTestId("reset-view-invalid")).toBeVisible();
  await expect(page.getByTestId("reset-link-problem")).toContainText("expired or has already been used");
  expect(auth2.updates).toHaveLength(0);
});

test("other link problems and e-mail limits are explained", async ({ page }) => {
  const auth = await mockAuth(page, { rateLimitRecover: true });
  await page.goto("/reset-password?code=pkce-code-from-another-browser");
  await expect(page.getByTestId("reset-view-invalid")).toBeVisible();
  await expect(page.getByTestId("reset-link-problem")).toContainText("same browser");

  await page.goto("/reset-password");
  await expect(page.getByTestId("reset-view-request")).toBeVisible();
  await page.locator("#reset-email").fill("faisal@example.com");
  await page.getByTestId("reset-send").click();
  await expect(page.getByTestId("reset-error")).toHaveText("Too many reset e-mails have been sent recently. Wait a few minutes, then try again.");
  await expect(page.getByTestId("reset-view-request")).toBeVisible();
  assertNothingElseChanged(auth);
});

test("screens for review (desktop, mobile)", async ({ page }) => {
  await mockAuth(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("bidlyze-theme", "light"));
  await page.goto(`/reset-password${recoveryHash()}`);
  await expect(page.getByTestId("reset-view-form")).toBeVisible();
  await page.screenshot({ path: "test-results/reset-form-desktop-light.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/reset-password${EXPIRED_HASH}`);
  await expect(page.getByTestId("reset-view-invalid")).toBeVisible();
  await page.screenshot({ path: "test-results/reset-invalid-mobile.png", fullPage: true });
});
