import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeTender, analyzeTenderFromPDF } from "@/lib/gemini";
import {
  sendEmail,
  buildAnalysisSummaryEmail,
  buildUsageWarningEmail,
} from "@/lib/email";

export const maxDuration = 300;

export async function POST(request) {
  const t0 = Date.now();
  const log = (stage) => console.log(`[analyze] ${stage} — ${Date.now() - t0}ms`);

  try {
    log("request received");

    // Authenticate user
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    // Create Supabase client with the user's JWT so RLS policies work
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's subscription plan and limit
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan, analyses_limit, status")
      .eq("user_id", user.id)
      .single();

    const analysesLimit = (subscription?.status === "active" && subscription?.analyses_limit)
      ? subscription.analyses_limit
      : 3;
    const planName = subscription?.plan || "free";

    // Check usage limit
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth);

    if (count >= analysesLimit) {
      const msg = planName === "free"
        ? "You've reached your free limit of 3 analyses this month. Upgrade to continue."
        : `You've reached your ${planName} plan limit of ${analysesLimit} analyses this month. Upgrade for more.`;
      return NextResponse.json(
        { success: false, error: msg },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileSize = file.size;
    const maxSize = 3 * 1024 * 1024; // 3MB
    const fileExtension = fileName.split(".").pop().toLowerCase();

    if (fileSize > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "File too large. Please upload a PDF under 3MB.",
        },
        { status: 400 }
      );
    }

    log("auth + usage check done");

    // Read file buffer once so we can reuse for analysis + storage upload
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let result;

    log(`file parsed: ${fileName} (${fileSize} bytes, .${fileExtension})`);

    if (fileExtension === "pdf") {
      const base64PDF = fileBuffer.toString("base64");
      result = await analyzeTenderFromPDF(base64PDF);
    } else if (fileExtension === "docx") {
      const mammoth = await import("mammoth");
      const extracted = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = extracted.value;

      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Could not extract text from the uploaded file. The file may be empty or corrupted.",
          },
          { status: 400 }
        );
      }

      result = await analyzeTender(text.substring(0, 500000));
    } else if (fileExtension === "txt") {
      const text = fileBuffer.toString("utf-8");

      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Could not extract text from the uploaded file. The file may be empty or corrupted.",
          },
          { status: 400 }
        );
      }

      result = await analyzeTender(text.substring(0, 500000));
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
        },
        { status: 400 }
      );
    }

    log("AI analysis complete");

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Save analysis record to Supabase (including full analysis JSON)
    const { data: insertedRow } = await supabase.from("analyses").insert({
      user_id: user.id,
      file_name: fileName,
      project_name: result.data?.summary?.projectName || "Unknown",
      bid_score: result.data?.bidScore?.score ?? null,
      analysis_data: result.data,
    }).select("id").single();

    const analysisId = insertedRow?.id ?? null;

    // Upload original file to Supabase Storage (fire-and-forget)
    if (analysisId) {
      const storagePath = `${user.id}/${analysisId}/${fileName}`;
      supabase.storage
        .from("tenders")
        .upload(storagePath, fileBuffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        })
        .then(({ error: uploadError }) => {
          if (uploadError) {
            console.error("File upload error:", uploadError);
            return;
          }
          // Save storage path to the analysis record
          supabase
            .from("analyses")
            .update({ file_path: storagePath })
            .eq("id", analysisId)
            .then(({ error: updateError }) => {
              if (updateError) console.error("File path update error:", updateError);
            });
        });
    }

    // Send email notifications (fire-and-forget — don't block the response)
    const newUsageCount = (count ?? 0) + 1;

    // Analysis summary email
    const summaryEmail = buildAnalysisSummaryEmail({
      projectName: result.data?.summary?.projectName || "Unknown",
      bidScore: result.data?.bidScore?.score ?? 0,
      recommendation: result.data?.bidScore?.recommendation || "N/A",
      summary: result.data?.summary?.briefDescription || "Analysis complete.",
      analysisId,
    });
    sendEmail({ to: user.email, subject: summaryEmail.subject, html: summaryEmail.html })
      .catch((err) => console.error("Failed to send analysis email:", err));

    // Usage warning email (when 1 remaining)
    if (newUsageCount === analysesLimit - 1) {
      const warningEmail = buildUsageWarningEmail({ usageCount: newUsageCount, limit: analysesLimit });
      sendEmail({ to: user.email, subject: warningEmail.subject, html: warningEmail.html })
        .catch((err) => console.error("Failed to send usage warning email:", err));
    }

    log("DB + storage done, responding");

    return NextResponse.json({
      success: true,
      fileName,
      fileSize,
      analysis: result.data,
      analysisId,
    });
  } catch (error) {
    console.error("Analysis API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred while processing your file. Please try again.",
      },
      { status: 500 }
    );
  }
}
