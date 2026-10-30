import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureTrainSeed } from "@/lib/train/seed";
import { apiError } from "@/lib/api";
import { getPersona } from "@/lib/persona";
import { CAREER_REQUIREMENTS, analyzeSkillGap, isCareerGoal } from "@/lib/careers";
import { TRAIN_WEIGHTS, recommendTraining } from "@/lib/training-matching";
import { Assessment, Roadmap, Student } from "@/models";
import { TrainingCourse, TrainingEnrollment, type CourseT } from "@/models/train";

export const dynamic = "force-dynamic";

// GET — training programs matched to the student's EXISTING skill-gap, assessment and roadmap outputs.
export async function GET() {
  try {
    const p = await getPersona();
    if (p.role !== "student") return NextResponse.json({ recommendations: [], reason: "Training recommendations are shown for the student persona." });
    await connectDB();
    await ensureTrainSeed();
    const student = await Student.findOne({ key: p.id }).lean<{ skills: string[]; careerGoal: string; interests: string[] }>();
    if (!student) return NextResponse.json({ recommendations: [], reason: "Save your student profile to get training recommendations." });
    const goal = student.careerGoal;
    const gap = isCareerGoal(goal) ? analyzeSkillGap(student.skills ?? [], goal) : null;
    const [assessment, roadmap] = await Promise.all([
      Assessment.findOne({ studentKey: p.id, submittedAt: { $ne: null } }).sort({ submittedAt: -1 }).lean<{ weakTopics: string[] }>(),
      Roadmap.findOne({ studentKey: p.id }).sort({ createdAt: -1 }).lean<{ stages: { topic: string; completed: boolean }[] }>(),
    ]);
    const signals = {
      careerGoal: goal,
      requiredSkills: isCareerGoal(goal) ? CAREER_REQUIREMENTS[goal].map((r) => r.skill) : [],
      missingSkills: gap?.missing ?? [],
      weakTopics: assessment?.weakTopics ?? [],
      roadmapTopics: (roadmap?.stages ?? []).filter((s) => !s.completed).map((s) => s.topic),
      interests: student.interests ?? [],
    };
    const courses = (await TrainingCourse.find({ published: true }).lean()) as unknown as CourseT[];
    const enrolled = new Set((await TrainingEnrollment.find({ studentId: p.id }).select("courseId").lean<{ courseId: unknown }[]>()).map((e) => String(e.courseId)));
    const cmap = new Map(courses.map((c) => [String(c._id), c]));
    const recs = recommendTraining(
      courses.map((c) => ({ id: String(c._id), title: c.title, category: c.category, skillTags: c.skillTags, moduleTitles: c.modules.map((m) => m.title) })),
      signals
    ).map((r) => {
      const c = cmap.get(r.courseId)!;
      return { ...r, course: { id: r.courseId, title: c.title, difficulty: c.difficulty, durationWeeks: c.durationWeeks, moduleCount: c.modules.length, isDemo: c.isDemo }, enrolled: enrolled.has(r.courseId) };
    });
    return NextResponse.json({
      recommendations: recs,
      basedOn: signals,
      method: `GURUKOOL Training Recommender: ${TRAIN_WEIGHTS.weakSkills}·weak skills + ${TRAIN_WEIGHTS.roadmap}·roadmap + ${TRAIN_WEIGHTS.careerGoal}·career goal (deterministic, no AI)`,
    });
  } catch (e) {
    return apiError(e);
  }
}
