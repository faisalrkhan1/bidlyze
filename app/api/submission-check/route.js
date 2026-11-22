import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import { normaliseResponse, checkProposalAgainstAnalysis, CheckInputError } from "@/lib/submission/service";
import { isDeletedAnalysis } from "@/lib/deleteTender";
import { DEMO_ID, loadDemoAnalysis, loadRecordedDemoResult } from "@/lib/submission/demo";

// Submission Check (beta): check a supplier proposal against a saved tender
// analysis. The proposal's page text is extracted in the browser and sent
// here; nothing is written to the database or to storage.
//
// Preview deployments and local development only (see lib/submission/beta.js).

export const maxDuration = 300;
const MAX_BODY_BYTES = 4_000_000; // Vercel rejects request bodies over 4.5 MB

function err(status, message) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function userFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { user: null };
  const token = authHeader.split(" ")[1];
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { user: null };
  return { user: data.user, client };
}

export async function POST(request) {
  if (!submissionCheckBetaEnabled()) return err(404, "Not found");
  try {
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
      return err(413, "The proposal text is too large to send in one go (over 4 MB of text).");
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return err(400, "Invalid request.");
    }
    const analysisId = String(body?.analysisId || "");
    const response = normaliseResponse(body?.response);

    let analysis;
    if (analysisId === DEMO_ID) {
      analysis = await loadDemoAnalysis();
      // The sample proposal has a recorded live result: demos cost nothing.
      if (!body.live) {
        const rec = await loadRecordedDemoResult();
        if (rec && response.sha256 && rec.response?.sha256 === response.sha256) {
          return NextResponse.json({ ...rec, response: { ...rec.response, filename: response.filename }, recorded: { checkedAt: rec.checkedAt } });
        }
      }
      // A live AI run (any other file, or a re-run) needs a signed-in user.
      const { user } = await userFromRequest(request);
      if (!user) return err(401, "Sign in to run a live check on the sample tender.");
    } else {
      const { user, client } = await userFromRequest(request);
      if (!user) return err(401, "Your session has expired. Sign in again.");
      if (!/^[0-9a-f-]{36}$/i.test(analysisId)) return err(400, "Unknown tender analysis.");
      // RLS + explicit owner filter: users can only check against their own analyses.
      const { data, error } = await client
        .from("analyses")
        .select("id, project_name, file_name, analysis_data")
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .single();
      if (error || !data?.analysis_data) return err(404, "Tender analysis not found.");
      if (isDeletedAnalysis(data)) return err(410, "This tender has been deleted.");
      analysis = {
        id: data.id,
        name: data.analysis_data?.summary?.projectName || data.project_name || "Tender",
        fileName: data.file_name,
        analysisData: data.analysis_data,
      };
    }

    const result = await checkProposalAgainstAnalysis({ analysis, response });
    console.log(`[submission-check] ${analysis.id}: ${result.items.length} reqs, ${result.response.pages} pages, ${result.meta.durationMs} ms, $${result.meta.aiCostUsd}`);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof CheckInputError) return err(e.status, e.message);
    console.error("[submission-check] unexpected error:", e);
    return err(500, "Something went wrong while checking the proposal. Please try again.");
  }
}
