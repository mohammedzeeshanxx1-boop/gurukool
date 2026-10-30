import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureTrainSeed } from "@/lib/train/seed";
import { courseSummary } from "@/lib/train/core";
import { apiError, badRequest, cleanList } from "@/lib/api";
import { getPersona, requireRole } from "@/lib/persona";
import { matchTerm } from "@/lib/mentor-matching/match";
import { Mentor } from "@/models/connect";
import { DIFFICULTIES, TRAIN_CATEGORIES, TrainingCourse, TrainingEnrollment, type CourseT } from "@/models/train";

export const dynamic = "force-dynamic";

// GET /api/train/courses?q=&category=&difficulty= — published catalog (+ trainer's own drafts).
export async function GET(req: Request) {
  try {
    await connectDB();
    await ensureTrainSeed();
    const p = await getPersona();
    const sp = new URL(req.url).searchParams;
    const q = (sp.get("q") ?? "").trim().slice(0, 60);
    const category = sp.get("category") ?? "";
    const difficulty = sp.get("difficulty") ?? "";
    const vis = p.role === "mentor" ? { $or: [{ published: true }, { trainerId: p.id }] } : { published: true };
    const filter: Record<string, unknown> = { ...vis };
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    let courses = (await TrainingCourse.find(filter).sort({ isDemo: 1, createdAt: -1 }).lean()) as unknown as CourseT[];
    if (q) courses = courses.filter((c) => matchTerm(q, [c.title, c.category, ...c.skillTags, ...c.modules.map((m) => m.title)]));

    const trainers = await Mentor.find({ _id: { $in: courses.map((c) => c.trainerId) } }).select("name designation isDemo").lean<{ _id: unknown; name: string; designation: string; isDemo: boolean }[]>();
    const tmap = new Map(trainers.map((t) => [String(t._id), t]));
    const enrolled = p.role === "student"
      ? new Set((await TrainingEnrollment.find({ studentId: p.id }).select("courseId").lean<{ courseId: unknown }[]>()).map((e) => String(e.courseId)))
      : new Set<string>();
    return NextResponse.json({
      courses: courses.map((c) => ({ ...courseSummary(c, tmap.get(String(c.trainerId))), enrolled: enrolled.has(String(c._id)), isOwner: p.role === "mentor" && p.id === String(c.trainerId) })),
      facets: { categories: TRAIN_CATEGORIES, difficulties: DIFFICULTIES },
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST — a trainer (existing mentor persona) creates a course. Starts unpublished.
export async function POST(req: Request) {
  try {
    const p = await requireRole("mentor");
    const b = await req.json().catch(() => null);
    if (!b) return badRequest("Invalid JSON body");
    const title = String(b.title ?? "").trim().slice(0, 140);
    const description = String(b.description ?? "").trim().slice(0, 3000);
    const durationWeeks = Number(b.durationWeeks);
    if (title.length < 5) return badRequest("Title must be at least 5 characters");
    if (description.length < 20) return badRequest("Description must be at least 20 characters");
    if (!(TRAIN_CATEGORIES as readonly string[]).includes(b.category)) return badRequest("Pick a valid category");
    if (!(DIFFICULTIES as readonly string[]).includes(b.difficulty)) return badRequest("Pick a valid difficulty");
    if (!Number.isInteger(durationWeeks) || durationWeeks < 1 || durationWeeks > 52) return badRequest("Duration must be 1–52 weeks");
    const skillTags = cleanList(b.skillTags);
    if (!skillTags.length) return badRequest("Add at least one skill tag");
    await connectDB();
    const c = await TrainingCourse.create({ title, description, trainerId: p.id, category: b.category, difficulty: b.difficulty, durationWeeks, skillTags, modules: [], published: false, isDemo: false });
    return NextResponse.json({ course: { id: String(c._id) } }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
