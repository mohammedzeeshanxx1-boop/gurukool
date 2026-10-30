import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { loadCourse } from "@/lib/train/core";
import { apiError, badRequest, conflict, isDupKey, notFound } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { Student } from "@/models";
import { TrainingEnrollment } from "@/models/train";

export const dynamic = "force-dynamic";

// POST — student enrolls. Unique index (studentId, courseId) prevents duplicates at the database level.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const p = await requireRole("student");
    const { id } = await ctx.params;
    await connectDB();
    const c = await loadCourse(id);
    if (!c || !c.published) return notFound("Course not found");
    if (!(await Student.exists({ key: p.id }))) return badRequest("Save your student profile on the Dashboard first.");
    try {
      const e = await TrainingEnrollment.create({ studentId: p.id, courseId: c._id, completedLessonIds: [] });
      return NextResponse.json({ enrollment: { id: String(e._id), enrolledAt: e.enrolledAt } }, { status: 201 });
    } catch (e) {
      if (isDupKey(e)) return conflict("You're already enrolled in this course.");
      throw e;
    }
  } catch (e) {
    return apiError(e);
  }
}
