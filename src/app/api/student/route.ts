import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { requireRole } from "@/lib/persona";
import { User } from "@/models/user";
import { apiError, badRequest } from "@/lib/api";
import { isCareerGoal } from "@/lib/careers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const KEY = (await requireRole("student")).id;
    await connectDB();
    const student = await Student.findOne({ key: KEY }).lean();
    return NextResponse.json({ student });
  } catch (e) {
    return apiError(e);
  }
}

const splitList = (v: unknown) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 50);

export async function PUT(req: Request) {
  try {
    const me = await requireRole("student");
    const KEY = me.id;
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");
    const { name, college, branch, semester, careerGoal } = body;
    if (!name || !college || !branch) return badRequest("Name, college and branch are required");
    const sem = Number(semester);
    if (!Number.isInteger(sem) || sem < 1 || sem > 10) return badRequest("Semester must be 1–10");
    if (!isCareerGoal(careerGoal)) return badRequest("Pick a valid career goal");
    await connectDB();
    const account = await User.findByIdAndUpdate(me.uid, { $set: { name: String(name).slice(0, 100) } }, { new: true }).select("email").lean<{ email: string }>();
    const student = await Student.findOneAndUpdate(
      { key: KEY },
      {
        key: KEY,
        name: String(name).slice(0, 100),
        email: account?.email ?? "",
        college: String(college).slice(0, 150),
        branch: String(branch).slice(0, 100),
        semester: sem,
        careerGoal,
        skills: splitList(body.skills),
        interests: splitList(body.interests),
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    return NextResponse.json({ student });
  } catch (e) {
    return apiError(e);
  }
}
