// Server-only AI client for any OpenAI-compatible Chat Completions API.
// Secrets are read from process.env and never sent to the browser.
import "server-only";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Set AI_API_KEY, AI_MODEL and AI_BASE_URL in .env.local and restart.");
  }
}

export function isAiConfigured() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_MODEL && process.env.AI_BASE_URL);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: ChatMessage[], opts: { json?: boolean; maxTokens?: number } = {}) {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  const base = process.env.AI_BASE_URL!.replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 1500,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI API returned an empty response.");
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
