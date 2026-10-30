import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Mentor, DOMAINS, SESSION_FORMATS, type MentorT } from "@/models/connect";
import { apiError, badRequest } from "@/lib/api";
import { matchTerm, parseMentorInput, publicMentor } from "@/lib/mentors";
import { demoPersonasEnabled, setPersona } from "@/lib/persona";
import { validateAvailability } from "@/lib/slots";

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

    const filter: Record<string, unknown> = { profileStatus: "active" };
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

// POST /api/mentors — create a professional profile; the demo session then acts as that mentor.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");
    const { data, error } = parseMentorInput(body);
    if (error) return badRequest(error);
    if (body.availability === undefined) data!.availability = [];
    else if (validateAvailability(body.availability)) return badRequest(validateAvailability(body.availability)!);
    await connectDB();
    await ensureSeed();
    const mentor = await Mentor.create({ ...data, isDemo: false, profileStatus: data!.profileStatus ?? "active" });
    if (demoPersonasEnabled()) await setPersona({ role: "mentor", id: String(mentor._id) });
    return NextResponse.json({ mentor: publicMentor(mentor.toObject()) }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
