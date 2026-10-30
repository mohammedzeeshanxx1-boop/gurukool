import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Assessment, Roadmap, Student, DEMO_KEY } from "@/models";
import { apiError, badRequest } from "@/lib/api";
import { analyzeSkillGap, isCareerGoal, youtubeSearchUrl } from "@/lib/careers";
import { chatJSON, isAiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";

type Stage = { topic: string; description: string; duration: string };

function rulesRoadmap(goal: string, missing: string[], weak: string[], existing: string[]): Stage[] {
  // Weak assessment topics are revised first, then missing skills in priority order, then a capstone.
  const ordered = [...new Set([...weak, ...missing])];
  const stages: Stage[] = ordered.map((topic) => ({
    topic,
    description: weak.includes(topic)
      ? `Revise ${topic}: you missed questions on it in your assessment. Re-learn the fundamentals and solve 15–20 practice problems.`
      : `Learn ${topic} from scratch: core concepts, then build a small exercise that uses it.`,
    duration: weak.includes(topic) && existing.includes(topic) ? "1 week" : "2 weeks",
  }));
  stages.push({
    topic: `${goal} Capstone Project`,
    description: `Build and deploy a portfolio project that combines ${[...existing, ...missing].slice(0, 4).join(", ")}. Push it to GitHub with a README.`,
    duration: "3 weeks",
  });
  return stages.slice(0, 10);
}

function validStages(x: unknown): Stage[] | null {
  const arr = (x as { stages?: unknown })?.stages;
  if (!Array.isArray(arr) || arr.length < 3) return null;
  const out = arr.slice(0, 10).map((s) => ({
    topic: String(s?.topic ?? "").slice(0, 120),
    description: String(s?.description ?? "").slice(0, 600),
    duration: String(s?.duration ?? "").slice(0, 40),
  }));
  return out.every((s) => s.topic && s.description) ? out : null;
}

export async function POST(req: Request) {
  try {
    const { goal } = await req.json().catch(() => ({}));
    if (!isCareerGoal(goal)) return badRequest("Pick a valid career goal");
    await connectDB();
    const student = await Student.findOne({ key: DEMO_KEY }).lean();
    if (!student) return badRequest("Save your student profile first (Dashboard).");

    const gap = analyzeSkillGap(student.skills ?? [], goal);
    const lastAssessment = await Assessment.findOne({ studentKey: DEMO_KEY, careerGoal: goal, submittedAt: { $ne: null } })
      .sort({ submittedAt: -1 })
      .lean<{ score: number; total: number; weakTopics: string[] }>();
    const weak = lastAssessment?.weakTopics ?? [];

    let stages: Stage[] | null = null;
    let source: "ai" | "rules" = "rules";
    let aiError: string | null = null;

    if (isAiConfigured()) {
      try {
        const data = await chatJSON<unknown>([
          { role: "system", content: "You are an expert engineering learning-path designer. Respond with JSON only." },
          {
            role: "user",
            content: `Design a step-by-step learning roadmap (5 to 8 stages) for a semester-${student.semester} ${student.branch} student to become a ${goal}.
Already knows: ${gap.existing.join(", ") || "nothing relevant yet"}.
Missing skills (priority order): ${gap.missing.join(", ") || "none"}.
Assessment: ${lastAssessment ? `${lastAssessment.score}/${lastAssessment.total}, weak topics: ${weak.join(", ") || "none"}` : "not taken yet"}.
Address weak topics early, then missing skills, finish with a portfolio project.
Each stage "topic" must be a short searchable topic name (2-6 words).
Return JSON: {"stages":[{"topic":string,"description":string (1-2 sentences, concrete),"duration":string like "2 weeks"}]}`,
          },
        ]);
        stages = validStages(data);
        if (stages) source = "ai";
        else aiError = "AI returned a malformed roadmap; generated a rule-based roadmap instead.";
      } catch (e) {
        aiError = `AI generation failed (${e instanceof Error ? e.message : e}); generated a rule-based roadmap instead.`;
      }
    }
    if (!stages) stages = rulesRoadmap(goal, gap.missing, weak, gap.existing);

    const roadmap = await Roadmap.create({
      studentKey: DEMO_KEY,
      careerGoal: goal,
      source,
      basedOn: { missingSkills: gap.missing, weakTopics: weak },
      stages: stages.map((s) => ({ ...s, youtubeUrl: youtubeSearchUrl(s.topic), completed: false })),
    });
    return NextResponse.json({ roadmap: roadmap.toObject(), aiConfigured: isAiConfigured(), aiError });
  } catch (e) {
    return apiError(e);
  }
}

export async function GET() {
  try {
    await connectDB();
    const roadmap = await Roadmap.findOne({ studentKey: DEMO_KEY }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ roadmap });
  } catch (e) {
    return apiError(e);
  }
}
