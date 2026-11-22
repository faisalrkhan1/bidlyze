// Single place that talks to the AI model (via OpenRouter).
//
// Model is set by the AI_MODEL environment variable so it can be changed in
// Vercel without a code change. Default: Claude Sonnet 5.5.
//
// Data handling (tender documents are confidential):
//   - provider.data_collection = "deny": OpenRouter only routes to providers
//     that do not store or train on prompts.
//   - AI_PROVIDER_ONLY (optional, e.g. "anthropic"): pin the request to the
//     named provider(s) so the privacy policy can name exactly who processes
//     the documents.
//   - AI_ZDR=true (optional): only zero-data-retention endpoints. Test before
//     enabling: if no ZDR endpoint serves the model, every call will fail.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

export function currentModel() {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

/** OpenRouter provider-routing preferences built from env. Exported for tests. */
export function providerPreferences(env = process.env) {
  const prefs = { data_collection: "deny" };
  const only = String(env.AI_PROVIDER_ONLY || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (only.length) {
    prefs.only = only;
    prefs.allow_fallbacks = false;
  }
  if (env.AI_ZDR === "true") prefs.zdr = true;
  return prefs;
}

function stripFences(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
}

export function parseJSON(text) {
  const t = stripFences(text);
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("No JSON object in AI response");
  return JSON.parse(t.slice(a, b + 1));
}

/**
 * Recover the complete part of a JSON object that was cut off because the
 * model hit its output-token limit.
 *
 * Keeps every array element that was fully written and drops the half-written
 * one, then closes the open arrays/objects. Example:
 *   {"requirements":[{...},{...},{"category":"Tech   ->   {"requirements":[{...},{...}]}
 *
 * Returns null if nothing usable can be recovered.
 */
export function salvageTruncatedJSON(text) {
  const t = stripFences(text);
  const start = t.indexOf("{");
  if (start === -1) return null;

  const stack = [];
  let inStr = false;
  let esc = false;
  let lastCut = null; // { end, stack } just after a complete element inside an array

  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) {
        // The object actually closed — not truncated after all.
        try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
      }
      if (stack[stack.length - 1] === "[") lastCut = { end: i + 1, stack: stack.slice() };
    }
  }

  if (!lastCut) return null;
  const closers = lastCut.stack.slice().reverse().map((c) => (c === "[" ? "]" : "}")).join("");
  try {
    return JSON.parse(t.slice(start, lastCut.end) + closers);
  } catch {
    return null;
  }
}

function isLengthStop(choice) {
  const fr = String(choice?.finish_reason || "").toLowerCase();
  const native = String(choice?.native_finish_reason || "").toLowerCase();
  return fr === "length" || native === "max_tokens" || native === "length";
}

function addUsage(total, u) {
  if (!u) return total;
  total.prompt_tokens = (total.prompt_tokens || 0) + (Number(u.prompt_tokens) || 0);
  total.completion_tokens = (total.completion_tokens || 0) + (Number(u.completion_tokens) || 0);
  total.cost = (total.cost || 0) + (Number(u.cost) || 0);
  const cached = Number(u.prompt_tokens_details?.cached_tokens) || 0;
  total.prompt_tokens_details = { cached_tokens: (total.prompt_tokens_details?.cached_tokens || 0) + cached };
  return total;
}

/**
 * Ask the model for a JSON object.
 *
 * The (large) tender document is sent as its own content block marked for
 * prompt caching, so repeat passes over the same tender are cheaper.
 *
 * @param {object} args
 * @param {string} args.system        role / rules
 * @param {string} [args.document]    marked tender text (cached)
 * @param {string} args.task          pass-specific instructions + JSON shape
 * @param {number} [args.maxTokens]
 * @param {string} [args.label]       for logs
 * @returns {Promise<{json: object, usage: object, truncated: boolean}>}
 *   truncated = the model ran out of output tokens; json holds only the items
 *   it finished writing, so the caller must warn that the list may be incomplete.
 */
// Errors that a second attempt cannot fix (bad key, no credit, request too large, policy).
const NO_RETRY_STATUS = new Set([400, 401, 402, 403, 404, 413, 422]);
// Vercel stops a function after 300 s; leave room to save and answer.
export const DEFAULT_AI_TIMEOUT_MS = 270_000;
const MIN_RETRY_BUDGET_MS = 45_000;

export async function askJSON({ system, document, documentTag = "tender_documents", task, maxTokens = 12000, label = "ai", timeoutMs = DEFAULT_AI_TIMEOUT_MS, fetchImpl = fetch }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const userContent = [];
  if (document) {
    userContent.push({
      type: "text",
      text: `<${documentTag}>\n${document}\n</${documentTag}>`,
      cache_control: { type: "ephemeral" },
    });
  }
  userContent.push({ type: "text", text: task });

  const body = {
    model: currentModel(),
    max_tokens: maxTokens,
    temperature: 0,
    // Ask OpenRouter to return token counts and the real cost of this call,
    // so each analysis records what it actually cost (see engine meta.aiUsage).
    usage: { include: true },
    provider: providerPreferences(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  };

  let lastErr;
  const usage = {}; // summed over attempts, so failed attempts are still costed
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    const remaining = deadline - t0;
    if (attempt > 1 && remaining < MIN_RETRY_BUDGET_MS) break; // no time left for a useful retry
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetchImpl(OPENROUTER_URL, {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://bidlyze.com",
          "X-Title": "Bidlyze",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[${label}] AI error ${res.status}:`, errBody.slice(0, 500));
        const httpErr = new Error(`AI service returned ${res.status}`);
        httpErr.status = res.status;
        if (NO_RETRY_STATUS.has(res.status)) httpErr.noRetry = true;
        throw httpErr;
      }
      const data = await res.json();
      const choice = data?.choices?.[0];
      const content = choice?.message?.content;
      addUsage(usage, data?.usage);
      console.log(
        `[${label}] ${currentModel()} ok in ${Date.now() - t0}ms — in=${data?.usage?.prompt_tokens ?? "?"} out=${data?.usage?.completion_tokens ?? "?"} finish=${choice?.finish_reason ?? "?"}`
      );

      if (isLengthStop(choice)) {
        // Retrying would hit the same limit, so keep what was finished.
        const partial = salvageTruncatedJSON(content);
        if (partial) {
          console.warn(`[${label}] output hit max_tokens=${maxTokens}; kept the complete items only`);
          return { json: partial, usage, truncated: true };
        }
        const cut = new Error(`AI output was cut off at ${maxTokens} tokens and could not be recovered`);
        cut.noRetry = true; // a retry would hit the same limit and cost the same again
        throw cut;
      }

      return { json: parseJSON(content), usage, truncated: false };
    } catch (e) {
      lastErr = e.name === "AbortError" ? Object.assign(new Error(`AI call timed out after ${Math.round((Date.now() - t0) / 1000)} s`), { timeout: true, noRetry: true }) : e;
      console.warn(`[${label}] attempt ${attempt} failed: ${lastErr.message}`);
      if (lastErr.noRetry) break;
      if (lastErr.status === 429 || lastErr.status >= 500) await new Promise((r) => setTimeout(r, 1500));
    } finally {
      clearTimeout(timer);
    }
  }
  lastErr.usage = usage; // failed calls can still cost money; let the caller record it
  throw lastErr;
}
