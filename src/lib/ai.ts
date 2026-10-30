// Server-only AI client for any OpenAI-compatible Chat Completions API.
// Secrets are read from process.env and never sent to the browser.
import "server-only";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Set AI_API_KEY, AI_MODEL and AI_BASE_URL in .env.local and restart.");
  }
}

// Tolerate common .env mistakes: surrounding quotes, spaces, trailing slashes.
const env = (k: string) => (process.env[k] ?? "").trim().replace(/^["']|["']$/g, "").trim();
const cfg = () => ({
  key: env("AI_API_KEY"),
  model: env("AI_MODEL"),
  base: env("AI_BASE_URL").replace(/\/+$/, ""),
});

export function isAiConfigured() {
  const c = cfg();
  return Boolean(c.key && c.model && c.base);
}

export function aiModel() {
  return cfg().model;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: ChatMessage[], opts: { json?: boolean; maxTokens?: number } = {}) {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  const { key, model, base } = cfg();
  if (!/^https?:\/\//.test(base)) throw new Error(`AI_BASE_URL must start with https:// (got "${base}")`);
  const url = `${base}/chat/completions`;
  // Reasoning models (gpt-oss, qwen3, o-series, deepseek-r1) spend tokens "thinking" before answering,
  // so give them extra budget and keep reasoning light for fast demo responses.
  const reasoning = /gpt-oss|qwen3|deepseek-r1|(^|\/)o\d/i.test(model);
  const maxTokens = (opts.maxTokens ?? 1500) + (reasoning ? 2500 : 0);
  let res: Response;
  try {
    res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
      ...(reasoning && /gpt-oss/i.test(model) ? { reasoning_effort: "low" } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(60000),
    });
  } catch (e) {
    // Surface the real network cause (DNS, TLS, timeout, connection reset) instead of "fetch failed".
    const err = e as Error & { cause?: { code?: string; message?: string } };
    const cause = err.cause?.code || err.cause?.message || err.name;
    const hint =
      cause === "ENOTFOUND" ? "host not found: check AI_BASE_URL spelling or your internet/DNS"
      : /TIMEOUT|ETIMEDOUT|TimeoutError/i.test(String(cause)) ? "timed out: your network may be blocking this host (try a phone hotspot)"
      : /ECONNRESET|ECONNREFUSED/.test(String(cause)) ? "connection blocked/reset: firewall or college network (try a phone hotspot)"
      : /CERT|SSL|TLS/i.test(String(cause)) ? "TLS/certificate problem: a network proxy may be intercepting HTTPS"
      : "network error";
    throw new Error(`Cannot reach ${new URL(url).host} (${cause}): ${hint}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const raw: string | undefined = data?.choices?.[0]?.message?.content;
  // Some reasoning models inline their thinking in <think> tags; never show it to students.
  const content = raw?.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!content) throw new Error("AI API returned an empty response (try a non-reasoning model or retry).");
  return content;
}

/** Ask for JSON and parse it robustly (strips ```json fences some models add). */
export async function chatJSON<T>(messages: ChatMessage[], maxTokens = 2000): Promise<T> {
  let raw: string;
  try {
    raw = await chat(messages, { json: true, maxTokens });
  } catch (e) {
    // Some providers reject response_format; retry without it.
    if (e instanceof AiNotConfiguredError) throw e;
    raw = await chat(messages, { maxTokens });
  }
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.search(/[[{]/);
  return JSON.parse(start > 0 ? cleaned.slice(start) : cleaned) as T;
}
