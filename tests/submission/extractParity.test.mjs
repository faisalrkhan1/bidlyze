// The proposal is read in the browser (lib/submission/extractClient.js). Its
// text must be identical to the server's extraction (lib/readiness/pages.js),
// or quotes would be verified against different text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Document, Packer, Paragraph } from "docx";

import { extractPages } from "../../lib/readiness/pages.js";
import { extractProposalPages, proposalContentType, sha256Hex, ExtractionError } from "../../lib/submission/extractClient.js";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ab = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

for (const f of ["../e2e/ECTA_test_response.pdf", "../benchmarks/alton-cctv-2026/supplier_proposal.pdf"]) {
  test(`PDF parity: browser and server read ${f.split("/").pop()} identically`, async () => {
    const buf = readFileSync(new URL(f, import.meta.url));
    const server = await extractPages({ buffer: buf, contentType: "application/pdf" });
    const client = await extractProposalPages(ab(buf), "application/pdf");
    assert.deepEqual(client.pages, server.pages);
    assert.deepEqual(client.scannedPages, server.scannedPages);
    assert.ok(client.chars > 1000);
  });
}

test("Word (.docx) parity: browser build of mammoth gives the same sections as the server", async () => {
  const doc = new Document({ sections: [{ children: Array.from({ length: 60 }, (_, i) => new Paragraph(`Clause ${i + 1}. The supplier confirms requirement ${i + 1} is met in full, with evidence in Annex ${i % 7}.`)) }] });
  const buf = await Packer.toBuffer(doc);
  const server = await extractPages({ buffer: buf, contentType: DOCX });
  const client = await extractProposalPages(ab(buf), DOCX);
  assert.deepEqual(client.pages, server.pages);
  assert.ok(client.pages.length >= 2, "long documents are split into sections");
  assert.equal(client.pages[0].unit, "section");
});

test("text parity", async () => {
  const buf = Buffer.from("Section one.\n\nWe confirm 31 days of storage.\n\nSection three.", "utf-8");
  const server = await extractPages({ buffer: buf, contentType: "text/plain" });
  const client = await extractProposalPages(ab(buf), "text/plain");
  assert.deepEqual(client.pages, server.pages);
});

test("unsupported, damaged and mis-named files fail with a clear message", async () => {
  assert.equal(proposalContentType("bid.PDF", ""), "application/pdf");
  assert.equal(proposalContentType("bid.docx", "application/octet-stream"), DOCX);
  assert.equal(proposalContentType("scan.png", "image/png"), null);
  assert.equal(proposalContentType("old.doc", "application/msword"), null);
  await assert.rejects(extractProposalPages(new ArrayBuffer(8), "image/png"), ExtractionError);
  await assert.rejects(extractProposalPages(ab(Buffer.from("this is not a pdf")), "application/pdf"), (e) => e instanceof ExtractionError && /could not be read/.test(e.message));
});

test("file fingerprint matches Node's SHA-256", async () => {
  const buf = readFileSync(new URL("../e2e/ECTA_test_response.pdf", import.meta.url));
  assert.equal(await sha256Hex(ab(buf)), createHash("sha256").update(buf).digest("hex"));
});
