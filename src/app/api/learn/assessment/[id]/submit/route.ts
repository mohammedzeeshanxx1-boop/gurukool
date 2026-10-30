import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Assessment, DEMO_KEY } from "@/models";
import { apiError, badRequest } from "@/lib/api";
import type { MCQ } from "@/lib/questionBank";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return badRequest("Invalid assessment id");
    const { answers } = await req.json().catch(() => ({}));
    await connectDB();
    const a = await Assessment.findOne({ _id: id, studentKey: DEMO_KEY });
    if (!a) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    if (a.submittedAt) return badRequest("This assessment was already submitted");
    const qs = a.questions as MCQ[];
    if (!Array.isArray(answers) || answers.length !== qs.length || answers.some((x) => !Number.isInteger(x) || x < 0 || x > 3))
      return badRequest(`Answer all ${qs.length} questions`);

    let score = 0;
    const weak = new Set<string>();
    const results = qs.map((q, i) => {
      const correct = answers[i] === q.answerIndex;
      if (correct) score++;
      else weak.add(q.topic);
      return { question: q.question, options: q.options, topic: q.topic, selected: answers[i], answerIndex: q.answerIndex, correct, explanation: q.explanation };
    });

    a.answers = answers;
    a.score = score;
    a.weakTopics = [...weak];
    a.submittedAt = new Date();
    await a.save();

    return NextResponse.json({ score, total: qs.length, weakTopics: [...weak], results, saved: true });
  } catch (e) {
    return apiError(e);
  }
}
