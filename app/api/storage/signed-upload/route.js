import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { FILE_LIMITS } from "@/lib/constants";

export const maxDuration = 30;

const BUCKET = "tender-uploads";
const MAX_FILE_SIZE = FILE_LIMITS.MAX_FILE_SIZE;
const MAX_FILENAME_LEN = 200;
const ALLOWED_CONTENT_TYPES = new Set(FILE_LIMITS.ALLOWED_CONTENT_TYPES);

const CONTENT_TYPE_TO_EXT = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function err(status, message) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function deriveExtension(filename, contentType) {
  let ext = "";
  if (typeof filename === "string") {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot > -1 && lastDot < filename.length - 1) {
      ext = filename.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (ext.length > 10) ext = ext.slice(0, 10);
    }
  }
  if (!ext) ext = CONTENT_TYPE_TO_EXT[contentType] || "bin";
  return ext;
}

/**
 * Normalize a single file entry. Returns the validated entry or a string error.
 */
function validateEntry(raw) {
  const filename = raw?.filename;
  const fileSize = raw?.fileSize;
  const rawContentType = raw?.contentType;

  if (typeof filename !== "string" || filename.length === 0) {
    return "filename is required";
  }
  if (filename.length > MAX_FILENAME_LEN) {
    return `filename exceeds ${MAX_FILENAME_LEN} characters`;
  }
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return "filename contains invalid path characters";
  }

  const contentType =
    typeof rawContentType === "string"
      ? rawContentType.split(";")[0].trim().toLowerCase()
      : "";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return "Unsupported content type. Allowed: PDF, DOCX, TXT, XLSX.";
  }

  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    return "fileSize must be a positive number";
  }
  if (fileSize > MAX_FILE_SIZE) {
    return `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
  }

  return { filename, fileSize, contentType };
}

export async function POST(request) {
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

    // ── Parse body — accept both batch and legacy single-file shapes ──
    let body;
    try {
      body = await request.json();
    } catch {
      return err(400, "Invalid JSON body");
    }

    // Detect mode. Legacy single-file: top-level `filename` present. Batch: `files` array.
    const isBatch = Array.isArray(body?.files);
    const rawEntries = isBatch
      ? body.files
      : [{ filename: body?.filename, contentType: body?.contentType, fileSize: body?.fileSize }];

    if (rawEntries.length < 1) {
      return err(400, "At least one file is required.");
    }
    if (rawEntries.length > FILE_LIMITS.MAX_FILES_PER_PACKAGE) {
      return err(400, `A tender package can contain at most ${FILE_LIMITS.MAX_FILES_PER_PACKAGE} files.`);
    }

    // Per-file validation
    const entries = [];
    let totalSize = 0;
    for (let i = 0; i < rawEntries.length; i++) {
      const result = validateEntry(rawEntries[i]);
      if (typeof result === "string") {
        return err(400, isBatch ? `File ${i + 1}: ${result}` : result);
      }
      entries.push(result);
      totalSize += result.fileSize;
    }

    if (totalSize > FILE_LIMITS.MAX_TOTAL_SIZE) {
      return err(
        400,
        `Combined size exceeds the limit. Maximum total is ${FILE_LIMITS.MAX_TOTAL_SIZE / (1024 * 1024)}MB.`
      );
    }

    // ── Plan-limit check (once per request — a Tender Package counts as 1 analysis) ──
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan, analyses_limit, status")
      .eq("user_id", user.id)
      .single();

    const planName = subscription?.plan || "free";
    const isActiveSub = subscription?.status === "active";

    if (subscription && !isActiveSub && planName !== "free") {
      return err(
        403,
        "Your subscription is not active. Please update your billing to continue."
      );
    }

    const analysesLimit =
      isActiveSub && subscription?.analyses_limit ? subscription.analyses_limit : 3;

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

    // ── Generate signed upload URLs via service-role client ──
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[signed-upload] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return err(500, "Failed to generate upload URL");
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey
    );

    const uploads = [];
    for (const entry of entries) {
      const ext = deriveExtension(entry.filename, entry.contentType);
      const storagePath = `${user.id}/${randomUUID()}.${ext}`;
      const { data: signed, error: signedError } = await adminClient.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);

      if (signedError || !signed?.signedUrl) {
        console.error("[signed-upload] createSignedUploadUrl failed:", signedError);
        return err(500, "Failed to generate upload URL");
      }
      uploads.push({
        uploadUrl: signed.signedUrl,
        storagePath,
        token: signed.token ?? null,
        filename: entry.filename,
      });
    }

    // Backward-compat: when the caller sent the legacy single-file shape,
    // return the legacy response shape too. The new caller sends `files` and
    // receives `uploads`.
    if (!isBatch) {
      const u = uploads[0];
      return NextResponse.json({
        uploadUrl: u.uploadUrl,
        storagePath: u.storagePath,
        token: u.token,
      });
    }

    return NextResponse.json({ success: true, uploads });
  } catch (error) {
    console.error("[signed-upload] unexpected error:", error);
    return err(500, "Failed to generate upload URL");
  }
}
