import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { lessonIds, loadCourse, requireEnrollment } from "@/lib/train/core";
import { apiError, badRequest, notFound } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { TrainingEnrollment } from "@/models/train";

export const dynamic = "force-dynamic";

// POST {courseId, lessonId, completed} — marks lesson completion (engagement progress, not mastery).
export async function POST(req: Request) {
  try {
    const p = await requireRole("student");
    const b = await req.json().catch(() => null);
    if (!b || typeof b.completed !== "boolean") return badRequest("Invalid request");
    await connectDB();
    const c = await loadCourse(String(b.courseId ?? ""));
    if (!c) return notFound("Course not found");
    const lessonId = String(b.lessonId ?? "");
    if (!lessonIds(c).includes(lessonId)) return badRequest("Lesson is not part of this course");
    await requireEnrollment(p, c._id);
    const updated = await TrainingEnrollment.findOneAndUpdate(
      { studentId: p.id, courseId: c._id },
      b.completed ? { $addToSet: { completedLessonIds: lessonId } } : { $pull: { completedLessonIds: lessonId } },
      { new: true }
    ).lean<{ completedLessonIds: string[] }>();
    const all = lessonIds(c);
    const done = (updated?.completedLessonIds ?? []).filter((x) => all.includes(x));
    return NextResponse.json({ completedLessonIds: done, engagementPct: Math.round((done.length / all.length) * 100) });
  } catch (e) {
    return apiError(e);
  }
}
