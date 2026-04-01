/**
 * AI integration via OpenRouter (GPT-5.4).
 *
 * File kept as lib/gemini.js to preserve import paths across all API routes.
 * All Gemini SDK code has been replaced with OpenRouter chat completions.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-5.4";

async function callOpenRouter(messages, { jsonMode = false, maxTokens = 65536 } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const body = {
    model: MODEL,
    messages,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://bidlyze.com",
      "X-Title": "Bidlyze",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("OpenRouter API error:", res.status, errBody);
    throw new Error(`AI service returned ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI service returned an empty response");
  }

  return content;
}

function parseJSONResponse(text) {
  text = text.trim();
  // Remove markdown code fences if present
  text = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "");
  text = text.replace(/^```\s*/i, "").replace(/\s*```\s*$/i, "");
  // Extract only the JSON object between first { and last }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No valid JSON object found in AI response");
  }
  text = text.substring(firstBrace, lastBrace + 1);
  return JSON.parse(text);
}

// ─── Prompts ────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are an expert government tender/procurement analyst. Analyze the following tender document and extract structured information.

Return your response as a valid JSON object with exactly these fields:

{
  "summary": {
    "projectName": "Name of the project or tender",
    "issuingAuthority": "Organization issuing the tender",
    "tenderReference": "Reference/ID number of the tender",
    "estimatedValue": "Estimated contract value (number or string)",
    "currency": "Currency code (e.g. USD, EUR, ZAR)",
    "submissionDeadline": "Submission deadline date",
    "projectDuration": "Duration of the project",
    "location": "Project location",
    "sector": "Industry sector",
    "briefDescription": "Brief 2-3 sentence description of the tender"
  },
  "requirements": [
    {
      "category": "Category of requirement (e.g. Technical, Financial, Legal)",
      "requirement": "Description of the requirement",
      "mandatory": true,
      "priority": "HIGH | MEDIUM | LOW"
    }
  ],
  "complianceAnalysis": {
    "overallComplianceScore": 75,
    "summary": {
      "totalItems": 20,
      "compliant": 14,
      "gaps": 4,
      "critical": 2
    },
    "items": [
      {
        "item": "Compliance item description",
        "category": "Category (e.g. Documentation, Legal, Financial, Technical)",
        "status": "compliant",
        "severity": "HIGH | MEDIUM | LOW",
        "commonIssue": "Why this is commonly missed or a concern",
        "remediation": "Steps to achieve or maintain compliance",
        "timeToRemediate": "Estimated time to fix (e.g. 2-3 days, 1 week)",
        "costEstimate": "Low | Medium | High"
      }
    ],
    "missingDocuments": ["Required document not yet prepared 1", "Required document 2"],
    "certificationGaps": ["Required certification or accreditation not held 1", "Certification 2"],
    "actionPlan": [
      {
        "priority": 1,
        "action": "Action description to close compliance gap",
        "deadline": "Recommended deadline relative to submission date",
        "owner": "Suggested responsible party (e.g. Legal, Finance, Technical Lead)"
      }
    ]
  },
  "riskRadar": {
    "overallRiskLevel": "medium",
    "riskScore": 45,
    "categories": [
      {
        "category": "timeline",
        "riskLevel": "medium",
        "score": 50,
        "risks": [
          {
            "risk": "Description of the specific risk",
            "severity": "critical | high | medium | low",
            "likelihood": "certain | likely | possible | unlikely",
            "impact": "What happens if this risk materializes",
            "mitigation": "Specific action to mitigate this risk",
            "owner": "Who should handle this (e.g. Legal Team, Project Manager, Finance)"
          }
        ]
      }
    ],
    "showstoppers": ["Risk that could make this tender not worth bidding 1"],
    "topActions": [
      {
        "action": "Specific action to take",
        "priority": "immediate | before_submission | post_award",
        "responsible": "Who should do this"
      }
    ]
  },
  "keyDates": [
    {
      "event": "Name of the event/milestone",
      "date": "Date or timeframe"
    }
  ],
  "evaluationCriteria": [
    {
      "criterion": "Name of the evaluation criterion",
      "weight": "Weight or percentage",
      "details": "Details about what is evaluated"
    }
  ],
  "financialRequirements": {
    "bidBond": "Bid bond/guarantee requirement",
    "performanceBond": "Performance bond/guarantee requirement",
    "minimumTurnover": "Minimum annual turnover requirement",
    "otherFinancial": "Any other financial requirements"
  },
  "bidScore": {
    "score": 75,
    "recommendation": "BID",
    "reasoning": "Detailed reasoning for the bid/no-bid recommendation"
  },
  "winProbability": {
    "overall": 65,
    "factors": [
      {
        "factor": "Factor name (e.g. Technical Capability Match, Timeline Feasibility, Financial Capacity, Compliance Burden, Market Competition, Specialized Requirements)",
        "score": 70,
        "reasoning": "Brief explanation of score",
        "impact": "high"
      }
    ],
    "strengths": ["Top strength 1", "Top strength 2", "Top strength 3"],
    "weaknesses": ["Potential weakness 1", "Potential weakness 2", "Potential weakness 3"],
    "strategyRecommendation": "2-3 sentences on recommended bid strategy based on the analysis",
    "competitivePosition": "strong"
  },
  "competitorIntelligence": {
    "estimatedCompetitors": [
      {
        "name": "Likely competitor company name or type (e.g. 'Large Regional IT Integrator', 'Global Consulting Firm')",
        "type": "multinational",
        "strengths": ["Key strength 1", "Key strength 2"],
        "weaknesses": ["Weakness 1"],
        "threatLevel": "high",
        "estimatedApproach": "How they would likely approach this bid"
      }
    ],
    "marketDynamics": "Overview of the competitive landscape for this specific tender",
    "differentiationStrategy": "2-3 sentences on how to differentiate from competitors",
    "pricingPosition": {
      "aggressive": "Description of aggressive pricing approach and implications",
      "balanced": "Description of balanced pricing approach and implications",
      "premium": "Description of premium pricing approach and implications",
      "recommended": "balanced",
      "reasoning": "Why this pricing position is recommended for this tender"
    }
  },
  "pricingAdvisor": {
    "canEstimate": true,
    "currency": "USD",
    "strategies": [
      {
        "approach": "aggressive",
        "label": "Win on Price",
        "estimatedRange": { "low": 100000, "high": 150000 },
        "winProbability": 70,
        "margin": "low",
        "risk": "high",
        "notes": "When to use this aggressive pricing strategy"
      },
      {
        "approach": "balanced",
        "label": "Competitive Value",
        "estimatedRange": { "low": 150000, "high": 220000 },
        "winProbability": 55,
        "margin": "medium",
        "risk": "medium",
        "notes": "When to use this balanced pricing strategy"
      },
      {
        "approach": "premium",
        "label": "Quality Leader",
        "estimatedRange": { "low": 220000, "high": 300000 },
        "winProbability": 35,
        "margin": "high",
        "risk": "low",
        "notes": "When to use this premium pricing strategy"
      }
    ],
    "recommended": "balanced",
    "reasoning": "Detailed explanation of why this pricing strategy is recommended for this specific tender",
    "costDrivers": ["Main cost component 1", "Main cost component 2", "Main cost component 3"],
    "pricingRisks": ["Pricing risk 1 (e.g. scope creep)", "Pricing risk 2 (e.g. penalty clauses)"],
    "financialTips": "Specific financial tips based on the tender's requirements, payment terms, and financial structure"
  }
}

Important instructions:
- The "score" and "overall" must be numbers between 0 and 100
- The "recommendation" must be either "BID" or "NO-BID"
- The "impact" must be "high", "medium", or "low"
- The "competitivePosition" must be "strong", "moderate", or "challenging"
- The "threatLevel" must be "high", "medium", or "low"
- The competitor "type" must be "multinational", "regional", "local", or "specialist"
- The "pricingPosition.recommended" must be "aggressive", "balanced", or "premium"
- For competitorIntelligence, infer likely competitors based on: tender sector and technology requirements, geographic location (e.g. GCC, MENA, Africa, Europe), project size and complexity, specialized requirements, and known major players in that sector. Provide 3-5 estimated competitors.
- For winProbability factors, analyze: technical requirements complexity vs typical vendor capabilities, evaluation criteria weighting (technical vs commercial), timeline feasibility, financial requirements (bond/turnover), compliance burden, market competition level (based on sector/location), and specialized requirements that limit competition
- Provide exactly 3 strengths and 3 weaknesses
- The factors array should have 5-7 items covering distinct assessment areas
- Each competitor should have 2-3 strengths and 1-2 weaknesses
- The "overallComplianceScore" must be a number between 0 and 100
- The compliance item "status" must be "compliant", "gap", or "at-risk"
- The compliance item "costEstimate" must be "Low", "Medium", or "High"
- For complianceAnalysis, thoroughly assess every compliance requirement in the tender: documentation submissions, legal prerequisites, financial qualifications, technical certifications, registration requirements, insurance policies, and format/submission rules. Provide 8-15 items covering all major compliance areas.
- The actionPlan should have 3-6 prioritized actions ordered by urgency
- missingDocuments should list 2-5 documents commonly required but often missing
- certificationGaps should list relevant certifications/accreditations that may be needed
- For riskRadar: the "overallRiskLevel" must be "low", "medium", "high", or "critical"
- The "riskScore" must be a number between 0 and 100 (higher = more risky)
- Each category "category" must be one of: "timeline", "financial", "technical", "legal", "compliance", "operational", "reputational"
- Each category "riskLevel" must be "low", "medium", "high", or "critical"
- Each risk "severity" must be "critical", "high", "medium", or "low"
- Each risk "likelihood" must be "certain", "likely", "possible", or "unlikely"
- Provide 4-7 risk categories, each with 1-4 risks. Cover at minimum: timeline, financial, technical, and compliance categories.
- "showstoppers" should list 0-3 risks that could make the tender not worth bidding. If none, use an empty array.
- "topActions" should have 3-6 prioritized actions. The "priority" must be "immediate", "before_submission", or "post_award".
- For pricingAdvisor: set "canEstimate" to true only if the tender contains enough financial information (estimated value, budget range, scope details) to derive meaningful price ranges. If insufficient, set to false and still provide costDrivers, pricingRisks, and financialTips with general guidance.
- The pricingAdvisor "recommended" must be "aggressive", "balanced", or "premium"
- Each strategy "margin" must be "low", "medium", or "high"
- Each strategy "risk" must be "low", "medium", or "high"
- Each strategy "winProbability" must be a number between 0 and 100
- The "estimatedRange" low and high must be numbers (not strings). Base them on the tender's estimated value, scope, and market rates for the sector/location.
- Provide 3-5 costDrivers and 2-4 pricingRisks
- The "currency" should match the tender's currency or default to "USD"
- All arrays should have at least one item if relevant information exists
- If information is not found in the document, use "Not specified" for strings
- Return ONLY valid JSON, no markdown formatting or extra text`;

const PROPOSAL_PROMPTS = {
  executive_summary: `You are an expert proposal writer for government tenders and procurement. Write a professional Executive Summary section for a bid proposal.

Based on the tender analysis data provided, write a compelling executive summary that:
- Opens with a strong understanding of the client's needs and project objectives
- Highlights [COMPANY NAME]'s relevant experience and qualifications
- Summarizes the proposed approach and key differentiators
- References specific tender requirements and evaluation criteria
- Includes value proposition aligned with the tender's priorities
- Ends with a confident closing statement

Format the output as well-structured markdown with:
- A clear heading structure
- Bullet points for key highlights
- Bold text for emphasis on critical points
- Placeholders like [COMPANY NAME], [YEARS OF EXPERIENCE], [KEY PROJECT REFERENCE] for the user to fill in

Write in professional third-person proposal language. Be specific to this tender — reference actual requirements, deadlines, and criteria from the analysis. Do NOT write generic content.`,

  technical_response: `You are an expert proposal writer for government tenders and procurement. Write a professional Technical Response section for a bid proposal.

Based on the tender analysis data provided, write a comprehensive technical response that:
- Addresses each technical requirement identified in the analysis
- Proposes specific technical solutions and technologies
- Describes the implementation approach with clear phases
- Maps solutions to the evaluation criteria and their weights
- Addresses any technical risks identified in the risk analysis
- Includes relevant standards and certifications

Format the output as well-structured markdown with:
- Clear sections for each major technical area
- Numbered lists for implementation steps
- Tables where appropriate (using markdown table syntax)
- Placeholders like [COMPANY NAME], [TECHNICAL LEAD NAME], [PROPRIETARY TOOL NAME] for the user to fill in

Write in professional third-person proposal language. Reference specific technical requirements from this tender. Do NOT write generic content.`,

  compliance_matrix: `You are an expert proposal writer for government tenders and procurement. Generate a full Compliance Matrix table for a bid proposal.

Based on the tender analysis data provided (especially the compliance analysis, requirements, and financial requirements), create a comprehensive compliance matrix that:
- Lists every requirement from the tender
- Maps each to a compliance status (Compliant / Partially Compliant / Will Comply)
- Provides a brief response or reference for each item
- Groups requirements by category (Technical, Financial, Legal, Administrative)
- Highlights where [COMPANY NAME] exceeds requirements
- Notes any deviations with explanations

Format as a markdown table with columns:
| # | Requirement | Category | Compliance Status | Response/Reference |

Include all items from the requirements list, compliance analysis items, financial requirements, and any document submission requirements. Be thorough — this is a critical evaluation document.

Use placeholders like [COMPANY NAME], [DOCUMENT REFERENCE], [CERTIFICATE NUMBER] where appropriate.`,

  methodology: `You are an expert proposal writer for government tenders and procurement. Write a professional Project Methodology section for a bid proposal.

Based on the tender analysis data provided, write a detailed methodology that:
- Describes the overall project management approach (e.g., Agile, Waterfall, Hybrid)
- Outlines clear project phases with milestones aligned to the tender timeline
- Details deliverables for each phase
- Describes quality assurance and quality control processes
- Addresses handover and knowledge transfer
- Includes monitoring, reporting, and communication frameworks
- Addresses specific risks and their mitigation strategies

Format the output as well-structured markdown with:
- Phase-by-phase breakdown with timelines
- Milestone tables (using markdown table syntax)
- Process flow descriptions
- Placeholders like [COMPANY NAME], [PROJECT MANAGER NAME], [PROJECT TIMELINE], [REPORTING FREQUENCY] for the user to fill in

Write in professional third-person proposal language. Align timelines with the tender's key dates and project duration. Do NOT write generic content.`,

  team_structure: `You are an expert proposal writer for government tenders and procurement. Write a professional Team Structure section for a bid proposal.

Based on the tender analysis data provided, recommend and describe a team structure that:
- Proposes key roles needed based on the tender's technical and scope requirements
- Defines responsibilities for each role
- Suggests minimum qualifications aligned with tender requirements
- Includes an organizational chart description
- Addresses any specific personnel requirements from the tender
- Describes the escalation and decision-making hierarchy
- Includes local presence or localization requirements if applicable

Format the output as well-structured markdown with:
- Role cards with title, responsibilities, and qualifications
- A team hierarchy description
- A staffing plan table (Role | Count | Level | Location)
- Placeholders like [TEAM LEAD NAME], [COMPANY NAME], [YEARS EXPERIENCE] for the user to fill in

Write in professional third-person proposal language. Base the team on the actual scope and requirements of this specific tender.`,

  risk_mitigation: `You are an expert proposal writer for government tenders and procurement. Write a professional Risk Mitigation Strategy section for a bid proposal.

Based on the tender analysis data provided (especially the risk flags, compliance gaps, and competitive analysis), write a comprehensive risk mitigation strategy that:
- Addresses each risk identified in the tender analysis
- Provides specific mitigation actions with owners and timelines
- Includes a risk register table format
- Describes contingency plans for high-severity risks
- Addresses compliance risks and how they will be managed
- Covers operational, technical, financial, and schedule risks
- Includes monitoring and early warning indicators

Format the output as well-structured markdown with:
- Risk register table (Risk | Severity | Likelihood | Impact | Mitigation | Owner)
- Detailed mitigation strategies for critical risks
- Contingency plan descriptions
- Placeholders like [COMPANY NAME], [RISK MANAGER NAME], [ESCALATION CONTACT] for the user to fill in

Write in professional third-person proposal language. Reference actual risks from this tender analysis. Do NOT write generic content.`,
};

const COMPARISON_PROMPT = `You are an expert government tender/procurement analyst specializing in amendment analysis. Compare the two tender document versions below and identify all changes, additions, and removals.

Return your response as a valid JSON object with exactly these fields:

{
  "summary": {
    "totalChanges": 12,
    "critical": 2,
    "major": 4,
    "minor": 6,
    "overallImpact": "significant",
    "recommendation": "2-3 sentence AI recommendation on how these amendments affect the bid strategy"
  },
  "changes": [
    {
      "id": 1,
      "category": "scope",
      "severity": "critical",
      "title": "Short title describing the change",
      "description": "Detailed description of what changed",
      "originalText": "Relevant text from the original version (quote or summarize)",
      "amendedText": "Relevant text from the amended version (quote or summarize)",
      "impact": "How this change affects the bid or proposal",
      "actionRequired": "Specific action the bidder should take"
    }
  ],
  "financialImpact": {
    "hasFinancialChanges": true,
    "estimatedValueChange": "Description of how the contract value changed",
    "budgetImplications": ["Budget implication 1", "Budget implication 2"],
    "pricingAdjustment": "Recommendation on how to adjust pricing strategy"
  },
  "deadlineChanges": {
    "hasDeadlineChanges": true,
    "changes": [
      {
        "event": "Submission Deadline",
        "originalDate": "Original date or timeframe",
        "newDate": "New date or timeframe",
        "impact": "How this affects preparation"
      }
    ]
  },
  "complianceChanges": {
    "newRequirements": ["New requirement added 1", "New requirement added 2"],
    "removedRequirements": ["Requirement that was removed 1"],
    "modifiedRequirements": ["Requirement that was changed 1"]
  },
  "riskAssessment": {
    "newRisks": ["New risk introduced by amendments 1"],
    "mitigatedRisks": ["Risk that was reduced by amendments 1"],
    "overallRiskChange": "increased"
  }
}

Important instructions:
- The "severity" must be "critical", "major", or "minor"
- The "category" must be one of: "scope", "financial", "timeline", "technical", "legal", "compliance", "evaluation", "administrative"
- The "overallImpact" must be "minimal", "moderate", "significant", or "transformative"
- The "overallRiskChange" must be "increased", "decreased", or "unchanged"
- Provide ALL changes you can identify, no matter how small
- For each change, always provide both originalText and amendedText when possible
- If a section is entirely new (not in original), set originalText to "Not present in original version"
- If a section was removed, set amendedText to "Removed in amended version"
- Order changes by severity (critical first, then major, then minor)
- The id field should be sequential starting from 1
- Return ONLY valid JSON, no markdown formatting or extra text`;

// ─── Exported Functions ─────────────────────────────────────────────────────

export async function analyzeTender(documentText) {
  try {
    const content = await callOpenRouter(
      [
        { role: "system", content: "You are an expert government tender/procurement analyst. Return ONLY valid JSON." },
        { role: "user", content: `${ANALYSIS_PROMPT}\n\nTENDER DOCUMENT:\n${documentText}` },
      ],
      { jsonMode: true }
    );
    const analysis = parseJSONResponse(content);
    return { success: true, data: analysis };
  } catch (error) {
    console.error("AI analysis error:", error);
    return {
      success: false,
      error: "Failed to analyze tender document. Please try again.",
    };
  }
}

export async function analyzeTenderFromPDF(base64PDF) {
  // OpenRouter does not accept raw PDF bytes. Extract text first using pdf-parse v2.
  let parser;
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = Buffer.from(base64PDF, "base64");

    parser = new PDFParse({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    const text = result?.text;

    if (!text || text.trim().length < 20) {
      return {
        success: false,
        error: "This PDF appears to be scanned or image-based and could not be read as text. Please upload a text-based PDF, DOCX, or TXT file instead.",
      };
    }

    return analyzeTender(text.substring(0, 500000));
  } catch (error) {
    console.error("PDF extraction error:", error);
    return {
      success: false,
      error: "Failed to read PDF content. The file may be corrupted or in an unsupported format.",
    };
  } finally {
    if (parser) {
      try { await parser.destroy(); } catch (_) {}
    }
  }
}

export async function generateProposalSection(analysisData, sectionType) {
  try {
    const sectionPrompt = PROPOSAL_PROMPTS[sectionType];
    if (!sectionPrompt) {
      return { success: false, error: `Unknown section type: ${sectionType}` };
    }

    const content = await callOpenRouter([
      { role: "system", content: "You are an expert bid proposal writer. Write in professional third-person proposal language." },
      { role: "user", content: `${sectionPrompt}\n\nTENDER ANALYSIS DATA:\n${JSON.stringify(analysisData, null, 2)}` },
    ]);

    return { success: true, content };
  } catch (error) {
    console.error("AI proposal generation error:", error);
    return {
      success: false,
      error: "Failed to generate proposal section. Please try again.",
    };
  }
}

export async function compareTenderAmendments(originalText, amendedText) {
  try {
    const content = await callOpenRouter(
      [
        { role: "system", content: "You are an expert tender amendment analyst. Return ONLY valid JSON." },
        {
          role: "user",
          content: `${COMPARISON_PROMPT}\n\nORIGINAL TENDER DOCUMENT:\n${originalText}\n\n---\n\nAMENDED TENDER DOCUMENT:\n${amendedText}`,
        },
      ],
      { jsonMode: true }
    );
    const comparison = parseJSONResponse(content);
    return { success: true, data: comparison };
  } catch (error) {
    console.error("AI comparison error:", error);
    return {
      success: false,
      error: "Failed to compare tender documents. Please try again.",
    };
  }
}

export async function compareTenderPDFs(base64Original, base64Amended) {
  // OpenRouter does not accept raw PDF bytes. Extract text from both PDFs first.
  const parsers = [];
  try {
    const { PDFParse } = await import("pdf-parse");

    async function extractText(base64) {
      const parser = new PDFParse({ data: Buffer.from(base64, "base64") });
      parsers.push(parser);
      await parser.load();
      const result = await parser.getText();
      return result?.text || "";
    }

    const [originalText, amendedText] = await Promise.all([
      extractText(base64Original),
      extractText(base64Amended),
    ]);

    if (!originalText.trim() || !amendedText.trim()) {
      return {
        success: false,
        error: "Could not extract text from one or both PDFs. They may be scanned or image-based.",
      };
    }

    return compareTenderAmendments(
      originalText.substring(0, 250000),
      amendedText.substring(0, 250000)
    );
  } catch (error) {
    console.error("PDF comparison extraction error:", error);
    return {
      success: false,
      error: "Failed to read PDF content for comparison. Please try different files.",
    };
  } finally {
    for (const p of parsers) {
      try { await p.destroy(); } catch (_) {}
    }
  }
}
