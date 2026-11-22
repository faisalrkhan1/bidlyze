import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let url = new URL(specifier.slice(2), ROOT);
    if (!/\.[cm]?js$/.test(url.pathname)) {
      if (existsSync(fileURLToPath(url) + ".js")) url = new URL(url.href + ".js");
      else if (existsSync(fileURLToPath(url) + "/index.js")) url = new URL(url.href + "/index.js");
    }
    return nextResolve(url.href, context);
  }
  // Next.js resolves these subpaths itself; plain Node needs the file name.
  if (specifier === "next/server" || specifier === "next/navigation") return nextResolve(`${specifier}.js`, context);
  return nextResolve(specifier, context);
}
