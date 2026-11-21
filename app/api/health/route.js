import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Health check + database keep-alive.
//
// Vercel Cron calls this once a day (see vercel.json) so the free Supabase
// project never sits idle long enough to be paused (it paused in Nov 2026
// and took the whole app down). It is also a quick uptime check:
//   https://app.bidlyze.com/api/health  ->  {"ok":true,"db":"up"}
//
// Uses the public anon key and a head-only query, so it reads no data and
// reveals nothing beyond up/down.

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers = { "Cache-Control": "no-store" };

  if (!url || !anon) {
    return NextResponse.json({ ok: false, db: "not_configured" }, { status: 500, headers });
  }

  try {
    const supabase = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await supabase
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - t0 }, { headers });
  } catch (e) {
    console.error("[health] database check failed:", e?.message || e);
    return NextResponse.json({ ok: false, db: "down", ms: Date.now() - t0 }, { status: 503, headers });
  }
}
