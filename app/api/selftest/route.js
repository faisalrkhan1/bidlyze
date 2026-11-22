import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractPages } from "@/lib/readiness/pages";
import { runReadinessAnalysis } from "@/lib/readiness/engine";
import { askJSON, currentModel, providerPreferences } from "@/lib/readiness/ai";
import { score } from "@/lib/readiness/benchmark";
import { runSubmissionCheck } from "@/lib/submission/check";
import { scoreSubmission } from "@/lib/submission/benchmark";
import { loadBenchmarkSource } from "@/lib/benchmarks/fetchSource";
import { BENCHMARKS } from "@/lib/benchmarks/registry";
import { validateKey } from "@/lib/benchmarks/validateKey";
import { scoreReadiness } from "@/lib/benchmarks/scoreReadiness";
import { normaliseDocuments } from "@/lib/submission/documents";
import { readTenderRequirements } from "@/lib/submission/tender";
import { normaliseResponse, checkProposalAgainstAnalysis } from "@/lib/submission/service";
import { summarize } from "@/lib/submission/review";

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
//   /api/selftest?mode=submission
//                             Submission Check prototype: the fictional bid
//                             response (ECTA_test_response.pdf) checked against
//                             18 known requirements (submission_truth.json)
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

    // Real-world benchmark: download an allowlisted public tender and return
    // its page text exactly as the product's extractor sees it.
    if (mode === "extract") {
      const src = await loadBenchmarkSource(new URL(request.url).searchParams.get("bench") || "");
      return NextResponse.json({
        ok: true,
        meta: src.meta,
        pages: src.files[0].pages.map((p) => ({ n: p.n, text: p.text })),
        scannedPages: src.files[0].scannedPages,
        ms: Date.now() - t0,
      });
    }

    // Real-world benchmark (authentic public tender + fictional supplier
    // response + hand-checked answer key). Modes:
    //   bench-validate    answer-key quotes checked against the LIVE tender (no AI)
    //   bench-submission  Submission Check on the key's requirements
    //   bench-readiness   Tender Intelligence on the tender, matched to the key
    //   bench-chained     Tender Intelligence requirements -> Submission Check
    if (mode?.startsWith("bench-")) {
      const benchId = new URL(request.url).searchParams.get("bench") || "";
      const bench = BENCHMARKS[benchId];
      if (!bench) return NextResponse.json({ ok: false, error: "unknown benchmark" }, { status: 400 });
      const bdir = path.join(process.cwd(), bench.dir);
      const [src, responsePdf, keyRaw] = await Promise.all([
        loadBenchmarkSource(bench.source),
        readFile(path.join(bdir, bench.response)),
        readFile(path.join(bdir, bench.key), "utf8"),
      ]);
      const key = JSON.parse(keyRaw);
      const tenderFiles = src.files;
      const rp = await extractPages({ buffer: responsePdf, contentType: "application/pdf" });
      const responseFiles = [{ fileIndex: 1, filename: bench.response, role: "primary", pages: rp.pages, scannedPages: rp.scannedPages }];
      const fetchMs = Date.now() - t0;
      const itemView = (i) => ({ id: i.id, status: i.status, ai: i.aiStatus, by: i.decidedBy, evidence: i.evidence.map((e) => `${e.file} p.${e.page} ${e.status}: ${e.quote.slice(0, 160)}`), checks: i.checks.map((c) => `${c.type}: ${c.result}`), flags: i.flags, gap: i.gap });

      if (mode === "bench-validate") {
        return NextResponse.json({ ok: true, source: src.meta, responsePages: rp.pages.length, validation: validateKey(key, tenderFiles, responseFiles), ms: Date.now() - t0 });
      }

      if (mode === "bench-submission") {
        const requirements = key.requirements.map((k) => ({ id: k.id, requirement: k.requirement, tenderQuote: k.tenderQuote, tenderFile: "F1", tenderPage: k.tenderPage }));
        const result = await runSubmissionCheck({ requirements, responseFiles, tenderFiles });
        if (!result.success) return NextResponse.json({ ok: false, error: result.error, ms: Date.now() - t0 }, { status: 502 });
        return NextResponse.json({
          ok: true, model: currentModel(), source: src.meta,
          score: scoreSubmission(key, result), summary: result.summary,
          items: result.items.map(itemView),
          aiUsage: result.meta.aiUsage, failedBatches: result.meta.failedBatches, truncatedBatches: result.meta.truncatedBatches,
          fetchMs, engineMs: result.meta.durationMs, totalMs: Date.now() - t0,
        });
      }

      // Chained, from a saved Tender Intelligence output (runs/<ti>.requirements.json):
      // repeatable, and fits in one request (live TI + check exceeds some clients' timeouts).
      if (mode === "bench-chained-fixture") {
        const ti = new URL(request.url).searchParams.get("ti") || "";
        if (!/^ti-run\d+$/.test(ti)) return NextResponse.json({ ok: false, error: "bad fixture name" }, { status: 400 });
        const fixture = JSON.parse(await readFile(path.join(bdir, "runs", `${ti}.requirements.json`), "utf8"));
        const extracted = fixture.requirements.map((r) => ({ id: r.id, requirement: r.requirement, tenderQuote: r.quote, tenderFile: "F1", tenderPage: r.page }));
        const sc = await runSubmissionCheck({ requirements: extracted, responseFiles, tenderFiles });
        if (!sc.success) return NextResponse.json({ ok: false, error: sc.error, ms: Date.now() - t0 }, { status: 502 });
        const match = scoreReadiness(bench, key, { requirements: fixture.requirements.map((r) => ({ id: r.id, requirement: r.requirement, citation: { quote: r.quote, page: r.page, status: r.status } })) }).match;
        const byTi = new Map(sc.items.map((i) => [i.id, i]));
        const mapped = { items: key.requirements.map((k) => {
          const m = match.get(k.id);
          const it = m ? byTi.get(m.tiId) : null;
          return it ? { ...it, id: k.id, viaTi: m.tiId } : { id: k.id, status: undefined, aiStatus: undefined, evidence: [] };
        }) };
        const expected = JSON.parse(await readFile(path.join(bdir, "runs", `${ti}.expected.json`), "utf8"));
        return NextResponse.json({
          ok: true, model: currentModel(), fixture: ti,
          // Primary: each extracted requirement scored on its own terms (expected
          // statuses derived from the answer key, see runs/<ti>.expected.json).
          extractedScore: scoreSubmission(expected, sc),
          // Secondary: mapped back to the 38 answer-key items (merges distort this).
          chainedScore: scoreSubmission(key, mapped),
          chainedItems: mapped.items.map((i) => (i.viaTi ? `${i.id} via ${i.viaTi}: ${i.status} (ai ${i.aiStatus}, ${i.decidedBy}) ${i.evidence.map((e) => `p.${e.page} ${e.status}`).join(", ")}` : `${i.id}: not matched`)),
          extractedItems: sc.items.map((i) => `${i.id}: ${i.status} (ai ${i.aiStatus}) | ${i.gap}`),
          tenderQuotesVerified: `${sc.items.filter((i) => i.tender && i.tender.status !== "unverified").length}/${sc.items.length}`,
          summary: sc.summary, aiUsage: sc.meta.aiUsage, engineMs: sc.meta.durationMs, totalMs: Date.now() - t0,
        });
      }

      // The new-check flow exactly as a customer runs it (tender read for its
      // requirements, then the proposal checked), minus the database: nothing is saved.
      if (mode === "bench-beta-flow") {
        const t1 = Date.now();
        const { files: tFiles } = normaliseDocuments({ files: tenderFiles.map((f) => ({ filename: f.filename, pages: f.pages, scannedPages: f.scannedPages })) }, { kind: "tender" });
        const tender = await readTenderRequirements({ files: tFiles });
        const tenderMs = Date.now() - t1;
        const response = normaliseResponse({ files: [{ filename: bench.response, pages: rp.pages, scannedPages: rp.scannedPages }] });
        const result = await checkProposalAgainstAnalysis({ analysis: { id: "selftest", name: tender.summary.name, fileName: tFiles[0].filename, analysisData: tender.analysisData }, response });
        const rs = scoreReadiness(bench, key, tender.analysisData);
        const byTi = new Map(result.items.map((i) => [i.id, i]));
        const mapped = { items: key.requirements.map((k) => {
          const m = rs.match.get(k.id);
          const base = m && String(m.tiId);
          const it = base ? byTi.get(base) || result.items.find((x) => String(x.id).startsWith(`${base}.`)) : null;
          return it ? { ...it, id: k.id, viaTi: it.id } : { id: k.id, status: undefined, aiStatus: undefined, evidence: [] };
        }) };
        const groups = summarize(result.items, {}).byGroup;
        const keyScore = scoreSubmission(key, mapped);
        // The full run takes about 2 minutes, longer than some fetch proxies wait: also log a
        // compact summary (public tender, fictional proposal; no customer data).
        console.log(`[selftest:beta-flow] ${JSON.stringify({
          tender: { reqs: tender.summary.requirementsTotal, cited: tender.summary.cited, checkable: tender.summary.checkable, notCheckable: tender.summary.notCheckable, ms: tenderMs, cost: tender.aiCostUsd, failed: tender.analysisData.meta?.failedPasses, truncated: tender.analysisData.meta?.truncatedPasses, keyCoverage: rs.summary },
          check: { checked: result.items.length, groups, statuses: result.summary, quotesResponse: `${result.items.flatMap((i) => i.evidence).filter((e) => e.status !== "unverified").length}/${result.items.flatMap((i) => i.evidence).length}`, ms: result.meta.durationMs, cost: result.meta.aiCostUsd },
          key: { exact: keyScore.final.exact, issuesFlagged: keyScore.final.issuesFlagged, falseAlarms: keyScore.final.falseAlarmCount, missed: keyScore.final.missedIssues, falseAlarmIds: keyScore.final.falseAlarms, evidence: keyScore.evidence },
          totalMs: Date.now() - t0,
        })}`);
        return NextResponse.json({
          ok: true, model: currentModel(), source: src.meta,
          tender: { ...tender.summary, ms: tenderMs, aiCostUsd: tender.aiCostUsd, passesRun: ["overview", "requirements"], passesSkipped: tender.analysisData.meta?.passesSkipped, failedPasses: tender.analysisData.meta?.failedPasses, truncatedPasses: tender.analysisData.meta?.truncatedPasses, keyCoverage: rs.summary },
          check: { requirementsChecked: result.items.length, excluded: result.excluded.length, groups, statuses: result.summary, documents: result.documents.map((d) => `${d.id} ${d.name}: ${d.state}`), quotes: { response: `${result.items.flatMap((i) => i.evidence).filter((e) => e.status !== "unverified").length}/${result.items.flatMap((i) => i.evidence).length}`, tender: `${result.items.filter((i) => i.tender && i.tender.status !== "unverified").length}/${result.items.filter((i) => i.tender).length}` }, ms: result.meta.durationMs, aiCostUsd: result.meta.aiCostUsd },
          answerKey: keyScore,
          missedIssues: mapped.items.filter((i) => { const k = key.requirements.find((x) => x.id === i.id); return k && k.expected !== "answered" && (!i.status || i.status === "answered"); }).map((i) => `${i.id}: ${i.status || "not extracted"}`),
          falseAlarms: mapped.items.filter((i) => { const k = key.requirements.find((x) => x.id === i.id); return k && k.expected === "answered" && i.status && !["answered", "manual"].includes(i.status); }).map((i) => `${i.id} (${i.viaTi}): ${i.status} | ${i.gap}`),
          totalCostUsd: Math.round(((tender.aiCostUsd || 0) + (result.meta.aiCostUsd || 0)) * 10000) / 10000,
          fetchMs, totalMs: Date.now() - t0,
        });
      }

      if (mode === "bench-readiness" || mode === "bench-chained") {
        const ti = await runReadinessAnalysis({ files: tenderFiles, rfxType: "rfp" });
        if (!ti.success) return NextResponse.json({ ok: false, error: ti.error, ms: Date.now() - t0 }, { status: 502 });
        const rs = scoreReadiness(bench, key, ti.data);
        const tiView = {
          score: rs.summary, notFound: rs.notFound, wrongPage: rs.wrongPage, dateHits: rs.dateHits, weightHits: rs.weightHits,
          matches: rs.rows.map((r) => `${r.id}->${r.ti || "-"} p.${r.page ?? "-"} ${r.citation || ""} run=${r.run} cov=${r.cov}`),
          meta: { failedPasses: ti.data.meta?.failedPasses, truncatedPasses: ti.data.meta?.truncatedPasses, requirementsCapped: ti.data.meta?.requirementsCapped, durationMs: ti.data.meta?.durationMs, aiUsage: ti.data.meta?.aiUsage },
        };
        if (mode === "bench-readiness") {
          // emit=requirements: the extracted requirements with their tender
          // quotes, to be saved as a fixture for the chained check below.
          if (new URL(request.url).searchParams.get("emit") === "requirements") {
            return NextResponse.json({
              ok: true, tenderIntelligence: tiView,
              fixture: (ti.data.requirements || []).map((r) => ({ id: r.id, requirement: r.requirement, quote: r.citation?.quote || "", page: r.citation?.page ?? null, status: r.citation?.status || "none" })),
              totalMs: Date.now() - t0,
            });
          }
          return NextResponse.json({
            ok: true, model: currentModel(), source: src.meta, tenderIntelligence: tiView,
            requirements: (ti.data.requirements || []).map((r) => `${r.id} [${r.priority}${r.mandatory ? "" : ", optional"}] p.${r.citation?.page ?? "-"} ${r.citation?.status || "none"} | ${r.requirement}`),
            keyDates: ti.data.keyDates, evaluationCriteria: ti.data.evaluationCriteria, summary: ti.data.summary,
            submission: ti.data.submission, financial: ti.data.financialRequirements,
            disqualificationRequired: (ti.disqualification?.fixed_checks || ti.data.disqualification?.fixed_checks || []).filter((f) => f.status === "required").map((f) => `${f.id} p:${f.page_reference} ${f.citation_status}: ${f.details}`),
            dynamicFindings: (ti.disqualification?.dynamic_findings || ti.data.disqualification?.dynamic_findings || []).map((d) => `${d.severity}: ${d.title} (${d.citation_status})`),
            clarifications: (ti.data.clarificationQuestions || []).map((q) => `${q.priority} ${q.citation?.status || "none"}: ${q.question}`),
            bidScore: ti.data.bidScore,
            fetchMs, totalMs: Date.now() - t0,
          });
        }
        // Chained: the requirements Tender Intelligence extracted are checked
        // against the response; each key item takes the status of the
        // extracted requirement it matched (unmatched = "none" = not checked).
        const extracted = (ti.data.requirements || []).map((r) => ({ id: r.id, requirement: r.requirement, tenderQuote: r.citation?.quote || "", tenderFile: "F1", tenderPage: r.citation?.page || null }));
        const sc = await runSubmissionCheck({ requirements: extracted, responseFiles, tenderFiles });
        if (!sc.success) return NextResponse.json({ ok: false, error: sc.error, tenderIntelligence: tiView, ms: Date.now() - t0 }, { status: 502 });
        const byTi = new Map(sc.items.map((i) => [i.id, i]));
        const mapped = { items: key.requirements.map((k) => {
          const m = rs.match.get(k.id);
          const it = m ? byTi.get(m.tiId) : null;
          return it ? { ...it, id: k.id, viaTi: m.tiId } : { id: k.id, status: undefined, aiStatus: undefined, evidence: [] };
        }) };
        return NextResponse.json({
          ok: true, model: currentModel(), source: src.meta, tenderIntelligence: tiView,
          chainedScore: scoreSubmission(key, mapped),
          chainedItems: mapped.items.map((i) => (i.viaTi ? { via: i.viaTi, ...itemView(i) } : { id: i.id, status: "not extracted" })),
          submissionSummary: sc.summary,
          submissionUsage: sc.meta.aiUsage, submissionMs: sc.meta.durationMs,
          fetchMs, totalMs: Date.now() - t0,
        });
      }
      return NextResponse.json({ ok: false, error: "unknown mode" }, { status: 400 });
    }

    if (mode === "submission") {
      const [tenderPdf, responsePdf, subTruthRaw] = await Promise.all([
        readFile(path.join(dir, "ECTA_test_tender.pdf")),
        readFile(path.join(dir, "ECTA_test_response.pdf")),
        readFile(path.join(dir, "submission_truth.json"), "utf8"),
      ]);
      const subTruth = JSON.parse(subTruthRaw);
      const asFiles = async (buffer, filename) => {
        const { pages, scannedPages } = await extractPages({ buffer, contentType: "application/pdf" });
        return [{ fileIndex: 1, filename, role: "primary", pages, scannedPages }];
      };
      const [tenderFiles, responseFiles] = await Promise.all([
        asFiles(tenderPdf, "ECTA_test_tender.pdf"),
        asFiles(responsePdf, "ECTA_test_response.pdf"),
      ]);
      const requirements = subTruth.requirements.map((t) => ({
        id: t.id, requirement: t.requirement, tenderQuote: t.tenderQuote, tenderFile: "F1", tenderPage: t.tenderPage,
      }));
      const result = await runSubmissionCheck({ requirements, responseFiles, tenderFiles });
      if (!result.success) {
        return NextResponse.json({ ok: false, error: result.error, ms: Date.now() - t0 }, { status: 502 });
      }
      return NextResponse.json({
        ok: true,
        model: currentModel(),
        provider: providerPreferences(),
        score: scoreSubmission(subTruth, result),
        summary: result.summary,
        items: result.items.map((i) => ({ id: i.id, status: i.status, ai: i.aiStatus, by: i.decidedBy, evidence: i.evidence.map((e) => `${e.file} p.${e.page} ${e.status}`), checks: i.checks.map((c) => `${c.type}: ${c.result}`), gap: i.gap })),
        aiUsage: result.meta.aiUsage,
        truncatedBatches: result.meta.truncatedBatches,
        engineMs: result.meta.durationMs,
        totalMs: Date.now() - t0,
      });
    }

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
