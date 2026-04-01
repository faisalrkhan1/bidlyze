import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

export async function POST(request) {
  const t0 = Date.now();
  const log = (s) => console.log(`[workspace] ${s} — ${Date.now() - t0}ms`);

  try {
    log("request received");

    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    log("auth done");

    const formData = await request.formData();
    const packageName = formData.get("packageName") || "Tender Package";
    const fileCount = parseInt(formData.get("fileCount") || "0", 10);

    if (fileCount === 0) {
      return NextResponse.json({ success: false, error: "No files uploaded" }, { status: 400 });
    }

    // Extract text from each file
    const fileEntries = [];
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file_${i}`);
      const category = formData.get(`category_${i}`) || "attachment";
      if (!file) continue;

      const fileName = file.name;
      const ext = fileName.split(".").pop().toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());
      let text = "";

      try {
        if (ext === "pdf") {
          const { extractText } = await import("unpdf");
          const result = await extractText(new Uint8Array(buffer));
          text = result.text.join("\n");
        } else if (ext === "docx") {
          const mammoth = await import("mammoth");
          const extracted = await mammoth.extractRawText({ buffer });
          text = extracted.value || "";
        } else if (ext === "txt") {
          text = buffer.toString("utf-8");
        }
      } catch (e) {
        console.error(`[workspace] Failed to extract ${fileName}:`, e.message);
        text = `[Could not extract text from ${fileName}]`;
      }

      fileEntries.push({
        fileName,
        category,
        size: file.size,
        textLength: text.length,
        text: text.substring(0, 30000), // cap per file
      });
    }

    log(`extracted ${fileEntries.length} files`);

    // Build combined document for AI
    const combinedText = fileEntries.map((f) =>
      `\n===== FILE: ${f.fileName} (Category: ${f.category}) =====\n${f.text}\n`
    ).join("\n");

    // Call AI
    const { PACKAGE_ANALYSIS_PROMPT } = await import("@/lib/package-prompt");

    const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
    const apiKey = process.env.OPENROUTER_API_KEY;

    log("calling AI");

    const aiRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://bidlyze.com",
        "X-Title": "Bidlyze",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.4",
        messages: [
          { role: "system", content: "You are an expert tender package analyst. Analyze all documents as one package. Return ONLY valid JSON." },
          { role: "user", content: `${PACKAGE_ANALYSIS_PROMPT}\n\nTENDER PACKAGE (${fileEntries.length} files):\n${combinedText.substring(0, 100000)}` },
        ],
        max_tokens: 16384,
        response_format: { type: "json_object" },
      }),
    });

    log(`AI response status: ${aiRes.status}`);

    if (!aiRes.ok) {
      const errBody = await aiRes.text().catch(() => "");
      console.error("[workspace] AI error:", aiRes.status, errBody);
      return NextResponse.json({ success: false, error: "Package analysis failed. Please try again." }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ success: false, error: "AI returned empty response." }, { status: 500 });
    }

    // Parse JSON
    let analysis;
    try {
      let cleaned = content.trim().replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "");
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      cleaned = cleaned.substring(first, last + 1);
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("[workspace] JSON parse failed:", content.substring(0, 200));
      return NextResponse.json({ success: false, error: "Failed to parse package analysis." }, { status: 500 });
    }

    log("AI analysis parsed");

    // Add metadata
    analysis.isPackage = true;
    analysis.rfxType = "package";
    analysis.files = fileEntries.map((f) => ({
      fileName: f.fileName,
      category: f.category,
      size: f.size,
      textLength: f.textLength,
    }));

    // Save to DB
    const { data: insertedRow } = await supabase.from("analyses").insert({
      user_id: user.id,
      file_name: `${fileEntries.length} files`,
      project_name: analysis.packageSummary?.tenderObjective || packageName,
      bid_score: null,
      analysis_data: analysis,
    }).select("id").single();

    const packageId = insertedRow?.id ?? null;
    log("saved to DB");

    return NextResponse.json({ success: true, packageId });
  } catch (error) {
    console.error("[workspace] Error:", error);
    return NextResponse.json({ success: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}
