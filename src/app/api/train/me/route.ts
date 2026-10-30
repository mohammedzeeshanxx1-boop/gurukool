import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureTrainSeed } from "@/lib/train/seed";
import { fmtIST, lessonIds } from "@/lib/train/core";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { Mentor, MentorSession } from "@/models/connect";
import { TrainingAssignment, TrainingCourse, TrainingEnrollment, TrainingSession, TrainingSubmission, type CourseT } from "@/models/train";

export const dynamic = "force-dynamic";

// GET — the student's training dashboard: enrollments with progress, upcoming live classes, feedback.
export async function GET() {
  try {
    const p = await requireRole("student");
    await connectDB();
    await ensureTrainSeed();
    const enrollments = await TrainingEnrollment.find({ studentId: p.id }).sort({ enrolledAt: -1 }).lean<{ _id: unknown; courseId: unknown; completedLessonIds: string[]; enrolledAt: Date; showInPortfolio: boolean }[]>();
    const courseIds = enrollments.map((e) => e.courseId);
    const [courses, subs, assignments, sessions] = await Promise.all([
      TrainingCourse.find({ _id: { $in: courseIds }, published: true }).lean() as unknown as Promise<CourseT[]>, // withdrawn courses are hidden
      TrainingSubmission.find({ studentId: p.id }).lean<{ assignmentId: unknown; courseId: unknown; status: string; score: number | null; feedback: string; reviewedAt: Date | null }[]>(),
      TrainingAssignment.find({ courseId: { $in: courseIds } }).select("courseId title maxMarks dueAt").lean<{ _id: unknown; courseId: unknown; title: string; maxMarks: number; dueAt: Date }[]>(),
      TrainingSession.find({ courseId: { $in: courseIds }, status: "SCHEDULED", endAt: { $gt: new Date() } }).sort({ startAt: 1 }).lean<{ _id: unknown; courseId: unknown; trainerId: unknown; title: string; agenda: string; startAt: Date; endAt: Date; status: string; isDemo: boolean }[]>(),
    ]);
    const cmap = new Map(courses.map((c) => [String(c._id), c]));
    const liveSessions = sessions.filter((s) => cmap.has(String(s.courseId)));
    const amap = new Map(assignments.map((a) => [String(a._id), a]));
    const trainers = await Mentor.find({ _id: { $in: [...courses.map((c) => c.trainerId), ...sessions.map((s) => s.trainerId)] } }).select("name").lean<{ _id: unknown; name: string }[]>();
    const tname = new Map(trainers.map((t) => [String(t._id), t.name]));

    const mentorship = await MentorSession.find({ studentId: p.id, status: "ACCEPTED", requestedEndAt: { $gt: new Date() } }).sort({ requestedStartAt: 1 })
      .lean<{ _id: unknown; mentorId: unknown; mentorName: string; topic: string; requestedStartAt: Date; requestedEndAt: Date; durationMinutes: number }[]>();
    return NextResponse.json({
      mentorshipSessions: mentorship.map((m) => ({ id: String(m._id), mentorId: String(m.mentorId), mentor: m.mentorName, topic: m.topic, startAt: m.requestedStartAt, endAt: m.requestedEndAt, when: fmtIST(m.requestedStartAt), durationMinutes: m.durationMinutes })),
      enrollments: enrollments.filter((e) => cmap.has(String(e.courseId))).map((e) => {
        const c = cmap.get(String(e.courseId))!;
        const all = lessonIds(c);
        const done = e.completedLessonIds.filter((x) => all.includes(x)).length;
        const cs = subs.filter((s) => String(s.courseId) === String(c._id));
        const reviewed = cs.filter((s) => s.status === "REVIEWED");
        const pct = reviewed.length ? Math.round((reviewed.reduce((t, s) => t + (s.score ?? 0) / (amap.get(String(s.assignmentId))?.maxMarks ?? 1), 0) / reviewed.length) * 100) : null;
        const totalAssignments = assignments.filter((a) => String(a.courseId) === String(c._id)).length;
        return {
          id: String(e._id), courseId: String(c._id), title: c.title, trainer: tname.get(String(c.trainerId)) ?? "Trainer", isDemo: c.isDemo,
          enrolledAt: e.enrolledAt, showInPortfolio: e.showInPortfolio,
          completedLessons: done, totalLessons: all.length, engagementPct: all.length ? Math.round((done / all.length) * 100) : 0,
          submitted: cs.length, reviewed: reviewed.length, totalAssignments, demonstratedPct: pct,
          completed: all.length > 0 && done === all.length && totalAssignments > 0 && reviewed.length === totalAssignments,
        };
      }),
      upcomingSessions: liveSessions.map((s) => ({
        id: String(s._id), courseId: String(s.courseId), courseTitle: cmap.get(String(s.courseId))?.title ?? "", title: s.title, agenda: s.agenda,
        trainer: tname.get(String(s.trainerId)) ?? "Trainer", startAt: s.startAt, endAt: s.endAt, when: fmtIST(s.startAt),
        durationMinutes: Math.round((new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 60000), status: s.status, isDemo: s.isDemo,
      })),
      feedback: subs.filter((s) => s.status === "REVIEWED" && cmap.has(String(s.courseId))).sort((a, b) => +new Date(b.reviewedAt ?? 0) - +new Date(a.reviewedAt ?? 0)).slice(0, 10).map((s) => {
        const a = amap.get(String(s.assignmentId));
        return { assignmentTitle: a?.title ?? "", courseId: String(s.courseId), courseTitle: cmap.get(String(s.courseId))?.title ?? "", score: s.score, maxMarks: a?.maxMarks ?? 0, feedback: s.feedback, reviewedAt: s.reviewedAt };
      }),
    });
  } catch (e) {
    return apiError(e);
  }
}
