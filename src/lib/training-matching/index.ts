// GURUKOOL Training Recommender
// ------------------------------------------------------------
// Deterministic matching of a student's existing Skill Intelligence outputs to training programs.
// Reads (never recalculates) the skill-gap analysis, saved assessment weak topics and saved roadmap.
//
// score = 0.50·weakSkills + 0.30·roadmap + 0.20·careerGoal        (each component normalised to 0–1)
//
//  weakSkills  share of the student's assessment weak topics the course covers ("evidence").
//              With no assessment: the student's interests, then skill-gap missing skills ("interest-based").
//  roadmap     priority-weighted coverage of incomplete roadmap stages (stage i weighs 1/(i+1));
//              with no roadmap, the skill-gap priority list (missing skills / prerequisites).
//  careerGoal  1 if the course category is the goal's domain, else share of the goal's top-5 required skills covered.
import { matchTerm } from "../mentor-matching/match";

export const TRAIN_WEIGHTS = { weakSkills: 0.5, roadmap: 0.3, careerGoal: 0.2 } as const;
const GOAL_DOMAIN: Record<string, string> = {
  "Backend Developer": "Backend Development",
  "Frontend Developer": "Frontend Development",
  "Full Stack Developer": "Full Stack Development",
  "AI/ML Engineer": "AI/ML",
};

export type MatchCourse = { id: string; title: string; category: string; skillTags: string[]; moduleTitles: string[] };
export type TrainingSignals = {
  careerGoal: string; requiredSkills: string[]; missingSkills: string[];
  weakTopics: string[]; roadmapTopics: string[]; interests: string[];
};
export type TrainingMatch = {
  courseId: string; matchScore: number;
  components: { weakSkills: number; roadmap: number; careerGoal: number };
  basis: "evidence" | "interest";
  relevantSkills: { studentTopic: string; courseTerm: string; source: "assessment" | "interest" | "skill-gap" | "roadmap" }[];
  explanation: string; enrollUrl: string;
};

const r2 = (x: number) => Math.round(x * 100) / 100;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const clean = (t: string) => t.replace(/^Module \d+:\s*/i, "");

export function matchCourse(c: MatchCourse, s: TrainingSignals): TrainingMatch {
  const terms = [...c.skillTags, ...c.moduleTitles.map(clean)];
  const rel: TrainingMatch["relevantSkills"] = [];
  const hit = (t: string, source: TrainingMatch["relevantSkills"][number]["source"]) => {
    const m = matchTerm(t, terms);
    if (m) rel.push({ studentTopic: t, courseTerm: m, source });
    return Boolean(m);
  };

  const basis: TrainingMatch["basis"] = s.weakTopics.length ? "evidence" : "interest";
  const weakInputs = basis === "evidence" ? s.weakTopics.map((t) => [t, "assessment"] as const)
    : (s.interests.length ? s.interests.map((t) => [t, "interest"] as const) : s.missingSkills.slice(0, 5).map((t) => [t, "skill-gap"] as const));
  const weakSkills = weakInputs.length ? weakInputs.filter(([t, src]) => hit(t, src)).length / weakInputs.length : 0;

  const roadmapSrc = s.roadmapTopics.length ? "roadmap" : "skill-gap";
  const pri = (s.roadmapTopics.length ? s.roadmapTopics : s.missingSkills).slice(0, 8);
  let num = 0, den = 0;
  pri.forEach((t, i) => { const w = 1 / (i + 1); den += w; if (hit(t, roadmapSrc)) num += w; });
  const roadmap = den ? num / den : 0;

  const top = s.requiredSkills.slice(0, 5);
  const careerGoal = GOAL_DOMAIN[s.careerGoal] === c.category ? 1 : top.length ? top.filter((t) => matchTerm(t, terms)).length / top.length : 0;
  const score = TRAIN_WEIGHTS.weakSkills * weakSkills + TRAIN_WEIGHTS.roadmap * roadmap + TRAIN_WEIGHTS.careerGoal * careerGoal;

  const uniq = (srcs: string[]) => [...new Map(rel.filter((x) => srcs.includes(x.source)).map((x) => [x.studentTopic, x])).values()];
  const weak = uniq(["assessment", "interest", ...(basis === "interest" && !s.interests.length ? ["skill-gap"] : [])]);
  const plan = uniq(["roadmap", "skill-gap"]).filter((x) => !weak.some((w) => w.studentTopic === x.studentTopic));
  const covers = [...new Set([...weak, ...plan].map((x) => x.courseTerm))].slice(0, 3);
  const parts: string[] = [];
  if (weak.length) {
    const topics = list(weak.map((x) => x.studentTopic).slice(0, 3));
    parts.push(basis === "evidence" ? `your recent assessment indicates difficulty with ${topics}`
      : s.interests.length ? `you listed an interest in ${topics}` : `your skill gap shows ${topics} as missing`);
  }
  if (plan.length) parts.push(`your ${roadmapSrc === "roadmap" ? "current roadmap" : "skill-gap priorities"} include${plan.length === 1 ? "s" : ""} ${list(plan.map((x) => x.studentTopic).slice(0, 2))}`);
  if (!parts.length && careerGoal > 0) parts.push(`it fits your ${s.careerGoal} goal`);
  let explanation = parts.length ? `Recommended because ${list(parts)}${covers.length ? `, and this training program covers ${list(covers)}` : ""}.` : "Low relevance to your current learning data.";
  if (basis === "interest") explanation += " (Interest-based: take the assessment for evidence-based recommendations.)";

  return {
    courseId: c.id, matchScore: Math.round(score * 100),
    components: { weakSkills: r2(weakSkills), roadmap: r2(roadmap), careerGoal: r2(careerGoal) },
    basis, relevantSkills: [...new Map(rel.map((x) => [`${x.studentTopic}|${x.source}`, x])).values()],
    explanation, enrollUrl: `/train/courses/${c.id}`,
  };
}

export function recommendTraining(courses: MatchCourse[], s: TrainingSignals, limit = 2): TrainingMatch[] {
  return courses.map((c) => matchCourse(c, s))
    .filter((m) => m.matchScore >= 15 && m.components.weakSkills + m.components.roadmap > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
