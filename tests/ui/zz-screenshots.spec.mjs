// Screenshot walkthrough (local only; not part of the test suite).
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { mockSupabase, ecta } from "./mocks.mjs";

const OUT = "/home/claude/screens/";
// The sandbox build cannot download Google Fonts; load Bidlyze's Outfit font locally for faithful screenshots.
const FONT_CSS = [400, 500, 600, 700].map((w) => `@font-face{font-family:"OutfitShot";font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(`/tmp/fonts/package/files/outfit-latin-${w}-normal.woff2`).toString("base64")}) format("woff2");}`).join("") + 'body,body *:not(.font-mono){font-family:"OutfitShot",sans-serif !important}';
async function brandFont(page) {
  await page.addInitScript((css) => {
    const add = () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); };
    if (document.head) add(); else document.addEventListener("DOMContentLoaded", add);
  }, FONT_CSS);
}
const CACHE = "/home/claude/bidlyze/tests/benchmarks/alton-cctv-2026/.cache/tender_pages.json";

async function demoTender(page) {
  // Local sandbox cannot reach alton.gov.uk; serve the same page text the preview fetches live.
  if (!existsSync(CACHE)) return;
  const pages = JSON.parse(readFileSync(CACHE)).pages.map((p) => ({ unit: "page", ...p }));
  await page.route("**/api/submission-check/demo?part=tender", (r) => r.fulfill({ json: { analysis: { id: "demo-alton", name: "Alton Town Council: CCTV review, installation and 3-year maintenance (sample)", fileName: "Alton-Town-Council-Invitation-to-Tender-CCTV-system.pdf", requirementsTotal: 39 }, pages } }));
}

for (const theme of ["dark", "light"]) {
  test(`walkthrough (${theme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((t) => localStorage.setItem("bidlyze-theme", t), theme);
    await mockSupabase(page);
    await brandFont(page);
    await demoTender(page);
    const s = (name) => page.screenshot({ path: `${OUT}${theme}-${name}.png` });

    await page.goto("/submission-check");
    await expect(page.getByTestId("tender-demo")).toBeVisible();
    await page.waitForTimeout(400);
    if (theme === "dark") await s("01-choose-tender");

    await page.goto("/submission-check/demo");
    await expect(page.getByTestId("dropzone")).toBeVisible();
    await page.waitForTimeout(300);
    if (theme === "dark") await s("02-upload");

    await page.getByTestId("use-sample").click();
    await expect(page.getByTestId("run-check")).toBeVisible();
    if (theme === "dark") await s("03-ready-to-run");

    // Hold the response briefly to capture the progress screen.
    if (theme === "dark") {
      await page.route("**/api/submission-check", async (route) => {
        const res = await route.fetch();
        await new Promise((r) => setTimeout(r, 6000));
        await route.fulfill({ response: res });
      });
    }
    await page.getByTestId("run-check").click();
    if (theme === "dark") {
      await expect(page.getByTestId("checking")).toBeVisible();
      await page.waitForTimeout(4500);
      await s("04-checking");
    }
    await expect(page.getByTestId("results")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(300);
    await s("05-results-summary");

    await page.getByTestId("tab-attention").click();
    const r14 = page.getByTestId("finding-R14");
    await r14.getByRole("button", { expanded: false }).click();
    await r14.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140));
    await page.waitForTimeout(300);
    await s("06-contradiction-both-sides");

    if (theme === "dark") {
      await page.getByTestId("evidence-R14-1").getByRole("button", { name: "View page" }).click();
      await expect(page.getByTestId("viewer-highlight")).toBeVisible();
      await page.waitForTimeout(700);
      await s("07-proposal-page-viewer");
      await page.keyboard.press("Escape");
      await page.getByTestId("tender-quote-R14").getByRole("button", { name: "View page" }).click();
      await expect(page.getByTestId("viewer-highlight")).toBeVisible();
      await page.waitForTimeout(700);
      await s("08-tender-page-viewer");
      await page.keyboard.press("Escape");

      await page.getByTestId("search").fill("insurance");
      const r20 = page.getByTestId("finding-R20");
      await r20.getByRole("button", { expanded: false }).click();
      await page.getByTestId("note-R20").fill("Ask the broker for a £10m PI certificate before submission.");
      await page.getByTestId("reviewed-R20").check();
      await r20.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140));
      await page.waitForTimeout(300);
      await s("09-search-and-review");

      await page.getByTestId("search").fill("");
      await page.getByTestId("tab-manual").click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await s("10-check-manually");

      const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export").click()]);
      await dl.saveAs(`${OUT}${dl.suggestedFilename()}`);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId("tab-attention").click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}${theme}-11-mobile.png`, fullPage: false });
      const r14m = page.getByTestId("finding-R14");
      await r14m.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}${theme}-12-mobile-finding.png`, fullPage: false });
    }
  });
}

test("existing dashboard still renders (AppShell layout change)", async ({ page }) => {
  await mockSupabase(page);
  await brandFont(page);
  await page.goto("/dashboard");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}dark-zz-dashboard-unchanged.png` });
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
