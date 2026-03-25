import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compareTenderAmendments } from "@/lib/openrouter";

export const maxDuration = 300;

const MAX_TEXT = 150000;

async function extractText(file) {
  const fileExtension = file.name.split(".").pop().toLowerCase();

  if (fileExtension === "pdf") {
    const { extractPdfText } = await import("@/lib/pdf");
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(buffer);
    if (!text || text.trim().length === 0) {
      return { type: "error", error: "Could not extract text from PDF file." };
    }
    return { type: "text", data: text.substring(0, MAX_TEXT) };
  } else if (fileExtension === "docx") {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await mammoth.extractRawText({ buffer });
    if (!extracted.value || extracted.value.trim().length === 0) {
      return { type: "error", error: "Could not extract text from DOCX file." };
    }
    return { type: "text", data: extracted.value.substring(0, MAX_TEXT) };
  } else if (fileExtension === "txt") {
    const text = await file.text();
    if (!text || text.trim().length === 0) {
      return { type: "error", error: "Could not extract text from TXT file." };
    }
    return { type: "text", data: text.substring(0, MAX_TEXT) };
  }
  return { type: "error", error: "Unsupported file type." };
}

export async function POST(request) {
  try {
    // Authenticate user
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    // Use service role key for server-side operations.
    // NEXT_PUBLIC_ env vars may not be in process.env for Route Handlers.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const originalFile = formData.get("original");
    const amendedFile = formData.get("amended");

    if (!originalFile || !amendedFile) {
      return NextResponse.json(
        { success: false, error: "Both original and amended files are required." },
        { status: 400 }
      );
    }

    const original = await extractText(originalFile);
    const amended = await extractText(amendedFile);

    if (original.type === "error") {
      return NextResponse.json(
        { success: false, error: `Original file: ${original.error}` },
        { status: 400 }
      );
    }
    if (amended.type === "error") {
      return NextResponse.json(
        { success: false, error: `Amended file: ${amended.error}` },
        { status: 400 }
      );
    }

    // All file types (PDF, DOCX, TXT) are now extracted to text
    const result = await compareTenderAmendments(original.data, amended.data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      originalFileName: originalFile.name,
      amendedFileName: amendedFile.name,
      comparison: result.data,
    });
  } catch (error) {
    console.error("Compare API error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while comparing documents." },
      { status: 500 }
    );
  }
}
