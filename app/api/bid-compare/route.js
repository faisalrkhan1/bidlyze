import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

export async function POST(request) {
  const t0 = Date.now();
  const log = (s) => console.log(`[bid-compare] ${s} — ${Date.now() - t0}ms`);

  try {
    log("request received");

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
    const compareName = formData.get("compareName") || "Bid Comparison";
    const compareType = formData.get("compareType") || "quotation";
    const fileCount = parseInt(formData.get("fileCount") || "0", 10);

    if (fileCount < 2) {
      return NextResponse.json({ success: false, error: "Upload at least 2 documents to compare." }, { status: 400 });
    }

    // Extract text from each file
    const submissions = [];
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file_${i}`);
      const label = formData.get(`label_${i}`) || file?.name || `Submission ${i + 1}`;
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
        console.error(`[bid-compare] Failed to extract ${fileName}:`, e.message);
        text = `[Could not extract text from ${fileName}]`;
      }

      submissions.push({ label, fileName, size: file.size, text: text.substring(0, 80000) });
    }

    log(`extracted ${submissions.length} submissions`);

    // Build combined text
    const combinedText = submissions.map((s) =>
      `\n===== SUBMISSION: ${s.label} (File: ${s.fileName}) =====\n${s.text}\n`
    ).join("\n");

    // Call AI
    const { BID_COMPARE_PROMPT } = await import("@/lib/compare-prompt");
    const apiKey = process.env.OPENROUTER_API_KEY;

    log("calling AI");

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
          { role: "system", content: "You are an expert procurement bid evaluation analyst. Compare all submissions structurally. Return ONLY valid JSON." },
          { role: "user", content: `${BID_COMPARE_PROMPT}\n\nCOMPARISON TYPE: ${compareType}\nNUMBER OF SUBMISSIONS: ${submissions.length}\n\n${combinedText.substring(0, 400000)}` },
        ],
        max_tokens: 16384,
        response_format: { type: "json_object" },
      }),
    });

    log(`AI response: ${aiRes.status}`);

    if (!aiRes.ok) {
      const errBody = await aiRes.text().catch(() => "");
      console.error("[bid-compare] AI error:", aiRes.status, errBody);
      return NextResponse.json({ success: false, error: "Comparison analysis failed. Please try again." }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ success: false, error: "AI returned empty response." }, { status: 500 });
    }

    let analysis;
    try {
      let cleaned = content.trim().replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "");
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      cleaned = cleaned.substring(first, last + 1);
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("[bid-compare] JSON parse failed");
      return NextResponse.json({ success: false, error: "Failed to parse comparison results." }, { status: 500 });
    }

    log("analysis parsed");

    // Add metadata
    analysis.isComparison = true;
    analysis.rfxType = "comparison";
    analysis.compareType = compareType;
    analysis.files = submissions.map((s) => ({ label: s.label, fileName: s.fileName, size: s.size }));

    // Save to DB
    const { data: insertedRow } = await supabase.from("analyses").insert({
      user_id: user.id,
      file_name: `${submissions.length} submissions`,
      project_name: compareName,
      bid_score: null,
      analysis_data: analysis,
    }).select("id").single();

    log("saved to DB");

    return NextResponse.json({ success: true, compareId: insertedRow?.id });
  } catch (error) {
    console.error("[bid-compare] Error:", error);
    return NextResponse.json({ success: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}
