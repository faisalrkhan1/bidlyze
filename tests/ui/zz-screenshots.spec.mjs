// Screenshot walkthrough for review (local only: skipped unless SCREENSHOTS=1 and
// the local tender cache exists). Not part of `npm run test:ui`.
//   SCREENSHOTS=1 npx playwright test -c tests/ui/playwright.config.mjs zz-screenshots.spec.mjs
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { mockSupabase, ecta } from "./mocks.mjs";

const OUT = process.env.SCREENSHOT_DIR || "/home/claude/screens/";
const CACHE = new URL("../benchmarks/alton-cctv-2026/.cache/tender_pages.json", import.meta.url);
const ENABLED = process.env.SCREENSHOTS === "1" && existsSync(CACHE);
test.skip(!ENABLED, "screenshot walkthrough runs only locally with SCREENSHOTS=1");
if (ENABLED) mkdirSync(OUT, { recursive: true });

// Brand fonts are bundled with the app (app/fonts), so screenshots use them as users will.
async function brandFont() {}

async function demoTender(page) {
  // Local sandbox cannot reach alton.gov.uk; serve the same page text the preview fetches live.
  const pages = JSON.parse(readFileSync(CACHE)).pages.map((p) => ({ unit: "page", ...p }));
  await page.route("**/api/submission-check/demo?part=tender", (r) => r.fulfill({ json: { analysis: { id: "demo-alton", name: "Alton Town Council: CCTV review, installation and 3-year maintenance (sample)", fileName: "Alton-Town-Council-Invitation-to-Tender-CCTV-system.pdf", requirementsTotal: 39, checkable: 38, notCheckable: 2 }, pages } }));
}

async function scrollTo(page, testId, offset = 140) {
  await page.getByTestId(testId).evaluate((el, o) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o), offset);
  await page.waitForTimeout(300);
}

async function openFinding(page, id) {
  const f = page.getByTestId(`finding-${id}`);
  const btn = f.getByRole("button", { expanded: false });
  if (await btn.count()) await btn.first().click();
  return f;
}

for (const theme of ["dark", "light"]) {
  test(`walkthrough (${theme})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((t) => localStorage.setItem("bidlyze-theme", t), theme);
    await mockSupabase(page);
    await brandFont(page);
    await demoTender(page);
    const s = (name) => page.screenshot({ path: `${OUT}${theme}-${name}.png` });
    const dark = theme === "dark";

    await page.goto("/submission-check");
    await expect(page.getByTestId("tender-demo")).toBeVisible();
    await page.waitForTimeout(400);
    await s("01-choose-tender");

    await page.goto("/submission-check/demo");
    await expect(page.getByTestId("dropzone")).toBeVisible();
    await page.waitForTimeout(300);
    await s("02-upload");

    await page.getByTestId("use-sample").click();
    await expect(page.getByTestId("run-check")).toBeVisible();
    await page.getByTestId("processing-note").locator("summary").click();
    await page.waitForTimeout(200);
    await s("03-ready-to-run-and-privacy");

    if (dark) {
      await page.route("**/api/submission-check", async (route) => {
        const res = await route.fetch();
        await new Promise((r) => setTimeout(r, 6000));
        await route.fulfill({ response: res });
      });
    }
    await page.getByTestId("run-check").click();
    if (dark) {
      await expect(page.getByTestId("checking")).toBeVisible();
      await page.waitForTimeout(4500);
      await s("04-checking");
    }
    await expect(page.getByTestId("results")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(300);
    await s("05-results-summary");
    await page.getByTestId("toggle-excluded").click();
    await scrollTo(page, "documents", 90);
    await s("06-documents-and-requirement-list");

    await page.getByTestId("tab-attention").click();
    await openFinding(page, "R14");
    await scrollTo(page, "finding-R14");
    await s("07-contradiction-both-sides");

    if (dark) {
      await page.getByTestId("evidence-R14-1").getByRole("button", { name: "View page" }).click();
      await expect(page.getByTestId("viewer-highlight")).toBeVisible();
      await page.waitForTimeout(700);
      await s("08-proposal-page-viewer");
      await page.keyboard.press("Escape");
      await page.getByTestId("tender-quote-R14").getByRole("button", { name: "View page" }).click();
      await expect(page.getByTestId("viewer-highlight")).toBeVisible();
      await page.waitForTimeout(700);
      await s("09-tender-page-viewer");
      await page.keyboard.press("Escape");

      // R6/R7: no double counting; R7 is conditional.
      await page.getByTestId("tab-all").click();
      await page.getByTestId("search").fill("image quality");
      await openFinding(page, "R6");
      await scrollTo(page, "finding-R6", 120);
      await s("10-R6-no-double-counting");
      await page.getByTestId("search").fill("");
      await page.getByTestId("type-filter").selectOption("conditional");
      await openFinding(page, "R7");
      await scrollTo(page, "finding-R7", 120);
      await s("10b-R7-conditional");
      await page.getByTestId("type-filter").selectOption("all");

      // R16 split into two obligations.
      await page.getByTestId("search").fill("ISO");
      await openFinding(page, "R16.2");
      await scrollTo(page, "findings", 120);
      await s("11-R16-split");

      // Price schedule: separate document, described in the proposal.
      await page.getByTestId("search").fill("price");
      await openFinding(page, "R31");
      await scrollTo(page, "finding-R31", 120);
      await s("12-R31-price-schedule-document");

      // Review: note + decision.
      await page.getByTestId("search").fill("insurance");
      await openFinding(page, "R20");
      await page.getByTestId("note-R20").fill("Ask the broker for a £10m PI certificate before submission.");
      await page.getByTestId("reviewed-R20").check();
      await scrollTo(page, "finding-R20");
      await s("13-search-and-review");

      // Check manually: recommendation (R5), submission steps.
      await page.getByTestId("search").fill("");
      await page.getByTestId("tab-manual").click();
      await openFinding(page, "R5");
      await page.evaluate(() => window.scrollTo(0, 0));
      await scrollTo(page, "finding-R5", 200);
      await s("14-check-manually-R5-recommendation");

      // Optional item R27 and the type filter.
      await page.getByTestId("tab-all").click();
      await page.getByTestId("type-filter").selectOption("optional");
      await openFinding(page, "R27");
      await scrollTo(page, "finding-R27", 200);
      await s("15-R27-optional");
      await page.getByTestId("type-filter").selectOption("all");

      const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export").click()]);
      await dl.saveAs(`${OUT}${dl.suggestedFilename()}`);
    }

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("search").fill("");
    await page.getByTestId("tab-all").click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}${theme}-16-mobile.png` });
    await page.getByTestId("tab-attention").click();
    await openFinding(page, "R14");
    await scrollTo(page, "finding-R14", 70);
    await page.screenshot({ path: `${OUT}${theme}-17-mobile-finding.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

test("dashboard (no NaN average)", async ({ page }) => {
  await mockSupabase(page);
  await brandFont(page);
  await page.goto("/dashboard");
  await expect(page.getByTestId("stat-avg")).toHaveText("--");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}dark-18-dashboard.png` });
});

test("analysis page entry point", async ({ page }) => {
  await mockSupabase(page);
  await brandFont(page);
  await page.goto(`/analysis/${ecta.id}`);
  await expect(page.getByTestId("submission-check-entry")).toBeVisible();
  await page.getByTestId("submission-check-entry").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -260));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}dark-00-analysis-page-entry.png` });
});
