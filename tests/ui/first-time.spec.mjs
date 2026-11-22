// The complete first-time-user workflow and its failure cases, in a real browser.
// Supabase and the paid API routes are mocked in the browser: no production data,
// no AI cost. The routes' own behaviour is tested in tests/submission/*.test.mjs.
import { test, expect } from "@playwright/test";
import { mockSupabase, ecta, ectaResult, RESPONSE_PDF, TENDER_PDF_PATH } from "./mocks.mjs";

const tenderOk = { success: true, analysisId: ecta.id, source: "submission-check", tender: { name: "ECTA Smart Parking Sensors (fictional test tender)", requirementsTotal: 18, cited: 18, checkable: 18, notCheckable: 0 }, files: [{ key: "F1", filename: "ECTA_test_tender.pdf", pages: 8, unit: "page", scannedPages: [] }] };
const PRICE = { name: "Price_Schedule.txt", mimeType: "text/plain", buffer: Buffer.from("Price schedule (Document 2). Supply of 400 parking sensors: AED 1,240,000. Installation: AED 180,000. Five-year maintenance: AED 95,000 per year. Prices exclude VAT and are valid for 120 days.") };

async function mockApis(page, { tender = () => ({ status: 200, json: tenderOk }), check = () => ({ status: 200, json: ectaResult }) } = {}) {
  const seen = { tender: [], check: [] };
  await page.route("**/api/submission-check/tender", async (route) => {
    const req = route.request();
    seen.tender.push({ body: req.postDataJSON(), raw: req.postData() || "", auth: req.headers()["authorization"] });
    const r = tender(seen.tender.length);
    if (r === "abort") return route.abort("internetdisconnected");
    return route.fulfill(r);
  });
  await page.route("**/api/submission-check", async (route) => {
    const req = route.request();
    seen.check.push({ body: req.postDataJSON(), raw: req.postData() || "" });
    return route.fulfill(check(seen.check.length));
  });
  return seen;
}

test("first-time user: Home, add tender, add two proposal files, run, review, export, then History", async ({ page }) => {
  const calls = await mockSupabase(page);
  const seen = await mockApis(page);

  // Home: one obvious next step.
  await page.goto("/submission-check");
  await expect(page.getByRole("navigation").getByRole("button")).toHaveText(["Home", "New check", "History", "Account"]);
  await expect(page.locator("aside")).not.toContainText("New Analysis");
  await page.getByTestId("start-new").click();
  await expect(page).toHaveURL(/\/submission-check\/new$/);
  await expect(page.getByRole("heading", { name: "New check" })).toBeVisible();

  // 1. Tender: read in the browser, not analysed until the check runs.
  await expect(page.getByTestId("proposal-card")).toContainText("Add the tender first");
  await page.getByTestId("tender-file-input").setInputFiles(TENDER_PDF_PATH);
  await expect(page.getByTestId("tender-card")).toContainText("ECTA_test_tender.pdf");
  await expect(page.getByTestId("tender-card")).toContainText("requirements are read when you run the check");

  // 2. Proposal: technical proposal plus a separate price schedule.
  await page.getByTestId("file-input").setInputFiles(RESPONSE_PDF);
  await expect(page.getByTestId("proposal-card")).toContainText("6 pages read");
  await page.getByTestId("file-input").setInputFiles(PRICE);
  await expect(page.getByTestId("proposal-card")).toContainText("2 files");
  await expect(page.getByTestId("proposal-file-1")).toContainText("Price_Schedule.txt");
  await expect(page.locator("body")).toContainText("First reads the tender's requirements, then checks the proposal");

  // 3. Run: tender first, then the check, against the tender just read.
  await page.getByTestId("run-check").click();
  await expect(page.getByTestId("results")).toBeVisible();
  expect(seen.tender).toHaveLength(1);
  expect(seen.tender[0].auth).toBe("Bearer test-access-token");
  expect(seen.tender[0].body.tender.files[0].filename).toBe("ECTA_test_tender.pdf");
  expect(seen.tender[0].body.tender.files[0].pages.length).toBe(8);
  expect(seen.tender[0].raw).not.toContain("%PDF");
  expect(seen.check).toHaveLength(1);
  expect(seen.check[0].body.analysisId).toBe(ecta.id);
  expect(seen.check[0].body.response.files.map((f) => f.filename)).toEqual(["ECTA_test_response.pdf", "Price_Schedule.txt"]);
  expect(seen.check[0].body.requestId).not.toBe(seen.tender[0].body.requestId);
  expect(seen.check[0].raw).not.toContain("%PDF");
  await expect(page).toHaveURL(new RegExp(`/submission-check/${ecta.id}$`));
  await expect(page.getByTestId("tender-card")).toContainText("read just now");

  // 4. Review and 5. export.
  await expect(page.getByTestId("human-review-notice")).toBeVisible();
  await page.getByTestId("search").fill("bid bond");
  await page.getByTestId("finding-Q01").getByRole("button", { expanded: false }).click();
  await page.getByTestId("evidence-Q01-0").getByRole("button", { name: "View page" }).click();
  await expect(page.getByTestId("viewer-highlight")).toContainText("bid bond of 1%");
  await page.keyboard.press("Escape");
  await page.getByTestId("tender-quote-Q01").getByRole("button", { name: "View page" }).click();
  await expect(page.getByTestId("viewer-highlight")).toContainText("bid bond of 2%");
  await page.keyboard.press("Escape");
  await page.getByTestId("reviewed-Q01").check();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export").click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

  // History shows the tender with this device's results.
  await page.getByRole("navigation").getByRole("button", { name: "History" }).click();
  await expect(page).toHaveURL(/\/submission-check\/history$/);
  await expect(page.getByTestId(`history-row-${ecta.id}`)).toContainText("Reviewed 1 of 18");
  await page.getByTestId(`open-${ecta.id}`).click();
  await expect(page.getByText("Restored from this browser")).toBeVisible();
  expect(calls.writes).toEqual([]);
});

test("tender reading fails, then a retry: a clear message, and a new request only after a definite failure", async ({ page }) => {
  await mockSupabase(page);
  let mode = "fail";
  const seen = await mockApis(page, {
    tender: () => (mode === "fail" ? { status: 502, json: { success: false, error: "The tender's requirements could not be read this time (the AI service did not answer). Please try again." } } : mode === "offline" ? "abort" : { status: 200, json: tenderOk }),
  });
  await page.goto("/submission-check/new");
  await page.getByTestId("tender-file-input").setInputFiles(TENDER_PDF_PATH);
  await page.getByTestId("file-input").setInputFiles(RESPONSE_PDF);
  await page.getByTestId("run-check").click();
  await expect(page.getByTestId("run-error")).toContainText("The tender could not be read");
  await expect(page.getByTestId("run-error")).toContainText("Please try again");
  mode = "offline";
  await page.getByTestId("run-error").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("run-error")).toContainText("network problem");
  mode = "ok";
  await page.getByTestId("run-error").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("results")).toBeVisible();
  const ids = seen.tender.map((t) => t.body.requestId);
  expect(ids[1]).not.toBe(ids[0]); // after a definite failure: a new request
  expect(ids[2]).toBe(ids[1]); // after a lost connection: the same request, so it is never read (or charged) twice
});

test("the check fails after the tender was read: retry re-runs only the check", async ({ page }) => {
  await mockSupabase(page);
  let fail = true;
  const seen = await mockApis(page, { check: () => (fail ? { status: 429, json: { success: false, error: "You have used this month's beta allowance of 30 checks. It resets on the 1st; ask Bidlyze if you need more." } } : { status: 200, json: ectaResult }) });
  await page.goto("/submission-check/new");
  await page.getByTestId("tender-file-input").setInputFiles(TENDER_PDF_PATH);
  await page.getByTestId("file-input").setInputFiles(RESPONSE_PDF);
  await page.getByTestId("run-check").click();
  await expect(page.getByTestId("run-error")).toContainText("beta allowance of 30 checks");
  await expect(page.getByTestId("run-error")).toContainText("were read and saved, so trying again only re-runs the check");
  fail = false;
  await page.getByTestId("run-error").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("results")).toBeVisible();
  expect(seen.tender).toHaveLength(1);
  expect(seen.check).toHaveLength(2);
});

test("files the beta cannot take are refused with what to do instead", async ({ page }) => {
  await mockSupabase(page);
  await mockApis(page);
  await page.goto("/submission-check/new");
  await page.getByTestId("tender-file-input").setInputFiles({ name: "ITT.doc", mimeType: "application/msword", buffer: Buffer.from("old word") });
  await expect(page.getByTestId("tender-file-error")).toContainText("Save it as .docx or PDF");
  await page.getByTestId("tender-file-input").setInputFiles({ name: "Pack.zip", mimeType: "application/zip", buffer: Buffer.from("PK") });
  await expect(page.getByTestId("tender-file-error")).toContainText("Unzip it");
  await page.getByTestId("tender-file-input").setInputFiles(TENDER_PDF_PATH);
  // A proposal over the one-pass limit is refused before anything is sent.
  const long = { name: "huge.txt", mimeType: "text/plain", buffer: Buffer.from("The supplier will provide the services described. ".repeat(14_000)) };
  await page.getByTestId("file-input").setInputFiles(long);
  await expect(page.getByTestId("proposal-too-long")).toContainText("too long to check in one go");
  await expect(page.getByTestId("run-check")).toBeDisabled();
  // Five files at most.
  await page.getByRole("button", { name: "Remove huge.txt" }).click();
  const many = Array.from({ length: 6 }, (_, i) => ({ name: `part${i + 1}.txt`, mimeType: "text/plain", buffer: Buffer.from(`Part ${i + 1}. The supplier confirms compliance with the specification in full, including all delivery and warranty terms.`) }));
  await page.getByTestId("file-input").setInputFiles(many);
  await expect(page.getByTestId("file-error")).toContainText("Only 5 more files can be added");
  await expect(page.getByTestId("proposal-card")).toContainText("5 files");
});

test("History: delete a tender (two steps), Account: usage this month, landing and pricing: no payment buttons", async ({ page }) => {
  await mockSupabase(page, { usage: { success: true, tracked: true, inBeta: true, environment: "production", used: { checks: 4, tenders: 2, cost_usd: 1.1 }, limits: { checks_per_month: 30, tenders_per_month: 15 } } });
  const deleted = [];
  await page.route("**/api/analysis/delete", async (route) => { deleted.push(route.request().postDataJSON()); await route.fulfill({ json: { success: true } }); });
  await page.goto("/submission-check/history");
  await expect(page.getByTestId(`history-row-${ecta.id}`)).toContainText("18 requirements");
  await page.getByTestId("history-search").fill("no such tender");
  await expect(page.locator("body")).toContainText("No tenders match your search");
  await page.getByTestId("history-search").fill("");
  await page.getByTestId(`delete-${ecta.id}`).click();
  await expect(page.getByTestId(`history-row-${ecta.id}`)).toContainText("This cannot be undone");
  await page.getByTestId(`confirm-delete-${ecta.id}`).click();
  await expect.poll(() => deleted.length).toBe(1);
  expect(deleted[0]).toEqual({ analysis_id: ecta.id });

  await page.goto("/account");
  await expect(page.getByTestId("account-email")).toContainText("reviewer@example.com");
  await expect(page.getByTestId("account-plan")).toContainText("closed beta");
  await expect(page.getByTestId("usage-card")).toContainText("4 of 30");
  await expect(page.getByTestId("usage-card")).toContainText("2 of 15");

  await page.goto("/pricing");
  await expect(page.getByTestId("beta-access")).toContainText("free during the beta");
  await expect(page.locator("body")).not.toContainText("$");
  await expect(page.locator("body")).not.toContainText("Upgrade");

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find the gaps in a proposal before the buyer does.");
  await expect(page.getByTestId("landing-access")).toHaveAttribute("href", /^mailto:/);
  await expect(page.locator("body")).not.toContainText("$");
  await expect(page.locator("body")).not.toContainText("Start Free");
});

test("tablet (820 px) and mobile (390 px): the new-check page fits without sideways scrolling", async ({ page }) => {
  await mockSupabase(page);
  await mockApis(page);
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/submission-check/new");
    await page.getByTestId("tender-file-input").setInputFiles(TENDER_PDF_PATH);
    await page.getByTestId("file-input").setInputFiles(RESPONSE_PDF);
    await expect(page.getByTestId("run-check")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto("/submission-check");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
