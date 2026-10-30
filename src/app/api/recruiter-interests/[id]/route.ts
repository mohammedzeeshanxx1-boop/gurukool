import { NextResponse } from "next/server";
import { notifyProfile } from "@/lib/notify";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { RecruiterInterest } from "@/models/connect";
import { apiError, conflict, notFound } from "@/lib/api";
import { ForbiddenError, getPersona } from "@/lib/persona";

export const dynamic = "force-dynamic";

// Student (recipient): PENDING → ACCEPTED | DECLINED.  Recruiter (sender): PENDING → WITHDRAWN.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound("Request not found");
    const p = await getPersona();
    const b = await req.json().catch(() => null);
    const to = String(b?.status ?? "");
    // Role/transition checks happen before touching the database.
    if (p.role === "student" && to !== "ACCEPTED" && to !== "DECLINED") throw new ForbiddenError("Students can accept or decline a request.");
    if (p.role === "recruiter" && to !== "WITHDRAWN") throw new ForbiddenError("Recruiters can only withdraw their own request.");
    if (p.role === "mentor") throw new ForbiddenError("Mentors can't change recruiter requests.");
    await connectDB();

    let owner: Record<string, unknown>;
    if (p.role === "student") {
      if (to !== "ACCEPTED" && to !== "DECLINED") throw new ForbiddenError("Students can accept or decline a request.");
      const me = await Student.findOne({ key: p.id }).select("_id").lean<{ _id: unknown }>();
      if (!me) return notFound("Request not found");
      owner = { studentId: me._id };
    } else if (p.role === "recruiter") {
      if (to !== "WITHDRAWN") throw new ForbiddenError("Recruiters can only withdraw their own request.");
      owner = { recruiterId: p.id };
    } else throw new ForbiddenError("Mentors can't change recruiter requests.");

    const updated = await RecruiterInterest.findOneAndUpdate(
      { _id: id, ...owner, status: "PENDING" },
      { $set: { status: to }, $unset: { pendingKey: 1 } },
      { new: true }
    ).lean<{ status: string; recruiterId: unknown }>();
    if (!updated) {
      const exists = await RecruiterInterest.exists({ _id: id, ...owner });
      return exists ? conflict("This request has already been answered.") : notFound("Request not found");
    }
    if (p.role === "student") await notifyProfile("recruiter", String(updated.recruiterId), { title: `Request ${updated.status.toLowerCase()}`, body: `A student ${updated.status.toLowerCase()} your connection request.`, link: "/grow/recruiter" });
    return NextResponse.json({ status: updated.status });
  } catch (e) {
    return apiError(e);
  }
}
