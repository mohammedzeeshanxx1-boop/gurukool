// ============================================================================
// Retention modelling and spaced-repetition scheduling.
//
// Every model above answers "do they know it now". None answers "will they
// still know it at the interview in six weeks" — and a skill learned in March
// and never revisited is not a skill you can claim in September.
//
// This implements half-life regression in the style of Duolingo's published
// model, built on the Ebbinghaus forgetting curve:
//
//     retrievability  r(t) = 2^(−t / h)
//
// where h is the memory half-life: the time at which recall probability has
// decayed to 50%. Each successful recall multiplies h (the spacing effect);
// each lapse cuts it back. Reviews are scheduled at the moment r is predicted
// to fall to a target retention, which is what makes the schedule expanding
// rather than fixed.
// ============================================================================

export type ReviewOutcome = {
  correct: boolean;
  at: Date;
};

export type RetentionState = {
  /** Current memory half-life in days. */
  halfLifeDays: number;
  /** Predicted probability of recalling the skill right now, in [0,1]. */
  retrievability: number;
  /** When retrievability is predicted to hit the target retention. */
  nextReviewAt: Date;
  /** Days until that review. Negative means the review is already overdue. */
  daysUntilReview: number;
  /** True once retrievability has already fallen below target. */
  due: boolean;
  /** Review urgency, for sorting a revision queue. */
  priority: "overdue" | "due-soon" | "scheduled";
};

export type RetentionConfig = {
  initialHalfLifeDays: number;
  successFactor: number;
  lapseFactor: number;
  maxHalfLifeDays: number;
  minHalfLifeDays: number;
  targetRetention: number;
  dueSoonDays: number;
};

export const RETENTION: RetentionConfig = {
  /** Half-life for a skill that has just been learned for the first time. */
  initialHalfLifeDays: 1,
  /** Multiplier applied on a successful recall — the spacing effect. */
  successFactor: 2.2,
  /** Multiplier applied on a lapse. Forgetting costs more than one success gains. */
  lapseFactor: 0.45,
  /** Never schedule further out than this. */
  maxHalfLifeDays: 180,
  minHalfLifeDays: 0.25,
  /** Review when predicted recall drops to this. */
  targetRetention: 0.85,
  /** Within this many days of the review date, treat it as due soon. */
  dueSoonDays: 2,
};

const DAY = 86_400_000;

/** Ebbinghaus retrievability after `days` have elapsed with half-life `h`. */
export const retrievability = (days: number, halfLifeDays: number) =>
  halfLifeDays <= 0 ? 0 : clamp(Math.pow(2, -Math.max(0, days) / halfLifeDays), 0, 1);

/**
 * Days from a review until retrievability decays to the target.
 *
 *   r = 2^(−t/h) = target   ⟹   t = h · log₂(1/target)
 */
export const intervalForTarget = (halfLifeDays: number, target: number = RETENTION.targetRetention) =>
  halfLifeDays * Math.log2(1 / clamp(target, 0.01, 0.999));

/**
 * Replay a review history into a current retention state.
 *
 * The half-life is grown or cut per outcome, then the elapsed time since the
 * last review is used to project forward to today. A lapse on a long-matured
 * item is penalised proportionally, not reset to zero — the student has not
 * lost everything just because they missed one question.
 */
export function traceRetention(
  history: ReviewOutcome[],
  now: Date = new Date(),
  cfg: RetentionConfig = RETENTION,
): RetentionState {
  if (history.length === 0) {
    return {
      halfLifeDays: 0,
      retrievability: 0,
      nextReviewAt: now,
      daysUntilReview: 0,
      due: true,
      priority: "overdue",
    };
  }

  const sorted = [...history].sort((a, b) => a.at.getTime() - b.at.getTime());
  let h: number = cfg.initialHalfLifeDays;
  let last = sorted[0].at;

  for (let i = 0; i < sorted.length; i++) {
    const o = sorted[i];
    if (i > 0) {
      // Reviewing later than necessary still strengthens memory, so the
      // elapsed gap is folded in rather than ignored.
      const gap = (o.at.getTime() - last.getTime()) / DAY;
      const r = retrievability(gap, h);
      // Harder recalls (lower r at review time) produce bigger gains.
      const difficultyBonus = o.correct ? 1 + (1 - r) * 0.5 : 1;
      h = o.correct ? h * cfg.successFactor * difficultyBonus : h * cfg.lapseFactor;
    } else {
      h = o.correct ? h * cfg.successFactor : h * cfg.lapseFactor;
    }
    h = clamp(h, cfg.minHalfLifeDays, cfg.maxHalfLifeDays);
    last = o.at;
  }

  const elapsed = (now.getTime() - last.getTime()) / DAY;
  const r = retrievability(elapsed, h);
  const interval = intervalForTarget(h, cfg.targetRetention);
  const nextReviewAt = new Date(last.getTime() + interval * DAY);
  const daysUntilReview = (nextReviewAt.getTime() - now.getTime()) / DAY;

  return {
    halfLifeDays: round(h),
    retrievability: round(r),
    nextReviewAt,
    daysUntilReview: round(daysUntilReview),
    due: daysUntilReview <= 0,
    priority: daysUntilReview <= 0 ? "overdue" : daysUntilReview <= cfg.dueSoonDays ? "due-soon" : "scheduled",
  };
}

export type ReviewQueueEntry = {
  skill: string;
  state: RetentionState;
};

/**
 * Build the revision queue, most urgent first.
 *
 * Ordering is by predicted retrievability ascending, so the skills closest to
 * being forgotten come first — rather than by calendar date, which would keep
 * surfacing items the student still remembers perfectly well.
 */
export function reviewQueue(
  histories: Record<string, ReviewOutcome[]>,
  now: Date = new Date(),
  limit = 10,
): ReviewQueueEntry[] {
  return Object.entries(histories)
    .map(([skill, h]) => ({ skill, state: traceRetention(h, now) }))
    .filter((e) => e.state.halfLifeDays > 0)
    .sort((a, b) => a.state.retrievability - b.state.retrievability || a.skill.localeCompare(b.skill))
    .slice(0, limit);
}

/**
 * Blend a point-in-time proficiency with how well it is predicted to have been
 * retained. A skill measured at 0.9 six months ago is not a 0.9 today.
 */
export function decayedProficiency(proficiency: number, state: RetentionState): number {
  if (state.halfLifeDays <= 0) return round(proficiency);
  // Retention can erode a score toward the guessing floor but never below it.
  const floor = 0.25;
  return round(floor + (proficiency - floor) * state.retrievability);
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number) => Math.round(x * 1e4) / 1e4;
