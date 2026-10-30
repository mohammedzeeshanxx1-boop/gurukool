import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { assertTrainer, loadCourse } from "@/lib/train/core";
import { apiError, badRequest, conflict, notFound } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { TrainingAssignment, TrainingSubmission } from "@/models/train";

export const dynamic = "force-dynamic";

// PATCH {score, feedback} — only the course's trainer reviews. Marks are recorded; no skill mastery is auto-awarded.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const p = await requireRole("mentor");
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound("Submission not found");
    const b = await req.json().catch(() => null);
    await connectDB();
    const s = await TrainingSubmission.findById(id).lean<{ _id: unknown; assignmentId: unknown; courseId: unknown; status: string }>();
    if (!s) return notFound("Submission not found");
    const c = await loadCourse(String(s.courseId));
    if (!c) return notFound("Course not found");
    assertTrainer(p, c);
    const a = await TrainingAssignment.findById(s.assignmentId).select("maxMarks").lean<{ maxMarks: number }>();
    const score = Number(b?.score);
    const feedback = String(b?.feedback ?? "").trim().slice(0, 3000);
    if (!Number.isFinite(score) || score < 0 || score > (a?.maxMarks ?? 0)) return badRequest(`Marks must be between 0 and ${a?.maxMarks ?? 0}`);
    if (feedback.length < 5) return badRequest("Write some feedback for the student (at least 5 characters)");
    const updated = await TrainingSubmission.findOneAndUpdate(
      { _id: id },
      { $set: { score: Math.round(score * 10) / 10, feedback, status: "REVIEWED", reviewedBy: p.id, reviewedAt: new Date() } },
      { new: true }
    ).lean<{ status: string; score: number }>();
    if (!updated) return conflict("Submission changed, refresh and try again.");
    return NextResponse.json({ status: updated.status, score: updated.score });
  } catch (e) {
    return apiError(e);
  }
}
