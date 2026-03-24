import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compareTenderAmendments, compareTenderPDFs } from "@/lib/openrouter";

export const maxDuration = 120;

async function extractText(file) {
  const fileName = file.name;
  const fileExtension = fileName.split(".").pop().toLowerCase();

  if (fileExtension === "pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    return { type: "pdf", data: buffer.toString("base64") };
  } else if (fileExtension === "docx") {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await mammoth.extractRawText({ buffer });
    if (!extracted.value || extracted.value.trim().length === 0) {
      return { type: "error", error: "Could not extract text from DOCX file." };
    }
    return { type: "text", data: extracted.value.substring(0, 500000) };
  } else if (fileExtension === "txt") {
    const text = await file.text();
    if (!text || text.trim().length === 0) {
      return { type: "error", error: "Could not extract text from TXT file." };
    }
    return { type: "text", data: text.substring(0, 500000) };
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

    const maxSize = 3 * 1024 * 1024;
    if (originalFile.size > maxSize || amendedFile.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "Each file must be under 3MB." },
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

    let result;

    if (original.type === "pdf" && amended.type === "pdf") {
      result = await compareTenderPDFs(original.data, amended.data);
    } else {
      // If one is PDF, we can't mix — fall back to text comparison
      // For PDF that needs text extraction, use Gemini inline for both
      if (original.type === "pdf" || amended.type === "pdf") {
        // Send both as PDFs if both are PDFs, otherwise use text
        // For mixed types, we need text from both
        return NextResponse.json(
          { success: false, error: "Both files must be the same type (both PDF or both DOCX/TXT) for comparison." },
          { status: 400 }
        );
      }
      result = await compareTenderAmendments(original.data, amended.data);
    }

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
