import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateProposalSection } from "@/lib/gemini";

export const maxDuration = 120;

const VALID_SECTIONS = [
  "executive_summary",
  "technical_response",
  "compliance_matrix",
  "methodology",
  "team_structure",
  "risk_mitigation",
];

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { analysisId, sectionType } = body;

    if (!analysisId || !sectionType) {
      return NextResponse.json(
        { success: false, error: "Missing analysisId or sectionType" },
        { status: 400 }
      );
    }

    if (!VALID_SECTIONS.includes(sectionType)) {
      return NextResponse.json(
        { success: false, error: `Invalid section type: ${sectionType}` },
        { status: 400 }
      );
    }

    // Load analysis from Supabase
    const { data: analysis, error: fetchError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !analysis || !analysis.analysis_data) {
      return NextResponse.json(
        { success: false, error: "Analysis not found" },
        { status: 404 }
      );
    }

    // Generate proposal section
    const result = await generateProposalSection(
      analysis.analysis_data,
      sectionType
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Save generated section to proposals column
    const currentProposals = analysis.proposals || {};
    currentProposals[sectionType] = {
      content: result.content,
      generatedAt: new Date().toISOString(),
    };

    await supabase
      .from("analyses")
      .update({ proposals: currentProposals })
      .eq("id", analysisId)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      content: result.content,
      sectionType,
    });
  } catch (error) {
    console.error("Proposal generation API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
