import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { apiError, badRequest, notFound } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { User } from "@/models/user";
import { Recruiter } from "@/models/connect";

export const dynamic = "force-dynamic";

// Admin: list recruiter accounts and approve / revoke them.
export async function GET() {
  try {
    await requireRole("admin");
    await connectDB();
    const users = await User.find({ role: "recruiter" }).select("email name approved profileId createdAt").sort({ approved: 1, createdAt: -1 }).lean<{ _id: unknown; email: string; name: string; approved: boolean; profileId: string; createdAt: Date }[]>();
    const recs = await Recruiter.find({ _id: { $in: users.map((u) => u.profileId).filter((x) => mongoose.isValidObjectId(x)) } }).select("organization designation").lean<{ _id: unknown; organization: string; designation: string }[]>();
    const rmap = new Map(recs.map((r) => [String(r._id), r]));
    return NextResponse.json({
      recruiters: users.map((u) => ({ id: String(u._id), email: u.email, name: u.name, approved: u.approved, createdAt: u.createdAt, organization: rmap.get(u.profileId)?.organization ?? "", designation: rmap.get(u.profileId)?.designation ?? "" })),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireRole("admin");
    const b = await req.json().catch(() => null);
    if (!b || !mongoose.isValidObjectId(b.id) || typeof b.approved !== "boolean") return badRequest("Invalid request");
    await connectDB();
    const r = await User.updateOne({ _id: b.id, role: "recruiter" }, { $set: { approved: b.approved } });
    if (!r.matchedCount) return notFound("Recruiter not found");
    return NextResponse.json({ approved: b.approved });
  } catch (e) {
    return apiError(e);
  }
}
