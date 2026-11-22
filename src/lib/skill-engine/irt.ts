// ============================================================================
// Item Response Theory — 3-parameter logistic (3PL) model.
//
// The Beta–Bernoulli model in mastery.ts treats every question as equally
// informative: answering a trivial question correctly moves the estimate as
// much as answering a hard one. IRT fixes that by giving every *item* its own
// parameters and estimating the student's latent ability θ against them.
//
//   a — discrimination: how sharply the item separates students near its difficulty
//   b — difficulty:     the ability level at which the item is answered correctly 50%
//                       of the time (above the guessing floor)
//   c — pseudo-guessing: the floor probability for a student of very low ability.
//                       For 4-option MCQs this is ~0.25, which is why a 2PL model
//                       systematically overestimates ability on multiple choice.
//
// This is the same family of models used by GRE, GMAT and other standardised
// adaptive tests. θ is on a standard-normal scale: 0 is average, ±1 is one SD.
// ============================================================================

/** Scaling constant that aligns the logistic ogive with the normal ogive. */
export const D = 1.702;

export type ItemParams = {
  /** Discrimination (slope). Typical range 0.5–2.5; higher is a sharper item. */
  a: number;
  /** Difficulty on the θ scale. Typical range −3…+3. */
  b: number;
  /** Pseudo-guessing floor in [0, 1). 1/options for a well-formed MCQ. */
  c: number;
};

export type Item = ItemParams & {
  id: string;
  skill: string;
};

export type Response = {
  item: Item;
  correct: boolean;
};

export type Ability = {
  /** Expected a posteriori estimate of latent ability. */
  theta: number;
  /** Posterior standard deviation — the standard error of measurement. */
  se: number;
  /** Test information at θ̂. SE = 1/sqrt(information). */
  information: number;
  /** Number of responses the estimate is based on. */
  responses: number;
  /** Probability the student is above the mastery cut-score. */
  pMastery: number;
};

export const DEFAULTS = {
  /** Prior on θ. Standard normal is the conventional choice. */
  priorMean: 0,
  priorSd: 1,
  /** Quadrature grid for EAP integration. */
  gridMin: -4,
  gridMax: 4,
  gridStep: 0.1,
  /** θ above which a skill counts as mastered (≈ 69th percentile). */
  masteryCut: 0.5,
  /** Fallback item parameters when an item has never been calibrated. */
  defaultA: 1.0,
  defaultB: 0.0,
  defaultC: 0.25,
} as const;

// ── Core model ──────────────────────────────────────────────────────────────

/**
 * P(correct | θ) under the 3PL model.
 * Reduces to 2PL when c = 0 and to 1PL (Rasch) when additionally a = 1.
 */
export function prob(theta: number, item: ItemParams): number {
  const c = clamp(item.c, 0, 0.99);
  const z = D * item.a * (theta - item.b);
  // Numerically stable logistic.
  const logistic = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  return c + (1 - c) * logistic;
}

/**
 * Fisher information contributed by an item at ability θ.
 *
 *   I(θ) = D²a² · (P − c)²/(1 − c)² · (1 − P)/P
 *
 * This is what makes adaptive testing work: the next item to administer is the
 * one that maximises this quantity at the current estimate. For c = 0 it
 * collapses to the familiar D²a²·P(1−P), which peaks at b.
 */
export function information(theta: number, item: ItemParams): number {
  const c = clamp(item.c, 0, 0.99);
  const p = prob(theta, item);
  if (p <= c || p >= 1 || p <= 0) return 0;
  const ratio = (p - c) / (1 - c);
  return D * D * item.a * item.a * ratio * ratio * ((1 - p) / p);
}

// ── Ability estimation (EAP over a quadrature grid) ─────────────────────────

/**
 * Expected a posteriori (EAP) estimate of θ.
 *
 * Maximum likelihood is the textbook alternative but it diverges to ±∞ for
 * all-correct or all-incorrect response patterns, which is common on a 5-item
 * quiz. EAP integrates against a prior, so it is always finite and degrades
 * gracefully to the prior mean when there is no evidence — exactly the
 * behaviour we want for a student who has just signed up.
 */
export function estimateAbility(
  responses: Response[],
  opts: { priorMean?: number; priorSd?: number; masteryCut?: number } = {},
): Ability {
  const priorMean = opts.priorMean ?? DEFAULTS.priorMean;
  const priorSd = opts.priorSd ?? DEFAULTS.priorSd;
  const cut = opts.masteryCut ?? DEFAULTS.masteryCut;

  const nodes = grid();
  // log posterior ∝ log prior + Σ log likelihood
  const logPost = nodes.map((t) => {
    const z = (t - priorMean) / priorSd;
    let lp = -0.5 * z * z;
    for (const r of responses) {
      const p = clamp(prob(t, r.item), 1e-9, 1 - 1e-9);
      lp += r.correct ? Math.log(p) : Math.log(1 - p);
    }
    return lp;
  });

  // Subtract the max before exponentiating to avoid underflow.
  const max = Math.max(...logPost);
  const w = logPost.map((lp) => Math.exp(lp - max));
  const total = w.reduce((s, x) => s + x, 0);
  if (!(total > 0) || !Number.isFinite(total)) {
    return { theta: priorMean, se: priorSd, information: 0, responses: responses.length, pMastery: 0.5 };
  }

  let theta = 0;
  for (let i = 0; i < nodes.length; i++) theta += nodes[i] * w[i];
  theta /= total;

  let varSum = 0;
  for (let i = 0; i < nodes.length; i++) varSum += (nodes[i] - theta) ** 2 * w[i];
  const se = Math.sqrt(varSum / total);

  // Posterior mass above the mastery cut-score.
  let above = 0;
  for (let i = 0; i < nodes.length; i++) if (nodes[i] >= cut) above += w[i];

  const info = responses.reduce((s, r) => s + information(theta, r.item), 0);

  return {
    theta: round(theta),
    se: round(se),
    information: round(info),
    responses: responses.length,
    pMastery: round(above / total),
  };
}

/** Test information function evaluated at θ, summed over a set of items. */
export function testInformation(theta: number, items: ItemParams[]): number {
  return items.reduce((s, it) => s + information(theta, it), 0);
}

/** Standard error implied by a given amount of test information. */
export const seFromInformation = (info: number) => (info > 0 ? 1 / Math.sqrt(info) : Infinity);

// ── Item calibration from historical responses ──────────────────────────────

export type ItemStats = {
  id: string;
  skill: string;
  /** Number of students who answered correctly. */
  correct: number;
  /** Total attempts. */
  total: number;
  /**
   * Point-biserial correlation between answering this item correctly and the
   * student's total score. The standard discrimination index from classical
   * item analysis.
   */
  pointBiserial?: number;
  /** Number of answer options, used to set the guessing floor. */
  options?: number;
};

/**
 * Convert classical item statistics into 3PL parameters.
 *
 * Proper calibration is marginal maximum likelihood over the full response
 * matrix (an EM procedure), which needs hundreds of responses per item before
 * it is stable. Until a platform has that volume, the defensible approach is
 * the classical-to-IRT conversion used in test development:
 *
 *   b ← probit of the corrected difficulty (normal-ogive approximation)
 *   a ← r_pb / sqrt(1 − r_pb²), the biserial-to-slope transform
 *
 * Items with too few attempts keep neutral defaults so they can still be
 * administered without distorting anyone's estimate.
 */
export function calibrate(s: ItemStats, minAttempts = 20): Item {
  const options = s.options ?? 4;
  const c = options > 1 ? 1 / options : DEFAULTS.defaultC;

  if (s.total < minAttempts || s.total <= 0) {
    return { id: s.id, skill: s.skill, a: DEFAULTS.defaultA, b: DEFAULTS.defaultB, c };
  }

  const pRaw = clamp(s.correct / s.total, 0.01, 0.99);
  // Remove the share of correct answers attributable to guessing, so a question
  // everyone gets right by chance is not recorded as genuinely easy.
  const pTrue = clamp((pRaw - c) / (1 - c), 0.01, 0.99);
  const b = clamp(-probit(pTrue), -3, 3);

  const rpb = clamp(s.pointBiserial ?? 0.3, -0.95, 0.95);
  const a = rpb <= 0 ? 0.4 : clamp(rpb / Math.sqrt(1 - rpb * rpb), 0.3, 2.5);

  return { id: s.id, skill: s.skill, a: round(a), b: round(b), c: round(c) };
}

/** Convert a latent ability to the 0–1 proficiency scale the rest of the app uses. */
export const thetaToProficiency = (theta: number) => round(normalCdf(theta));

/** Inverse of {@link thetaToProficiency}. */
export const proficiencyToTheta = (p: number) => round(probit(clamp(p, 0.001, 0.999)));

// ── Numeric helpers ─────────────────────────────────────────────────────────

function grid(): number[] {
  const out: number[] = [];
  const steps = Math.round((DEFAULTS.gridMax - DEFAULTS.gridMin) / DEFAULTS.gridStep);
  for (let i = 0; i <= steps; i++) out.push(DEFAULTS.gridMin + i * DEFAULTS.gridStep);
  return out;
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number) => Math.round(x * 1e4) / 1e4;

/** Standard normal CDF via the Abramowitz–Stegun erf approximation. */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Inverse standard normal CDF (probit), via Acklam's rational approximation.
 * Accurate to about 1.15e-9 across the open interval.
 */
export function probit(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > pHigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
         (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
