"""Synthetic BID RESPONSE to the fictional ECTA test tender, with known answers.

Used to test Submission Check: for each of 18 tender requirements we know
whether this response answers it fully, partly, not at all, or contradicts it,
and on which page the evidence is. Several items are deliberate traps:

  * text that matches but is not compliant (distributor letter instead of OEM,
    signed but not stamped, English only, ISO 9001 without ISO 27001)
  * a value that contradicts the tender (1% bond vs 2%, 90 days vs 120,
    3-year battery vs 5, approval AFTER delivery vs BEFORE)
  * the requirement copied word for word with no commitment (IP68)
  * answers in different words from the tender (site visit "inspection",
    10/12/2026) and answers found only in an annex table
  * requirements simply not mentioned (ICV certificate, compliance statement)

Fictional company; no real bid content. Run: python3 make_response.py
"""
import json
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

PAGES = [
    ["TECHNICAL AND COMMERCIAL PROPOSAL - FOR SOFTWARE TESTING ONLY (FICTIONAL)",
     "Submitted by: Northwind Parking Systems LLC",
     "To: Example City Transport Authority",
     "Tender No. ECTA/ICT/2026/014 - Smart Parking Sensors and Guidance System",
     "This bid is submitted through the Example e-Procurement Portal.",
     "This document is fictional and was created to test bid compliance software."],
    ["SECTION 1 - COMPANY AND ELIGIBILITY",
     "1.1 Our UAE trade licence No. 123456 covers ICT systems integration and is",
     "valid until March 2028. A copy is provided in Annex 1.",
     "1.2 We provide two completion certificates for smart parking projects",
     "delivered in Dubai (2023) and Sharjah (2024), see Annex 3.",
     "1.3 Audited financial statements for 2023, 2024 and 2025 are provided in Annex 4.",
     "1.4 We hold a valid ISO 9001:2015 certificate, provided in Annex 7."],
    ["SECTION 2 - TECHNICAL SOLUTION",
     "2.1 Requirements restated from the tender:",
     "4.1 All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.",
     "2.2 Our PS-200 sensors have a battery life of 3 years under typical traffic.",
     "2.3 Our system will integrate with the Authority's existing parking management",
     "platform through its REST interface.",
     "2.4 TDRA type approval for the radio units will be obtained within 60 days after delivery."],
    ["SECTION 3 - BID SECURITY AND VALIDITY",
     "3.1 We enclose an unconditional bid bond of 1% of the total bid value,",
     "valid for 150 days from the tender closing date.",
     "3.2 Our offer remains valid for 90 days from the tender closing date.",
     "3.3 A Manufacturer Authorisation Letter from our distributor, Gulf Sensors",
     "Trading LLC, is attached in Annex 5."],
    ["SECTION 4 - SUBMISSION FORMS",
     "4.1 All Annex B forms are signed by our authorised signatory, Mr. A. Rahman.",
     "4.2 Commercial forms are provided in English.",
     "4.3 Our project manager joined the Authority's compulsory site inspection on",
     "10/12/2026; the attendance sheet is included in Annex 6."],
    ["ANNEX TABLE - PORTAL AND REGISTRATION DETAILS",
     "Item | Detail",
     "Supplier registration | Registered on the Example e-Procurement Portal on 14 March 2025",
     "Registration number | EP-55821",
     "Submission channel | Example e-Procurement Portal (online)"],
]

c = canvas.Canvas("ECTA_test_response.pdf", pagesize=A4)
c.setTitle("ECTA test bid response (fictional)")
for i, lines in enumerate(PAGES, 1):
    y = 270 * mm
    for j, line in enumerate(lines):
        c.setFont("Helvetica-Bold" if j == 0 else "Helvetica", 12 if j == 0 else 10.5)
        c.drawString(18 * mm, y, line)
        y -= 9 * mm
    c.setFont("Helvetica", 9)
    c.drawString(95 * mm, 12 * mm, f"Response page {i} of {len(PAGES)}")
    c.showPage()
c.save()

# Requirements to check, with the exact tender wording and page (from
# ECTA_test_tender.pdf), the correct verdict for THIS response, and the page
# where the evidence is (None when the response does not address it).
R = lambda id, req, quote, tpage, status, rpage, trap: dict(
    id=id, requirement=req, tenderQuote=quote, tenderPage=tpage,
    expected=status, responsePage=rpage, trap=trap)

truth = {
    "statuses": ["answered", "partial", "missing", "conflict"],
    "requirements": [
        R("Q01", "Submit an unconditional bid bond of 2% of the total bid value, valid 150 days",
          "The bidder shall submit an unconditional bid bond of 2% of the total bid value", 2,
          "conflict", 4, "value: 1% instead of 2%"),
        R("Q02", "Offer valid for 120 days from the closing date",
          "Offers shall remain valid for 120 days from the tender closing date.", 2,
          "conflict", 4, "value: 90 days instead of 120"),
        R("Q03", "Submit through the Example e-Procurement Portal only",
          "Bids shall be submitted through the Example e-Procurement Portal only.", 2,
          "answered", 1, None),
        R("Q04", "Be registered on the Example e-Procurement Portal before the closing date",
          "Only suppliers registered on the Example e-Procurement Portal before the closing date may submit a bid.", 2,
          "answered", 6, "answer only in an annex table"),
        R("Q05", "Hold a valid UAE trade licence covering ICT systems integration",
          "The bidder shall hold a valid UAE trade licence covering ICT systems integration.", 3,
          "answered", 2, None),
        R("Q06", "Submit a valid In-Country Value (ICV) certificate",
          "Bidders must submit a valid In-Country Value (ICV) certificate.", 3,
          "missing", None, "not mentioned"),
        R("Q07", "Provide at least three completion certificates for similar smart parking projects",
          "The bidder shall provide at least three (3) completion certificates for similar smart parking projects", 3,
          "partial", 2, "two certificates instead of three"),
        R("Q08", "Submit audited financial statements for the last three years",
          "Audited financial statements for the last three (3) years shall be submitted.", 3,
          "answered", 2, "years named (2023-2025), not '3 years'"),
        R("Q09", "All parking sensors have an IP68 rating",
          "All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.", 4,
          "missing", None, "requirement copied word for word, no commitment"),
        R("Q10", "Sensors have a minimum battery life of 5 years",
          "All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.", 4,
          "conflict", 3, "value: 3 years instead of 5"),
        R("Q11", "Manufacturer Authorisation Letter from the sensor OEM, addressed to the Authority",
          "The bidder shall submit a Manufacturer Authorisation Letter (MAL) from the sensor OEM, addressed to the Authority.", 4,
          "partial", 4, "letter from a distributor, not the OEM"),
        R("Q12", "TDRA type approval for all radio equipment before delivery",
          "All radio equipment shall have TDRA type approval before delivery.", 4,
          "conflict", 3, "after delivery instead of before"),
        R("Q13", "Integrate with the Authority's existing parking management platform",
          "The system shall integrate with the Authority's existing parking management platform.", 4,
          "answered", 3, None),
        R("Q14", "Attend the mandatory site visit on 10 December 2026",
          "A mandatory site visit will be held on 10 December 2026 at 10:00.", 5,
          "answered", 5, "different words (compulsory site inspection, 10/12/2026)"),
        R("Q15", "All Annex B forms signed by the authorised signatory and stamped with the company seal",
          "All forms in Annex B shall be signed by the authorised signatory and stamped with the company seal.", 6,
          "partial", 5, "signed but not stamped"),
        R("Q16", "Commercial forms submitted in Arabic and English",
          "Commercial forms shall be submitted in Arabic and English.", 6,
          "partial", 5, "English only"),
        R("Q17", "Submit a clause-by-clause compliance statement",
          "The bidder shall submit a clause-by-clause compliance statement.", 6,
          "missing", None, "not mentioned"),
        R("Q18", "Hold valid ISO 9001 and ISO 27001 certificates",
          "The bidder shall hold valid ISO 9001 and ISO 27001 certificates.", 8,
          "partial", 2, "ISO 9001 only, no ISO 27001"),
    ],
}
json.dump(truth, open("submission_truth.json", "w"), indent=2)
print("ok")
