import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Roadmap } from "@/models";
import { requireRole } from "@/lib/persona";
import { apiError, badRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

// Toggle a stage's completion checkbox.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const KEY = (await requireRole("student")).id;
    const { id } = await ctx.params;
    const { stageId, completed } = await req.json().catch(() => ({}));
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(stageId) || typeof completed !== "boolean")
      return badRequest("Invalid request");
    await connectDB();
    const res = await Roadmap.updateOne(
      { _id: id, studentKey: KEY, "stages._id": stageId },
      { $set: { "stages.$.completed": completed } }
    );
    if (!res.matchedCount) return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
