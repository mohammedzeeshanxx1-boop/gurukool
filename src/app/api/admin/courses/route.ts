import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { apiError, badRequest, notFound } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { notifyProfile } from "@/lib/notify";
import { TrainingCourse } from "@/models/train";

export const dynamic = "force-dynamic";

// PATCH {id, published:false} — admin content moderation: unpublish a course (trainer is notified).
export async function PATCH(req: Request) {
  try {
    await requireRole("admin");
    const b = await req.json().catch(() => null);
    if (!b || !mongoose.isValidObjectId(b.id) || b.published !== false) return badRequest("Admins can only unpublish courses");
    const c = await TrainingCourse.findByIdAndUpdate(b.id, { $set: { published: false } }, { new: true }).select("title trainerId").lean<{ title: string; trainerId: unknown }>();
    if (!c) return notFound("Course not found");
    await notifyProfile("mentor", String(c.trainerId), { title: "Course unpublished by admin", body: `"${c.title}" was unpublished. Contact the admin for details.`, link: "/train?tab=trainer" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
