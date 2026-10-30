import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Mentor, Recruiter } from "@/models/connect";
import { Student, DEMO_KEY } from "@/models";
import { apiError, badRequest } from "@/lib/api";
import { ForbiddenError, demoPersonasEnabled, getPersona, setPersona } from "@/lib/persona";

export const dynamic = "force-dynamic";

// GET — current demo persona and the personas available to switch to.
export async function GET() {
  try {
    const persona = await getPersona();
    await connectDB();
    await ensureSeed();
    const [student, mentors, recruiters] = await Promise.all([
      Student.findOne({ key: DEMO_KEY }).select("name").lean<{ name: string }>(),
      Mentor.find().select("name designation isDemo").sort({ isDemo: 1, name: 1 }).lean<{ _id: unknown; name: string; designation: string; isDemo: boolean }[]>(),
      Recruiter.find().select("name organization isDemo").lean<{ _id: unknown; name: string; organization: string; isDemo: boolean }[]>(),
    ]);
    const options = [
      { role: "student", id: DEMO_KEY, label: student?.name ?? "Demo Student", sub: "Student" },
      ...mentors.map((m) => ({ role: "mentor", id: String(m._id), label: m.name, sub: `Mentor · ${m.designation}${m.isDemo ? " (demo)" : ""}` })),
      ...recruiters.map((r) => ({ role: "recruiter", id: String(r._id), label: r.name, sub: `Recruiter · ${r.organization}` })),
    ];
    const current = options.find((o) => o.role === persona.role && o.id === persona.id) ?? options[0];
    return NextResponse.json({ persona, current, options, demoEnabled: demoPersonasEnabled() });
  } catch (e) {
    return apiError(e);
  }
}

// POST {role, id} — switch persona (SIMULATION ONLY; disabled when GURUKOOL_DEMO_PERSONAS=false).
export async function POST(req: Request) {
  try {
    if (!demoPersonasEnabled()) throw new ForbiddenError("Persona switching is disabled in this deployment.");
    const b = await req.json().catch(() => null);
    const role = b?.role, id = String(b?.id ?? "");
    if (role !== "student" && role !== "mentor" && role !== "recruiter") return badRequest("Unknown role");
    await connectDB();
    if (role === "student") {
      if (id !== DEMO_KEY) return badRequest("Unknown student persona");
    } else if (role === "mentor" || role === "recruiter") {
      if (!mongoose.isValidObjectId(id)) return badRequest("Unknown persona");
      const exists = role === "mentor" ? await Mentor.exists({ _id: id }) : await Recruiter.exists({ _id: id });
      if (!exists) return badRequest("Unknown persona");
    } else return badRequest("Unknown role");
    await setPersona({ role, id });
    return NextResponse.json({ ok: true, persona: { role, id } });
  } catch (e) {
    return apiError(e);
  }
}
