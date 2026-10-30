import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { apiError, badRequest, cleanList, notFound } from "@/lib/api";
import { requireRole } from "@/lib/persona";

export const dynamic = "force-dynamic";

const url = (v: unknown) => {
  const s = String(v ?? "").trim().slice(0, 200);
  if (!s) return "";
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try { return new URL(withProto).toString(); } catch { return null; }
};

type V = { recruiterDiscoverable?: boolean; portfolioLinks?: { github?: string; linkedin?: string; portfolio?: string }; projects?: string[]; mentorshipInterests?: string[] };
const view = (s: V) => ({
  recruiterDiscoverable: Boolean(s.recruiterDiscoverable),
  portfolioLinks: { github: s.portfolioLinks?.github ?? "", linkedin: s.portfolioLinks?.linkedin ?? "", portfolio: s.portfolioLinks?.portfolio ?? "" },
  projects: s.projects ?? [], mentorshipInterests: s.mentorshipInterests ?? [],
});

export async function GET() {
  try {
    const p = await requireRole("student");
    await connectDB();
    const s = await Student.findOne({ key: p.id }).lean<V>();
    if (!s) return notFound("Save your student profile first");
    return NextResponse.json(view(s));
  } catch (e) {
    return apiError(e);
  }
}

// PATCH — student controls their own recruiter visibility (private by default) and portfolio details.
export async function PATCH(req: Request) {
  try {
    const p = await requireRole("student");
    const b = await req.json().catch(() => null);
    if (!b) return badRequest("Invalid JSON body");
    const set: Record<string, unknown> = {};
    if (b.recruiterDiscoverable !== undefined) set.recruiterDiscoverable = b.recruiterDiscoverable === true;
    if (b.portfolioLinks) {
      for (const k of ["github", "linkedin", "portfolio"] as const) {
        if (b.portfolioLinks[k] === undefined) continue;
        const u = url(b.portfolioLinks[k]);
        if (u === null) return badRequest(`${k} link isn't a valid URL`);
        set[`portfolioLinks.${k}`] = u;
      }
    }
    if (b.projects !== undefined) set.projects = (Array.isArray(b.projects) ? b.projects : String(b.projects).split("\n")).map((x: unknown) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 10);
    if (b.mentorshipInterests !== undefined) set.mentorshipInterests = cleanList(b.mentorshipInterests);
    await connectDB();
    const s = await Student.findOneAndUpdate({ key: p.id }, { $set: set }, { new: true }).lean<V>();
    if (!s) return notFound("Save your student profile first");
    return NextResponse.json(view(s));
  } catch (e) {
    return apiError(e);
  }
}
