import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeTender, analyzeTenderFromPDF } from "@/lib/gemini";
import {
  sendEmail,
  buildAnalysisSummaryEmail,
  buildUsageWarningEmail,
} from "@/lib/email";

export const maxDuration = 300;

const BUCKET = "tender-uploads";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TEXT_CHARS = 400_000;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const ALLOWED_RFX_TYPES = new Set(["rfp", "rfq", "rfi", "other"]);

function err(status, message) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request) {
  const t0 = Date.now();
  const log = (stage) => console.log(`[analyze] ${stage} — ${Date.now() - t0}ms`);

  try {
    log("request received");

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

    // ── Parse + validate JSON body ──
    let body;
    try {
      body = await request.json();
    } catch {
      return err(400, "Invalid JSON body");
    }

    const storagePath = body?.storagePath;
    const filename = body?.filename;
    const rawContentType = body?.contentType;
    const rfxType = body?.rfxType || "rfp";

    if (typeof storagePath !== "string" || !storagePath.startsWith(`${user.id}/`) || storagePath.includes("..")) {
      return err(400, "Invalid storagePath");
    }
    if (typeof filename !== "string" || filename.length === 0) {
      return err(400, "filename is required");
    }
    const contentType =
      typeof rawContentType === "string"
        ? rawContentType.split(";")[0].trim().toLowerCase()
        : "";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return err(400, "Unsupported content type. Allowed: PDF, DOCX, TXT.");
    }
    if (!ALLOWED_RFX_TYPES.has(rfxType)) {
      return err(400, "Invalid rfxType");
    }

    // ── Plan-limit check (authoritative) ──
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan, analyses_limit, status")
      .eq("user_id", user.id)
      .single();

    const planName = subscription?.plan || "free";
    const isActiveSub = subscription?.status === "active";
    const analysesLimit = isActiveSub && subscription?.analyses_limit ? subscription.analyses_limit : 3;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth);

    if ((count ?? 0) >= analysesLimit) {
      const msg =
        planName === "free"
          ? "You've reached your free limit of 3 analyses this month. Upgrade to continue."
          : `You've reached your ${planName} plan limit of ${analysesLimit} analyses this month. Upgrade for more.`;
      return err(403, msg);
    }

    log("auth + usage check done");

    // ── Download file from storage via service-role client ──
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[analyze] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return err(500, "Failed to retrieve uploaded file");
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey
    );

    const { data: blob, error: dlError } = await adminClient.storage
      .from(BUCKET)
      .download(storagePath);

    if (dlError || !blob) {
      console.error("[analyze] storage download failed:", dlError);
      return err(500, "Failed to retrieve uploaded file");
    }

    const fileBuffer = Buffer.from(await blob.arrayBuffer());
    const fileSize = fileBuffer.length;

    log(`file downloaded from storage: ${filename} (${fileSize} bytes)`);

    if (fileSize > MAX_FILE_SIZE) {
      return err(400, "File too large (over 50MB)");
    }

    // ── Parse + analyze based on content type ──
    let result;
    if (contentType === "application/pdf") {
      const base64PDF = fileBuffer.toString("base64");
      result = await analyzeTenderFromPDF(base64PDF, rfxType);
    } else if (
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const extracted = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = extracted.value;
      if (!text || text.trim().length === 0) {
        return err(
          400,
          "Could not extract text from the uploaded file. The file may be empty or corrupted."
        );
      }
      result = await analyzeTender(text.substring(0, MAX_TEXT_CHARS), rfxType);
    } else {
      // text/plain
      const text = fileBuffer.toString("utf-8");
      if (!text || text.trim().length === 0) {
        return err(
          400,
          "Could not extract text from the uploaded file. The file may be empty or corrupted."
        );
      }
      result = await analyzeTender(text.substring(0, MAX_TEXT_CHARS), rfxType);
    }

    log("AI analysis complete");

    if (!result.success) {
      return err(500, result.error);
    }

    // ── Insert analyses row (file already in storage at storagePath) ──
    const { data: insertedRow } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        file_name: filename,
        file_path: storagePath,
        project_name: result.data?.summary?.projectName || "Unknown",
        bid_score:
          result.data?.bidScore?.score ??
          result.data?.qualificationSummary?.fitScore ??
          null,
        analysis_data: result.data,
      })
      .select("id")
      .single();

    const analysisId = insertedRow?.id ?? null;

    // ── Email notifications (fire-and-forget) ──
    const newUsageCount = (count ?? 0) + 1;

    const summaryEmail = buildAnalysisSummaryEmail({
      projectName: result.data?.summary?.projectName || "Unknown",
      bidScore: result.data?.bidScore?.score ?? 0,
      recommendation: result.data?.bidScore?.recommendation || "N/A",
      summary: result.data?.summary?.briefDescription || "Analysis complete.",
      analysisId,
    });
    sendEmail({ to: user.email, subject: summaryEmail.subject, html: summaryEmail.html }).catch(
      (e) => console.error("Failed to send analysis email:", e)
    );

    if (newUsageCount === analysesLimit - 1) {
      const warningEmail = buildUsageWarningEmail({
        usageCount: newUsageCount,
        limit: analysesLimit,
      });
      sendEmail({ to: user.email, subject: warningEmail.subject, html: warningEmail.html }).catch(
        (e) => console.error("Failed to send usage warning email:", e)
      );
    }

    log("DB insert + emails done, responding");

    return NextResponse.json({
      success: true,
      fileName: filename,
      fileSize,
      analysis: result.data,
      analysisId,
    });
  } catch (error) {
    console.error("Analysis API error:", error);
    return err(500, "An unexpected error occurred while processing your file. Please try again.");
  }
}
