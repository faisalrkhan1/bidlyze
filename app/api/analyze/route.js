import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeTender, analyzeTenderFromPDF, analyzeTenderPackage } from "@/lib/gemini";
import { extractFileText } from "@/lib/extractFileText";
import {
  sendEmail,
  buildAnalysisSummaryEmail,
  buildUsageWarningEmail,
} from "@/lib/email";
import { FILE_LIMITS, TEXT_LIMITS, TENDER_FILE_ROLES } from "@/lib/constants";

export const maxDuration = 300;

const BUCKET = "tender-uploads";
const MAX_FILE_SIZE = FILE_LIMITS.MAX_FILE_SIZE;
const MAX_TEXT_CHARS = TEXT_LIMITS.MAX_TEXT_CHARS_SINGLE;

const ALLOWED_CONTENT_TYPES = new Set(FILE_LIMITS.ALLOWED_CONTENT_TYPES);
const ALLOWED_RFX_TYPES = new Set(["rfp", "rfq", "rfi", "other"]);
const VALID_ROLES = new Set(TENDER_FILE_ROLES);

function err(status, message) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function normalizeContentType(raw) {
  return typeof raw === "string" ? raw.split(";")[0].trim().toLowerCase() : "";
}

function validateFileDescriptor(entry, idx, userId) {
  const storagePath = entry?.storagePath;
  const filename = entry?.filename;
  const contentType = normalizeContentType(entry?.contentType);
  const role = entry?.role || "primary";

  if (typeof storagePath !== "string" || !storagePath.startsWith(`${userId}/`) || storagePath.includes("..")) {
    return `File ${idx + 1}: Invalid storagePath`;
  }
  if (typeof filename !== "string" || filename.length === 0) {
    return `File ${idx + 1}: filename is required`;
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return `File ${idx + 1}: Unsupported content type. Allowed: PDF, DOCX, TXT, XLSX.`;
  }
  if (!VALID_ROLES.has(role)) {
    return `File ${idx + 1}: Invalid role "${role}"`;
  }
  return { storagePath, filename, contentType, role };
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

    const rfxType = body?.rfxType || "rfp";
    if (!ALLOWED_RFX_TYPES.has(rfxType)) {
      return err(400, "Invalid rfxType");
    }

    // Detect mode — legacy single-file or new batch.
    const isBatch = Array.isArray(body?.files);
    const rawEntries = isBatch
      ? body.files
      : [{
          storagePath: body?.storagePath,
          filename: body?.filename,
          contentType: body?.contentType,
          role: "primary",
        }];

    if (rawEntries.length < 1) {
      return err(400, "At least one file is required.");
    }
    if (rawEntries.length > FILE_LIMITS.MAX_FILES_PER_PACKAGE) {
      return err(400, `A tender package can contain at most ${FILE_LIMITS.MAX_FILES_PER_PACKAGE} files.`);
    }

    // Per-file validation
    const fileDescriptors = [];
    for (let i = 0; i < rawEntries.length; i++) {
      const result = validateFileDescriptor(rawEntries[i], i, user.id);
      if (typeof result === "string") {
        return err(400, result);
      }
      fileDescriptors.push(result);
    }

    // Exactly one primary
    const primaryCount = fileDescriptors.filter((f) => f.role === "primary").length;
    if (primaryCount !== 1) {
      return err(400, "Exactly one file must be designated as the primary RFP.");
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

    // ── Service-role client for storage + downstream inserts ──
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[analyze] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return err(500, "Failed to retrieve uploaded file");
    }
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey
    );

    // ── Download + extract each file ──
    const downloaded = [];
    let totalSize = 0;
    for (let i = 0; i < fileDescriptors.length; i++) {
      const fd = fileDescriptors[i];
      const { data: blob, error: dlError } = await adminClient.storage
        .from(BUCKET)
        .download(fd.storagePath);
      if (dlError || !blob) {
        console.error(`[analyze] storage download failed (file ${i + 1}):`, dlError);
        return err(500, `Failed to retrieve uploaded file: ${fd.filename}`);
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      if (buffer.length > MAX_FILE_SIZE) {
        return err(400, `${fd.filename} is too large (over 50MB).`);
      }
      totalSize += buffer.length;
      downloaded.push({ ...fd, buffer });
      log(`downloaded ${fd.filename} (${buffer.length} bytes)`);
    }

    if (totalSize > FILE_LIMITS.MAX_TOTAL_SIZE) {
      return err(400, "Combined file size exceeds the package limit.");
    }

    // ── Single-file fast path (preserves legacy behaviour exactly) ──
    let result;
    let primaryFile;
    if (downloaded.length === 1) {
      const only = downloaded[0];
      primaryFile = only;
      if (only.contentType === "application/pdf") {
        const base64PDF = only.buffer.toString("base64");
        result = await analyzeTenderFromPDF(base64PDF, rfxType);
      } else {
        let text;
        try {
          text = await extractFileText({ buffer: only.buffer, contentType: only.contentType });
        } catch (e) {
          console.error("[analyze] text extraction failed:", e);
          return err(400, "Could not extract text from the uploaded file. The file may be empty or corrupted.");
        }
        if (!text || text.trim().length === 0) {
          return err(400, "Could not extract text from the uploaded file. The file may be empty or corrupted.");
        }
        result = await analyzeTender(text.substring(0, MAX_TEXT_CHARS), rfxType);
      }
    } else {
      // ── Multi-file (Tender Package) path ──
      const extractedFiles = [];
      for (const d of downloaded) {
        let text;
        try {
          text = await extractFileText({ buffer: d.buffer, contentType: d.contentType });
        } catch (e) {
          console.error(`[analyze] text extraction failed for ${d.filename}:`, e);
          return err(400, `Could not extract text from ${d.filename}. The file may be empty, corrupted, or a scanned-image PDF.`);
        }
        if (!text || text.trim().length === 0) {
          return err(400, `${d.filename} contained no extractable text.`);
        }
        extractedFiles.push({
          filename: d.filename,
          role: d.role,
          text,
        });
      }
      primaryFile = downloaded.find((d) => d.role === "primary");
      result = await analyzeTenderPackage(extractedFiles, rfxType);
    }

    log("AI analysis complete");

    if (!result.success) {
      return err(500, result.error);
    }

    // ── Insert analyses row (primary file path for backward compat) ──
    const { data: insertedRow } = await adminClient
      .from("analyses")
      .insert({
        user_id: user.id,
        file_name: primaryFile.filename,
        file_path: primaryFile.storagePath,
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

    // ── Insert one analysis_files row per file (only for true packages or when
    //    explicitly batch — legacy single-file callers don't get a row, to
    //    minimise behaviour change). ──
    if (isBatch && analysisId) {
      const fileRows = downloaded.map((d, i) => ({
        analysis_id: analysisId,
        user_id: user.id,
        storage_path: d.storagePath,
        file_name: d.filename,
        content_type: d.contentType,
        file_size: d.buffer.length,
        role: d.role,
        sort_order: i,
      }));
      const { error: filesError } = await adminClient
        .from("analysis_files")
        .insert(fileRows);
      if (filesError) {
        console.error("[analyze] analysis_files insert failed:", filesError.message);
        // Non-fatal: the analysis row is saved; only the per-file metadata is missing.
      }
    }

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
      fileName: primaryFile.filename,
      fileSize: primaryFile.buffer.length,
      analysis: result.data,
      analysisId,
    });
  } catch (error) {
    console.error("Analysis API error:", error);
    return err(500, "An unexpected error occurred while processing your file. Please try again.");
  }
}
