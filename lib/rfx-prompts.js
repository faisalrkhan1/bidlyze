/**
 * RFx-specific analysis prompts and schemas.
 * Each type has its own system prompt and JSON output schema.
 * The RFP schema reuses the existing comprehensive schema.
 * RFI, RFQ, and Other have leaner, tailored schemas.
 */

// ─── RFI Schema ─────────────────────────────────────────────────────────────

export const RFI_PROMPT = `You are an expert procurement analyst specializing in Request for Information (RFI) analysis. Analyze the uploaded RFI document and return structured intelligence.

Return your response as a valid JSON object with exactly these fields:

{
  "rfxType": "rfi",
  "summary": {
    "projectName": "Name of the project or initiative",
    "issuingAuthority": "Organization issuing the RFI",
    "reference": "Reference number",
    "submissionDeadline": "Deadline date",
    "sector": "Industry sector",
    "briefDescription": "Brief 2-3 sentence description"
  },
  "qualificationSummary": {
    "overallFit": "strong | moderate | weak",
    "fitScore": 70,
    "reasoning": "2-3 sentence explanation of qualification fit",
    "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
    "keyGaps": ["Gap 1", "Gap 2"]
  },
  "requestedInformation": [
    {
      "item": "What information is being requested",
      "category": "Technical | Financial | Organizational | Experience | Legal",
      "priority": "HIGH | MEDIUM | LOW",
      "notes": "Guidance on how to respond",
      "sourceRef": "Page, section, or clause reference"
    }
  ],
  "capabilityFit": [
    {
      "requirement": "Capability or qualification mentioned",
      "fitLevel": "strong | partial | gap",
      "notes": "Assessment notes"
    }
  ],
  "missingDetails": [
    "Information that is unclear or missing from the RFI"
  ],
  "clarificationQuestions": [
    {
      "question": "Suggested clarification question to ask the issuer",
      "reason": "Why this question matters",
      "priority": "HIGH | MEDIUM | LOW"
    }
  ],
  "keyDates": [
    { "event": "Event name", "date": "Date or timeframe" }
  ],
  "recommendation": {
    "decision": "RESPOND | CONSIDER | PASS",
    "reasoning": "Detailed reasoning for the recommendation",
    "nextSteps": ["Recommended next step 1", "Recommended next step 2", "Recommended next step 3"]
  }
}

Important:
- "fitScore" must be 0-100
- "overallFit" must be "strong", "moderate", or "weak"
- "decision" must be "RESPOND", "CONSIDER", or "PASS"
- Provide 5-10 requestedInformation items
- Provide 4-8 capabilityFit items
- Provide 3-6 clarificationQuestions
- If information is not found, use "Not specified"
- Return ONLY valid JSON`;

// ─── RFQ Schema ─────────────────────────────────────────────────────────────

export const RFQ_PROMPT = `You are an expert procurement analyst specializing in Request for Quotation (RFQ) analysis. Analyze the uploaded RFQ document and return structured commercial intelligence.

Return your response as a valid JSON object with exactly these fields:

{
  "rfxType": "rfq",
  "summary": {
    "projectName": "Name of the project or procurement",
    "issuingAuthority": "Organization issuing the RFQ",
    "reference": "Reference number",
    "submissionDeadline": "Deadline date",
    "estimatedValue": "Estimated value if mentioned",
    "currency": "Currency code",
    "sector": "Industry sector",
    "briefDescription": "Brief 2-3 sentence description"
  },
  "commercialSummary": {
    "pricingStructure": "Description of how pricing should be structured (lump sum, unit rate, BOQ, etc.)",
    "paymentTerms": "Payment terms mentioned",
    "contractType": "Fixed price | Time & materials | Unit rate | Other",
    "estimatedScope": "Brief scope summary relevant to pricing"
  },
  "lineItems": [
    {
      "item": "Item or service description",
      "category": "Category or section",
      "quantity": "Quantity or scope (if specified)",
      "unit": "Unit of measure (if specified)",
      "notes": "Pricing guidance or constraints",
      "sourceRef": "Page, section, or clause reference"
    }
  ],
  "submissionRequirements": [
    {
      "requirement": "What must be submitted",
      "format": "Required format or structure",
      "mandatory": true
    }
  ],
  "commercialRisks": [
    {
      "risk": "Commercial or pricing risk",
      "severity": "HIGH | MEDIUM | LOW",
      "impact": "Financial impact description",
      "mitigation": "How to mitigate this risk"
    }
  ],
  "assumptions": [
    "Assumption that should be stated in the quotation"
  ],
  "keyDates": [
    { "event": "Event name", "date": "Date or timeframe" }
  ],
  "comparisonLayout": {
    "evaluationMethod": "How quotations will be evaluated (lowest price, best value, weighted, etc.)",
    "evaluationCriteria": [
      { "criterion": "Criterion name", "weight": "Weight or percentage" }
    ],
    "tips": "Strategic advice for competitive positioning"
  },
  "recommendation": {
    "decision": "QUOTE | CONSIDER | PASS",
    "reasoning": "Detailed reasoning",
    "pricingStrategy": "Recommended pricing approach for this specific RFQ"
  }
}

Important:
- "decision" must be "QUOTE", "CONSIDER", or "PASS"
- Provide 3-15 lineItems based on what the document contains
- Provide 3-6 commercialRisks
- Provide 3-6 assumptions
- Provide 3-6 submissionRequirements
- If information is not found, use "Not specified"
- Return ONLY valid JSON`;

// ─── Other Tender Schema ────────────────────────────────────────────────────

export const OTHER_PROMPT = `You are an expert procurement/tender document analyst. Analyze the uploaded document — it may be a tender notice, Expression of Interest, pre-qualification document, or other procurement document. Classify it and return structured intelligence.

Return your response as a valid JSON object with exactly these fields:

{
  "rfxType": "other",
  "summary": {
    "projectName": "Name of the project or initiative",
    "issuingAuthority": "Issuing organization",
    "reference": "Reference number",
    "submissionDeadline": "Deadline date",
    "sector": "Industry sector",
    "briefDescription": "Brief 2-3 sentence description"
  },
  "documentClassification": {
    "type": "Tender Notice | Expression of Interest | Pre-Qualification | Amendment | Addendum | Award Notice | Other",
    "confidence": "HIGH | MEDIUM | LOW",
    "notes": "Explanation of classification"
  },
  "obligations": [
    {
      "obligation": "What is required or expected",
      "category": "Submission | Financial | Legal | Technical | Administrative",
      "mandatory": true,
      "deadline": "When this is due (if specified)"
    }
  ],
  "keyDates": [
    { "event": "Event or milestone", "date": "Date or timeframe" }
  ],
  "requiredAttachments": [
    {
      "document": "Document name or type",
      "description": "What it should contain",
      "mandatory": true
    }
  ],
  "eligibility": {
    "criteria": ["Eligibility criterion 1", "Eligibility criterion 2"],
    "restrictions": ["Any restriction or exclusion mentioned"]
  },
  "recommendedActions": [
    {
      "action": "Recommended next step",
      "priority": "HIGH | MEDIUM | LOW",
      "deadline": "When to complete (if relevant)",
      "owner": "Suggested responsible party"
    }
  ],
  "recommendation": {
    "decision": "PURSUE | REVIEW | PASS",
    "reasoning": "Detailed reasoning for the recommendation"
  }
}

Important:
- "decision" must be "PURSUE", "REVIEW", or "PASS"
- Provide 4-10 obligations
- Provide 3-6 recommendedActions
- Provide 2-5 requiredAttachments
- If information is not found, use "Not specified"
- Return ONLY valid JSON`;

// ─── System Prompts per Type ────────────────────────────────────────────────

export const RFX_SYSTEM_PROMPTS = {
  rfp: "You are an expert government tender/procurement analyst specializing in RFP analysis. Return ONLY valid JSON.",
  rfq: "You are an expert procurement analyst specializing in RFQ and commercial quotation analysis. Return ONLY valid JSON.",
  rfi: "You are an expert procurement analyst specializing in RFI and capability assessment. Return ONLY valid JSON.",
  other: "You are an expert procurement/tender document analyst. Classify and analyze the document. Return ONLY valid JSON.",
};

/**
 * Get the appropriate analysis prompt for the given RFx type.
 * RFP uses the existing comprehensive ANALYSIS_PROMPT (passed separately).
 * Other types use their specialized prompts from this file.
 */
export function getRfxPrompt(rfxType) {
  switch (rfxType) {
    case "rfi": return RFI_PROMPT;
    case "rfq": return RFQ_PROMPT;
    case "other": return OTHER_PROMPT;
    default: return null; // RFP uses existing prompt
  }
}
