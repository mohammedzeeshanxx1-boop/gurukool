import { NextResponse } from "next/server";
import { apiError, badRequest } from "@/lib/api";
import { chat, type ChatMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

const SYSTEM = `You are GURUKOOL's coding mentor for engineering students.
You explain code, help debug errors, give hints, and answer programming questions.
Be concise and practical. Prefer hints that teach over full solutions unless the student asks for the full answer.
Use short paragraphs and fenced code blocks for code.`;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const question = String(body?.question ?? "").trim();
    if (!question) return badRequest("Ask a question");
    const code = String(body?.code ?? "").slice(0, 12000);
    const output = String(body?.output ?? "").slice(0, 3000);
    const history: ChatMessage[] = Array.isArray(body?.history)
      ? body.history
          .filter((m: ChatMessage) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
          .slice(-8)
          .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [];

    const context = `Current editor code (JavaScript):\n\`\`\`js\n${code || "// (empty)"}\n\`\`\`\n${
      output ? `Latest console output:\n\`\`\`\n${output}\n\`\`\`\n` : ""
    }\nStudent question: ${question.slice(0, 2000)}`;

    const reply = await chat([{ role: "system", content: SYSTEM }, ...history, { role: "user", content: context }], {
      maxTokens: 900,
    });
    return NextResponse.json({ reply });
  } catch (e) {
    return apiError(e);
  }
}
