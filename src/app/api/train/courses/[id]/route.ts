import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureTrainSeed } from "@/lib/train/seed";
import { assertTrainer, courseSummary, fmtIST, isTrainer, lessonIds, loadCourse } from "@/lib/train/core";
import { apiError, badRequest, cleanList, notFound } from "@/lib/api";
import { getPersona } from "@/lib/persona";
import { Mentor } from "@/models/connect";
import { DIFFICULTIES, TRAIN_CATEGORIES, TrainingAssignment, TrainingCourse, TrainingEnrollment, TrainingSession, TrainingSubmission } from "@/models/train";

export const dynamic = "force-dynamic";

type A = { _id: unknown; moduleId: string; title: string; description: string; instructions: string; skillTags: string[]; dueAt: Date; maxMarks: number };
type Sub = { _id: unknown; assignmentId: unknown; status: string; score: number | null; feedback: string; submissionText: string; repositoryUrl: string; projectUrl: string; submittedAt: Date; reviewedAt: Date | null };
type S = { _id: unknown; title: string; agenda: string; startAt: Date; endAt: Date; status: string; isDemo: boolean };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await connectDB();
    await ensureTrainSeed();
    const c = await loadCourse(id);
    const p = await getPersona();
    const owner = c ? isTrainer(p, c) : false;
    if (!c || (!c.published && !owner)) return notFound("Course not found");

    const [trainer, assignments, sessions] = await Promise.all([
      Mentor.findById(c.trainerId).select("name designation isDemo").lean<{ name: string; designation: string; isDemo: boolean }>(),
      TrainingAssignment.find({ courseId: c._id }).sort({ dueAt: 1 }).lean<A[]>(),
      TrainingSession.find({ courseId: c._id, status: { $ne: "CANCELLED" }, endAt: { $gt: new Date(Date.now() - 7 * 86400000) } }).sort({ startAt: 1 }).lean<S[]>(),
    ]);
    const enrollment = p.role === "student"
      ? await TrainingEnrollment.findOne({ studentId: p.id, courseId: c._id }).lean<{ _id: unknown; completedLessonIds: string[]; enrolledAt: Date; showInPortfolio: boolean }>()
      : null;
    const subs = enrollment
      ? await TrainingSubmission.find({ studentId: p.id, courseId: c._id }).lean<Sub[]>()
      : [];
    const subBy = new Map(subs.map((s) => [String(s.assignmentId), s]));
    const canSeeContent = owner || Boolean(enrollment);
    const allLessons = lessonIds(c);
    const done = enrollment ? enrollment.completedLessonIds.filter((x) => allLessons.includes(x)) : [];
    const reviewed = subs.filter((s) => s.status === "REVIEWED");
    const maxBy = new Map(assignments.map((a) => [String(a._id), a.maxMarks]));
    const pct = reviewed.length ? Math.round((reviewed.reduce((t, s) => t + (s.score ?? 0) / (maxBy.get(String(s.assignmentId)) ?? 1), 0) / reviewed.length) * 100) : null;

    return NextResponse.json({
      course: {
        ...courseSummary(c, trainer),
        modules: c.modules.map((m) => ({
          id: String(m._id), title: m.title, summary: m.summary,
          lessons: m.lessons.map((l) => ({
            id: String(l._id), title: l.title, durationMinutes: l.durationMinutes, objectives: l.objectives,
            explanation: canSeeContent ? l.explanation : null, // full lesson content for enrolled students / trainer
          })),
        })),
      },
      assignments: assignments.map((a) => {
        const s = subBy.get(String(a._id));
        return {
          id: String(a._id), moduleId: a.moduleId, title: a.title, description: a.description, instructions: a.instructions,
          skillTags: a.skillTags, dueAt: a.dueAt, due: fmtIST(a.dueAt), maxMarks: a.maxMarks,
          mySubmission: s ? {
            id: String(s._id), status: s.status, score: s.score, feedback: s.feedback, submissionText: s.submissionText,
            repositoryUrl: s.repositoryUrl, projectUrl: s.projectUrl, submittedAt: s.submittedAt, late: new Date(s.submittedAt) > new Date(a.dueAt),
          } : null,
        };
      }),
      sessions: sessions.map((s) => ({ id: String(s._id), title: s.title, agenda: s.agenda, startAt: s.startAt, endAt: s.endAt, when: fmtIST(s.startAt), status: s.status, isDemo: s.isDemo, past: new Date(s.endAt) < new Date() })),
      enrollment: enrollment ? { id: String(enrollment._id), completedLessonIds: done, enrolledAt: enrollment.enrolledAt, showInPortfolio: enrollment.showInPortfolio } : null,
      progress: enrollment ? {
        completedLessons: done.length, totalLessons: allLessons.length,
        engagementPct: allLessons.length ? Math.round((done.length / allLessons.length) * 100) : 0,
        submitted: subs.length, reviewed: reviewed.length, totalAssignments: assignments.length, demonstratedPct: pct,
      } : null,
      isOwner: owner,
      role: p.role,
    });
  } catch (e) {
    return apiError(e);
  }
}

// PATCH — trainer edits their own course details / publishes it.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await connectDB();
    const c = await loadCourse(id);
    if (!c) return notFound("Course not found");
    assertTrainer(await getPersona(), c);
    const b = await req.json().catch(() => null);
    if (!b) return badRequest("Invalid JSON body");
    const set: Record<string, unknown> = {};
    if (b.title !== undefined) { const t = String(b.title).trim(); if (t.length < 5) return badRequest("Title must be at least 5 characters"); set.title = t.slice(0, 140); }
    if (b.description !== undefined) { const d = String(b.description).trim(); if (d.length < 20) return badRequest("Description must be at least 20 characters"); set.description = d.slice(0, 3000); }
    if (b.category !== undefined) { if (!(TRAIN_CATEGORIES as readonly string[]).includes(b.category)) return badRequest("Invalid category"); set.category = b.category; }
    if (b.difficulty !== undefined) { if (!(DIFFICULTIES as readonly string[]).includes(b.difficulty)) return badRequest("Invalid difficulty"); set.difficulty = b.difficulty; }
    if (b.durationWeeks !== undefined) { const w = Number(b.durationWeeks); if (!Number.isInteger(w) || w < 1 || w > 52) return badRequest("Duration must be 1–52 weeks"); set.durationWeeks = w; }
    if (b.skillTags !== undefined) { const s = cleanList(b.skillTags); if (!s.length) return badRequest("Add at least one skill tag"); set.skillTags = s; }
    if (b.published !== undefined) {
      if (b.published === true && !lessonIds(c).length) return badRequest("Add at least one module with a lesson before publishing");
      set.published = b.published === true;
    }
    await TrainingCourse.updateOne({ _id: c._id }, { $set: set }, { runValidators: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
