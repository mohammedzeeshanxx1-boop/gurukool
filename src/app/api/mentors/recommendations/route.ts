import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Mentor, type MentorT } from "@/models/connect";
import { Assessment, Roadmap, Student } from "@/models";
import { apiError } from "@/lib/api";
import { getPersona } from "@/lib/persona";
import { discoverableMentor } from "@/lib/notify";
import { CAREER_REQUIREMENTS, analyzeSkillGap, isCareerGoal } from "@/lib/careers";
import { recommendMentors, WEIGHTS } from "@/lib/recommend";

export const dynamic = "force-dynamic";

// GET /api/mentors/recommendations?limit=3 — explainable matches for the current student's LEARN data.
export async function GET(req: Request) {
  try {
    const p = await getPersona();
    if (p.role !== "student") return NextResponse.json({ recommendations: [], reason: "Recommendations are shown for the student persona." });
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 3, 1), 6);
    await connectDB();
    await ensureSeed();
    const student = await Student.findOne({ key: p.id }).lean<{ skills: string[]; careerGoal: string; interests: string[] }>();
    if (!student) return NextResponse.json({ recommendations: [], reason: "Save your student profile to get mentor recommendations." });

    const goal = student.careerGoal;
    const gap = isCareerGoal(goal) ? analyzeSkillGap(student.skills ?? [], goal) : null;
    const [assessment, roadmap] = await Promise.all([
      Assessment.findOne({ studentKey: p.id, submittedAt: { $ne: null } }).sort({ submittedAt: -1 }).lean<{ weakTopics: string[] }>(),
      Roadmap.findOne({ studentKey: p.id }).sort({ createdAt: -1 }).lean<{ stages: { topic: string; completed: boolean }[] }>(),
    ]);
    // Reads existing Skill Intelligence outputs only (skill gap, saved assessment, saved roadmap).
    const ctx = {
      careerGoal: goal,
      requiredSkills: isCareerGoal(goal) ? CAREER_REQUIREMENTS[goal].map((r) => r.skill) : [],
      weakTopics: assessment?.weakTopics ?? [],
      roadmapTopics: (roadmap?.stages ?? []).filter((s) => !s.completed).map((s) => s.topic),
      missingSkills: gap?.missing ?? [],
      interests: student.interests ?? [],
    };
    const mentors = (await Mentor.find({ profileStatus: "active", ...discoverableMentor() }).lean()) as unknown as MentorT[];
    return NextResponse.json({
      recommendations: recommendMentors(mentors, ctx, limit),
      basedOn: ctx,
      engine: "GURUKOOL Mentor Match Engine (deterministic, no external AI)",
      method: `score = ${WEIGHTS.weakness}·weakness + ${WEIGHTS.roadmap}·roadmap + ${WEIGHTS.careerGoal}·career goal + ${WEIGHTS.availability}·weekend availability (each normalised 0–1)`,
    });
  } catch (e) {
    return apiError(e);
  }
}
