// Adapter: mentor recommendations are produced by the GURUKOOL Mentor Match Engine
// (src/lib/mentor-matching). This file only maps engine results to API objects.
import "server-only";
import type { MentorT } from "@/models/connect";
import { publicMentor } from "./mentors";
import { WEIGHTS, rankMentors, type StudentSignals } from "./mentor-matching";

export { WEIGHTS };
export type LearnContext = StudentSignals;

export function recommendMentors(mentors: MentorT[], ctx: LearnContext, limit = 3) {
  const byId = new Map(mentors.map((m) => [String(m._id), m]));
  return rankMentors(
    mentors.map((m) => ({
      id: String(m._id), name: m.name, expertise: m.expertise, teachingTopics: m.teachingTopics, domains: m.domains, availability: m.availability,
    })),
    ctx,
    limit
  ).map((r) => ({
    mentor: publicMentor(byId.get(r.mentorId)!),
    ...r,
    // Back-compat fields used by existing UI cards
    score: r.matchScore,
    reasons: [r.explanation],
    nextSlots: r.availableSlots,
  }));
}
