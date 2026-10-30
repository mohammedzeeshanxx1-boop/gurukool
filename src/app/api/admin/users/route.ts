import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { apiError, badRequest, notFound } from "@/lib/api";
import { ForbiddenError, requireRole } from "@/lib/persona";
import { User } from "@/models/user";
import { Recruiter } from "@/models/connect";

export const dynamic = "force-dynamic";

type U = { _id: unknown; email: string; name: string; role: string; approved: boolean; active?: boolean; profileId: string; createdAt: Date };

// GET ?role= — all registered accounts from MongoDB (never password hashes).
export async function GET(req: Request) {
  try {
    await requireRole("admin");
    const role = new URL(req.url).searchParams.get("role");
    await connectDB();
    const filter = role && ["student", "mentor", "recruiter", "admin"].includes(role) ? { role } : {};
    const users = await User.find(filter).select("email name role approved active profileId createdAt").sort({ createdAt: -1 }).limit(500).lean<U[]>();
    const recIds = users.filter((u) => u.role === "recruiter" && mongoose.isValidObjectId(u.profileId)).map((u) => u.profileId);
    const recs = await Recruiter.find({ _id: { $in: recIds } }).select("organization").lean<{ _id: unknown; organization: string }[]>();
    const org = new Map(recs.map((r) => [String(r._id), r.organization]));
    return NextResponse.json({
      users: users.map((u) => ({
        id: String(u._id), name: u.name, email: u.email, role: u.role, approved: u.approved, active: u.active !== false,
        organization: org.get(u.profileId) ?? "", createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

// PATCH {id, approved?, active?} — approve recruiters, suspend/reactivate accounts. Changes apply on the user's next request.
export async function PATCH(req: Request) {
  try {
    const admin = await requireRole("admin");
    const b = await req.json().catch(() => null);
    if (!b || !mongoose.isValidObjectId(b.id)) return badRequest("Invalid request");
    if (b.id === admin.uid && b.active === false) throw new ForbiddenError("You can't suspend your own admin account.");
    const set: Record<string, boolean> = {};
    if (typeof b.approved === "boolean") set.approved = b.approved;
    if (typeof b.active === "boolean") set.active = b.active;
    if (!Object.keys(set).length) return badRequest("Nothing to update");
    await connectDB();
    const target = await User.findById(b.id).select("role").lean<{ role: string }>();
    if (!target) return notFound("User not found");
    if ("approved" in set && target.role !== "recruiter") return badRequest("Approval applies to recruiter accounts only");
    await User.updateOne({ _id: b.id }, { $set: set });
    return NextResponse.json({ ok: true, ...set });
  } catch (e) {
    return apiError(e);
  }
}
