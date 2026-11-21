import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractPages } from "@/lib/readiness/pages";
import { runReadinessAnalysis } from "@/lib/readiness/engine";
import { askJSON, currentModel, providerPreferences } from "@/lib/readiness/ai";
import { score } from "@/lib/readiness/benchmark";

// Live self-test — PREVIEW DEPLOYMENTS ONLY (404 in production).
//
// Runs the known-answer test tender (tests/e2e/ECTA_test_tender.pdf, fictional)
// through the real pipeline and the real AI model, then scores the result:
// recall of the 16 required pass/fail items, correct pages, false alarms,
// key dates, clarification traps, citation checks, time and AI cost.
//
//   /api/selftest?mode=ping   one tiny AI call: proves the key, model and
//                             privacy routing work (costs a fraction of a cent)
//   /api/selftest             full analysis of the 8-page test tender
//
// Preview URLs are behind Vercel Authentication, so only the project owner can
// reach this. No user data is read or written.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ENABLED = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";

export async function GET(request) {
  if (!ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mode = new URL(request.url).searchParams.get("mode");
  const t0 = Date.now();

  try {
    if (mode === "ping") {
      const r = await askJSON({
        system: "Return ONLY valid JSON.",
        task: 'Return {"ok": true}.',
        maxTokens: 20,
        label: "selftest:ping",
      });
      return NextResponse.json({
        ok: r.json?.ok === true,
        model: currentModel(),
        provider: providerPreferences(),
        usage: r.usage,
        ms: Date.now() - t0,
      });
    }

    const dir = path.join(process.cwd(), "tests", "e2e");
    const [pdf, truthRaw] = await Promise.all([
      readFile(path.join(dir, "ECTA_test_tender.pdf")),
      readFile(path.join(dir, "ground_truth.json"), "utf8"),
    ]);
    const truth = JSON.parse(truthRaw);

    const { pages, scannedPages } = await extractPages({ buffer: pdf, contentType: "application/pdf" });
    const files = [{ fileIndex: 1, filename: "ECTA_test_tender.pdf", role: "primary", pages, scannedPages }];
    const result = await runReadinessAnalysis({ files, rfxType: "rfp" });
    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error, ms: Date.now() - t0 }, { status: 502 });
    }

    const s = score(truth, result.data, result.disqualification);
    return NextResponse.json({
      ok: true,
      model: currentModel(),
      provider: providerPreferences(),
      pagesRead: pages.length,
      score: s.summary,
      misses: s.misses,
      wrongPage: s.wrongPage,
      falseAlarms: s.falseAlarms,
      citations: result.data.citations,
      requirements: result.data.requirements.length,
      failedPasses: result.data.meta.failedPasses,
      truncatedPasses: result.data.meta.truncatedPasses,
      aiUsage: result.data.meta.aiUsage,
      engineMs: result.data.meta.durationMs,
      totalMs: Date.now() - t0,
    });
  } catch (e) {
    console.error("[selftest] failed:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e), ms: Date.now() - t0 }, { status: 500 });
  }
}
