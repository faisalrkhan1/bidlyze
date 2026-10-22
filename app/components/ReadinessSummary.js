"use client";

// Header card for Tender Readiness Reports (engine "readiness-v2").
// Shows the recommendation, conditions, showstoppers and — most importantly —
// how many of the AI's statements were checked against the actual tender text.

const REC_STYLE = {
  "BID": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "CONDITIONAL BID": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "NO-BID": "bg-red-500/10 text-red-400 border-red-500/20",
  "REVIEW": "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

function Stat({ value, label, tone }) {
  return (
    <div className="p-3 rounded-xl text-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
      <p className={`text-xl font-bold ${tone || ""}`}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

export default function ReadinessSummary({ analysis }) {
  if (!analysis || analysis.engine !== "readiness-v2") return null;

  const bid = analysis.bidScore || {};
  const rec = bid.recommendation || "REVIEW";
  const c = analysis.citations || {};
  const checked = (c.verified || 0) + (c.relocated || 0);
  const pct = c.total ? Math.round((checked / c.total) * 100) : 0;
  const r = analysis.readiness || {};
  const meta = analysis.meta || {};
  const scanned = (meta.files || []).filter((f) => f.scannedPages?.length > 0);

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ border: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`px-3 py-1 rounded-lg border text-sm font-bold ${REC_STYLE[rec] || REC_STYLE.REVIEW}`}>{rec}</span>
        {Number.isFinite(bid.score) && (
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Bid attractiveness <b>{bid.score}</b>/100</span>
        )}
      </div>

      {bid.reasoning && <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{bid.reasoning}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat value={r.mandatoryCount ?? 0} label="Mandatory requirements" />
        <Stat value={r.disqualifiersRequired ?? 0} label="Pass/fail items required" tone="text-red-400" />
        <Stat value={(analysis.clarificationQuestions || []).length} label="Clarifications drafted" />
        <Stat value={`${pct}%`} label="Statements verified in tender" tone={pct >= 90 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400"} />
      </div>

      {bid.conditions?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Bid only if</p>
          <ul className="list-disc pl-5 space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {bid.conditions.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
      )}

      {r.showstoppers?.length > 0 && (
        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-red-400">Showstoppers</p>
          <ul className="list-disc pl-5 space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {r.showstoppers.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
      )}

      {r.criticalSilent?.length > 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          The tender is silent on: {r.criticalSilent.join(", ")}. Confirm with the buyer before submission.
        </p>
      )}

      {(c.unverified > 0 || c.approximate > 0) && (
        <p className="text-xs text-amber-400">
          {c.unverified || 0} statement(s) could not be matched to the tender text and {c.approximate || 0} matched only approximately. They are marked in the tables below — check them against the source before relying on them.
        </p>
      )}
      {scanned.length > 0 && (
        <p className="text-xs text-amber-400">
          Scanned pages with no readable text: {scanned.map((f) => `${f.filename} (pages ${f.scannedPages.slice(0, 10).join(", ")}${f.scannedPages.length > 10 ? "…" : ""})`).join("; ")}. Anything on those pages was not analysed.
        </p>
      )}
      {meta.skipped?.length > 0 && (
        <p className="text-xs text-amber-400">
          {meta.skipped.length} page(s) exceeded the reading limit and were not analysed.
        </p>
      )}
      {meta.failedPasses?.length > 0 && (
        <p className="text-xs text-red-400">Some checks did not complete ({meta.failedPasses.join(", ")}). Re-run the analysis.</p>
      )}
    </div>
  );
}
