"""Realistic (fictional) supplier proposal answering the AUTHENTIC Alton Town
Council CCTV Invitation to Tender (public document, see ../../../lib/benchmarks/sources.js).

The supplier, its staff, its references and all phone numbers / e-mails are
fictional (01632 960xxx numbers are reserved for drama by Ofcom; .example
domains are reserved). The proposal deliberately contains subtle compliance
problems; the expected verdict for every requirement, with evidence from both
documents, is in answer_key.json. Nothing here is a real bid.

Run:  python3 make_proposal.py   ->  supplier_proposal.pdf
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak)

OUT = "supplier_proposal.pdf"
TOTAL_PAGES = 10

body = ParagraphStyle("body", fontName="Helvetica", fontSize=10.5, leading=14.5, spaceAfter=7)
small = ParagraphStyle("small", parent=body, fontSize=9, leading=12)
h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=15, leading=19, spaceAfter=10, textColor=colors.HexColor("#1F3A5F"))
h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11.5, leading=15, spaceBefore=6, spaceAfter=5, textColor=colors.HexColor("#1F3A5F"))
title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=24, leading=30, spaceAfter=16, textColor=colors.HexColor("#1F3A5F"))
cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=9.5, leading=12.5)
cellb = ParagraphStyle("cellb", parent=cell, fontName="Helvetica-Bold")


def P(text, style=body):
    return Paragraph(text, style)


def table(rows, widths):
    data = [[Paragraph(c, cellb if i == 0 else cell) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9AA9BA")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def footer(canv, doc):
    canv.saveState()
    canv.setFont("Helvetica", 8)
    canv.setFillColor(colors.HexColor("#555555"))
    canv.drawString(20 * mm, 12 * mm, "Halberd Vision Systems Ltd | Technical Proposal | Alton Town Council CCTV")
    canv.drawRightString(190 * mm, 12 * mm, f"Page {doc.page} of {TOTAL_PAGES}")
    canv.restoreState()


s = []

# ---- Page 1: cover --------------------------------------------------------
s += [Spacer(1, 30 * mm), P("TECHNICAL PROPOSAL", title),
      P("CCTV review of current system, design to meet new requirements, installation and "
        "ongoing maintenance support contract for 3 years to 2029", h1),
      Spacer(1, 8 * mm),
      P("<b>Submitted to:</b> The Town Clerk, Alton Town Council, Town Hall, Market Square, Alton"),
      P("<b>Submitted by:</b> Halberd Vision Systems Ltd"),
      P("<b>Date:</b> 10 August 2026"),
      P("<b>Document 1 of 2.</b> Our pricing is provided separately in Document 2 (Price Schedule)."),
      Spacer(1, 30 * mm),
      P("<i>Benchmark test document. The supplier, its staff and its references are fictional. "
        "It was written to test bid compliance software against an authentic public tender.</i>", small),
      PageBreak()]

# ---- Page 2: executive summary --------------------------------------------
s += [P("1. Executive summary", h1),
      P("Halberd Vision Systems is pleased to submit this proposal to review, redesign, extend and "
        "maintain the Town Council's public space CCTV system across the Town Centre and Open Spaces."),
      P("Our proposal covers all six locations in the contract: the four High Street camera positions, "
        "the High Street ANPR camera, the Market Square, the Public Gardens, Jubilee Playing Fields and "
        "Anstey Park."),
      P("We will deliver the upgraded system in time for the start of the maintenance contract on "
        "1 November 2026, and we will train three Council Officers so that the Council can apply for "
        "its public space surveillance licence."),
      P("Key benefits of our proposal:"),
      P("&bull; An open recording platform with spare capacity for future cameras."),
      P("&bull; Evidential-quality images at every entry point and in the Market Square."),
      P("&bull; A single point of contact and a 24/7 fault line staffed by our own engineers."),
      P("Our experience, our proposed approach to the works and our technical specification are set "
        "out in Sections 2 to 7 of this document."),
      PageBreak()]

# ---- Page 3: experience, personnel, references -----------------------------
s += [P("2. Company experience, key personnel and references", h1),
      P("2.1 About us", h2),
      P("Halberd Vision Systems Ltd has designed, installed and maintained public space CCTV for town "
        "and parish councils in southern England since 2009, with a team of 14 staff and six field engineers."),
      P("2.2 Key personnel", h2),
      table([["Name", "Role", "Experience and qualifications"],
             ["Daniel Okafor", "Project Director", "18 years in public space CCTV; BTEC Level 4 in Security Systems"],
             ["Priya Nandra", "Lead Design Engineer", "12 years; HERS certificate holder; accredited trainer for public space surveillance operators"],
             ["Tom Wrexley", "Senior Field Engineer", "9 years; HERS certificate holder; IPAF 3a and 3b"]],
            [38, 42, 90]),
      Spacer(1, 4 * mm),
      P("2.3 References", h2),
      P("Reference 1: Larkmoor Town Council. Upgrade of 22 town-centre cameras and the control room, "
        "completed in May 2026. Contact: Ms Helen Marsh, Town Clerk, 01632 960418, clerk@larkmoor-tc.example."),
      P("Reference 2: Fenbridge Borough Council. Maintenance of 40 public space cameras from April 2021 "
        "to March 2024. Contact: Mr Gareth Pryce, CCTV Manager, 01632 960733, g.pryce@fenbridge-bc.example."),
      PageBreak()]

# ---- Page 4: review of existing system, camera recommendations -------------
s += [P("3. Review of the existing system and camera recommendations", h1),
      P("3.1 Site survey", h2),
      P("Our engineers surveyed all existing camera positions on 21 July 2026. We checked the field of "
        "view, image quality, power supplies and network links at each location and identified two supply "
        "issues: an intermittent power feed to the Market Square column and a failing wireless link at "
        "Jubilee Playing Fields. Both are corrected in our design."),
      P("3.2 Camera positions and trees", h2),
      P("Camera positions have been checked on site to ensure that the field of view is not blocked by "
        "existing trees."),
      P("3.3 Recommended cameras", h2),
      P("We recommend 4MP and 8MP IP cameras with true day/night operation and infrared illumination to "
        "50 metres. At entry points and in the Market Square the cameras achieve the identify level of "
        "detail described in BS EN 62676-4, so recordings are of evidential quality for Hampshire "
        "Constabulary and the courts."),
      P("3.4 Existing cameras to be retained", h2),
      P("The eight High Street cameras installed in 2021 are in good condition and will be retained. "
        "Firmware updates for these cameras are included in our price. Hardware upgrades to retained "
        "cameras are excluded and can be quoted separately if required."),
      PageBreak()]

# ---- Page 5: new locations and capacity ------------------------------------
s += [P("4. New camera locations and system capacity", h1),
      P("4.1 New camera locations", h2),
      table([["Location", "Cameras", "Purpose"],
             ["Harry Baker Pavilion, Jubilee Playing Fields", "2", "Building entrances and frontage"],
             ["Charles Read Pavilion, Jubilee Playing Fields", "2", "Building entrances and changing room access"],
             ["Anstey Lane car park, in front of Energique", "3", "Vehicle entrance and parking bays"]],
            [72, 22, 76]),
      Spacer(1, 4 * mm),
      P("All new cameras connect to the existing recorder network over fibre or licensed point-to-point radio."),
      P("4.2 Capacity for growth", h2),
      P("The recording platform is licensed for 64 channels and the storage array has 40% spare capacity, "
        "which allows the system to grow over the next 5 to 10 years without replacing the core equipment."),
      PageBreak()]

# ---- Page 6: recording, viewing, faults ------------------------------------
s += [P("5. Recording, viewing and fault management", h1),
      P("5.1 Recording", h2),
      P("Recorders are configured to store at least 31 days of continuous recordings from every camera."),
      P("5.2 Viewing", h2),
      P("Nominated Council Officers will view live and recorded footage through a secure viewing client at "
        "the Town Hall, and Hampshire Constabulary will be given an evidence export account for "
        "downloading footage."),
      P("5.3 Fault monitoring and repair", h2),
      P("Our monitoring service checks every camera and recorder automatically every 15 minutes, 24 hours a "
        "day, and raises an alert to our service desk if a device goes offline or the image fails."),
      P("Every reported fault is acknowledged within 4 hours. An engineer will attend site and assess the "
        "fault within 48 hours of the report."),
      P("Faults are remedied within 72 hours of the report, seven days a week, including weekends and bank holidays."),
      P("5.4 CCTV retention policy", h2),
      P("CCTV retention policy: to be discussed with the Council at the mobilisation meeting."),
      PageBreak()]

# ---- Page 7: programme, training, safety -----------------------------------
s += [P("6. Installation programme, training and safety", h1),
      P("6.1 Programme", h2),
      table([["Stage", "Dates"],
             ["Order and mobilisation meeting", "14 to 18 September 2026"],
             ["Equipment delivery", "5 October 2026"],
             ["Installation and commissioning", "12 October to 13 November 2026"],
             ["System handover and acceptance", "Week commencing 16 November 2026"]],
            [90, 80]),
      Spacer(1, 4 * mm),
      P("Equipment lead time is three weeks from order, and all cameras and recorders are held in stock by "
        "our UK distributor."),
      P("6.2 Training", h2),
      P("We will provide classroom and on-site training for two nominated Council Officers, covering system "
        "operation, evidence handling and the requirements of the public space surveillance licence."),
      P("6.3 Health and safety", h2),
      P("We install and anchor all equipment to the manufacturer's instructions using load-rated brackets, "
        "so that every installation is safe and compliant with Health and Safety regulations."),
      P("Our site teams work to task-specific Risk Assessments and Method Statements (RAMS), with barriers "
        "and traffic management around every work area, so that our workers and the public are protected "
        "at all times."),
      PageBreak()]

# ---- Page 8: testing, equipment, qualifications ----------------------------
s += [P("6. Installation programme, training and safety (continued)", h1),
      P("6.4 Testing", h2),
      P("Anchor points and catenary wires are load tested at installation and at every annual service "
        "visit, using our in-house test procedure HVS-TP-07."),
      P("All electrical components, wiring and connections are tested, and we issue an Electrical "
        "Installation Certificate to BS 7671 for every circuit we install or modify."),
      P("6.5 Access equipment and vehicles", h2),
      P("We supply all access equipment, including our own cherry pickers (mobile elevating work platforms), "
        "and our own vehicles to transport equipment."),
      P("6.6 Qualifications", h2),
      P("Our lead engineers hold the HERS certificate; copies are provided in Appendix B."),
      P("All site operatives hold IPAF PAL cards in categories 3a and 3b for operating cherry pickers and "
        "are trained in working at height."),
      PageBreak()]

# ---- Page 9: maintenance, commercial, insurance ----------------------------
s += [P("7. Maintenance, commercial terms and insurance", h1),
      P("7.1 Maintenance term", h2),
      P("Our maintenance agreement runs for three years, from 1 November 2026 to 31 October 2029."),
      P("7.2 Price", h2),
      P("Our total price is provided in the separate Price Schedule (Document 2). It covers the initial "
        "installation and annual maintenance for Years 1 and 2. Maintenance for Year 3 will be quoted at "
        "the first anniversary of the contract, in line with the equipment then installed."),
      P("7.3 Scope of the maintenance fee", h2),
      P("The annual maintenance fee covers preventive maintenance visits and the repair of equipment faults. "
        "Call-outs to faults caused by vandalism, power failure or third-party damage are charged at "
        "&pound;85 per hour plus parts."),
      P("7.4 Assumptions", h2),
      P("Our price assumes that the existing High Street columns are structurally sound. Any remedial work "
        "to columns found during installation will be charged as a variation."),
      P("7.5 Payment", h2),
      P("Our offer is conditional on 50% of the installation price being paid with the order, before work "
        "starts; the balance is invoiced on handover."),
      P("7.6 Insurance", h2),
      P("We hold Public Liability insurance of &pound;10,000,000 and Professional Indemnity insurance of "
        "&pound;5,000,000. Certificates are provided in Appendix B."),
      P("7.7 Kings Pond car park and Holybourne Play Area", h2),
      P("For Kings Pond car park and Holybourne Play Area, which have no electricity supply, we suggest "
        "solar-powered cameras with battery storage and 4G transmission. We would be pleased to survey both "
        "sites and provide options."),
      PageBreak()]

# ---- Page 10: appendices ---------------------------------------------------
s += [P("Appendix A: Equipment schedule", h1),
      table([["Item", "Specification", "Qty"],
             ["4MP bullet camera", "Day/night, infrared to 50 m, IP67 housing", "7"],
             ["8MP turret camera", "Day/night, vandal-resistant IK10 housing", "3"],
             ["Network video recorder", "64-channel licence, 96 TB RAID 6 storage", "1"],
             ["Recording retention", "30 days at full resolution from all cameras", "-"],
             ["Viewing client", "Town Hall workstation and evidence export account", "1"]],
            [52, 98, 20]),
      Spacer(1, 6 * mm),
      P("Appendix B: Certificates and insurance documents", h1),
      P("B1. HERS certificate: Priya Nandra, Lead Design Engineer."),
      P("B2. HERS certificate: Tom Wrexley, Senior Field Engineer."),
      P("HERS certificates for our remaining four field engineers will follow on award."),
      P("B3. Public Liability insurance certificate (&pound;10,000,000), valid to 31 March 2027."),
      ]

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                        topMargin=20 * mm, bottomMargin=22 * mm,
                        title="Technical Proposal - Alton Town Council CCTV (fictional benchmark)",
                        author="Halberd Vision Systems Ltd (fictional)")
doc.build(s, onFirstPage=footer, onLaterPages=footer)
print("wrote", OUT)
