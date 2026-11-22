// ============================================================================
// Skill profile — the fusion layer.
//
// Three models answer three different questions, and a learner needs all three:
//
//   IRT        how able are they, measured against item difficulty  (how good)
//   BKT        has the skill been acquired across practice attempts (learned yet)
//   Retention  will it still be there in six weeks                  (will it last)
//
// Each is unreliable alone. IRT on five items has a wide standard error. BKT is
// blind to item difficulty. Retention says nothing about whether the skill was
// ever learned. Combining them with weights that reflect how much evidence each
// model actually has produces a single number that is defensible, plus the
// component parts so the UI can explain where that number came from.
// ============================================================================

import { estimateAbility, thetaToProficiency, type Item, type Response } from "./irt";
import { trace, type BktParams, type Opportunity } from "./bkt";
import { traceRetention, decayedProficiency, type ReviewOutcome, type RetentionState } from "./retention";

export type SkillEvidence = {
  skill: string;
  /** Scored responses with calibrated item parameters, for the IRT estimate. */
  responses: Response[];
  /** Ordered practice attempts, for knowledge tracing. */
  opportunities: Opportunity[];
  /** Review history, for the forgetting curve. */
  reviews: ReviewOutcome[];
  /** Whether the student listed this skill on their profile. */
  declared: boolean;
};

export type SkillProfile = {
  skill: string;

  /** Fused proficiency in [0,1], after retention decay. */
  proficiency: number;
  /** Proficiency before retention decay was applied. */
  measuredProficiency: number;

  irt: { theta: number; se: number; proficiency: number; items: number };
  bkt: { pKnown: number; pCorrectNext: number; opportunities: number; toMastery: number };
  retention: RetentionState;

  /** How much to trust this estimate, in [0,1]. Drives sorting and UI hedging. */
  confidence: number;
  status: "mastered" | "proficient" | "developing" | "gap" | "unassessed";
  /** Plain-language account of what the evidence is. Never a bare number. */
  rationale: string;
};

export const FUSION = {
  /** Base weights before evidence-volume adjustment. */
  wIrt: 0.5,
  wBkt: 0.3,
  wDeclared: 0.2,
  /** Responses at which the IRT estimate is treated as fully informative. */
  irtSaturation: 8,
  /** Opportunities at which the BKT estimate is treated as fully informative. */
  bktSaturation: 6,
  /** Proficiency a self-declared but unverified skill is credited with. */
  declaredPrior: 0.55,
  undeclaredPrior: 0.25,
  thresholds: { mastered: 0.8, proficient: 0.65, developing: 0.45 },
} as const;

/**
 * Build the fused profile for one skill.
 *
 * Weights are scaled by how much evidence each model has, then renormalised, so
 * a skill with one quiz answer leans on the declared prior while a skill with
 * twelve answers is driven almost entirely by IRT. This avoids the failure mode
 * where a single lucky guess reads as competence.
 */
export function buildSkillProfile(e: SkillEvidence, bktParams: Partial<BktParams> = {}, now = new Date()): SkillProfile {
  const ability = estimateAbility(e.responses, {
    priorMean: e.declared ? 0.25 : -0.25,
    priorSd: 1,
  });
  const irtProf = thetaToProficiency(ability.theta);
  const bkt = trace(e.opportunities, bktParams);
  const retention = traceRetention(e.reviews, now);

  // Evidence-scaled weights.
  const irtWeight = FUSION.wIrt * saturate(e.responses.length, FUSION.irtSaturation);
  const bktWeight = FUSION.wBkt * saturate(e.opportunities.length, FUSION.bktSaturation);
  const priorWeight = FUSION.wDeclared;
  const total = irtWeight + bktWeight + priorWeight;

  const prior = e.declared ? FUSION.declaredPrior : FUSION.undeclaredPrior;
  const measured = (irtProf * irtWeight + bkt.pKnown * bktWeight + prior * priorWeight) / total;

  const proficiency = e.reviews.length > 0 ? decayedProficiency(measured, retention) : round(measured);

  const evidenceCount = e.responses.length + e.opportunities.length;
  const confidence = round(
    clamp((irtWeight + bktWeight) / (FUSION.wIrt + FUSION.wBkt), 0, 1) * (ability.se > 0 ? clamp(0.5 / ability.se, 0, 1) : 1),
  );

  return {
    skill: e.skill,
    proficiency: round(proficiency),
    measuredProficiency: round(measured),
    irt: { theta: ability.theta, se: ability.se, proficiency: irtProf, items: e.responses.length },
    bkt: { pKnown: bkt.pKnown, pCorrectNext: bkt.pCorrectNext, opportunities: bkt.opportunities, toMastery: bkt.expectedToMastery },
    retention,
    confidence,
    status: classify(proficiency, evidenceCount, confidence),
    rationale: explain(e, ability, bkt, retention, proficiency),
  };
}

function classify(p: number, evidence: number, confidence: number): SkillProfile["status"] {
  if (evidence === 0) return "unassessed";
  const t = FUSION.thresholds;
  // A high score on thin evidence is not a claim of mastery.
  if (p >= t.mastered && confidence >= 0.5) return "mastered";
  if (p >= t.proficient) return "proficient";
  if (p >= t.developing) return "developing";
  return "gap";
}

function explain(
  e: SkillEvidence,
  ability: ReturnType<typeof estimateAbility>,
  bkt: ReturnType<typeof trace>,
  retention: RetentionState,
  proficiency: number,
): string {
  const parts: string[] = [];

  if (e.responses.length === 0 && e.opportunities.length === 0) {
    return e.declared
      ? "You listed this skill, but it has not been assessed yet. Take a quiz to turn it into verified evidence."
      : "No evidence yet. This skill has not been listed or assessed.";
  }

  if (e.responses.length > 0) {
    const correct = e.responses.filter((r) => r.correct).length;
    const avgDiff = e.responses.reduce((s, r) => s + r.item.b, 0) / e.responses.length;
    const level = avgDiff > 0.5 ? "harder-than-average" : avgDiff < -0.5 ? "easier-than-average" : "average-difficulty";
    parts.push(`${correct}/${e.responses.length} correct on ${level} items (ability ${ability.theta >= 0 ? "+" : ""}${ability.theta.toFixed(2)} ± ${ability.se.toFixed(2)})`);
  }

  if (e.opportunities.length > 0) {
    parts.push(
      bkt.mastered
        ? `knowledge tracing puts P(known) at ${pct(bkt.pKnown)} across ${bkt.opportunities} attempts`
        : `knowledge tracing puts P(known) at ${pct(bkt.pKnown)}; about ${bkt.expectedToMastery} more correct attempts would reach mastery`,
    );
  }

  if (retention.halfLifeDays > 0) {
    parts.push(
      retention.due
        ? `recall has decayed to ${pct(retention.retrievability)} — due for review`
        : `recall holding at ${pct(retention.retrievability)}, next review in ${Math.max(0, Math.round(retention.daysUntilReview))} days`,
    );
  }

  const head = `Estimated ${pct(proficiency)}`;
  return `${head} — ${parts.join("; ")}.`;
}

/**
 * Order skills for the next study session.
 *
 * Overdue reviews outrank new material: re-securing something half-remembered
 * is cheaper than learning something new, and losing it wastes the earlier work.
 */
export function studyPriority(profiles: SkillProfile[], limit = 5): { skill: string; why: string }[] {
  const score = (p: SkillProfile) => {
    if (p.retention.priority === "overdue") return 100 - p.retention.retrievability * 10;
    if (p.status === "unassessed") return 60 - p.confidence * 10;
    if (p.status === "gap") return 50 + (1 - p.proficiency) * 10;
    if (p.status === "developing") return 30 + (1 - p.proficiency) * 10;
    if (p.retention.priority === "due-soon") return 25;
    return 10 - p.proficiency * 5;
  };

  return [...profiles]
    .sort((a, b) => score(b) - score(a) || a.skill.localeCompare(b.skill))
    .slice(0, limit)
    .map((p) => ({
      skill: p.skill,
      why:
        p.retention.priority === "overdue" ? `Review now — recall has fallen to ${pct(p.retention.retrievability)}`
        : p.status === "unassessed" ? "Never assessed — a quiz here tells us the most"
        : p.status === "gap" ? `Weakest area at ${pct(p.proficiency)}`
        : p.status === "developing" ? `Close to proficient at ${pct(p.proficiency)} — worth finishing`
        : p.retention.priority === "due-soon" ? "Review due within two days"
        : "Keeping it fresh",
    }));
}

/**
 * Which skills the next adaptive test should target: the ones where the
 * measurement is least certain, since those are where new items buy the most
 * information. This is the content blueprint handed to the CAT selector.
 */
export function nextTestBlueprint(profiles: SkillProfile[], k = 4): string[] {
  return [...profiles]
    .filter((p) => p.status !== "mastered")
    .sort((a, b) => a.confidence - b.confidence || b.irt.se - a.irt.se || a.skill.localeCompare(b.skill))
    .slice(0, k)
    .map((p) => p.skill);
}

/** Pool filter: items for the skills in the blueprint. */
export const poolFor = (pool: Item[], skills: string[]) => pool.filter((i) => skills.includes(i.skill));

const saturate = (n: number, at: number) => clamp(n / at, 0, 1);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number) => Math.round(x * 1e4) / 1e4;
const pct = (x: number) => `${Math.round(x * 100)}%`;
