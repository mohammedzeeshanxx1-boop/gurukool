import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { apiError, conflict, notFound } from "@/lib/api";
import { ForbiddenError, requireRole } from "@/lib/persona";
import { TrainingSession } from "@/models/train";

export const dynamic = "force-dynamic";

// PATCH {status: "CANCELLED" | "COMPLETED"} — trainer who owns the session. COMPLETED only after it starts.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const p = await requireRole("mentor");
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound("Session not found");
    const b = await req.json().catch(() => null);
    const to = b?.status;
    if (to !== "CANCELLED" && to !== "COMPLETED") throw new ForbiddenError("Sessions can only be cancelled or completed.");
    await connectDB();
    const s = await TrainingSession.findOne({ _id: id, trainerId: p.id }).lean<{ startAt: Date; status: string }>();
    if (!s) return notFound("Session not found");
    if (s.status !== "SCHEDULED") return conflict(`This session is already ${s.status}.`);
    if (to === "COMPLETED" && new Date(s.startAt) > new Date()) return conflict("A session can only be marked completed after it starts.");
    await TrainingSession.updateOne({ _id: id, trainerId: p.id, status: "SCHEDULED" }, { $set: { status: to } });
    return NextResponse.json({ status: to });
  } catch (e) {
    return apiError(e);
  }
}
