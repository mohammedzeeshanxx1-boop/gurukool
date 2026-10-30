import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { apiError, badRequest, notFound } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { TrainingEnrollment } from "@/models/train";

export const dynamic = "force-dynamic";

// PATCH {showInPortfolio} — student controls whether a training program appears on their GROW resume.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const p = await requireRole("student");
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound("Enrollment not found");
    const b = await req.json().catch(() => null);
    if (typeof b?.showInPortfolio !== "boolean") return badRequest("showInPortfolio must be true or false");
    await connectDB();
    const r = await TrainingEnrollment.updateOne({ _id: id, studentId: p.id }, { $set: { showInPortfolio: b.showInPortfolio } });
    if (!r.matchedCount) return notFound("Enrollment not found");
    return NextResponse.json({ showInPortfolio: b.showInPortfolio });
  } catch (e) {
    return apiError(e);
  }
}
