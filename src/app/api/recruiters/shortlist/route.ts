import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { apiError, badRequest, notFound } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { Student } from "@/models";
import { Recruiter } from "@/models/connect";

export const dynamic = "force-dynamic";

// POST {studentId, shortlisted} — approved recruiter adds/removes an opted-in student on their persistent shortlist.
export async function POST(req: Request) {
  try {
    const p = await requireRole("recruiter");
    const b = await req.json().catch(() => null);
    if (!b || !mongoose.isValidObjectId(b.studentId) || typeof b.shortlisted !== "boolean") return badRequest("Invalid request");
    if (b.shortlisted && !(await Student.exists({ _id: b.studentId, recruiterDiscoverable: true }))) return notFound("Student not found or not open to recruiters");
    await Recruiter.updateOne({ _id: p.id }, b.shortlisted ? { $addToSet: { shortlist: b.studentId } } : { $pull: { shortlist: b.studentId } });
    return NextResponse.json({ shortlisted: b.shortlisted });
  } catch (e) {
    return apiError(e);
  }
}
