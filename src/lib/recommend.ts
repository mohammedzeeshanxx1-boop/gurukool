// Deterministic, explainable mentor recommendations (rule-based scoring, NOT a trained ML model).
// Priority weights follow the LEARN journey: weak quiz topics > roadmap stages > missing skills > career goal > interests.
import "server-only";
import type { MentorT } from "@/models/connect";
import { matchTerm, publicMentor } from "./mentors";
import { upcomingSlots } from "./slots";

export const WEIGHTS = { weakTopic: 5, roadmap: 3, missingSkill: 2, careerGoal: 2, interest: 1 };

const GOAL_DOMAIN: Record<string, string> = {
  "Backend Developer": "Backend Development",
  "Frontend Developer": "Frontend Development",
  "Full Stack Developer": "Full Stack Development",
  "AI/ML Engineer": "AI/ML",
};

export type LearnContext = {
  careerGoal: string;
  weakTopics: string[];
  roadmapTopics: string[]; // incomplete stages only
  missingSkills: string[];
  interests: string[];
};

export function recommendMentors(mentors: MentorT[], ctx: LearnContext, limit = 3) {
  const scored = mentors.map((m) => {
    const terms = [...m.expertise, ...m.teachingTopics];
    const reasons: { weight: number; text: string }[] = [];
    const seen = new Set<string>();
    const add = (weight: number, key: string, text: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      reasons.push({ weight, text });
    };
    for (const t of ctx.weakTopics) {
      const hit = matchTerm(t, terms);
      if (hit) add(WEIGHTS.weakTopic, `w:${t}`, `Your assessment showed gaps in ${t}, and this mentor teaches ${hit}.`);
    }
    for (const t of ctx.roadmapTopics) {
      const hit = matchTerm(t, terms);
      if (hit) add(WEIGHTS.roadmap, `r:${t}`, `Your current learning roadmap includes ${t}, and this mentor offers ${hit} sessions.`);
    }
    for (const t of ctx.missingSkills) {
      const hit = matchTerm(t, terms);
      if (hit) add(WEIGHTS.missingSkill, `m:${t}`, `${t} is a missing skill for your ${ctx.careerGoal} goal; this mentor's expertise includes ${hit}.`);
    }
    const domain = GOAL_DOMAIN[ctx.careerGoal];
    if (domain && m.domains.includes(domain)) add(WEIGHTS.careerGoal, "goal", `This mentor works in ${domain}, matching your ${ctx.careerGoal} goal.`);
    for (const t of ctx.interests) {
      const hit = matchTerm(t, [...terms, ...m.domains]);
      if (hit) add(WEIGHTS.interest, `i:${t}`, `Matches your interest in ${t}.`);
    }
    const score = reasons.reduce((s, r) => s + r.weight, 0);
    reasons.sort((a, b) => b.weight - a.weight);
    return { m, score, reasons };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.m.isDemo) - Number(b.m.isDemo))
    .slice(0, limit)
    .map(({ m, score, reasons }) => ({
      mentor: publicMentor(m),
      score,
      reasons: reasons.slice(0, 3).map((r) => r.text),
      nextSlots: upcomingSlots(m.availability).slice(0, 3),
    }));
}
