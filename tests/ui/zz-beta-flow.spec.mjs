// Screenshot walkthrough of the first-time-user flow (local only: SCREENSHOTS=1).
// Supabase and the paid API routes are mocked: no data, no AI cost.
//   SCREENSHOTS=1 SCREENSHOT_DIR=/tmp/shots/ npx playwright test -c tests/ui/playwright.config.mjs zz-beta-flow.spec.mjs
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { mockSupabase, ecta, ectaResult, RESPONSE_PDF, TENDER_PDF_PATH } from "./mocks.mjs";

const OUT = process.env.SCREENSHOT_DIR || "/home/claude/screens4/";
const ENABLED = process.env.SCREENSHOTS === "1";
test.skip(!ENABLED, "screenshot walkthrough runs only locally with SCREENSHOTS=1");
if (ENABLED) mkdirSync(OUT, { recursive: true });

const tenderOk = { success: true, analysisId: ecta.id, tender: { name: "ECTA Smart Parking Sensors (fictional test tender)", requirementsTotal: 18, cited: 18, checkable: 18, notCheckable: 0 } };
const PRICE = { name: "Price_Schedule_Document_2.txt", mimeType: "text/plain", buffer: Buffer.from("Price schedule (Document 2). Supply of 400 parking sensors: AED 1,240,000. Installation: AED 180,000. Five-year maintenance: AED 95,000 per year. Prices exclude VAT and are valid for 120 days.") };
const USAGE = { success: true, tracked: true, inBeta: true, environment: "production", used: { checks: 3, tenders: 2, cost_usd: 0.9 }, limits: { checks_per_month: 30, tenders_per_month: 15 } };

for (const theme of ["light", "dark"]) {
  test(`first-time flow (${theme})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((t) => localStorage.setItem("bidlyze-theme", t), theme);
    const s = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}${theme}-${name}.png` }); };

    // Public pages first (signed out).
    await page.goto("/");
    await expect(page.getByTestId("landing-access")).toBeVisible();
    await s("01-landing");
    await page.goto("/login");
    await s("02-login");

    await mockSupabase(page, { usage: USAGE });
    await page.route("**/api/submission-check/tender", async (route) => { await new Promise((r) => setTimeout(r, 5000)); await route.fulfill({ json: tenderOk }); });
    await page.route("**/api/submission-check", (route) => route.fulfill({ json: ectaResult }));

    await page.goto("/submission-check");
    await expect(page.getByTestId("start-new")).toBeVisible();
    await s("03-home");

    await page.getByTestId("start-new").click();
    await expect(page.getByTestId("tender-dropzone")).toBeVisible();
    await s("04-new-check");

    await page.getByTestId("tender-file-input").setInputFiles(TENDER_PDF_PATH);
    await page.getByTestId("file-input").setInputFiles(RESPONSE_PDF);
    await page.getByTestId("file-input").setInputFiles(PRICE);
    await expect(page.getByTestId("run-check")).toBeVisible();
    await page.getByTestId("processing-note").locator("summary").click();
    await s("05-ready-to-run");

    await page.getByTestId("run-check").click();
    await expect(page.getByTestId("checking")).toContainText("Reading the tender");
    await page.waitForTimeout(4200);
    await s("06-reading-tender");

    await expect(page.getByTestId("results")).toBeVisible({ timeout: 20_000 });
    await s("07-results");
    await page.getByTestId("search").fill("bid bond");
    await page.getByTestId("finding-Q01").getByRole("button", { expanded: false }).click();
    await page.getByTestId("reviewed-Q01").check();
    await page.getByTestId("note-Q01").fill("Bond to be re-issued at 2%");
    await page.getByTestId("finding-Q01").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80));
    await s("08-finding");

    await page.goto("/submission-check/history");
    await expect(page.getByTestId(`history-row-${ecta.id}`)).toBeVisible();
    await s("09-history");

    await page.goto("/account");
    await expect(page.getByTestId("usage-card")).toContainText("3 of 30");
    await s("10-account");

    await page.goto("/pricing");
    await expect(page.getByTestId("beta-access")).toBeVisible();
    await s("11-beta-access");

    await page.setViewportSize({ width: 820, height: 1100 });
    await page.goto("/submission-check/new");
    await page.getByTestId("tender-file-input").setInputFiles(TENDER_PDF_PATH);
    await page.getByTestId("file-input").setInputFiles(RESPONSE_PDF);
    await s("12-tablet-new-check");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/submission-check");
    await expect(page.getByTestId("start-new")).toBeVisible();
    await s("13-mobile-home");
    await page.goto("/submission-check/new");
    await page.getByTestId("tender-file-input").setInputFiles(TENDER_PDF_PATH);
    await page.getByTestId("file-input").setInputFiles(RESPONSE_PDF);
    await page.getByTestId("run-check").scrollIntoViewIfNeeded();
    await s("14-mobile-new-check");
  });
}
