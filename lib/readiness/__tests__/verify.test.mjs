// Citation-verification tests. Run with: npm test
//
// Each case mimics something real PDF text extraction does (ligatures,
// line-break hyphens, page breaks, punctuation) or something the AI does
// (shortened quotes with "...", a changed number, an invented sentence).
// The two "must NOT verify" cases matter most: a wrong citation shown as
// verified would mislead a customer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex, verifyCitation } from "../verify.js";

const PAGES = [
  { unit: "page", n: 1, text: "TENDER NO. EX-2026-0001\nSupply and installation of smart parking sensors" },
  { unit: "page", n: 2, text: "2.1 The bidder shall submit a bid bond of 2% of the tender value;\nvalid for 120 days." },
  { unit: "page", n: 3, text: "3.4 The ﬁnancial proposal shall be submitted in a separate envelope.\nBidders must hold a valid In-\nCountry Value (ICV) certificate." },
  { unit: "page", n: 4, text: "4.2 All bidders shall attend the mandatory site visit on 10 December 2026. Bidders who do not attend the site" },
  { unit: "page", n: 5, text: "visit will be disqualified.\n5.1 Questions must be sent by 1 December 2026." },
  { unit: "page", n: 6, text: "6.1 Offers must remain valid for one hundred and twenty (120) days from the closing date." },
  { unit: "page", n: 8, text: "8.1 The bidder shall | Mandatory | submit a copy of the ISO 9001 certificate | Yes |" },
  { unit: "page", n: 9, text: "9.1 Subcontractors shall not attend the technical clarification meetings with the Authority." },
  { unit: "page", n: 7, text: "7.1 ﺳﻨﺪ ﺩﻣﺎﻥ العطاء" },
];
const index = buildIndex([{ fileIndex: 1, pages: PAGES }]);
const check = (quote, page) => verifyCitation(index, { quote, file: "F1", page: `P${page}` });

test("exact quote on the cited page is verified", () => {
  assert.equal(check("The bidder shall submit a bid bond of 2% of the tender value", 2).status, "verified");
});

test("exact quote on the wrong page is relocated to the right page", () => {
  const r = check("The bidder shall submit a bid bond of 2% of the tender value", 4);
  assert.equal(r.status, "relocated");
  assert.equal(r.pageN, 2);
});

test("ligatures from PDF extraction (fi) still verify", () => {
  assert.equal(check("The financial proposal shall be submitted in a separate envelope", 3).status, "verified");
});

test("compound word split across a line break (In-\\nCountry) still verifies", () => {
  assert.equal(check("Bidders must hold a valid In-Country Value (ICV) certificate", 3).status, "verified");
});

test("trailing punctuation that differs from the page still verifies", () => {
  assert.equal(check("submit a bid bond of 2% of the tender value.", 2).status, "verified");
});

test("non-breaking spaces still verify", () => {
  assert.equal(check("valid for one hundred and twenty (120) days from the closing date", 6).status, "verified");
});

test("quote shortened with an ellipsis verifies when every part is on the page in order", () => {
  assert.equal(check("All bidders shall attend ... site visit on 10 December 2026", 4).status, "verified");
});

test("quote that starts on the previous page and ends on the cited page verifies", () => {
  assert.equal(check("Bidders who do not attend the site visit will be disqualified", 5).status, "verified");
});

test("quote that starts on the cited page and ends on the next page verifies", () => {
  assert.equal(check("Bidders who do not attend the site visit will be disqualified", 4).status, "verified");
});

test("Arabic presentation-form characters match normal Arabic", () => {
  assert.equal(check("سند دمان العطاء", 7).status, "verified");
});

test("MUST NOT VERIFY: an invented sentence", () => {
  assert.equal(check("The bidder shall provide a performance bond of 10% within 7 days of award", 2).status, "unverified");
});

test("MUST NOT VERIFY: a real sentence with a changed number", () => {
  const r = check("The bidder shall submit a bid bond of 5% of the tender value", 2);
  assert.notEqual(r.status, "verified");
  assert.notEqual(r.status, "approximate");
  assert.notEqual(r.status, "relocated");
});

test("MUST NOT VERIFY: ellipsis parts that appear out of order", () => {
  assert.equal(check("site visit on 10 December 2026 ... All bidders shall attend", 4).status, "unverified");
});

test("table-layout noise between words gives an approximate match", () => {
  assert.equal(check("The bidder shall submit a copy of the ISO 9001 certificate", 8).status, "approximate");
});

test("MUST NOT VERIFY: approximate match with a different model number", () => {
  assert.equal(check("The bidder shall submit a copy of the ISO 9002 certificate", 8).status, "unverified");
});

test("MUST NOT VERIFY: quote that drops a 'not'", () => {
  assert.equal(check("Subcontractors shall attend the technical clarification meetings with the Authority", 9).status, "unverified");
});

test("MUST NOT VERIFY: quote that adds a 'not'", () => {
  assert.equal(check("The bidder shall not submit a copy of the ISO 9001 certificate", 8).status, "unverified");
});

test("too-short quotes are not treated as evidence", () => {
  assert.equal(check("bid", 2).status, "unverified");
});
