import { createHash } from "node:crypto";
import { BENCHMARK_SOURCES } from "./sources.js";
import { extractPages } from "../readiness/pages.js";

const MAX_BYTES = 30 * 1024 * 1024;

/** Download an allowlisted benchmark document and extract its pages. */
export async function loadBenchmarkSource(id) {
  const src = BENCHMARK_SOURCES[id];
  if (!src) throw new Error(`Unknown benchmark source: ${id}`);
  const res = await fetch(src.url, { headers: { "User-Agent": "Bidlyze-benchmark/1.0 (accuracy testing)" } });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${src.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Benchmark document too large");
  const sha256 = createHash("sha256").update(buf).digest("hex");
  if (src.sha256 && src.sha256 !== sha256) {
    throw new Error(`Benchmark document changed: expected sha256 ${src.sha256}, got ${sha256}`);
  }
  const { pages, scannedPages } = await extractPages({ buffer: buf, contentType: src.contentType });
  return {
    meta: { id, title: src.title, url: src.url, bytes: buf.length, sha256, pinned: !!src.sha256 },
    files: [{ fileIndex: 1, filename: src.url.split("/").pop(), role: "primary", pages, scannedPages }],
  };
}
