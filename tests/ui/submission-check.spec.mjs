// UI end-to-end tests: the Submission Check beta workflow in a real browser.
// Supabase is mocked in the browser (no production data); the check API is
// either mocked (signed-in tender flows) or the real local server (sample flow).
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { mockSupabase, ecta, legacy, ectaResult, RESPONSE_PDF, SCANNED_PDF } from "./mocks.mjs";

const WORKSPACE = `/analysis/${ecta.id}/submission-check`;

async function mockCheckApi(page, body, status = 200) {
  const seen = [];
  await page.route("**/api/submission-check", async (route) => {
    const req = route.request();
    seen.push({ auth: req.headers()["authorization"], body: req.postDataJSON(), raw: req.postData() || "" });
    await route.fulfill({ status, json: typeof body === "function" ? body(req.postDataJSON()) : body });
  });
  return seen;
}

async function uploadAndRun(page, file = RESPONSE_PDF) {
  await page.getByTestId("file-input").setInputFiles(file);
  await expect(page.getByTestId("proposal-card")).toContainText("6 pages read");
  await page.getByTestId("run-check").click();
}

test("start page lists analysed tenders (new and older) and the sample tender", async ({ page }) => {
  const calls = await mockSupabase(page);
  await page.goto("/submission-check");
  await expect(page.getByRole("heading", { name: "Submission Check" })).toBeVisible();
  await expect(page.getByTestId(`tender-${ecta.id}`)).toContainText("18 requirements");
  await expect(page.getByTestId(`tender-${legacy.id}`)).toContainText("No tender quotes");
  await expect(page.getByTestId("tender-demo")).toBeVisible();
  await page.getByTestId(`tender-${ecta.id}`).click();
  await expect(page).toHaveURL(new RegExp(`${WORKSPACE}$`));
  await expect(page.getByTestId("tender-card")).toContainText("18 with verified tender quotes");
  expect(calls.writes).toEqual([]);
});

test("full workflow: upload, run, summary, filters, search, evidence, page viewer, review, export, restore", async ({ page }) => {
  const calls = await mockSupabase(page);
  const seen = await mockCheckApi(page, ectaResult);
  await page.goto(WORKSPACE);
  await uploadAndRun(page);

  // What was sent: page text + fingerprint, the user's token, no file bytes.
  await expect(page.getByTestId("results")).toBeVisible();
  expect(seen).toHaveLength(1);
  expect(seen[0].auth).toBe("Bearer test-access-token");
  expect(seen[0].body.analysisId).toBe(ecta.id);
  expect(seen[0].body.response.pages).toHaveLength(6);
  expect(seen[0].body.response.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(seen[0].raw).not.toContain("%PDF");

  // Summary: three groups, human review notice, never "compliant".
  await expect(page.getByTestId("headline")).toHaveText("Of 18 requirements: 12 need attention, 6 OK.");
  await expect(page.getByTestId("tile-attention")).toContainText("12");
  await expect(page.getByTestId("tile-manual")).toContainText("0");
  await expect(page.getByTestId("tile-ok")).toContainText("6");
  await expect(page.getByTestId("human-review-notice")).toContainText("a person must confirm every finding");
  await expect(page.getByTestId("results")).not.toContainText("fully compliant");

  // Filters and search.
  await page.getByTestId("tab-attention").click();
  await expect(page.getByTestId("shown-count")).toHaveText("Showing 12 of 18");
  await page.getByTestId("status-filter").selectOption("conflict");
  await expect(page.getByTestId("shown-count")).toHaveText("Showing 4 of 18");
  await page.getByTestId("tab-all").click();
  await page.getByTestId("search").fill("bid bond");
  await expect(page.getByTestId("shown-count")).toHaveText("Showing 1 of 18");

  // Two-sided evidence with pages and code verification.
  const q01 = page.getByTestId("finding-Q01");
  await expect(q01).toHaveAttribute("data-status", "conflict");
  await q01.getByRole("button", { expanded: false }).click();
  await expect(page.getByTestId("tender-quote-Q01")).toContainText("bid bond of 2%");
  await expect(page.getByTestId("tender-quote-Q01")).toContainText("Tender p.2");
  await expect(page.getByTestId("evidence-Q01-0")).toContainText("bid bond of 1%");
  await expect(page.getByTestId("evidence-Q01-0")).toContainText("Proposal p.4");
  await expect(page.getByTestId("evidence-Q01-0")).toContainText("Found on this page");
  await expect(q01).toContainText("tender: 2% · response: 1%");

  // Page viewer: proposal page 4 with the quote highlighted, then the tender page 2.
  await page.getByTestId("evidence-Q01-0").getByRole("button", { name: "View page" }).click();
  await expect(page.getByTestId("viewer-page")).toContainText("Page 4");
  await expect(page.getByTestId("viewer-highlight")).toContainText("bid bond of 1%");
  await expect(page.getByRole("link", { name: /Open original at this page/ })).toHaveAttribute("href", /^blob:.*#page=4$/);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByTestId("viewer-page")).toContainText("Page 5");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByTestId("tender-quote-Q01").getByRole("button", { name: "View page" }).click();
  await expect(page.getByTestId("viewer-page")).toContainText("Page 2");
  await expect(page.getByTestId("viewer-highlight")).toContainText("bid bond of 2%");
  await page.keyboard.press("Escape");

  // Reviewer decisions and notes.
  await page.getByTestId("note-Q01").fill("Bond to be re-issued at 2%");
  await page.getByTestId("reviewed-Q01").check();
  await expect(page.getByTestId("reviewed-progress")).toContainText("Reviewed 1 of 18");
  await page.getByTestId("search").fill("");
  await page.getByTestId("finding-Q03").getByRole("button", { expanded: false }).click();
  await page.getByTestId("verdict-Q03").selectOption("attention");
  await expect(page.getByTestId("tile-attention")).toContainText("13");

  // Export: a real .xlsx with the findings and the reviewer's work.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export").click()]);
  expect(download.suggestedFilename()).toMatch(/^Bidlyze_Submission_Check_.*\.xlsx$/);
  const wb = XLSX.read(readFileSync(await download.path()), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Findings);
  expect(rows).toHaveLength(18);
  const r01 = rows.find((r) => r["Req. ID"] === "Q01");
  expect(r01["Reviewer note"]).toBe("Bond to be re-issued at 2%");
  expect(r01["Evidence 1 page"]).toBe("p.4");
  expect(rows.find((r) => r["Req. ID"] === "Q03")["Reviewer decision"]).toBe("Overridden: needs attention");

  // Reload: results and review notes are restored from this browser.
  await page.reload();
  await expect(page.getByText("Restored from this browser")).toBeVisible();
  await expect(page.getByTestId("reviewed-progress")).toContainText("Reviewed 2 of 18");

  // New check clears this device's copy.
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("new-check").click();
  await expect(page.getByTestId("dropzone")).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bidlyze.submissionCheck")))).toEqual([]);
  expect(calls.writes).toEqual([]);
});

test("older analysis without citations: works, explains that tender quotes are unavailable", async ({ page }) => {
  await mockSupabase(page);
  const legacyResult = { ...ectaResult, legacy: true, tender: { ...ectaResult.tender, analysisId: legacy.id }, items: ectaResult.items.map((i) => ({ ...i, tender: null, sourceRef: "p.2" })) };
  await mockCheckApi(page, legacyResult);
  await page.goto(`/analysis/${legacy.id}/submission-check`);
  await expect(page.getByTestId("tender-card")).toContainText("Analysed before page-cited quotes");
  await uploadAndRun(page);
  await expect(page.getByTestId("warning").first()).toContainText("analysed before page-cited quotes");
  await page.getByTestId("finding-Q01").getByRole("button", { expanded: false }).click();
  await expect(page.getByTestId("finding-Q01")).toContainText("No verified tender quote for this requirement (source: p.2)");
});

test("errors are handled: unsupported file, scanned PDF, AI failure with retry, partly unchecked results", async ({ page }) => {
  await mockSupabase(page);
  let fail = true;
  const partial = { ...ectaResult, meta: { ...ectaResult.meta, failedBatches: [1] }, items: ectaResult.items.map((i, k) => (k < 3 ? { ...i, status: "unproven", notChecked: true, evidence: [], gap: "" } : i)) };
  await page.route("**/api/submission-check", async (route) => {
    if (fail) return route.fulfill({ status: 502, json: { success: false, error: "The AI service could not check this response. Please try again in a few minutes." } });
    return route.fulfill({ json: partial });
  });
  await page.goto(WORKSPACE);

  await page.getByTestId("file-input").setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) });
  await expect(page.getByTestId("file-error")).toContainText("not a supported file");

  await page.getByTestId("file-input").setInputFiles(SCANNED_PDF);
  await expect(page.getByTestId("file-error")).toContainText("No readable text");

  await uploadAndRun(page);
  await expect(page.getByTestId("run-error")).toContainText("could not check this response");
  fail = false;
  await page.getByTestId("run-error").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("results")).toBeVisible();
  await expect(page.getByTestId("warning").first()).toContainText("could not be checked");
  await page.getByTestId("status-filter").selectOption("not_checked");
  await expect(page.getByTestId("shown-count")).toHaveText("Showing 3 of 18");
  await expect(page.getByTestId("findings").locator('[data-group="ok"]')).toHaveCount(0);
});

const RECORDED = new URL("../benchmarks/alton-cctv-2026/runs/demo-recorded-result.json", import.meta.url);
test("sample tender: the sample proposal gives the recorded live result (no AI) with contradictions shown both sides", async ({ page }) => {
  test.skip(!existsSync(RECORDED), "recorded demo result not generated yet");
  await mockSupabase(page);
  await page.goto("/submission-check/demo");
  await expect(page.getByTestId("tender-card")).toContainText("39 requirements");
  await page.getByTestId("use-sample").click();
  await expect(page.getByTestId("proposal-card")).toContainText("10 pages read");
  await page.getByTestId("run-check").click();
  await expect(page.getByTestId("recorded-notice")).toBeVisible();
  await page.getByTestId("search").fill("31 days");
  const card = page.getByTestId("findings").locator("article").first();
  await card.getByRole("button", { expanded: false }).click();
  await expect(card).toContainText("Contradiction");
  await expect(card).toContainText("Statement A");
  await expect(card).toContainText("Statement B");
});

test("mobile (390 px): no sideways scrolling on the start page or the results", async ({ page }) => {
  test.skip(!existsSync(RECORDED), "recorded demo result not generated yet");
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSupabase(page);
  await page.goto("/submission-check");
  await expect(page.getByTestId("tender-demo")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.goto("/submission-check/demo");
  await page.getByTestId("use-sample").click();
  await page.getByTestId("run-check").click();
  await expect(page.getByTestId("results")).toBeVisible();
  await page.getByTestId("finding-R14").getByRole("button", { expanded: false }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
