// GET /api/peers?q= — other students a signed-in student can study with, best matches first.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { User } from "@/models/user";
import { requireRole } from "@/lib/persona";
import { apiError } from "@/lib/api";
import { showDemoData } from "@/lib/notify";
import { peerMatch } from "@/lib/peers";

export const dynamic = "force-dynamic";

type Row = { key: string; name: string; college: string; branch: string; semester: number; skills: string[]; interests: string[]; careerGoal: string };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  try {
    const me = await requireRole("student");
    await connectDB();
    const mine = await Student.findOne({ key: me.id }).select("skills interests careerGoal college").lean<Row>();
    if (!mine) return NextResponse.json({ needsProfile: true, peers: [] });

    // Suspended accounts never appear.
    const suspended = (await User.find({ role: "student", active: false }).distinct("profileId")) as string[];
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
    const rx = q ? new RegExp(esc(q), "i") : null;
    const filter: Record<string, unknown> = {
      key: { $nin: [me.id, ...suspended] },
      peerDiscoverable: { $ne: false },
      ...(showDemoData() ? {} : { isDemo: { $ne: true } }),
      ...(rx ? { $or: [{ name: rx }, { college: rx }, { branch: rx }, { careerGoal: rx }, { skills: rx }, { interests: rx }] } : {}),
    };
    const rows = await Student.find(filter).select("key name college branch semester skills interests careerGoal").limit(200).lean<Row[]>();
    const peers = rows
      .map((r) => ({ id: r.key, name: r.name, college: r.college, branch: r.branch, semester: r.semester, skills: r.skills.slice(0, 12), interests: r.interests.slice(0, 8), careerGoal: r.careerGoal, ...peerMatch(mine, r) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 60);
    return NextResponse.json({ needsProfile: false, peers });
  } catch (e) {
    return apiError(e);
  }
}
