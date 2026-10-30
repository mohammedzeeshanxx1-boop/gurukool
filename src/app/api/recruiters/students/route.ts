import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Student } from "@/models";
import { RecruiterInterest } from "@/models/connect";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { matchTerm } from "@/lib/mentors";

export const dynamic = "force-dynamic";

type S = {
  _id: unknown; name: string; college: string; branch: string; semester: number; careerGoal: string; skills: string[];
  projects?: string[]; portfolioLinks?: { github?: string; linkedin?: string; portfolio?: string }; isDemo?: boolean;
};

// GET /api/recruiters/students?skill=&goal= — ONLY opted-in students; no email, phone or assessment data.
export async function GET(req: Request) {
  try {
    const p = await requireRole("recruiter");
    const sp = new URL(req.url).searchParams;
    const skill = (sp.get("skill") ?? "").trim().slice(0, 60);
    const goal = sp.get("goal") ?? "";
    await connectDB();
    await ensureSeed();
    const filter: Record<string, unknown> = { recruiterDiscoverable: true };
    if (goal) filter.careerGoal = goal;
    let list = (await Student.find(filter)
      .select("name college branch semester careerGoal skills projects portfolioLinks isDemo")
      .sort({ isDemo: 1, updatedAt: -1 }).lean()) as unknown as S[];
    if (skill) list = list.filter((s) => matchTerm(skill, s.skills ?? []));

    const sent = await RecruiterInterest.find({ recruiterId: p.id }).select("studentId status").lean<{ studentId: unknown; status: string }[]>();
    const statusFor = new Map(sent.map((x) => [String(x.studentId), x.status]));
    return NextResponse.json({
      students: list.map((s) => ({
        id: String(s._id), name: s.name, college: s.college, branch: s.branch, semester: s.semester,
        careerGoal: s.careerGoal, skills: s.skills ?? [], projects: s.projects ?? [],
        links: { github: s.portfolioLinks?.github ?? "", linkedin: s.portfolioLinks?.linkedin ?? "", portfolio: s.portfolioLinks?.portfolio ?? "" },
        isDemo: Boolean(s.isDemo), myRequestStatus: statusFor.get(String(s._id)) ?? null,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
