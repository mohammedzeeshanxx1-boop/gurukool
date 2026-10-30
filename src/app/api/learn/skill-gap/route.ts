import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Student, DEMO_KEY } from "@/models";
import { apiError, badRequest } from "@/lib/api";
import { analyzeSkillGap, isCareerGoal } from "@/lib/careers";
import { chat, isAiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { goal } = await req.json().catch(() => ({}));
    if (!isCareerGoal(goal)) return badRequest("Pick a valid career goal");
    await connectDB();
    const student = await Student.findOne({ key: DEMO_KEY }).lean();
    if (!student) return badRequest("Save your student profile first (Dashboard).");

    const analysis = analyzeSkillGap(student.skills ?? [], goal);

    let explanation: string | null = null;
    let aiError: string | null = null;
    if (isAiConfigured()) {
      try {
        explanation = await chat(
          [
            { role: "system", content: "You are a concise engineering career mentor for Indian engineering students. Use short markdown-free paragraphs or '-' bullets. Max 180 words." },
            {
              role: "user",
              content: `Student: ${student.branch}, semester ${student.semester}. Goal: ${goal}.
Existing relevant skills: ${analysis.existing.join(", ") || "none"}.
Missing skills (in priority order): ${analysis.missing.join(", ") || "none"}.
Explain the most important gaps, why they matter for a ${goal} role, and what to learn first this month.`,
            },
          ],
          { maxTokens: 400 }
        );
      } catch (e) {
        aiError = e instanceof Error ? e.message : String(e);
      }
    }
    return NextResponse.json({ analysis, explanation, aiConfigured: isAiConfigured(), aiError });
  } catch (e) {
    return apiError(e);
  }
}
