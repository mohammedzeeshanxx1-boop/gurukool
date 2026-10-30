import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Student } from "@/models";
import { Recruiter, RecruiterInterest } from "@/models/connect";
import { apiError, badRequest, conflict, isDupKey, notFound } from "@/lib/api";
import { ForbiddenError, getPersona, requireRole } from "@/lib/persona";

export const dynamic = "force-dynamic";

type I = {
  _id: unknown; recruiterId: unknown; studentId: unknown; type: string; opportunityTitle: string; message: string;
  status: string; createdAt: Date;
};

// GET — recruiters see requests they sent; students see requests they received.
export async function GET() {
  try {
    const p = await getPersona();
    if (p.role === "mentor") throw new ForbiddenError("Mentors don't have recruiter requests.");
    await connectDB();
    await ensureSeed();
    if (p.role === "recruiter") {
      const list = (await RecruiterInterest.find({ recruiterId: p.id }).sort({ createdAt: -1 }).lean()) as unknown as I[];
      const students = await Student.find({ _id: { $in: list.map((x) => x.studentId) } }).select("name").lean<{ _id: unknown; name: string }[]>();
      const name = new Map(students.map((s) => [String(s._id), s.name]));
      return NextResponse.json({
        role: "recruiter",
        interests: list.map((x) => ({ id: String(x._id), studentName: name.get(String(x.studentId)) ?? "Student", type: x.type, opportunityTitle: x.opportunityTitle, message: x.message, status: x.status, createdAt: x.createdAt })),
      });
    }
    const me = await Student.findOne({ key: p.id }).select("_id").lean<{ _id: unknown }>();
    if (!me) return NextResponse.json({ role: "student", interests: [] });
    const list = (await RecruiterInterest.find({ studentId: me._id }).sort({ createdAt: -1 }).lean()) as unknown as I[];
    const recs = await Recruiter.find({ _id: { $in: list.map((x) => x.recruiterId) } }).lean<{ _id: unknown; name: string; organization: string; designation: string; isDemo: boolean }[]>();
    const rec = new Map(recs.map((r) => [String(r._id), r]));
    return NextResponse.json({
      role: "student",
      interests: list.map((x) => {
        const r = rec.get(String(x.recruiterId));
        return {
          id: String(x._id), recruiterName: r?.name ?? "Recruiter", organization: r?.organization ?? "", designation: r?.designation ?? "",
          recruiterIsDemo: Boolean(r?.isDemo), type: x.type, opportunityTitle: x.opportunityTitle, message: x.message, status: x.status, createdAt: x.createdAt,
        };
      }),
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST {studentId, message, type, opportunityTitle} — recruiter expresses interest / invites an opted-in student.
export async function POST(req: Request) {
  try {
    const p = await requireRole("recruiter");
    const b = await req.json().catch(() => null);
    if (!b || !mongoose.isValidObjectId(b.studentId)) return badRequest("Pick a student");
    const type = b.type === "INVITE" ? "INVITE" : "INTEREST";
    const message = String(b.message ?? "").trim();
    const opportunityTitle = String(b.opportunityTitle ?? "").trim().slice(0, 120);
    if (message.length < 10 || message.length > 1000) return badRequest("Message must be 10–1000 characters");
    if (type === "INVITE" && !opportunityTitle) return badRequest("Add the opportunity title for an invitation");
    await connectDB();
    const student = await Student.findOne({ _id: b.studentId, recruiterDiscoverable: true }).select("_id").lean();
    if (!student) return notFound("Student not found or not open to recruiters");
    try {
      const doc = await RecruiterInterest.create({
        recruiterId: p.id, studentId: b.studentId, type, opportunityTitle, message, status: "PENDING",
        pendingKey: `${p.id}|${b.studentId}`,
      });
      return NextResponse.json({ interest: { id: String(doc._id), status: doc.status } }, { status: 201 });
    } catch (e) {
      if (isDupKey(e)) return conflict("You already have an open request with this student.");
      throw e;
    }
  } catch (e) {
    return apiError(e);
  }
}
