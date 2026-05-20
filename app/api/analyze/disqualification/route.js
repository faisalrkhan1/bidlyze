import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractFileText } from "@/lib/extractFileText";
import { FILE_LIMITS, TEXT_LIMITS } from "@/lib/constants";
import { DISQUALIFICATION_CHECKLIST } from "@/lib/disqualificationChecklist";

export const maxDuration = 300;

const BUCKET = "tender-uploads";

// Mirror lib/gemini.js — same model, same headers, same error handling.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-5.4";

function err(status, message) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function callOpenRouter(messages, { jsonMode = false, maxTokens = 8192 } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  const body = { model: MODEL, messages, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: "json_object" };

  const t0 = Date.now();
  console.log(`[disqual-AI] Calling ${MODEL}, maxTokens=${maxTokens}, jsonMode=${jsonMode}`);

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

  console.log(`[disqual-AI] Response status ${res.status} — ${Date.now() - t0}ms`);

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[disqual-AI] Error body:", errBody);
    throw new Error(`AI service returned ${res.status}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI service returned an empty response");
  return content;
}

function safeParseJSON(text) {
  if (!text || typeof text !== "string") return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "");
  cleaned = cleaned.replace(/^```\s*/i, "").replace(/\s*```\s*$/i, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return null;
  cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

const VALID_FIXED_STATUSES = new Set(["required", "not_required", "not_specified"]);
const VALID_SEVERITIES = new Set(["critical", "high", "medium"]);
const VALID_LEVELS = new Set(["low", "medium", "high", "critical"]);

function severityFor(id) {
  const item = DISQUALIFICATION_CHECKLIST.find((c) => c.id === id);
  return item?.severity || "medium";
}

function computeRiskScore(parsed) {
  let score = 0;
  for (const fc of parsed?.fixed_checks || []) {
    if (fc?.status !== "not_specified") continue;
    const sev = severityFor(fc.id);
    if (sev === "critical") score += 15;
    else if (sev === "high") score += 8;
    else if (sev === "medium") score += 3;
  }
  for (const df of parsed?.dynamic_findings || []) {
    const sev = df?.severity;
    if (sev === "critical") score += 12;
    else if (sev === "high") score += 6;
    else if (sev === "medium") score += 2;
  }
  return Math.min(100, score);
}

function levelFor(score) {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

function normalizeFixedChecks(rawList) {
  const byId = new Map();
  for (const raw of rawList || []) {
    if (!raw || typeof raw !== "object" || !raw.id) continue;
    byId.set(raw.id, raw);
  }
  return DISQUALIFICATION_CHECKLIST.map((item) => {
    const raw = byId.get(item.id) || {};
    const status = VALID_FIXED_STATUSES.has(raw.status) ? raw.status : "not_specified";
    return {
      id: item.id,
      label: item.label,
      severity: item.severity,
      status,
      details: typeof raw.details === "string" ? raw.details : "",
      evidence_quote: typeof raw.evidence_quote === "string" ? raw.evidence_quote.slice(0, 200) : "",
      page_reference: raw.page_reference || null,
    };
  });
}

function normalizeDynamicFindings(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((d) => d && typeof d === "object" && d.title)
    .slice(0, 20)
    .map((d) => ({
      title: String(d.title).slice(0, 200),
      severity: VALID_SEVERITIES.has(d.severity) ? d.severity : "medium",
      details: typeof d.details === "string" ? d.details : "",
      evidence_quote: typeof d.evidence_quote === "string" ? d.evidence_quote.slice(0, 200) : "",
      page_reference: d.page_reference || null,
    }));
}

const PROMPT_HEADER = `You are an expert GCC government procurement compliance analyst. Your job is to read the tender document below and identify DISQUALIFICATION RISKS — the specific mandatory requirements that, if missed, would get the bid thrown out at the eligibility stage.

You will perform TWO passes:

PASS 1 — FIXED CHECKLIST. For each of the 15 checklist items below, decide whether the tender REQUIRES it, explicitly DOES NOT REQUIRE it, or is silent on it (not_specified). Quote the supporting clause when present.

PASS 2 — DYNAMIC FINDINGS. List any ADDITIONAL disqualification-grade requirements you find that are not covered by the fixed checklist (e.g. unusual security clearances, specific banking arrangements, country-of-origin restrictions, escrow accounts, niche certifications).

Return ONLY a valid JSON object with this exact shape:

{
  "fixed_checks": [
    {
      "id": "bid_bond",
      "status": "required" | "not_required" | "not_specified",
      "details": "what the tender says about this item",
      "evidence_quote": "short exact quote from the tender (max 200 chars)",
      "page_reference": "page X or section Y, or null"
    }
  ],
  "dynamic_findings": [
    {
      "title": "short title of the additional risk",
      "severity": "critical" | "high" | "medium",
      "details": "what the tender requires and why missing it is a disqualifier",
      "evidence_quote": "short exact quote from the tender",
      "page_reference": "page X or section Y, or null"
    }
  ],
  "summary": "2-3 sentence executive summary of the biggest disqualification risks for this bid",
  "risk_score": 0,
  "risk_level": "low" | "medium" | "high" | "critical"
}

Risk score calculation (compute deterministically, do NOT inflate):
- Each "required" fixed check with clear evidence: 0 risk contribution
- Each "not_specified" critical-severity fixed item: +15
- Each "not_specified" high-severity fixed item: +8
- Each "not_specified" medium-severity fixed item: +3
- Each dynamic finding with severity="critical": +12
- Each dynamic finding with severity="high": +6
- Each dynamic finding with severity="medium": +2
- Cap at 100.
Risk level mapping: 0–25 low, 26–50 medium, 51–75 high, 76–100 critical.

Output rules:
- The "fixed_checks" array MUST contain exactly one entry per checklist id below, in the same order.
- "evidence_quote" must be an exact substring of the tender when status is "required" or "not_required". Use an empty string when status is "not_specified".
- Keep all strings concise. Do not invent requirements that are not in the tender.
- Return ONLY the JSON object — no markdown, no commentary.

FIXED CHECKLIST:
`;

function buildPrompt(tenderText) {
  const checklistBlock = DISQUALIFICATION_CHECKLIST.map(
    (c) => `- ${c.id} (${c.severity}) — ${c.label}: ${c.description}`
  ).join("\n");
  return `${PROMPT_HEADER}${checklistBlock}\n\nTENDER DOCUMENT:\n${tenderText}`;
}

async function extractTenderTextForAnalysis(adminClient, analysisRow) {
  // Prefer the multi-file manifest if available; fall back to the single file.
  const { data: files } = await adminClient
    .from("analysis_files")
    .select("storage_path, file_name, content_type, role, sort_order")
    .eq("analysis_id", analysisRow.id)
    .order("sort_order", { ascending: true });

  const descriptors = (files && files.length > 0)
    ? files.map((f) => ({
        storagePath: f.storage_path,
        filename: f.file_name,
        contentType: f.content_type,
        role: f.role || "primary",
      }))
    : [{
        storagePath: analysisRow.file_path,
        filename: analysisRow.file_name,
        // Content type isn't stored on legacy analyses rows; the filename-inference
        // branch below will pick the correct extractor from the extension.
        contentType: "",
        role: "primary",
      }];

  // Download + extract each file. Combine primary first, supporting after.
  const parts = [];
  for (const fd of descriptors) {
    if (!fd.storagePath) continue;
    const { data: blob, error: dlError } = await adminClient.storage
      .from(BUCKET)
      .download(fd.storagePath);
    if (dlError || !blob) {
      console.warn(`[disqual] download failed for ${fd.filename}:`, dlError?.message);
      continue;
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.length > FILE_LIMITS.MAX_FILE_SIZE) continue;

    // Infer content type from filename when missing/unknown.
    let ct = (fd.contentType || "").toLowerCase();
    if (!ct || ct === "application/octet-stream") {
      const lower = (fd.filename || "").toLowerCase();
      if (lower.endsWith(".pdf")) ct = "application/pdf";
      else if (lower.endsWith(".docx")) ct = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (lower.endsWith(".xlsx")) ct = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else if (lower.endsWith(".txt")) ct = "text/plain";
    }

    let text = "";
    try {
      text = await extractFileText({ buffer, contentType: ct });
    } catch (e) {
      console.warn(`[disqual] extract failed for ${fd.filename}:`, e?.message);
      continue;
    }
    if (text && text.trim().length > 0) {
      parts.push({ role: fd.role, filename: fd.filename, text });
    }
  }

  if (parts.length === 0) return "";

  // Primary first, then supporting docs labeled.
  const primary = parts.find((p) => p.role === "primary") || parts[0];
  const others = parts.filter((p) => p !== primary);
  const blocks = [`=== ${primary.filename} ===\n${primary.text}`];
  for (const o of others) blocks.push(`=== ${o.filename} ===\n${o.text}`);
  return blocks.join("\n\n");
}

export async function POST(request) {
  const t0 = Date.now();
  const log = (stage) => console.log(`[disqual] ${stage} — ${Date.now() - t0}ms`);

  try {
    // ── Authenticate ──
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return err(401, "Unauthorized");
    const token = authHeader.split(" ")[1];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return err(401, "Unauthorized");

    // ── Body ──
    let body;
    try {
      body = await request.json();
    } catch {
      return err(400, "Invalid JSON body");
    }
    const analysisId = body?.analysis_id;
    if (!analysisId || typeof analysisId !== "string") {
      return err(400, "analysis_id is required");
    }

    // ── Verify ownership of the analysis row ──
    const { data: analysisRow, error: rowError } = await supabase
      .from("analyses")
      .select("id, user_id, file_name, file_path")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();
    if (rowError || !analysisRow) return err(404, "Analysis not found");

    log("auth + ownership verified");

    // ── Service-role client for storage download + upsert (matches analyze route) ──
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[disqual] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return err(500, "Service is not configured");
    }
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey
    );

    // ── Pull tender text from storage ──
    const fullText = await extractTenderTextForAnalysis(adminClient, analysisRow);
    if (!fullText || fullText.trim().length === 0) {
      return err(400, "Could not extract text from the tender for risk analysis.");
    }
    // Truncate using the same single-file limit as the main analyze route.
    const tenderText = fullText.substring(0, TEXT_LIMITS.MAX_TEXT_CHARS_SINGLE);
    log(`text ready, len=${tenderText.length}`);

    // ── AI call ──
    let parsed = null;
    let aiError = null;
    try {
      const content = await callOpenRouter(
        [
          { role: "system", content: "You are an expert GCC tender disqualification-risk analyst. Return ONLY valid JSON." },
          { role: "user", content: buildPrompt(tenderText) },
        ],
        { jsonMode: true }
      );
      parsed = safeParseJSON(content);
    } catch (e) {
      console.error("[disqual] AI call failed:", e?.message);
      aiError = e?.message || "AI call failed";
    }

    let fixed_checks;
    let dynamic_findings;
    let summary;
    let risk_score;
    let risk_level;

    if (!parsed) {
      // Fallback record so the user sees an entry instead of perpetual loading.
      fixed_checks = normalizeFixedChecks([]);
      dynamic_findings = [];
      summary = aiError
        ? `Risk analysis could not be completed automatically: ${aiError}. Please re-run the check.`
        : "Risk analysis could not parse the AI response. Please re-run the check.";
      risk_score = 0;
      risk_level = "low";
    } else {
      fixed_checks = normalizeFixedChecks(parsed.fixed_checks);
      dynamic_findings = normalizeDynamicFindings(parsed.dynamic_findings);
      summary = typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "Disqualification risk analysis complete.";
      // Re-compute the risk score deterministically from the normalized data.
      risk_score = computeRiskScore({ fixed_checks, dynamic_findings });
      // Prefer model-provided level only if it's consistent with the score; otherwise derive.
      risk_level = VALID_LEVELS.has(parsed.risk_level) && parsed.risk_level === levelFor(risk_score)
        ? parsed.risk_level
        : levelFor(risk_score);
    }

    log("AI parsed");

    // ── Upsert ──
    const { data: upserted, error: upsertError } = await adminClient
      .from("disqualification_analyses")
      .upsert(
        {
          analysis_id: analysisId,
          user_id: user.id,
          risk_score,
          risk_level,
          fixed_checks,
          dynamic_findings,
          summary,
        },
        { onConflict: "analysis_id" }
      )
      .select("*")
      .single();

    if (upsertError) {
      console.error("[disqual] upsert failed:", upsertError.message);
      return err(500, "Failed to save disqualification analysis");
    }

    log("upsert done");
    return NextResponse.json({ success: true, disqualification: upserted });
  } catch (e) {
    console.error("[disqual] unexpected error:", e);
    return err(500, "Unexpected error during disqualification analysis");
  }
}
