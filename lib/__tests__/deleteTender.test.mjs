// Tests for tender deletion (lib/deleteTender.js) against an in-memory fake
// of the Supabase client: tables + a storage bucket. Run: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteTender, isDeletedAnalysis } from "../deleteTender.js";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

function fakeSupabase({ failRemove = false, keepFiles = false, missingTables = [] } = {}) {
  const db = {
    analyses: [
      {
        id: "a1", user_id: U1, created_at: "2026-11-20T10:00:00Z", file_name: "RFP.pdf", file_path: `${U1}/p1.pdf`,
        project_name: "Smart Parking", bid_score: 62, analysis_data: { summary: { projectName: "Smart Parking" } },
        notes: "internal note", requirement_statuses: { edits: {} }, compliance_weighting: "equal", tender_status: "analyzed",
      },
      { id: "a2", user_id: U2, created_at: "2026-11-20T11:00:00Z", file_name: "Other.pdf", file_path: `${U2}/x.pdf`, project_name: "Other", analysis_data: { summary: {} } },
    ],
    analysis_files: [
      { analysis_id: "a1", storage_path: `${U1}/p1.pdf` },
      { analysis_id: "a1", storage_path: `${U1}/boq.xlsx` },
      { analysis_id: "a2", storage_path: `${U2}/x.pdf` },
    ],
    disqualification_analyses: [{ analysis_id: "a1", user_id: U1 }, { analysis_id: "a2", user_id: U2 }],
    bid_readiness_stages: [{ analysis_id: "a1", stage: "kickoff" }],
  };
  const files = new Set([`${U1}/p1.pdf`, `${U1}/boq.xlsx`, `${U2}/x.pdf`, `${U1}/unrelated.pdf`]);

  function query(table) {
    const filters = [];
    let op = "select";
    let payload = null;
    const rows = () => db[table].filter((r) => filters.every(([k, v]) => r[k] === v));
    const run = () => {
      if (missingTables.includes(table)) {
        return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` } };
      }
      if (op === "delete") {
        const keep = db[table].filter((r) => !filters.every(([k, v]) => r[k] === v));
        db[table] = keep;
        return { data: null, error: null };
      }
      if (op === "update") {
        for (const r of rows()) Object.assign(r, payload);
        return { data: null, error: null };
      }
      return { data: rows().map((r) => ({ ...r })), error: null };
    };
    const q = {
      select() { return q; },
      delete() { op = "delete"; return q; },
      update(p) { op = "update"; payload = p; return q; },
      eq(k, v) { filters.push([k, v]); return q; },
      maybeSingle() { const r = run(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return q;
  }

  return {
    db,
    files,
    from: query,
    storage: {
      from() {
        return {
          async remove(paths) {
            if (failRemove) return { data: null, error: { message: "storage down" } };
            if (!keepFiles) for (const p of paths) files.delete(p);
            return { data: paths, error: null };
          },
          async download(p) {
            return files.has(p) ? { data: new Blob(["x"]), error: null } : { data: null, error: { message: "Object not found" } };
          },
        };
      },
    },
  };
}

test("deletes the owner's files, child rows and content; keeps a content-free row for usage", async () => {
  const sb = fakeSupabase();
  const out = await deleteTender(sb, { analysisId: "a1", userId: U1, now: new Date("2026-11-21T12:00:00Z") });
  assert.deepEqual(out, { ok: true, filesRemoved: 2, filesConfirmedGone: 2 });

  // Files: both of this tender's files gone; unrelated and other user's files untouched.
  assert.equal(sb.files.has(`${U1}/p1.pdf`), false);
  assert.equal(sb.files.has(`${U1}/boq.xlsx`), false);
  assert.equal(sb.files.has(`${U1}/unrelated.pdf`), true);
  assert.equal(sb.files.has(`${U2}/x.pdf`), true);

  // Child rows for a1 gone, a2's untouched.
  assert.deepEqual(sb.db.analysis_files.map((f) => f.analysis_id), ["a2"]);
  assert.deepEqual(sb.db.disqualification_analyses.map((f) => f.analysis_id), ["a2"]);
  assert.equal(sb.db.bid_readiness_stages.length, 0);

  // Tombstone: no tender content left, usage fields kept.
  const row = sb.db.analyses.find((r) => r.id === "a1");
  assert.deepEqual(row.analysis_data, { deleted: true, deletedAt: "2026-11-21T12:00:00.000Z" });
  assert.equal(row.project_name, "Deleted tender");
  assert.equal(row.file_name, "Deleted");
  assert.equal(row.file_path, null);
  assert.equal(row.notes, null);
  assert.equal(row.requirement_statuses, null);
  assert.equal(row.bid_score, null);
  assert.equal(row.created_at, "2026-11-20T10:00:00Z");
  assert.equal(row.user_id, U1);
  assert.equal(row.compliance_weighting, "equal");
  assert.ok(isDeletedAnalysis(row));
  assert.ok(!JSON.stringify(row).includes("Smart Parking"), "no tender text remains");

  // The other user's analysis is untouched.
  assert.equal(sb.db.analyses.find((r) => r.id === "a2").project_name, "Other");
});

test("cannot delete someone else's tender", async () => {
  const sb = fakeSupabase();
  const out = await deleteTender(sb, { analysisId: "a2", userId: U1 });
  assert.equal(out.ok, false);
  assert.equal(out.status, 404);
  assert.equal(sb.files.has(`${U2}/x.pdf`), true);
  assert.equal(sb.db.analyses.find((r) => r.id === "a2").project_name, "Other");
});

test("if the storage delete fails, nothing else is changed (safe to retry)", async () => {
  const sb = fakeSupabase({ failRemove: true });
  const out = await deleteTender(sb, { analysisId: "a1", userId: U1 });
  assert.equal(out.ok, false);
  assert.equal(sb.db.analysis_files.filter((f) => f.analysis_id === "a1").length, 2);
  assert.equal(sb.db.analyses.find((r) => r.id === "a1").project_name, "Smart Parking");
});

test("if a file is still downloadable after delete, it reports failure instead of claiming success", async () => {
  const sb = fakeSupabase({ keepFiles: true });
  const out = await deleteTender(sb, { analysisId: "a1", userId: U1 });
  assert.equal(out.ok, false);
  assert.match(out.error, /could not be confirmed/);
  assert.equal(sb.db.analyses.find((r) => r.id === "a1").project_name, "Smart Parking");
});

test("deleting twice is harmless", async () => {
  const sb = fakeSupabase();
  await deleteTender(sb, { analysisId: "a1", userId: U1 });
  const again = await deleteTender(sb, { analysisId: "a1", userId: U1 });
  assert.equal(again.ok, true);
  assert.equal(again.filesRemoved, 0);
});

test("never touches files outside the user's own folder, even if a row points there", async () => {
  const sb = fakeSupabase();
  sb.db.analysis_files.push({ analysis_id: "a1", storage_path: `${U2}/x.pdf` });
  sb.db.analysis_files.push({ analysis_id: "a1", storage_path: `${U1}/../${U2}/x.pdf` });
  await deleteTender(sb, { analysisId: "a1", userId: U1 });
  assert.equal(sb.files.has(`${U2}/x.pdf`), true);
});

test("works on the live schema, where bid_readiness_stages does not exist (PGRST205)", async () => {
  const sb = fakeSupabase({ missingTables: ["bid_readiness_stages"] });
  delete sb.db.bid_readiness_stages;
  const out = await deleteTender(sb, { analysisId: "a1", userId: U1 });
  assert.equal(out.ok, true);
  assert.equal(out.filesConfirmedGone, 2);
  assert.ok(isDeletedAnalysis(sb.db.analyses.find((r) => r.id === "a1")));
});
