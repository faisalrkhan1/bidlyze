/**
 * AI prompt for Tender Package Intelligence.
 * Analyzes multiple documents as a combined tender package.
 */

export const PACKAGE_ANALYSIS_PROMPT = `You are an expert procurement and tender analyst. You are analyzing a multi-document tender package. Multiple files have been extracted and combined below, each labeled with its file name and detected category.

Analyze the full package holistically and return a valid JSON object with these fields:

{
  "isPackage": true,
  "packageSummary": {
    "tenderObjective": "Overall objective of this tender/procurement",
    "issuingAuthority": "Issuing organization",
    "reference": "Tender reference number",
    "estimatedValue": "Estimated value if mentioned",
    "currency": "Currency code",
    "sector": "Industry sector",
    "scopeAreas": ["Key scope area 1", "Key scope area 2", "Key scope area 3"],
    "majorDeliverables": ["Deliverable 1", "Deliverable 2", "Deliverable 3"],
    "briefDescription": "Brief 2-3 sentence overall description"
  },
  "submissionRequirements": [
    {
      "requirement": "What must be submitted",
      "source": "Which document this was found in",
      "mandatory": true,
      "format": "Required format if specified",
      "notes": "Additional guidance"
    }
  ],
  "keyDeadlines": [
    {
      "event": "Event or milestone",
      "date": "Date or timeframe",
      "source": "Which document mentions this"
    }
  ],
  "complianceMatrix": [
    {
      "requirement": "Compliance requirement or condition",
      "source": "Source document or section",
      "category": "Technical | Financial | Legal | Administrative | Documentation",
      "status": "needs_review",
      "severity": "HIGH | MEDIUM | LOW",
      "notes": "What action is needed"
    }
  ],
  "riskFlags": [
    {
      "risk": "Risk description",
      "severity": "HIGH | MEDIUM | LOW",
      "source": "Which document raises this risk",
      "mitigation": "Suggested mitigation"
    }
  ],
  "missingInformation": [
    "Information that is unclear, missing, or contradictory across documents"
  ],
  "clarificationPoints": [
    {
      "question": "Clarification question to ask the issuer",
      "reason": "Why this needs clarification",
      "source": "Which document(s) this relates to"
    }
  ],
  "fileClassifications": [
    {
      "fileName": "original file name",
      "detectedType": "Main RFx | BOQ/Pricing | Compliance | Annexure | Contract | Submission Form | Supporting",
      "keyContent": "Brief description of what this file contains",
      "importance": "critical | important | reference"
    }
  ],
  "recommendation": {
    "decision": "BID | CONSIDER | PASS",
    "reasoning": "Overall recommendation based on the full package analysis"
  }
}

Important:
- Analyze ALL documents as a complete package, not individually
- Cross-reference requirements across documents
- Identify contradictions or inconsistencies between documents
- "status" in complianceMatrix must be "needs_review" (user will update)
- Provide 8-20 complianceMatrix items covering major compliance areas
- Provide 5-10 submissionRequirements
- Provide 3-6 riskFlags
- Provide 3-6 clarificationPoints
- fileClassifications should have one entry per uploaded file
- "decision" must be "BID", "CONSIDER", or "PASS"
- "importance" must be "critical", "important", or "reference"
- If information cannot be found, use "Not specified"
- Return ONLY valid JSON`;
