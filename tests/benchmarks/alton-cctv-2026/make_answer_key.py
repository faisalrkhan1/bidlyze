import json
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "answer_key.json")
R = []
def req(id, requirement, tq, tp, expected, ev, why, trap):
    R.append({"id": id, "requirement": requirement, "tenderQuote": tq, "tenderPage": tp,
              "expected": expected,
              "responseEvidence": [{"quote": q, "page": p} for q, p in ev],
              "justification": why, "trap": trap})

req("A01", "Add camera coverage for the Harry Baker and Charles Read Pavilions at Jubilee Playing Fields.",
    "Coverage for the Harry Baker and Charles Read Pavilions at Jubilee Playing Fields", 2, "answered",
    [("Harry Baker Pavilion, Jubilee Playing Fields 2 Building entrances and frontage Charles Read Pavilion, Jubilee Playing Fields 2 Building entrances and changing room access", 5)],
    "Both pavilions are listed with cameras in the new-locations table.", "evidence in a table")
req("A02", "Add camera coverage for the Anstey Lane car park in front of Energique and the parking area to the rear of Energique.",
    "The car park off Anstey Lane in front of Energique, along with the parking area to the rear of Energique", 2, "partial",
    [("Anstey Lane car park, in front of Energique 3 Vehicle entrance and parking bays", 5)],
    "Only the car park in front of Energique is covered; the rear parking area appears nowhere in the proposal.", "scope omission")
req("A03", "Add camera coverage for the Council compound at Anstey Park.",
    "the parking area to the rear of Energique • The Council compound at Anstey Park", 2, "missing", [],
    "The Council compound is not mentioned anywhere in the proposal (the new-locations table lists only two pavilions and the front car park).", "missing")
req("A04", "The system must allow growth over the next 5 to 10 years.",
    "The Council want a system which will allow growth over the next 5 to 10 years.", 2, "answered",
    [("The recording platform is licensed for 64 channels and the storage array has 40% spare capacity, which allows the system to grow over the next 5 to 10 years", 5)],
    "States concrete spare capacity (64-channel licence, 40% storage headroom) for 5-10 years of growth.", "")
req("A05", "Maintenance contract from 1 November 2026 for three years, ending 31 October 2029.",
    "agreeing a maintenance contract with a supplier from 1st November 2026. The contract will then run for three years and will end on 31st October 2029.", 2, "answered",
    [("Our maintenance agreement runs for three years, from 1 November 2026 to 31 October 2029.", 9)],
    "Same term and dates.", "different date format")
req("A06", "Review the existing system to identify coverage and any supply issues at the existing locations.",
    "Review the existing system to identify the coverage and any supply issues for the existing locations.", 3, "answered",
    [("We checked the field of view, image quality, power supplies and network links at each location and identified two supply issues", 4)],
    "Survey of all existing positions done, coverage and supply checked, two supply issues identified and fixed in the design.", "")
req("A07", "Position units so that visibility is not blocked by existing trees, and ensure this will not become an issue within the contract period.",
    "positioning of the units to ensure visibility is not blocked by existing trees and that this will not become an issue within the contract period.", 3, "partial",
    [("Camera positions have been checked on site to ensure that the field of view is not blocked by existing trees.", 4)],
    "Covers current tree obstruction only; nothing ensures visibility stays clear during the three-year contract (e.g. growth, vegetation management).", "subtle scope omission")
req("A08", "Recommend cameras that provide good quality images as required by the Police and Courts.",
    "Recommendation of cameras which provide good quality images as required by the Police and Courts.", 3, "answered",
    [("At entry points and in the Market Square the cameras achieve the identify level of detail described in BS EN 62676-4, so recordings are of evidential quality for Hampshire Constabulary and the courts.", 4)],
    "Camera recommendation with evidential (identify-level) image quality for the police and courts.", "different wording (Hampshire Constabulary = Police)")
req("A09", "Where existing cameras are retained, any upgrades must be included.",
    "Where existing cameras are to be retained, any upgrades to be included.", 3, "conflict",
    [("Hardware upgrades to retained cameras are excluded and can be quoted separately if required.", 4)],
    "Tender requires any upgrades to retained cameras to be included; the proposal includes firmware only and explicitly excludes hardware upgrades.", "commercial exclusion")
req("A10", "Draw up detailed plans and records of the planned location of each device, with the Project Manager.",
    "Detailed plans and records of the planned location of each device shall be drawn up by the contractor in conjunction with the Project Manager.", 3, "missing", [],
    "No plans, drawings, device records or asset register are offered anywhere in the proposal.", "missing")
req("A11", "Install the new system to be fully operational by 1 November 2026.",
    "Install the new system to be fully operational by 1st November 2026.", 3, "conflict",
    [("System handover and acceptance Week commencing 16 November 2026", 7),
     ("We will deliver the upgraded system in time for the start of the maintenance contract on 1 November 2026", 2)],
    "The executive summary promises 1 November 2026, but the programme puts installation until 13 November and handover in the week of 16 November: a contradiction, and the programme misses the date.", "internal contradiction (date)")
req("A12", "Provide training for at least three Officers so the Council can achieve the public space surveillance (CCTV) licence.",
    "To provide training for at least three Officers to ensure the Town Council can achieve the public space surveillance (CCTV) licence.", 3, "conflict",
    [("We will provide classroom and on-site training for two nominated Council Officers", 7),
     ("we will train three Council Officers so that the Council can apply for its public space surveillance licence", 2)],
    "The training section commits to two Officers (minimum is three); the executive summary says three. Contradictory, and the detailed commitment is below the minimum.", "internal contradiction (number)")
req("A13", "Provide the required signage for the CCTV system and its placement.",
    "To provide the required signage for the CCTV system and its placement.", 3, "missing", [],
    "CCTV signage is not mentioned anywhere in the proposal.", "missing")
req("A14", "Monitor the system for any faults.",
    "Monitor the system for any faults and evaluate within 24 hours of the report.", 3, "answered",
    [("Our monitoring service checks every camera and recorder automatically every 15 minutes, 24 hours a day, and raises an alert to our service desk", 6)],
    "Automatic 24/7 monitoring of every device.", "")
req("A15", "Evaluate each reported fault within 24 hours of the report.",
    "Monitor the system for any faults and evaluate within 24 hours of the report.", 3, "conflict",
    [("An engineer will attend site and assess the fault within 48 hours of the report.", 6)],
    "Assessment within 48 hours exceeds the 24-hour maximum. The 4-hour 'acknowledged' commitment is not an evaluation.", "wrong technical value (maximum)")
req("A16", "Remedy all reported faults within three days; weekends are not excluded.",
    "All reported faults are to be remedied within three days. Weekends shall not be excluded from this arrangement.", 3, "answered",
    [("Faults are remedied within 72 hours of the report, seven days a week, including weekends and bank holidays.", 6)],
    "72 hours equals three days, and weekends are explicitly included.", "equivalent value in different units (false-alarm trap)")
req("A17", "The system must store at least 31 days of recordings.",
    "Ensure the system stores at least 31 days of recordings to be viewed by Officers and the Police.", 3, "conflict",
    [("Recording retention 30 days at full resolution from all cameras", 10),
     ("Recorders are configured to store at least 31 days of continuous recordings from every camera.", 6)],
    "Section 5.1 says at least 31 days but the equipment schedule (Appendix A) specifies 30 days: contradictory, and the specified equipment falls short of the minimum.", "internal contradiction (appendix value)")
req("A18", "Recordings must be available to be viewed by Officers and the Police.",
    "Ensure the system stores at least 31 days of recordings to be viewed by Officers and the Police.", 3, "answered",
    [("Nominated Council Officers will view live and recorded footage through a secure viewing client at the Town Hall, and Hampshire Constabulary will be given an evidence export account", 6)],
    "Viewing for Officers and an export account for the police.", "different wording (Hampshire Constabulary = Police)")
req("A19", "Review the Council's CCTV retention policy to ensure it meets current requirements.",
    "The Contractor should be able to review the CCTV retention policy for the Council to ensure it meets current requirements.", 3, "missing",
    [("CCTV retention policy: to be discussed with the Council at the mobilisation meeting.", 6)],
    "Only a heading and a deferral; no commitment to review the policy. (Partial would be a defensible issue flag.)", "deferral without commitment")
req("A20", "Safety tests on anchor points and catenary wires throughout the contract, carried out to ISO standards.",
    "Testing shall include safety tests on anchor points and viability of any catenary wires which may be installed throughout the duration of the contract. Testing shall be carried out to ISO standards.", 3, "partial",
    [("Anchor points and catenary wires are load tested at installation and at every annual service visit, using our in-house test procedure HVS-TP-07.", 8)],
    "Testing through the contract is committed, but to an in-house procedure; ISO standards are not confirmed.", "standard not confirmed")
req("A21", "Test all electrical components and certify all wiring and connections as safe.",
    "All electrical components shall be tested and all wiring, connections etc should be certified safe.", 3, "answered",
    [("All electrical components, wiring and connections are tested, and we issue an Electrical Installation Certificate to BS 7671 for every circuit we install or modify.", 8)],
    "Testing and certification (BS 7671 Electrical Installation Certificate).", "")
req("A22", "Install and anchor all equipment so it is safe and compliant with Health and Safety regulations.",
    "All equipment will be installed and anchored such that they are safe and compliant with Health and Safety regulations.", 3, "answered",
    [("We install and anchor all equipment to the manufacturer's instructions using load-rated brackets, so that every installation is safe and compliant with Health and Safety regulations.", 7)],
    "Commitment with method (manufacturer's instructions, load-rated brackets).", "close wording (echo trap)")
req("A23", "Adopt safe working practices at all times so workers and the public are fully protected.",
    "The contractor shall ensure safe working practices are adopted at all times and that workers and the public are fully protected.", 3, "answered",
    [("Our site teams work to task-specific Risk Assessments and Method Statements (RAMS), with barriers and traffic management around every work area, so that our workers and the public are protected at all times.", 7)],
    "RAMS, barriers and traffic management.", "")
req("A24", "Hold public liability insurance to the value of £10m.",
    "The contractor will hold the relevant insurance cover including professional and public liability to the value of £10m.", 3, "answered",
    [("We hold Public Liability insurance of £10,000,000 and Professional Indemnity insurance of £5,000,000.", 9)],
    "Public liability £10,000,000 = £10m.", "equivalent value in different format (false-alarm trap)")
req("A25", "Hold professional liability (indemnity) insurance to the value of £10m.",
    "The contractor will hold the relevant insurance cover including professional and public liability to the value of £10m.", 3, "conflict",
    [("We hold Public Liability insurance of £10,000,000 and Professional Indemnity insurance of £5,000,000.", 9)],
    "Professional indemnity is £5m, half the required £10m.", "wrong commercial value")
req("A26", "Provide all necessary equipment, including cherry pickers and vehicles to transport equipment.",
    "The contractor will provide all necessary equipment including cherry pickers and vehicles to transport equipment.", 3, "answered",
    [("We supply all access equipment, including our own cherry pickers (mobile elevating work platforms), and our own vehicles to transport equipment.", 8)],
    "Own cherry pickers and vehicles.", "")
req("A27", "The fees must cover all works, including dealing with all faults.",
    "The fees shall cover all works including dealing with all faults.", 4, "conflict",
    [("Call-outs to faults caused by vandalism, power failure or third-party damage are charged at £85 per hour plus parts.", 9)],
    "Some faults are charged extra, contradicting fees that cover all faults.", "commercial exclusion")
req("A28", "Complete all due diligence before tendering; the Council will not accept liability for additional payments.",
    "The contractor shall conduct all necessary due diligence in advance of submitting their tender as the Council will not accept liability for additional payments.", 4, "conflict",
    [("Our price assumes that the existing High Street columns are structurally sound. Any remedial work to columns found during installation will be charged as a variation.", 9)],
    "Shifts the risk of column remedial work to the Council as a variation, i.e. an additional payment the tender rules out.", "commercial qualification")
req("A29", "The contractor and all employees must hold the required electrical installation qualifications, including the HERS certificate.",
    "The contractor and all their employees shall hold the required electrical installation qualifications including the HERS certificate.", 4, "partial",
    [("Our lead engineers hold the HERS certificate; copies are provided in Appendix B.", 8),
     ("HERS certificates for our remaining four field engineers will follow on award.", 10)],
    "Only the two lead engineers are shown to hold HERS; certificates for the other four engineers are not provided (incomplete documentation).", "incomplete documentation")
req("A30", "Hold working at height certificates for operating a cherry picker.",
    "The contractor should also hold ‘working at height’ certificates for the operation of a cherry picker.", 4, "answered",
    [("All site operatives hold IPAF PAL cards in categories 3a and 3b for operating cherry pickers and are trained in working at height.", 8)],
    "IPAF PAL 3a/3b is the UK operator licence for mobile elevating work platforms (cherry pickers), plus working-at-height training.", "domain-equivalent certificate (false-alarm trap)")
req("A31", "Cover all six contract locations: four High Street positions, the High Street ANPR camera, Market Square, Public Gardens, Jubilee Playing Fields and Anstey Park.",
    "The locations covered by this contract are:- 1. Four positions in the High Street for CCTV cameras 2. ANPR Camera location in High Street 3. The Market Square 4. The Public Gardens 5. Jubilee Playing Fields 6. Anstey Park", 4, "answered",
    [("Our proposal covers all six locations in the contract: the four High Street camera positions, the High Street ANPR camera, the Market Square, the Public Gardens, Jubilee Playing Fields and Anstey Park.", 2)],
    "All six named.", "")
req("A32", "Comment on potential options for CCTV at Kings Pond car park and Holybourne Play Area, which have no electricity (optional, outside scope).",
    "Neither of these sites have access to electricity. These are outside the scope of the tender, but contractors are invited to comment on potential options in these locations.", 4, "answered",
    [("For Kings Pond car park and Holybourne Play Area, which have no electricity supply, we suggest solar-powered cameras with battery storage and 4G transmission.", 9)],
    "Solar/battery/4G option offered for both sites.", "optional item")
req("A33", "Include a technical specification with details of experience and the proposed approach to the works.",
    "The technical specification (details of experience, proposed approach to the works etc).", 4, "answered",
    [("Our experience, our proposed approach to the works and our technical specification are set out in Sections 2 to 7 of this document.", 2)],
    "The document is the technical specification; Sections 2-7 hold experience and approach.", "")
req("A34", "Provide a separate document confirming the total price for the initial installation and annual maintenance for a three-year period.",
    "A separate document confirming the total price for the initial installation and annual maintenance contract for a three-year period.", 4, "conflict",
    [("It covers the initial installation and annual maintenance for Years 1 and 2. Maintenance for Year 3 will be quoted at the first anniversary of the contract", 9)],
    "A separate price document is given, but it prices only two years of maintenance; Year 3 is deferred, so there is no total for the three-year period.", "wrong commercial scope")
req("A35", "Give names and contact details of two references who received a similar service in the past 12 months.",
    "The names and contact details of two references who have received a similar service in the past 12 months.", 4, "conflict",
    [("Reference 2: Fenbridge Borough Council. Maintenance of 40 public space cameras from April 2021 to March 2024.", 3)],
    "Reference 1 (completed May 2026) qualifies; Reference 2 ended March 2024, more than 12 months before the 10 August 2026 proposal. Only one qualifying reference. (Partial would be a defensible issue flag.)", "date reasoning")
req("A36", "Evidence of the experience, capability and qualifications of key personnel.",
    "Evidence of the experience, capability and qualifications of key personnel", 5, "answered",
    [("Daniel Okafor Project Director 18 years in public space CCTV; BTEC Level 4 in Security Systems", 3)],
    "Key-personnel table with roles, years and qualifications.", "evidence in a table")
req("A37", "State the supply time.",
    "2. Commercial Suitability: 10% a. Supply time b. Compliance to Invitation to Tender requirements", 5, "answered",
    [("Equipment lead time is three weeks from order, and all cameras and recorders are held in stock by our UK distributor.", 7)],
    "Lead time stated (three weeks).", "different wording (lead time = supply time)")
req("A38", "Accept the Council's payment terms: payment on receipt of a satisfactory VAT invoice, in one or more instalments.",
    "Payment for services will be made upon the receipt of a satisfactory VAT invoice and may be made in one or more instalments.", 7, "conflict",
    [("Our offer is conditional on 50% of the installation price being paid with the order, before work starts; the balance is invoiced on handover.", 9)],
    "Makes the offer conditional on a 50% advance payment before work, against payment for services on receipt of a satisfactory invoice.", "commercial condition")

ABSENT = {
  "A02": ["rear of energique", "rear parking", "to the rear"],
  "A03": ["compound"],
  "A07": ["contract period", "vegetation", "tree growth", "cutting back", "pruning"],
  "A10": ["plans", "drawing", "asset register", "records of"],
  "A13": ["signage", "signs"],
  "A20": ["iso"],
}
for r in R:
    if r["id"] in ABSENT: r["absentTerms"] = ABSENT[r["id"]]

key = {
  "benchmark": "alton-cctv-2026",
  "tenderSource": "alton-cctv-2026 (see lib/benchmarks/sources.js; authentic public document, fetched at run time, sha256-pinned)",
  "responseFile": "supplier_proposal.pdf (fictional supplier; generated by make_proposal.py)",
  "proposalDate": "2026-08-10",
  "rubric": {
    "answered": "The response commits to meeting the requirement in full, and nothing elsewhere in the response contradicts it.",
    "partial": "The response addresses the requirement but omits an element, narrows the scope without saying it does not comply, or lacks the required evidence/standard.",
    "conflict": "The response states a value, date, scope or condition that does not meet the requirement, or contradicts itself about it.",
    "missing": "The response does not address the requirement, only restates it, or defers it without a commitment."
  },
  "notes": "Requirements were taken from the tender by hand (one per obligation; compound sentences split where the response treats the parts differently: A14/A15, A17/A18, A24/A25). Partial vs conflict and missing vs partial are reported separately from exact accuracy because some items (A19, A35) are defensible either way.",
  "requirements": R,
}
json.dump(key, open(OUT, "w"), indent=1, ensure_ascii=False)
from collections import Counter
print(len(R), Counter(r["expected"] for r in R))
