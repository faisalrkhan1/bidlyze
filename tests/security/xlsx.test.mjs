// The SheetJS "xlsx" package was replaced by exceljs (unfixed advisories).
// These tests check that spreadsheet reading (tender uploads) and writing
// (Tender Intelligence exports) still work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ExcelJS from "exceljs";
import { xlsxSheets } from "../../lib/sheetText.js";
import { extractPages } from "../../lib/readiness/pages.js";
import { CT_XLSX } from "../../lib/readiness/sections.js";

const require = createRequire(import.meta.url);

async function sampleWorkbook() {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("Returnables");
  a.addRow(["Ref", "Document", "Mandatory"]);
  a.addRow(["D1", "Signed form of tender, with \"seal\"", "Yes"]);
  a.addRow(["D2", { richText: [{ text: "Price " }, { text: "schedule" }] }, "Yes"]);
  a.addRow(["D3", { formula: "1+1", result: 2 }, new Date("2026-12-01T00:00:00Z")]);
  const b = wb.addWorksheet("Notes");
  b.addRow(["Line, with comma"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test("xlsx text extraction reads every sheet as CSV (exceljs)", async () => {
  const sheets = await xlsxSheets(await sampleWorkbook());
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0].name, "Returnables");
  assert.match(sheets[0].csv, /^Ref,Document,Mandatory/);
  assert.match(sheets[0].csv, /"Signed form of tender, with ""seal"""/);
  assert.match(sheets[0].csv, /D2,Price schedule,Yes/);
  assert.match(sheets[0].csv, /D3,2,2026-12-01/);
  assert.equal(sheets[1].csv, '"Line, with comma"');
});

test("xlsx pages for the readiness engine: one page per sheet, with the sheet name", async () => {
  const { pages, scannedPages } = await extractPages({ buffer: await sampleWorkbook(), contentType: CT_XLSX });
  assert.deepEqual(pages.map((p) => [p.unit, p.n, p.label]), [["sheet", 1, "Returnables"], ["sheet", 2, "Notes"]]);
  assert.deepEqual(scannedPages, []);
});

test("per-sheet character cap is applied and reported", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Big");
  for (let i = 0; i < 2000; i++) ws.addRow([`row ${i}`, "x".repeat(40)]);
  const sheets = await xlsxSheets(Buffer.from(await wb.xlsx.writeBuffer()), { maxCharsPerSheet: 5000 });
  assert.equal(sheets[0].truncated, true);
  assert.ok(sheets[0].csv.length <= 5000);
});

test("a corrupt workbook is rejected, not half-read", async () => {
  await assert.rejects(() => xlsxSheets(Buffer.from("PK\u0003\u0004 not really a zip")));
});

test("the vulnerable SheetJS package is no longer installed", () => {
  assert.throws(() => require.resolve("xlsx"));
});

test("Tender Intelligence table export builds a valid workbook with exceljs", async () => {
  const { buildMultiSheetWorkbook } = await import("../../app/utils/exportExcel.js");
  const wb = await buildMultiSheetWorkbook([
    { name: "Compliance Matrix", data: [{ "#": "R1", Requirement: "Provide 31 days of recordings", Mandatory: "Yes", Extra: { a: 1 } }] },
    { name: "Empty", data: [] },
    { name: "Bad/Name:With*Chars", data: [{ A: 1 }] },
  ]);
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(await wb.xlsx.writeBuffer());
  assert.deepEqual(back.worksheets.map((w) => w.name), ["Compliance Matrix", "Bad Name With Chars"]);
  assert.equal(back.worksheets[0].getCell("B2").value, "Provide 31 days of recordings");
  assert.equal(back.worksheets[0].getCell("D2").value, '{"a":1}');
});
