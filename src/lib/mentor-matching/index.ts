// GURUKOOL Mentor Match Engine
// ------------------------------------------------------------
// Original, deterministic skill-to-mentor matching. No external AI calls.
// It READS existing outputs of the Skill Intelligence pipeline (skill-gap analysis, saved assessment
// weak topics, saved roadmap) and never recalculates or modifies them.
//
// score = 0.40·weakness + 0.30·roadmap + 0.20·careerGoal + 0.10·availability   (each component ∈ [0,1])
//
//  weakness     share of the student's demonstrated weak topics (assessment) this mentor can teach.
//               With no assessment, falls back to the student's chosen interests and is labelled
//               "interest-based" — assessment results are never invented.
//  roadmap      priority-weighted coverage of incomplete roadmap stages (stage i weighs 1/(i+1)).
//               With no roadmap, uses the skill-gap priority list (missing skills, high → low).
//  careerGoal   1 if the mentor works in the goal's domain, else the share of the goal's top required
//               skills the mentor covers.
//  availability min(1, open weekend slots in the next 14 days / 2).
import { matchTerm } from "./match";
import { upcomingSlots, type Availability, type UpcomingSlot } from "../slots";

export const WEIGHTS = { weakness: 0.4, roadmap: 0.3, careerGoal: 0.2, availability: 0.1 } as const;
export const MIN_SCORE = 0.15; // below this a match is not shown
const GOAL_DOMAIN: Record<string, string> = {
  "Backend Developer": "Backend Development",
  "Frontend Developer": "Frontend Development",
  "Full Stack Developer": "Full Stack Development",
  "AI/ML Engineer": "AI/ML",
};

export type MatchMentor = {
  id: string; name: string; expertise: string[]; teachingTopics: string[]; domains: string[]; availability: Availability[];
};
export type StudentSignals = {
  careerGoal: string;
  requiredSkills: string[];   // skills the career goal requires (from the existing career skill map)
  missingSkills: string[];    // existing skill-gap output, priority ordered
  weakTopics: string[];       // existing assessment output ([] if no assessment taken)
  roadmapTopics: string[];    // existing roadmap: incomplete stages in order ([] if none)
  interests: string[];        // student's explicitly selected interests
};
export type SkillMatch = { studentTopic: string; mentorTerm: string; source: "assessment" | "interest" | "roadmap" | "skill-gap" | "career-goal" };
export type MentorMatch = {
  mentorId: string;
  matchScore: number;                         // 0–100
  components: { weakness: number; roadmap: number; careerGoal: number; availability: number }; // each 0–1
  basis: "evidence" | "interest";
  matchingSkills: SkillMatch[];
  explanation: string;
  availableSlots: UpcomingSlot[];
};

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

export function matchMentor(m: MatchMentor, s: StudentSignals, now = new Date()): MentorMatch {
  const terms = [...m.expertise, ...m.teachingTopics];
  const matches: SkillMatch[] = [];
  const hit = (topic: string, source: SkillMatch["source"], pool = terms) => {
    const t = matchTerm(topic, pool);
    if (t) matches.push({ studentTopic: topic, mentorTerm: t, source });
    return t;
  };

  // 1. Weakness (evidence) — or interests when no assessment exists.
  const basis: MentorMatch["basis"] = s.weakTopics.length ? "evidence" : "interest";
  const weakInputs = basis === "evidence" ? s.weakTopics : s.interests;
  const weakHits = weakInputs.filter((t) => hit(t, basis === "evidence" ? "assessment" : "interest", basis === "evidence" ? terms : [...terms, ...m.domains]));
  const weakness = weakInputs.length ? weakHits.length / weakInputs.length : 0;

  // 2. Roadmap priorities (or skill-gap priorities when no roadmap), earlier = more important.
  const roadmapSource = s.roadmapTopics.length ? "roadmap" : "skill-gap";
  const priorities = (s.roadmapTopics.length ? s.roadmapTopics : s.missingSkills).slice(0, 8);
  let num = 0, den = 0;
  priorities.forEach((t, i) => {
    const w = 1 / (i + 1);
    den += w;
    if (hit(t, roadmapSource)) num += w;
  });
  const roadmap = den ? num / den : 0;

  // 3. Career-goal relevance.
  const domain = GOAL_DOMAIN[s.careerGoal];
  const top = s.requiredSkills.slice(0, 5);
  const covered = top.filter((t) => matchTerm(t, terms)).length;
  const careerGoal = domain && m.domains.includes(domain) ? 1 : top.length ? covered / top.length : 0;

  // 4. Weekend availability (next 14 days).
  const slots = upcomingSlots(m.availability, now);
  const soon = slots.filter((x) => new Date(x.startAt).getTime() - now.getTime() <= 14 * 86400000);
  const availability = Math.min(1, soon.length / 2);

  const score = WEIGHTS.weakness * weakness + WEIGHTS.roadmap * roadmap + WEIGHTS.careerGoal * careerGoal + WEIGHTS.availability * availability;

  // Explanation, strongest evidence first.
  const uniq = (src: SkillMatch["source"][]) => [...new Map(matches.filter((x) => src.includes(x.source)).map((x) => [x.studentTopic, x])).values()];
  const weakM = uniq(["assessment", "interest"]);
  const planM = uniq(["roadmap", "skill-gap"]).filter((x) => !weakM.some((w) => w.studentTopic === x.studentTopic));
  const teaches = [...new Set([...weakM, ...planM].map((x) => x.mentorTerm))].slice(0, 3);
  const parts: string[] = [];
  if (weakM.length)
    parts.push(basis === "evidence"
      ? `your assessment indicates difficulty with ${list(weakM.map((x) => x.studentTopic).slice(0, 3))}`
      : `you listed an interest in ${list(weakM.map((x) => x.studentTopic).slice(0, 3))}`);
  if (planM.length)
    parts.push(`your ${roadmapSource === "roadmap" ? "current roadmap" : "skill-gap priorities"} include${planM.length === 1 ? "s" : ""} ${list(planM.map((x) => x.studentTopic).slice(0, 2))}`);
  if (!parts.length && careerGoal > 0) parts.push(`this mentor works in ${domain ?? "an area relevant to"} your ${s.careerGoal} goal`);
  let explanation = parts.length
    ? `Recommended because ${list(parts)}${teaches.length ? `, and this mentor teaches ${list(teaches)}` : ""}.`
    : "Low relevance to your current learning data.";
  if (basis === "interest") explanation += " (Interest-based: take the assessment for evidence-based matching.)";
  if (!soon.length) explanation += " No open weekend slots in the next two weeks.";

  return {
    mentorId: m.id,
    matchScore: Math.round(score * 100),
    components: { weakness: round(weakness), roadmap: round(roadmap), careerGoal: round(careerGoal), availability: round(availability) },
    basis,
    matchingSkills: [...new Map(matches.map((x) => [`${x.studentTopic}|${x.source}`, x])).values()],
    explanation,
    availableSlots: slots.slice(0, 3),
  };
}

/** Rank mentors for a student. Mentors whose only signal is availability are never returned. */
export function rankMentors(mentors: MatchMentor[], s: StudentSignals, limit = 3, now = new Date()): MentorMatch[] {
  return mentors
    .map((m) => matchMentor(m, s, now))
    .filter((r) => r.matchScore / 100 >= MIN_SCORE && r.components.weakness + r.components.roadmap + r.components.careerGoal > 0)
    .sort((a, b) => b.matchScore - a.matchScore || b.components.weakness - a.components.weakness)
    .slice(0, limit);
}
