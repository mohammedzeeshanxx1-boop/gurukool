import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { fmtIST, isTrainer, loadCourse, requireEnrollment, safeUrl } from "@/lib/train/core";
import { apiError, badRequest, conflict, notFound } from "@/lib/api";
import { ForbiddenError, getPersona, requireRole } from "@/lib/persona";
import { Student } from "@/models";
import { TrainingAssignment, TrainingCourse, TrainingSubmission } from "@/models/train";

export const dynamic = "force-dynamic";

type Sub = {
  _id: unknown; assignmentId: unknown; courseId: unknown; studentId: string; studentName: string; submissionText: string;
  repositoryUrl: string; projectUrl: string; status: string; score: number | null; feedback: string; submittedAt: Date; reviewedAt: Date | null;
};

// GET ?status=SUBMITTED — trainers: submissions for THEIR courses only. Students: their own.
export async function GET(req: Request) {
  try {
    const p = await getPersona();
    if (p.role === "recruiter") throw new ForbiddenError("Recruiters can't view training submissions.");
    await connectDB();
    const status = new URL(req.url).searchParams.get("status");
    let filter: Record<string, unknown>;
    if (p.role === "mentor") {
      const mine = await TrainingCourse.find({ trainerId: p.id }).select("_id").lean<{ _id: unknown }[]>();
      filter = { courseId: { $in: mine.map((c) => c._id) } };
    } else filter = { studentId: p.id };
    if (status === "SUBMITTED" || status === "REVIEWED") filter.status = status;
    const subs = await TrainingSubmission.find(filter).sort({ submittedAt: -1 }).limit(200).lean<Sub[]>();
    const assignments = await TrainingAssignment.find({ _id: { $in: subs.map((s) => s.assignmentId) } }).select("title maxMarks dueAt courseId").lean<{ _id: unknown; title: string; maxMarks: number; dueAt: Date }[]>();
    const amap = new Map(assignments.map((a) => [String(a._id), a]));
    const courses = await TrainingCourse.find({ _id: { $in: subs.map((s) => s.courseId) } }).select("title").lean<{ _id: unknown; title: string }[]>();
    const cmap = new Map(courses.map((c) => [String(c._id), c.title]));
    return NextResponse.json({
      submissions: subs.map((s) => {
        const a = amap.get(String(s.assignmentId));
        return {
          id: String(s._id), assignmentId: String(s.assignmentId), assignmentTitle: a?.title ?? "", maxMarks: a?.maxMarks ?? 0,
          courseId: String(s.courseId), courseTitle: cmap.get(String(s.courseId)) ?? "", studentName: s.studentName,
          submissionText: s.submissionText, repositoryUrl: s.repositoryUrl, projectUrl: s.projectUrl, status: s.status,
          score: s.score, feedback: s.feedback, submittedAt: s.submittedAt, submitted: fmtIST(s.submittedAt),
          late: a ? new Date(s.submittedAt) > new Date(a.dueAt) : false, reviewedAt: s.reviewedAt,
        };
      }),
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST {assignmentId, submissionText?, repositoryUrl?, projectUrl?} — enrolled student submits (or resubmits before review).
export async function POST(req: Request) {
  try {
    const p = await requireRole("student");
    const b = await req.json().catch(() => null);
    if (!b || !mongoose.isValidObjectId(b.assignmentId)) return badRequest("Pick an assignment");
    const submissionText = String(b.submissionText ?? "").trim().slice(0, 8000);
    const repositoryUrl = safeUrl(b.repositoryUrl);
    const projectUrl = safeUrl(b.projectUrl);
    if (repositoryUrl === null) return badRequest("Repository link isn't a valid URL");
    if (projectUrl === null) return badRequest("Project link isn't a valid URL");
    if (!submissionText && !repositoryUrl && !projectUrl) return badRequest("Add an answer, a GitHub repository link or a project URL");
    if (submissionText && submissionText.length < 10 && !repositoryUrl && !projectUrl) return badRequest("Your answer is too short");
    await connectDB();
    const a = await TrainingAssignment.findById(b.assignmentId).lean<{ _id: unknown; courseId: unknown }>();
    if (!a) return notFound("Assignment not found");
    const c = await loadCourse(String(a.courseId));
    if (!c) return notFound("Course not found");
    if (isTrainer(p, c)) throw new ForbiddenError("Trainers can't submit to their own course.");
    await requireEnrollment(p, c._id);
    const existing = await TrainingSubmission.findOne({ assignmentId: a._id, studentId: p.id }).select("status").lean<{ status: string }>();
    if (existing?.status === "REVIEWED") return conflict("This submission has already been reviewed and can't be changed.");
    const student = await Student.findOne({ key: p.id }).select("name").lean<{ name: string }>();
    const s = await TrainingSubmission.findOneAndUpdate(
      { assignmentId: a._id, studentId: p.id, status: { $ne: "REVIEWED" } },
      { $set: { courseId: c._id, studentName: student?.name ?? "", submissionText, repositoryUrl, projectUrl, status: "SUBMITTED", submittedAt: new Date() } },
      { upsert: true, new: true }
    ).lean<{ _id: unknown; status: string; submittedAt: Date }>();
    return NextResponse.json({ submission: { id: String(s!._id), status: s!.status, submittedAt: s!.submittedAt }, resubmitted: Boolean(existing) }, { status: existing ? 200 : 201 });
  } catch (e) {
    return apiError(e);
  }
}
