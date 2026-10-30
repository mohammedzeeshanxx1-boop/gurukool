import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureTrainSeed } from "@/lib/train/seed";
import { courseSummary, fmtIST, lessonIds } from "@/lib/train/core";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { Student } from "@/models";
import { TrainingCourse, TrainingEnrollment, TrainingSession, TrainingSubmission, type CourseT } from "@/models/train";

export const dynamic = "force-dynamic";

// GET — trainer dashboard for the acting mentor persona: own courses, enrolled students, sessions, review queue size.
export async function GET() {
  try {
    const p = await requireRole("mentor");
    await connectDB();
    await ensureTrainSeed();
    const courses = (await TrainingCourse.find({ trainerId: p.id }).sort({ createdAt: -1 }).lean()) as unknown as CourseT[];
    const ids = courses.map((c) => c._id);
    const [enrollments, pending, sessions] = await Promise.all([
      TrainingEnrollment.find({ courseId: { $in: ids } }).lean<{ courseId: unknown; studentId: string; completedLessonIds: string[]; enrolledAt: Date }[]>(),
      TrainingSubmission.countDocuments({ courseId: { $in: ids }, status: "SUBMITTED" }),
      TrainingSession.find({ trainerId: p.id, status: "SCHEDULED" }).sort({ startAt: 1 }).lean<{ _id: unknown; courseId: unknown; title: string; startAt: Date; endAt: Date; status: string }[]>(),
    ]);
    const students = await Student.find({ key: { $in: enrollments.map((e) => e.studentId) } }).select("key name").lean<{ key: string; name: string }[]>();
    const sname = new Map(students.map((s) => [s.key, s.name]));
    const cmap = new Map(courses.map((c) => [String(c._id), c]));
    return NextResponse.json({
      courses: courses.map((c) => ({ ...courseSummary(c), enrolledCount: enrollments.filter((e) => String(e.courseId) === String(c._id)).length })),
      students: enrollments.map((e) => {
        const c = cmap.get(String(e.courseId))!;
        const all = lessonIds(c);
        const done = e.completedLessonIds.filter((x) => all.includes(x)).length;
        return { courseId: String(c._id), courseTitle: c.title, name: sname.get(e.studentId) ?? "Student", enrolledAt: e.enrolledAt, engagementPct: all.length ? Math.round((done / all.length) * 100) : 0 };
      }),
      pendingReviews: pending,
      sessions: sessions.map((s) => ({ id: String(s._id), courseId: String(s.courseId), courseTitle: cmap.get(String(s.courseId))?.title ?? "", title: s.title, startAt: s.startAt, when: fmtIST(s.startAt), status: s.status, started: new Date(s.startAt) <= new Date() })),
    });
  } catch (e) {
    return apiError(e);
  }
}
