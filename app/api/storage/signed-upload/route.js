import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const maxDuration = 30;

const BUCKET = "tender-uploads";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILENAME_LEN = 200;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const CONTENT_TYPE_TO_EXT = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
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

    // ── Parse + validate body ──
    let body;
    try {
      body = await request.json();
    } catch {
      return err(400, "Invalid JSON body");
    }

    const filename = body?.filename;
    const rawContentType = body?.contentType;
    const fileSize = body?.fileSize;

    if (typeof filename !== "string" || filename.length === 0) {
      return err(400, "filename is required");
    }
    if (filename.length > MAX_FILENAME_LEN) {
      return err(400, `filename exceeds ${MAX_FILENAME_LEN} characters`);
    }
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return err(400, "filename contains invalid path characters");
    }

    // Normalize content type: strip "; charset=..." parameters and lowercase
    const contentType =
      typeof rawContentType === "string"
        ? rawContentType.split(";")[0].trim().toLowerCase()
        : "";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return err(400, "Unsupported content type. Allowed: PDF, DOCX, TXT.");
    }

    if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
      return err(400, "fileSize must be a positive number");
    }
    if (fileSize > MAX_FILE_SIZE) {
      return err(400, `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
    }

    // ── Plan-limit check (mirrors /api/analyze) ──
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

    // ── Generate signed upload URL via service-role client ──
    const ext = deriveExtension(filename, contentType);
    const randomId = randomUUID(); // lowercase hex + hyphens — already matches [a-z0-9-]
    const storagePath = `${user.id}/${randomId}.${ext}`;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error(
        "[signed-upload] SUPABASE_SERVICE_ROLE_KEY is not configured"
      );
      return err(500, "Failed to generate upload URL");
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey
    );

    const { data: signed, error: signedError } = await adminClient.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError || !signed?.signedUrl) {
      console.error("[signed-upload] createSignedUploadUrl failed:", signedError);
      return err(500, "Failed to generate upload URL");
    }

    return NextResponse.json({
      uploadUrl: signed.signedUrl,
      storagePath,
      token: signed.token ?? null,
    });
  } catch (error) {
    console.error("[signed-upload] unexpected error:", error);
    return err(500, "Failed to generate upload URL");
  }
}
