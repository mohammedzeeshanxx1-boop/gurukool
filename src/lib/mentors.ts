import "server-only";
import { DOMAINS, SESSION_FORMATS, type MentorT } from "@/models/connect";
import { cleanList } from "./api";
import { validateAvailability, type Availability } from "./slots";

export function publicMentor(m: MentorT) {
  return {
    id: String(m._id),
    name: m.name, headline: m.headline, designation: m.designation, organization: m.organization,
    yearsOfExperience: m.yearsOfExperience, bio: m.bio, expertise: m.expertise, teachingTopics: m.teachingTopics,
    domains: m.domains, sessionFormats: m.sessionFormats, sessionDescription: m.sessionDescription,
    availability: m.availability.map((a) => ({ day: a.day, start: a.start, end: a.end })),
    profileStatus: m.profileStatus, isDemo: m.isDemo,
    verified: Boolean(m.verified), // true only after an admin approves the expert account
    links: { linkedin: m.links?.linkedin ?? "", portfolio: m.links?.portfolio ?? "" },
  };
}
export type PublicMentor = ReturnType<typeof publicMentor>;

/** Validate a create/update payload. `partial` allows omitting fields (PATCH). */
export function parseMentorInput(body: Record<string, unknown>, partial = false): { data?: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};
  const str = (k: string, max: number, required: boolean) => {
    if (body[k] === undefined) { if (required && !partial) throw `${k} is required`; return; }
    const v = String(body[k]).trim();
    if (required && !v) throw `${k} is required`;
    data[k] = v.slice(0, max);
  };
  try {
    str("name", 100, true); str("headline", 160, true); str("designation", 100, true); str("organization", 120, true);
    str("bio", 1500, false); str("sessionDescription", 1000, false);
    if (body.yearsOfExperience !== undefined || !partial) {
      const y = Number(body.yearsOfExperience);
      if (!Number.isFinite(y) || y < 0 || y > 50) throw "Years of experience must be 0–50";
      data.yearsOfExperience = Math.round(y);
    }
    if (body.expertise !== undefined || !partial) {
      data.expertise = cleanList(body.expertise);
      if (!(data.expertise as string[]).length) throw "Add at least one area of expertise";
    }
    if (body.teachingTopics !== undefined || !partial) {
      data.teachingTopics = cleanList(body.teachingTopics);
      if (!(data.teachingTopics as string[]).length) throw "Add at least one teaching topic";
    }
    if (body.domains !== undefined) {
      const d = cleanList(body.domains);
      if (d.some((x) => !(DOMAINS as readonly string[]).includes(x))) throw "Unknown domain";
      data.domains = d;
    }
    if (body.sessionFormats !== undefined) {
      const f = cleanList(body.sessionFormats);
      if (!f.length || f.some((x) => !(SESSION_FORMATS as readonly string[]).includes(x))) throw "Pick valid session formats";
      data.sessionFormats = f;
    }
    if (body.availability !== undefined) {
      const err = validateAvailability(body.availability);
      if (err) throw err;
      data.availability = (body.availability as Availability[]).map((a) => ({ day: a.day, start: a.start, end: a.end }));
    }
    if (body.links !== undefined) {
      const L = body.links as Record<string, unknown>;
      const clean = (v: unknown) => {
        const s = String(v ?? "").trim().slice(0, 200);
        if (!s) return "";
        try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); if (!/^https?:$/.test(u.protocol)) throw 0; return u.toString(); }
        catch { throw "LinkedIn/portfolio must be valid URLs"; }
      };
      data.links = { linkedin: clean(L?.linkedin), portfolio: clean(L?.portfolio) };
    }
    if (body.profileStatus !== undefined) {
      if (body.profileStatus !== "active" && body.profileStatus !== "draft") throw "Invalid profile status";
      data.profileStatus = body.profileStatus;
    }
  } catch (e) {
    return { error: String(e) };
  }
  return { data };
}

// Text matching lives in the Mentor Match Engine; re-exported for existing imports.
export { matchTerm } from "./mentor-matching/match";
