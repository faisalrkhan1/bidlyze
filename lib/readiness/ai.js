// Single place that talks to the AI model (via OpenRouter).
//
// Model is set by the AI_MODEL environment variable so it can be changed in
// Vercel without a code change. Default: Claude Sonnet 5.5.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

export function currentModel() {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

function parseJSON(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("No JSON object in AI response");
  return JSON.parse(t.slice(a, b + 1));
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
 */
export async function askJSON({ system, document, task, maxTokens = 12000, label = "ai" }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const userContent = [];
  if (document) {
    userContent.push({
      type: "text",
      text: `<tender_documents>\n${document}\n</tender_documents>`,
      cache_control: { type: "ephemeral" },
    });
  }
  userContent.push({ type: "text", text: task });

  const body = {
    model: currentModel(),
    max_tokens: maxTokens,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  };

  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch(OPENROUTER_URL, {
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
        throw new Error(`AI service returned ${res.status}`);
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      const usage = data?.usage || {};
      console.log(
        `[${label}] ${currentModel()} ok in ${Date.now() - t0}ms — in=${usage.prompt_tokens ?? "?"} out=${usage.completion_tokens ?? "?"}`
      );
      return { json: parseJSON(content), usage };
    } catch (e) {
      lastErr = e;
      console.warn(`[${label}] attempt ${attempt} failed: ${e.message}`);
    }
  }
  throw lastErr;
}
