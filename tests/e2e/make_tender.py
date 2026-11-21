"""Synthetic test tender with known answers (ground truth) for Bidlyze E2E testing.
Fictional authority; no real tender content."""
import json
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

PAGES = [
    ["TENDER DOCUMENT - FOR SOFTWARE TESTING ONLY (FICTIONAL)",
     "Example City Transport Authority",
     "Tender No. ECTA/ICT/2026/014",
     "Supply, Installation and Maintenance of Smart Parking Sensors and Guidance System",
     "Tender closing date: 15 January 2027 at 14:00 (UAE time).",
     "This document is fictional and was created to test tender analysis software."],
    ["SECTION 2 - INSTRUCTIONS TO BIDDERS",
     "2.1 The bidder shall submit an unconditional bid bond of 2% of the total bid value,",
     "valid for 150 days from the tender closing date.",
     "2.2 Offers shall remain valid for 120 days from the tender closing date.",
     "2.3 Bids shall be submitted through the Example e-Procurement Portal only.",
     "Hard copies will not be accepted.",
     "2.4 Only suppliers registered on the Example e-Procurement Portal before the",
     "closing date may submit a bid."],
    ["SECTION 3 - ELIGIBILITY",
     "3.1 The bidder shall hold a valid UAE trade licence covering ICT systems integration.",
     "3.2 Bidders must submit a valid In-Country Value (ICV) certificate. Bids without an",
     "ICV certificate will receive zero marks for the ICV criterion.",
     "3.3 The bidder shall provide at least three (3) completion certificates for similar",
     "smart parking projects completed in the last five years.",
     "3.4 Audited financial statements for the last three (3) years shall be submitted."],
    ["SECTION 4 - TECHNICAL REQUIREMENTS",
     "4.1 All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.",
     "4.2 The bidder shall submit a Manufacturer Authorisation Letter (MAL) from the sensor",
     "OEM, addressed to the Authority.",
     "4.3 All radio equipment shall have TDRA type approval before delivery.",
     "4.4 The system shall integrate with the Authority's existing parking management platform."],
    ["SECTION 5 - SITE VISIT AND CLARIFICATIONS",
     "5.1 A mandatory site visit will be held on 10 December 2026 at 10:00.",
     "Bidders who do not attend the site visit will be",
     ],
    ["disqualified.",
     "5.2 All clarification questions must be submitted through the portal no later than",
     "20 December 2026.",
     "SECTION 6 - SUBMISSION DOCUMENTS",
     "6.1 All forms in Annex B shall be signed by the authorised signatory and stamped",
     "with the company seal.",
     "6.2 The technical proposal may be submitted in English. Commercial forms shall be",
     "submitted in Arabic and English.",
     "6.3 The bidder shall submit a clause-by-clause compliance statement. Any deviation",
     "not declared in the deviation schedule will be treated as full compliance."],
    ["SECTION 7 - COMMERCIAL TERMS",
     "7.1 Payment terms: 30% on delivery, 60% on commissioning, 10% after the",
     "12-month defects liability period.",
     "7.2 Liquidated damages of 0.1% of the contract value per day of delay, capped at 10%.",
     "7.3 The quantity in BOQ item 3.2 is 2,400 sensors. The drawing schedule in Annex D",
     "lists 2,600 sensors."],
    ["SECTION 8 - EVALUATION",
     "8.1 Evaluation weighting: technical 70%, commercial 30%. The minimum technical",
     "score to pass is 70%.",
     "8.2 The bidder shall hold valid ISO 9001 and ISO 27001 certificates."],
]

c = canvas.Canvas("ECTA_test_tender.pdf", pagesize=A4)
c.setTitle("ECTA test tender (fictional)")
for i, lines in enumerate(PAGES, 1):
    y = 270 * mm
    for j, line in enumerate(lines):
        c.setFont("Helvetica-Bold" if j == 0 else "Helvetica", 13 if j == 0 else 11)
        c.drawString(20 * mm, y, line)
        y -= 9 * mm
    c.setFont("Helvetica", 9)
    c.drawString(100 * mm, 12 * mm, f"Page {i} of {len(PAGES)}")
    c.showPage()
c.save()

truth = {
    "required": {
        "bid_bond": 2, "bid_validity": 2, "submission_format": 2, "vendor_registration": 2,
        "trade_license": 3, "icv_certificate": 3, "previous_experience": 3, "financial_statements": 3,
        "manufacturer_authorization": 4, "type_approvals": 4,
        "mandatory_site_visit": 5, "clarification_deadline": 6,
        "stamped_signed_forms": 6, "arabic_documents": 6, "deviation_statement": 6,
        "iso_certifications": 8,
    },
    "not_specified": ["pre_bid_meeting", "local_authority_approvals", "mofa_attestation", "classification_grade"],
    "key_dates": {"site visit": "2026-12-10", "clarification deadline": "2026-12-20", "closing": "2027-01-15"},
    "clarification_traps": {
        "integration platform not named (4.4)": 4,
        "BOQ 2,400 vs drawings 2,600 sensors (7.3)": 7,
    },
    "spans_page_break": "site visit disqualification sentence runs from page 5 to page 6",
}
json.dump(truth, open("ground_truth.json", "w"), indent=2)
print("ok")
