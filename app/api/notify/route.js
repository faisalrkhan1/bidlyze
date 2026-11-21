import { NextResponse } from "next/server";
import {
  sendEmail,
  buildAnalysisSummaryEmail,
  buildUsageWarningEmail,
} from "@/lib/email";

export async function POST(request) {
  try {
    // Simple internal auth — only allow calls from our own API routes
    // Fail closed: if INTERNAL_API_KEY is not configured, nobody is authorised.
    const expectedKey = process.env.INTERNAL_API_KEY;
    const internalKey = request.headers.get("x-internal-key");
    if (!expectedKey || internalKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, to, data } = body;

    if (!type || !to) {
      return NextResponse.json(
        { success: false, error: "Missing type or recipient" },
        { status: 400 }
      );
    }

    let email;

    switch (type) {
      case "analysis_summary": {
        const { projectName, bidScore, recommendation, summary, analysisId } = data;
        email = buildAnalysisSummaryEmail({ projectName, bidScore, recommendation, summary, analysisId });
        break;
      }
      case "usage_warning": {
        const { usageCount, limit } = data;
        email = buildUsageWarningEmail({ usageCount, limit });
        break;
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown email type: ${type}` },
          { status: 400 }
        );
    }

    const result = await sendEmail({ to, subject: email.subject, html: email.html });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, emailId: result.id });
  } catch (error) {
    console.error("Notify API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
