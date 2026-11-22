// ============================================================================
// Bayesian Knowledge Tracing (Corbett & Anderson, 1995).
//
// IRT measures ability at a point in time. It deliberately assumes θ is fixed
// while the test runs — which is exactly wrong for a *learning* platform, where
// the student is supposed to be getting better between attempts.
//
// BKT models the thing IRT leaves out: the latent binary state "has this skill
// been learned yet", updated after every practice opportunity. It is the
// standard model behind intelligent tutoring systems (Cognitive Tutor, ASSISTments).
//
// Four parameters per skill:
//   pInit  P(L₀)  probability the skill is already known before any practice
//   pLearn P(T)   probability of transitioning from unlearned to learned per attempt
//   pSlip  P(S)   probability of answering wrong despite knowing it
//   pGuess P(G)   probability of answering right without knowing it
//
// Together these separate "got it right" from "knows it", which is the whole
// point: on a 4-option MCQ, a correct answer from a student who knows nothing
// happens 25% of the time.
// ============================================================================

export type BktParams = {
  pInit: number;
  pLearn: number;
  pSlip: number;
  pGuess: number;
};

/**
 * Defaults in the range reported across the ITS literature. pGuess is pinned
 * near 1/options for multiple choice, and both pSlip and pGuess are capped
 * below 0.5 — above that the model becomes degenerate, since a "correct"
 * answer would be evidence *against* knowing the skill.
 */
export const BKT_DEFAULTS: BktParams = {
  pInit: 0.25,
  pLearn: 0.18,
  pSlip: 0.10,
  pGuess: 0.25,
};

export type Opportunity = {
  correct: boolean;
  at?: Date;
};

export type BktState = {
  /** P(skill is learned) after all observations so far. */
  pKnown: number;
  /** Number of practice opportunities observed. */
  opportunities: number;
  /** P(next answer correct) under the current belief. */
  pCorrectNext: number;
  /** Opportunities still expected before pKnown crosses the mastery threshold. */
  expectedToMastery: number;
  mastered: boolean;
};

export const MASTERY_THRESHOLD = 0.95;

/** Guard parameters into the range where the model is well-behaved. */
export function sanitise(p: Partial<BktParams> = {}): BktParams {
  const c = (x: number | undefined, d: number, hi = 0.99) => clamp(x ?? d, 0.01, hi);
  return {
    pInit: c(p.pInit, BKT_DEFAULTS.pInit),
    pLearn: c(p.pLearn, BKT_DEFAULTS.pLearn),
    // Degenerate above 0.5 — see the note at the top of the file.
    pSlip: c(p.pSlip, BKT_DEFAULTS.pSlip, 0.49),
    pGuess: c(p.pGuess, BKT_DEFAULTS.pGuess, 0.49),
  };
}

/**
 * Posterior P(learned) after observing one answer, then applying the learning
 * transition. Bayes on the evidence, then the student may have learned it from
 * the attempt itself — which is why practice helps even when answered wrong.
 */
export function update(pKnown: number, correct: boolean, params: BktParams): number {
  const { pLearn, pSlip, pGuess } = params;
  const prior = clamp(pKnown, 1e-6, 1 - 1e-6);

  const posterior = correct
    ? (prior * (1 - pSlip)) / (prior * (1 - pSlip) + (1 - prior) * pGuess)
    : (prior * pSlip) / (prior * pSlip + (1 - prior) * (1 - pGuess));

  // Transition: unlearned → learned with probability pLearn.
  return clamp(posterior + (1 - posterior) * pLearn, 0, 1);
}

/** P(the next answer is correct) given the current belief. */
export function predict(pKnown: number, params: BktParams): number {
  const { pSlip, pGuess } = params;
  return clamp(pKnown * (1 - pSlip) + (1 - pKnown) * pGuess, 0, 1);
}

/** Run the full observation sequence for one skill. */
export function trace(opportunities: Opportunity[], params: Partial<BktParams> = {}): BktState {
  const p = sanitise(params);
  let pKnown = p.pInit;
  for (const o of opportunities) pKnown = update(pKnown, o.correct, p);

  return {
    pKnown: round(pKnown),
    opportunities: opportunities.length,
    pCorrectNext: round(predict(pKnown, p)),
    expectedToMastery: opportunitiesToMastery(pKnown, p),
    mastered: pKnown >= MASTERY_THRESHOLD,
  };
}

/**
 * How many more correct practice opportunities until P(known) reaches the
 * mastery threshold, assuming the student answers correctly each time.
 *
 * This is the optimistic bound, and it is the honest one to show: it answers
 * "how close am I if things go well", not "how close am I on average".
 */
export function opportunitiesToMastery(pKnown: number, params: BktParams, cap = 20): number {
  let p = clamp(pKnown, 0, 1);
  for (let n = 0; n < cap; n++) {
    if (p >= MASTERY_THRESHOLD) return n;
    p = update(p, true, params);
  }
  return cap;
}

/**
 * Fit pSlip and pGuess from aggregate response data for one skill.
 *
 * Proper BKT fitting is expectation-maximisation or brute-force grid search over
 * all four parameters against full per-student sequences. With the volume a new
 * platform has, that overfits badly. These two moment-based estimates are
 * stable at low volume and are the parameters that matter most for scoring:
 *
 *   pGuess ← accuracy among students whose other evidence says they do not know it
 *   pSlip  ← error rate among students whose other evidence says they do
 */
export function fitSlipGuess(
  data: { correct: boolean; believedKnown: boolean }[],
  prior: BktParams = BKT_DEFAULTS,
  minPerCell = 10,
): BktParams {
  const known = data.filter((d) => d.believedKnown);
  const unknown = data.filter((d) => !d.believedKnown);

  const pSlip = known.length >= minPerCell
    ? known.filter((d) => !d.correct).length / known.length
    : prior.pSlip;

  const pGuess = unknown.length >= minPerCell
    ? unknown.filter((d) => d.correct).length / unknown.length
    : prior.pGuess;

  return sanitise({ ...prior, pSlip, pGuess });
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number) => Math.round(x * 1e4) / 1e4;
