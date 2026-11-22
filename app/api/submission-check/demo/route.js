import { NextResponse } from "next/server";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import { loadDemoAnalysis, loadDemoProposal, DEMO_PROPOSAL_FILE } from "@/lib/submission/demo";
import { requirementsFromAnalysis } from "@/lib/submission/fromAnalysis";
import { prepareRequirements } from "@/lib/submission/obligations";
import { loadBenchmarkSource } from "@/lib/benchmarks/fetchSource";
import { extractPages } from "@/lib/readiness/pages";
import { normaliseResponse, checkProposalAgainstAnalysis } from "@/lib/submission/service";
import { sha256Hex } from "@/lib/submission/extractClient";

// Demo data for the Submission Check beta (preview only).
//   ?part=tender     the sample tender (requirements + page text fetched from the Council)
//   ?part=proposal   the fictional sample proposal (PDF)
//   ?part=record&confirm=1   run one LIVE check of the sample proposal (~$0.12) and return
//                    the full result, to be saved as runs/demo-recorded-result.json.
//                    Internal: preview deployments only (behind Vercel Authentication);
//                    always 404 in production, whatever the beta switch says.

export const maxDuration = 300;

export async function GET(request) {
  if (!submissionCheckBetaEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(request.url);
  const part = url.searchParams.get("part");

  if (part === "proposal") {
    const buf = await loadDemoProposal();
    return new NextResponse(buf, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${DEMO_PROPOSAL_FILE}"`, "Cache-Control": "private, max-age=3600" },
    });
  }

  if (part === "tender") {
    const analysis = await loadDemoAnalysis();
    const { total, requirements } = requirementsFromAnalysis(analysis.analysisData);
    const prep = prepareRequirements(requirements);
    let pages = null;
    let source = null;
    try {
      const src = await loadBenchmarkSource("alton-cctv-2026");
      pages = src.files[0].pages.map((p) => ({ unit: p.unit, n: p.n, text: p.text }));
      source = { url: src.meta.url, sha256: src.meta.sha256 };
    } catch (e) {
      console.warn("[submission-check demo] tender text unavailable:", e?.message);
    }
    return NextResponse.json({ analysis: { id: analysis.id, name: analysis.name, fileName: analysis.fileName, requirementsTotal: total, checkable: prep.checked.length, notCheckable: prep.excluded.length }, pages, source });
  }

  if (part === "record" && url.searchParams.get("confirm") === "1") {
    if (process.env.VERCEL_ENV === "production" || !["preview", "development"].includes(process.env.VERCEL_ENV || process.env.NODE_ENV)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const analysis = await loadDemoAnalysis();
    const buf = await loadDemoProposal();
    const { pages, scannedPages } = await extractPages({ buffer: buf, contentType: "application/pdf" });
    const sha256 = await sha256Hex(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const response = normaliseResponse({ filename: DEMO_PROPOSAL_FILE, contentType: "application/pdf", sha256, pages, scannedPages });
    const result = await checkProposalAgainstAnalysis({ analysis, response });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown part" }, { status: 400 });
}
