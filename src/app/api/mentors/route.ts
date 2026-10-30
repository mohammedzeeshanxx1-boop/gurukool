import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Mentor, DOMAINS, SESSION_FORMATS, type MentorT } from "@/models/connect";
import { apiError } from "@/lib/api";
import { matchTerm, publicMentor } from "@/lib/mentors";
import { ForbiddenError } from "@/lib/persona";
import { discoverableMentor } from "@/lib/notify";

export const dynamic = "force-dynamic";

// GET /api/mentors?q=&domain=&day=&format=  — real server-side filtering.
export async function GET(req: Request) {
  try {
    await connectDB();
    await ensureSeed();
    const sp = new URL(req.url).searchParams;
    const q = (sp.get("q") ?? "").trim().slice(0, 60);
    const domain = sp.get("domain") ?? "";
    const day = sp.get("day") ?? "";
    const format = sp.get("format") ?? "";

    const filter: Record<string, unknown> = { profileStatus: "active", ...(await discoverableMentor()) };
    if (domain) filter.domains = domain;
    if (day) filter["availability.day"] = day;
    if (format) filter.sessionFormats = format;
    let mentors = (await Mentor.find(filter).sort({ isDemo: 1, yearsOfExperience: -1 }).lean()) as unknown as MentorT[];
    if (q) mentors = mentors.filter((m) => matchTerm(q, [...m.expertise, ...m.teachingTopics, m.headline, m.name, m.designation]));

    return NextResponse.json({ mentors: mentors.map(publicMentor), facets: { domains: DOMAINS, days: ["Saturday", "Sunday"], formats: SESSION_FORMATS } });
  } catch (e) {
    return apiError(e);
  }
}

// POST — disabled: expert profiles are created at registration (/expert/register) and edited from the Mentor Dashboard.
export async function POST() {
  return apiError(new ForbiddenError("Expert profiles are created when you register as an expert."));
}
