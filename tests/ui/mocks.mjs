// In-browser mock of Supabase (auth, the analyses tables, storage) for UI tests.
import { readFileSync } from "node:fs";

const FX = new URL("../fixtures/submission/", import.meta.url);
export const ecta = JSON.parse(readFileSync(new URL("ecta-analysis.json", FX)));
export const legacy = JSON.parse(readFileSync(new URL("legacy-analysis.json", FX)));
export const ectaResult = JSON.parse(readFileSync(new URL("ecta-result.json", FX)));
export const TENDER_PDF = readFileSync(new URL("../e2e/ECTA_test_tender.pdf", import.meta.url));
export const RESPONSE_PDF = new URL("../e2e/ECTA_test_response.pdf", import.meta.url).pathname;
export const SCANNED_PDF = new URL("scanned_blank.pdf", FX).pathname;

const SB = "http://localhost:54321";
export const USER = { id: ecta.user_id, aud: "authenticated", role: "authenticated", email: "reviewer@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

export const TENDER_PDF_PATH = new URL("../e2e/ECTA_test_tender.pdf", import.meta.url).pathname;

export async function mockSupabase(page, { analyses = [ecta, legacy], usage = { success: true, tracked: false, environment: "preview" } } = {}) {
  await page.route("**/api/submission-check/usage", (route) => route.fulfill({ json: usage }));
  await page.addInitScript((user) => {
    const now = Math.floor(Date.now() / 1000);
    window.localStorage.setItem("sb-localhost-auth-token", JSON.stringify({ access_token: "test-access-token", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "test-refresh", user }));
  }, USER);
  const calls = { writes: [] };
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() !== "GET" && req.method() !== "HEAD") {
      calls.writes.push(`${req.method()} ${url.pathname}`);
      return route.fulfill({ status: 403, json: { message: "writes are not allowed in UI tests" } });
    }
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (url.pathname === "/auth/v1/user") return route.fulfill({ json: USER });
    if (url.pathname === "/rest/v1/analyses") {
      const idEq = url.searchParams.get("id")?.replace(/^eq\./, "");
      const rows = idEq ? analyses.filter((a) => a.id === idEq) : analyses;
      if (single) return rows[0] ? route.fulfill({ json: rows[0] }) : route.fulfill({ status: 406, json: { code: "PGRST116", message: "not found" } });
      return route.fulfill({ json: rows });
    }
    if (url.pathname === "/rest/v1/analysis_files") {
      const idEq = url.searchParams.get("analysis_id")?.replace(/^eq\./, "");
      const a = analyses.find((x) => x.id === idEq);
      return route.fulfill({ json: a ? [{ storage_path: a.file_path, file_name: a.file_name, content_type: "application/pdf", role: "primary", sort_order: 0 }] : [] });
    }
    if (url.pathname === "/rest/v1/subscriptions") return route.fulfill({ json: single ? { plan: "free", status: "active" } : [] });
    if (url.pathname.startsWith("/storage/v1/object/")) return route.fulfill({ status: 200, contentType: "application/pdf", body: TENDER_PDF });
    return route.fulfill({ json: single ? {} : [] });
  });
  return calls;
}
