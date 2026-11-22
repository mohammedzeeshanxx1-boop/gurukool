// ============================================================================
// Computerised Adaptive Testing (CAT).
//
// A fixed 5-question quiz wastes most of its questions: a strong student spends
// them on items they were always going to get right, and a weak student spends
// them on items they were always going to miss. Neither tells you much.
//
// A CAT picks each item *after* seeing the previous answer, always choosing the
// one that will shrink the confidence interval around θ the most, and stops as
// soon as the estimate is precise enough. The result is typically the same
// measurement precision in roughly half the items.
//
// Three things make a naive "always pick max information" selector unusable in
// production, and all three are handled here:
//   1. Item exposure — the single most informative item near θ=0 would be served
//      to almost every new student, so it leaks. Randomesque selection picks at
//      random from the top-k instead.
//   2. Content balance — maximum information alone will happily ask five
//      questions about one skill. Selection is balanced across target skills.
//   3. Pool exhaustion — the test must terminate even when the pool runs dry.
// ============================================================================

import { estimateAbility, information, testInformation, type Ability, type Item, type Response } from "./irt";

export type CatConfig = {
  /** Stop once the standard error falls below this. 0.30 ≈ a 95% CI of ±0.59 logits. */
  targetSe: number;
  /** Never stop before this many items, however confident the estimate looks. */
  minItems: number;
  /** Never exceed this many items, however imprecise the estimate still is. */
  maxItems: number;
  /** Randomesque exposure control: choose uniformly among this many best items. */
  exposureTopK: number;
  /** Prefer a skill that has had fewer items than this before doubling up. */
  perSkillTarget: number;
};

export const CAT_DEFAULTS: CatConfig = {
  targetSe: 0.3,
  minItems: 5,
  maxItems: 15,
  exposureTopK: 3,
  perSkillTarget: 2,
};

export type CatState = {
  responses: Response[];
  ability: Ability;
  administered: Set<string>;
};

export type Selection = {
  item: Item;
  /** Information this item is expected to contribute at the current θ̂. */
  expectedInformation: number;
  /** Why this item was chosen, surfaced in the UI so the test is not a black box. */
  reason: string;
};

export type StopDecision = {
  stop: boolean;
  reason: "precision-reached" | "max-items" | "pool-exhausted" | "continue";
};

/** Start a fresh adaptive test. */
export function startTest(prior?: { theta: number; se: number }): CatState {
  return {
    responses: [],
    ability: estimateAbility([], prior ? { priorMean: prior.theta, priorSd: Math.max(prior.se, 0.3) } : {}),
    administered: new Set(),
  };
}

/**
 * Choose the next item.
 *
 * Candidates are ranked by Fisher information at the running estimate of θ,
 * restricted to whichever target skill is currently under-represented so the
 * test keeps its content blueprint. The final pick is drawn at random from the
 * top-k to control exposure.
 */
export function selectNextItem(
  pool: Item[],
  state: CatState,
  targetSkills: string[],
  cfg: CatConfig = CAT_DEFAULTS,
  rng: () => number = Math.random,
): Selection | null {
  const available = pool.filter((i) => !state.administered.has(i.id));
  if (available.length === 0) return null;

  const theta = state.ability.theta;

  // Content balancing: how many items each skill has already received.
  const seen = new Map<string, number>();
  for (const r of state.responses) seen.set(r.item.skill, (seen.get(r.item.skill) ?? 0) + 1);

  const wanted = targetSkills.length > 0 ? targetSkills : [...new Set(available.map((i) => i.skill))];
  const minSeen = Math.min(...wanted.map((s) => seen.get(s) ?? 0));
  const underserved = new Set(wanted.filter((s) => (seen.get(s) ?? 0) === minSeen && minSeen < cfg.perSkillTarget));

  let candidates = available.filter((i) => underserved.has(i.skill));
  if (candidates.length === 0) candidates = available.filter((i) => wanted.includes(i.skill));
  if (candidates.length === 0) candidates = available;

  const scored = candidates
    .map((item) => ({ item, info: information(theta, item) }))
    .sort((x, y) => y.info - x.info || x.item.id.localeCompare(y.item.id));

  const top = scored.slice(0, Math.max(1, Math.min(cfg.exposureTopK, scored.length)));
  const pick = top[Math.floor(clamp01(rng()) * top.length) % top.length];

  return {
    item: pick.item,
    expectedInformation: Math.round(pick.info * 1e4) / 1e4,
    reason: explain(pick.item, theta, state.responses.length, underserved.has(pick.item.skill)),
  };
}

function explain(item: Item, theta: number, answered: number, balancing: boolean): string {
  if (answered === 0) return `Starting near average difficulty to locate your level quickly.`;
  const gap = item.b - theta;
  const where = gap > 0.4 ? "harder than" : gap < -0.4 ? "easier than" : "matched to";
  const base = `Chosen because it is ${where} your current estimate, so the answer is most informative.`;
  return balancing ? `${base} Also keeps coverage balanced across your target skills.` : base;
}

/** Record an answer and re-estimate ability. */
export function recordAnswer(state: CatState, item: Item, correct: boolean, prior?: { theta: number; se: number }): CatState {
  const responses = [...state.responses, { item, correct }];
  const administered = new Set(state.administered);
  administered.add(item.id);
  return {
    responses,
    administered,
    ability: estimateAbility(responses, prior ? { priorMean: prior.theta, priorSd: Math.max(prior.se, 0.3) } : {}),
  };
}

/** Decide whether the test has gathered enough evidence to stop. */
export function shouldStop(state: CatState, poolRemaining: number, cfg: CatConfig = CAT_DEFAULTS): StopDecision {
  const n = state.responses.length;
  if (n >= cfg.maxItems) return { stop: true, reason: "max-items" };
  if (poolRemaining <= 0) return { stop: true, reason: "pool-exhausted" };
  if (n >= cfg.minItems && state.ability.se <= cfg.targetSe) return { stop: true, reason: "precision-reached" };
  return { stop: false, reason: "continue" };
}

/**
 * How many more items of typical quality are needed to reach the target SE.
 *
 * Information adds, and SE = 1/sqrt(I), so the remaining requirement is the
 * shortfall in information divided by what one average item contributes.
 * Used to show an honest progress bar rather than a fake "question 3 of 5".
 */
export function itemsRemaining(state: CatState, pool: Item[], cfg: CatConfig = CAT_DEFAULTS): number {
  const n = state.responses.length;
  if (n >= cfg.maxItems) return 0;

  const current = testInformation(state.ability.theta, state.responses.map((r) => r.item));
  const needed = 1 / (cfg.targetSe * cfg.targetSe);
  if (current >= needed) return Math.max(0, cfg.minItems - n);

  const unused = pool.filter((i) => !state.administered.has(i.id));
  if (unused.length === 0) return 0;

  const avg = unused.reduce((s, i) => s + information(state.ability.theta, i), 0) / unused.length;
  if (avg <= 1e-6) return Math.max(0, cfg.minItems - n);

  const est = Math.ceil((needed - current) / avg);
  return clampInt(Math.max(est, cfg.minItems - n), 0, cfg.maxItems - n);
}

/** A human-readable summary of where the student landed. */
export function describeAbility(a: Ability): { band: string; percentile: number; blurb: string } {
  const percentile = Math.round(normal(a.theta) * 100);
  const band =
    a.theta >= 1.5 ? "Advanced" :
    a.theta >= 0.5 ? "Proficient" :
    a.theta >= -0.5 ? "Developing" :
    "Foundational";
  const precision = a.se <= 0.3 ? "a confident" : a.se <= 0.5 ? "a reasonable" : "a provisional";
  return {
    band,
    percentile,
    blurb: `${precision} estimate from ${a.responses} item${a.responses === 1 ? "" : "s"} (SE ${a.se.toFixed(2)}).`,
  };
}

const clamp01 = (x: number) => Math.min(0.999999, Math.max(0, x));
const clampInt = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function normal(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
