import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteTender } from "@/lib/deleteTender";

// Delete one tender: uploaded files + everything extracted from them.
// See lib/deleteTender.js for exactly what is removed and kept.

export const maxDuration = 60;

function err(status, message) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return err(401, "Unauthorized");
    const token = authHeader.split(" ")[1];

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) return err(401, "Unauthorized");

    let body;
    try {
      body = await request.json();
    } catch {
      return err(400, "Invalid JSON body");
    }
    const analysisId = body?.analysis_id;
    if (!analysisId || typeof analysisId !== "string") return err(400, "analysis_id is required");

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[delete] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return err(500, "Service is not configured");
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey);

    const out = await deleteTender(admin, { analysisId, userId: user.id });
    if (!out.ok) return err(out.status, out.error);

    console.log(`[delete] analysis ${analysisId}: ${out.filesRemoved} file(s) removed, ${out.filesConfirmedGone} confirmed gone`);
    return NextResponse.json({ success: true, filesRemoved: out.filesRemoved, filesConfirmedGone: out.filesConfirmedGone });
  } catch (e) {
    console.error("[delete] unexpected error:", e);
    return err(500, "Unexpected error while deleting the tender");
  }
}
