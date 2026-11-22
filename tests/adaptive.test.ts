import { describe, it, expect } from "vitest";
import {
  prob, information, estimateAbility, calibrate, probit, normalCdf,
  thetaToProficiency, proficiencyToTheta, testInformation, seFromInformation,
  type Item,
} from "../src/lib/skill-engine/irt";
import {
  startTest, selectNextItem, recordAnswer, shouldStop, itemsRemaining, describeAbility, CAT_DEFAULTS,
} from "../src/lib/skill-engine/cat";
import { update, predict, trace, opportunitiesToMastery, fitSlipGuess, sanitise, BKT_DEFAULTS } from "../src/lib/skill-engine/bkt";
import { retrievability, intervalForTarget, traceRetention, reviewQueue, decayedProficiency, RETENTION } from "../src/lib/skill-engine/retention";
import { buildSkillProfile, studyPriority, nextTestBlueprint, type SkillEvidence } from "../src/lib/skill-engine/profile";

const item = (over: Partial<Item> = {}): Item => ({ id: "i1", skill: "React", a: 1, b: 0, c: 0.25, ...over });
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY);

// ─────────────────────────────── IRT ───────────────────────────────

describe("IRT 3PL model", () => {
  it("returns the guessing floor for very low ability", () => {
    expect(prob(-6, item({ c: 0.25 }))).toBeCloseTo(0.25, 2);
  });

  it("approaches 1 for very high ability", () => {
    expect(prob(6, item())).toBeGreaterThan(0.99);
  });

  it("sits midway between c and 1 at θ = b", () => {
    // P(b) = c + (1-c)/2
    expect(prob(0, item({ b: 0, c: 0.25 }))).toBeCloseTo(0.625, 4);
  });

  it("is monotonically increasing in ability", () => {
    const it0 = item();
    for (let t = -3; t < 3; t += 0.5) {
      expect(prob(t + 0.5, it0)).toBeGreaterThan(prob(t, it0));
    }
  });

  it("makes harder items less likely to be answered correctly", () => {
    expect(prob(0, item({ b: 2 }))).toBeLessThan(prob(0, item({ b: -2 })));
  });

  it("gives a higher discrimination a steeper curve around b", () => {
    const sharp = prob(0.5, item({ a: 2.5 })) - prob(-0.5, item({ a: 2.5 }));
    const flat = prob(0.5, item({ a: 0.5 })) - prob(-0.5, item({ a: 0.5 }));
    expect(sharp).toBeGreaterThan(flat);
  });
});

describe("Fisher information", () => {
  it("reduces to the 2PL form D²a²P(1-P) when c = 0", () => {
    const D = 1.702, a = 1.3;
    const it0 = item({ a, b: 0.4, c: 0 });
    const theta = 0.1;
    const p = prob(theta, it0);
    expect(information(theta, it0)).toBeCloseTo(D * D * a * a * p * (1 - p), 6);
  });

  it("peaks near the item difficulty", () => {
    const it0 = item({ b: 1.0, c: 0 });
    const atB = information(1.0, it0);
    expect(atB).toBeGreaterThan(information(-1.0, it0));
    expect(atB).toBeGreaterThan(information(3.0, it0));
  });

  it("increases with discrimination", () => {
    expect(information(0, item({ a: 2 }))).toBeGreaterThan(information(0, item({ a: 0.6 })));
  });

  it("is never negative", () => {
    for (let t = -4; t <= 4; t += 0.5) expect(information(t, item())).toBeGreaterThanOrEqual(0);
  });

  it("converts to standard error as 1/sqrt(I)", () => {
    expect(seFromInformation(4)).toBeCloseTo(0.5, 10);
    expect(seFromInformation(0)).toBe(Infinity);
  });
});

describe("EAP ability estimation", () => {
  it("returns the prior mean with no responses", () => {
    const a = estimateAbility([]);
    expect(a.theta).toBeCloseTo(0, 6);
    expect(a.se).toBeCloseTo(1, 1);
    expect(a.responses).toBe(0);
  });

  it("stays finite for an all-correct pattern, where MLE would diverge", () => {
    const rs = [0, 1, 2].map((i) => ({ item: item({ id: `i${i}`, b: i - 1 }), correct: true }));
    const a = estimateAbility(rs);
    expect(Number.isFinite(a.theta)).toBe(true);
    expect(a.theta).toBeGreaterThan(0);
    expect(a.theta).toBeLessThan(4);
  });

  it("stays finite for an all-incorrect pattern", () => {
    const rs = [0, 1, 2].map((i) => ({ item: item({ id: `i${i}` }), correct: false }));
    const a = estimateAbility(rs);
    expect(Number.isFinite(a.theta)).toBe(true);
    expect(a.theta).toBeLessThan(0);
  });

  it("raises the estimate for correct answers and lowers it for wrong ones", () => {
    const right = estimateAbility([{ item: item(), correct: true }]).theta;
    const wrong = estimateAbility([{ item: item(), correct: false }]).theta;
    expect(right).toBeGreaterThan(wrong);
  });

  it("shrinks the standard error as evidence accumulates", () => {
    const few = estimateAbility([{ item: item({ id: "a" }), correct: true }]);
    const many = estimateAbility(
      Array.from({ length: 12 }, (_, i) => ({ item: item({ id: `x${i}`, b: (i % 5) - 2 }), correct: i % 3 !== 0 })),
    );
    expect(many.se).toBeLessThan(few.se);
  });

  it("credits a correct answer on a hard item more than on an easy one", () => {
    const hard = estimateAbility([{ item: item({ b: 2, c: 0 }), correct: true }]).theta;
    const easy = estimateAbility([{ item: item({ b: -2, c: 0 }), correct: true }]).theta;
    expect(hard).toBeGreaterThan(easy);
  });

  it("penalises a wrong answer on an easy item more than on a hard one", () => {
    const easy = estimateAbility([{ item: item({ b: -2, c: 0 }), correct: false }]).theta;
    const hard = estimateAbility([{ item: item({ b: 2, c: 0 }), correct: false }]).theta;
    expect(easy).toBeLessThan(hard);
  });

  it("reports P(mastery) as posterior mass above the cut-score", () => {
    const strong = estimateAbility(
      Array.from({ length: 10 }, (_, i) => ({ item: item({ id: `s${i}`, b: 0, c: 0 }), correct: true })),
    );
    expect(strong.pMastery).toBeGreaterThan(0.9);
    const weak = estimateAbility(
      Array.from({ length: 10 }, (_, i) => ({ item: item({ id: `w${i}`, b: 0, c: 0 }), correct: false })),
    );
    expect(weak.pMastery).toBeLessThan(0.1);
  });

  it("sums test information across items", () => {
    const items = [item({ a: 1 }), item({ a: 1.5 })];
    expect(testInformation(0, items)).toBeCloseTo(information(0, items[0]) + information(0, items[1]), 8);
  });
});

describe("item calibration", () => {
  it("keeps neutral defaults below the minimum attempt count", () => {
    const c = calibrate({ id: "q", skill: "React", correct: 3, total: 4 });
    expect(c.a).toBe(1.0);
    expect(c.b).toBe(0);
  });

  it("marks a rarely-answered-correctly item as hard", () => {
    const hard = calibrate({ id: "q", skill: "React", correct: 5, total: 100, pointBiserial: 0.4 });
    expect(hard.b).toBeGreaterThan(1);
  });

  it("marks a frequently-answered-correctly item as easy", () => {
    const easy = calibrate({ id: "q", skill: "React", correct: 95, total: 100, pointBiserial: 0.4 });
    expect(easy.b).toBeLessThan(-1);
  });

  it("orders difficulty consistently with the success rate", () => {
    const b = [10, 30, 50, 70, 90].map(
      (k) => calibrate({ id: "q", skill: "s", correct: k, total: 100, pointBiserial: 0.35 }).b,
    );
    for (let i = 1; i < b.length; i++) expect(b[i]).toBeLessThan(b[i - 1]);
  });

  it("sets the guessing floor from the option count", () => {
    expect(calibrate({ id: "q", skill: "s", correct: 50, total: 100, options: 4 }).c).toBeCloseTo(0.25, 4);
    expect(calibrate({ id: "q", skill: "s", correct: 50, total: 100, options: 2 }).c).toBeCloseTo(0.5, 4);
  });

  it("assigns a low discrimination when the point-biserial is non-positive", () => {
    const bad = calibrate({ id: "q", skill: "s", correct: 50, total: 100, pointBiserial: -0.2 });
    expect(bad.a).toBeLessThan(0.5);
  });

  it("keeps parameters inside sane bounds", () => {
    const c = calibrate({ id: "q", skill: "s", correct: 1, total: 1000, pointBiserial: 0.94 });
    expect(c.a).toBeLessThanOrEqual(2.5);
    expect(c.b).toBeLessThanOrEqual(3);
    expect(c.b).toBeGreaterThanOrEqual(-3);
  });
});

describe("numeric helpers", () => {
  it("probit inverts the normal CDF", () => {
    for (const p of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      expect(normalCdf(probit(p))).toBeCloseTo(p, 3);
    }
  });

  it("probit is 0 at the median", () => {
    expect(probit(0.5)).toBeCloseTo(0, 6);
  });

  it("round-trips ability to proficiency and back", () => {
    for (const t of [-1.5, -0.5, 0, 0.8, 1.6]) {
      expect(proficiencyToTheta(thetaToProficiency(t))).toBeCloseTo(t, 2);
    }
  });
});

// ─────────────────────────────── CAT ───────────────────────────────

const pool: Item[] = [
  { id: "r-easy", skill: "React", a: 1.2, b: -1.5, c: 0.25 },
  { id: "r-mid", skill: "React", a: 1.4, b: 0, c: 0.25 },
  { id: "r-hard", skill: "React", a: 1.3, b: 1.5, c: 0.25 },
  { id: "n-easy", skill: "Node", a: 1.1, b: -1.2, c: 0.25 },
  { id: "n-mid", skill: "Node", a: 1.5, b: 0.2, c: 0.25 },
  { id: "n-hard", skill: "Node", a: 1.2, b: 1.8, c: 0.25 },
];

describe("adaptive item selection", () => {
  it("starts with a mid-difficulty item when nothing is known", () => {
    const s = startTest();
    const pick = selectNextItem(pool, s, ["React"], CAT_DEFAULTS, () => 0);
    expect(pick).not.toBeNull();
    expect(pick!.item.id).toBe("r-mid");
  });

  it("escalates difficulty after a correct answer", () => {
    let s = startTest();
    s = recordAnswer(s, pool[1], true);   // r-mid correct
    s = recordAnswer(s, pool[4], true);   // n-mid correct
    const pick = selectNextItem(pool, s, ["React", "Node"], CAT_DEFAULTS, () => 0);
    expect(pick!.item.b).toBeGreaterThan(0);
  });

  it("drops difficulty after wrong answers", () => {
    let s = startTest();
    s = recordAnswer(s, pool[1], false);
    s = recordAnswer(s, pool[4], false);
    const pick = selectNextItem(pool, s, ["React", "Node"], CAT_DEFAULTS, () => 0);
    expect(pick!.item.b).toBeLessThan(0);
  });

  it("never re-administers an item", () => {
    let s = startTest();
    const seen = new Set<string>();
    for (let i = 0; i < pool.length; i++) {
      const pick = selectNextItem(pool, s, ["React", "Node"], CAT_DEFAULTS, () => 0);
      if (!pick) break;
      expect(seen.has(pick.item.id)).toBe(false);
      seen.add(pick.item.id);
      s = recordAnswer(s, pick.item, true);
    }
    expect(seen.size).toBe(pool.length);
  });

  it("returns null once the pool is exhausted", () => {
    let s = startTest();
    for (const i of pool) s = recordAnswer(s, i, true);
    expect(selectNextItem(pool, s, ["React", "Node"], CAT_DEFAULTS, () => 0)).toBeNull();
  });

  it("balances coverage across target skills", () => {
    let s = startTest();
    const skills: string[] = [];
    for (let i = 0; i < 4; i++) {
      const pick = selectNextItem(pool, s, ["React", "Node"], CAT_DEFAULTS, () => 0);
      if (!pick) break;
      skills.push(pick.item.skill);
      s = recordAnswer(s, pick.item, i % 2 === 0);
    }
    expect(skills.filter((x) => x === "React").length).toBe(2);
    expect(skills.filter((x) => x === "Node").length).toBe(2);
  });

  it("varies selection under exposure control", () => {
    const s = startTest();
    const first = selectNextItem(pool, s, ["React"], CAT_DEFAULTS, () => 0)!.item.id;
    const last = selectNextItem(pool, s, ["React"], CAT_DEFAULTS, () => 0.99)!.item.id;
    expect(first).not.toBe(last);
  });

  it("restricts to the blueprint skills", () => {
    const s = startTest();
    for (let i = 0; i < 5; i++) {
      const pick = selectNextItem(pool, s, ["Node"], CAT_DEFAULTS, () => i / 5);
      expect(pick!.item.skill).toBe("Node");
    }
  });

  it("gives a non-empty reason for every selection", () => {
    const s = startTest();
    const pick = selectNextItem(pool, s, ["React"], CAT_DEFAULTS, () => 0);
    expect(pick!.reason.length).toBeGreaterThan(10);
  });
});

describe("stopping rules", () => {
  it("does not stop before the minimum item count", () => {
    let s = startTest();
    s = recordAnswer(s, pool[1], true);
    expect(shouldStop(s, 5).stop).toBe(false);
  });

  it("stops at the maximum item count", () => {
    let s = startTest();
    const big = Array.from({ length: 20 }, (_, i) => ({ ...pool[i % pool.length], id: `g${i}` }));
    for (const i of big) s = recordAnswer(s, i, true);
    const d = shouldStop(s, 10);
    expect(d.stop).toBe(true);
    expect(d.reason).toBe("max-items");
  });

  it("stops when the pool runs out", () => {
    let s = startTest();
    for (let i = 0; i < 6; i++) s = recordAnswer(s, { ...pool[0], id: `p${i}` }, true);
    expect(shouldStop(s, 0).reason).toBe("pool-exhausted");
  });

  it("stops early once the target precision is reached", () => {
    let s = startTest();
    // A spread of difficulties with a pattern consistent with θ ≈ 0 pins the
    // estimate down: correct below the student's level, wrong above it.
    for (const b of [-1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1]) {
      s = recordAnswer(s, { id: `s${b}`, skill: "React", a: 2.5, b, c: 0 }, b < 0);
    }
    expect(s.ability.se).toBeLessThanOrEqual(CAT_DEFAULTS.targetSe);
    const d = shouldStop(s, 10);
    expect(d.stop).toBe(true);
    expect(d.reason).toBe("precision-reached");
  });

  it("stays imprecise when every item was far below the student's level", () => {
    // Eight correct answers on identical easy items only establish a lower
    // bound on ability, so the test must keep going rather than stopping early.
    let s = startTest();
    for (let i = 0; i < 8; i++) {
      s = recordAnswer(s, { id: `e${i}`, skill: "React", a: 2.5, b: -1.5, c: 0 }, true);
    }
    expect(s.ability.se).toBeGreaterThan(CAT_DEFAULTS.targetSe);
    expect(shouldStop(s, 10).stop).toBe(false);
  });

  it("estimates a non-negative number of remaining items", () => {
    const s = startTest();
    const n = itemsRemaining(s, pool);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(CAT_DEFAULTS.maxItems);
  });
});

describe("ability description", () => {
  it("bands ability sensibly", () => {
    expect(describeAbility({ theta: 2, se: 0.2, information: 1, responses: 8, pMastery: 0.99 }).band).toBe("Advanced");
    expect(describeAbility({ theta: 0, se: 0.3, information: 1, responses: 8, pMastery: 0.3 }).band).toBe("Developing");
    expect(describeAbility({ theta: -2, se: 0.3, information: 1, responses: 8, pMastery: 0.01 }).band).toBe("Foundational");
  });

  it("maps ability to a percentile", () => {
    const mid = describeAbility({ theta: 0, se: 0.3, information: 1, responses: 5, pMastery: 0.3 });
    expect(mid.percentile).toBeGreaterThan(45);
    expect(mid.percentile).toBeLessThan(55);
  });
});

// ─────────────────────────────── BKT ───────────────────────────────

describe("Bayesian Knowledge Tracing", () => {
  it("raises P(known) after a correct answer", () => {
    expect(update(0.3, true, BKT_DEFAULTS)).toBeGreaterThan(0.3);
  });

  it("lowers the Bayes posterior after a wrong answer", () => {
    // The learning transition can lift the final value, so compare the
    // posterior before transition by using pLearn = 0.
    const noLearn = sanitise({ ...BKT_DEFAULTS, pLearn: 0.01 });
    expect(update(0.6, false, noLearn)).toBeLessThan(0.6);
  });

  it("credits a correct answer less when guessing is likely", () => {
    const highGuess = sanitise({ ...BKT_DEFAULTS, pGuess: 0.45 });
    const lowGuess = sanitise({ ...BKT_DEFAULTS, pGuess: 0.05 });
    expect(update(0.3, true, highGuess)).toBeLessThan(update(0.3, true, lowGuess));
  });

  it("converges toward mastery under repeated correct answers", () => {
    const t = trace(Array.from({ length: 12 }, () => ({ correct: true })));
    expect(t.pKnown).toBeGreaterThan(0.95);
    expect(t.mastered).toBe(true);
  });

  it("stays low under repeated wrong answers", () => {
    const t = trace(Array.from({ length: 10 }, () => ({ correct: false })));
    expect(t.pKnown).toBeLessThan(0.4);
    expect(t.mastered).toBe(false);
  });

  it("returns the prior with no opportunities", () => {
    expect(trace([]).pKnown).toBeCloseTo(BKT_DEFAULTS.pInit, 4);
  });

  it("predicts correctness above the guessing floor once learned", () => {
    expect(predict(1, BKT_DEFAULTS)).toBeCloseTo(1 - BKT_DEFAULTS.pSlip, 4);
    expect(predict(0, BKT_DEFAULTS)).toBeCloseTo(BKT_DEFAULTS.pGuess, 4);
  });

  it("reports fewer remaining opportunities as belief grows", () => {
    const low = opportunitiesToMastery(0.2, BKT_DEFAULTS);
    const high = opportunitiesToMastery(0.85, BKT_DEFAULTS);
    expect(high).toBeLessThan(low);
  });

  it("reports zero remaining once already mastered", () => {
    expect(opportunitiesToMastery(0.99, BKT_DEFAULTS)).toBe(0);
  });

  it("caps slip and guess below 0.5 to keep the model non-degenerate", () => {
    const s = sanitise({ pSlip: 0.9, pGuess: 0.8 });
    expect(s.pSlip).toBeLessThan(0.5);
    expect(s.pGuess).toBeLessThan(0.5);
  });

  it("fits slip and guess from labelled data", () => {
    const data = [
      ...Array.from({ length: 20 }, () => ({ correct: true, believedKnown: true })),
      ...Array.from({ length: 5 }, () => ({ correct: false, believedKnown: true })),
      ...Array.from({ length: 18 }, () => ({ correct: false, believedKnown: false })),
      ...Array.from({ length: 2 }, () => ({ correct: true, believedKnown: false })),
    ];
    const f = fitSlipGuess(data);
    expect(f.pSlip).toBeCloseTo(0.2, 1);
    expect(f.pGuess).toBeCloseTo(0.1, 1);
  });

  it("falls back to the prior when a cell is too small", () => {
    const f = fitSlipGuess([{ correct: true, believedKnown: true }]);
    expect(f.pSlip).toBeCloseTo(BKT_DEFAULTS.pSlip, 4);
  });
});

// ──────────────────────────── Retention ────────────────────────────

describe("forgetting curve", () => {
  it("is 1 at zero elapsed time", () => {
    expect(retrievability(0, 10)).toBeCloseTo(1, 6);
  });

  it("is exactly 0.5 after one half-life", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.5, 6);
  });

  it("is 0.25 after two half-lives", () => {
    expect(retrievability(20, 10)).toBeCloseTo(0.25, 6);
  });

  it("decreases monotonically with elapsed time", () => {
    let prev = 1;
    for (let d = 1; d <= 30; d++) {
      const r = retrievability(d, 7);
      expect(r).toBeLessThan(prev);
      prev = r;
    }
  });

  it("computes the interval that lands on the target retention", () => {
    const h = 10;
    const t = intervalForTarget(h, 0.5);
    expect(t).toBeCloseTo(h, 6);
    expect(retrievability(intervalForTarget(h, 0.85), h)).toBeCloseTo(0.85, 4);
  });
});

describe("spaced repetition scheduling", () => {
  it("treats a skill with no history as due", () => {
    const s = traceRetention([]);
    expect(s.due).toBe(true);
    expect(s.priority).toBe("overdue");
  });

  it("grows the half-life after successful reviews", () => {
    const one = traceRetention([{ correct: true, at: ago(1) }]);
    const three = traceRetention([
      { correct: true, at: ago(20) },
      { correct: true, at: ago(10) },
      { correct: true, at: ago(1) },
    ]);
    expect(three.halfLifeDays).toBeGreaterThan(one.halfLifeDays);
  });

  it("cuts the half-life after a lapse", () => {
    const good = traceRetention([
      { correct: true, at: ago(20) },
      { correct: true, at: ago(10) },
      { correct: true, at: ago(2) },
    ]);
    const lapsed = traceRetention([
      { correct: true, at: ago(20) },
      { correct: true, at: ago(10) },
      { correct: false, at: ago(2) },
    ]);
    expect(lapsed.halfLifeDays).toBeLessThan(good.halfLifeDays);
  });

  it("keeps the half-life within bounds", () => {
    const many = traceRetention(Array.from({ length: 30 }, (_, i) => ({ correct: true, at: ago(60 - i * 2) })));
    expect(many.halfLifeDays).toBeLessThanOrEqual(RETENTION.maxHalfLifeDays);
    expect(many.halfLifeDays).toBeGreaterThanOrEqual(RETENTION.minHalfLifeDays);
  });

  it("marks a long-untouched skill as overdue", () => {
    const s = traceRetention([{ correct: true, at: ago(400) }]);
    expect(s.due).toBe(true);
    expect(s.retrievability).toBeLessThan(0.5);
  });

  it("orders the review queue by how close to forgotten each skill is", () => {
    const q = reviewQueue({
      Fresh: [{ correct: true, at: ago(1) }],
      Stale: [{ correct: true, at: ago(120) }],
      Middling: [{ correct: true, at: ago(5) }],
    });
    expect(q[0].skill).toBe("Stale");
    expect(q[q.length - 1].skill).toBe("Fresh");
  });

  it("respects the queue limit", () => {
    const histories = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`s${i}`, [{ correct: true, at: ago(i + 1) }]]),
    );
    expect(reviewQueue(histories, new Date(), 5)).toHaveLength(5);
  });

  it("decays a stale proficiency toward the guessing floor but never below it", () => {
    const stale = traceRetention([{ correct: true, at: ago(500) }]);
    const decayed = decayedProficiency(0.9, stale);
    expect(decayed).toBeLessThan(0.9);
    expect(decayed).toBeGreaterThanOrEqual(0.25);
  });

  it("leaves a freshly reviewed proficiency almost unchanged", () => {
    const fresh = traceRetention([
      { correct: true, at: ago(10) },
      { correct: true, at: ago(0.1) },
    ]);
    expect(decayedProficiency(0.9, fresh)).toBeGreaterThan(0.85);
  });
});

// ──────────────────────── Fusion / profile ─────────────────────────

const evidence = (over: Partial<SkillEvidence> = {}): SkillEvidence => ({
  skill: "React", responses: [], opportunities: [], reviews: [], declared: false, ...over,
});

describe("fused skill profile", () => {
  it("marks a skill with no evidence as unassessed", () => {
    const p = buildSkillProfile(evidence());
    expect(p.status).toBe("unassessed");
    expect(p.confidence).toBeCloseTo(0, 3);
  });

  it("credits a declared skill above an undeclared one when neither is tested", () => {
    const d = buildSkillProfile(evidence({ declared: true }));
    const u = buildSkillProfile(evidence({ declared: false }));
    expect(d.proficiency).toBeGreaterThan(u.proficiency);
  });

  it("does not call a skill mastered on one lucky answer", () => {
    const p = buildSkillProfile(evidence({
      declared: true,
      responses: [{ item: item({ b: -2 }), correct: true }],
      opportunities: [{ correct: true }],
    }));
    expect(p.status).not.toBe("mastered");
  });

  it("reaches mastery with consistent strong evidence", () => {
    const p = buildSkillProfile(evidence({
      declared: true,
      responses: Array.from({ length: 10 }, (_, i) => ({ item: item({ id: `m${i}`, b: 0.5, c: 0 }), correct: true })),
      opportunities: Array.from({ length: 8 }, () => ({ correct: true })),
    }));
    expect(p.status).toBe("mastered");
    expect(p.confidence).toBeGreaterThan(0.5);
  });

  it("classifies consistent failure as a gap", () => {
    const p = buildSkillProfile(evidence({
      responses: Array.from({ length: 8 }, (_, i) => ({ item: item({ id: `g${i}`, b: -1, c: 0 }), correct: false })),
      opportunities: Array.from({ length: 8 }, () => ({ correct: false })),
    }));
    expect(p.status).toBe("gap");
  });

  it("raises confidence as evidence accumulates", () => {
    const thin = buildSkillProfile(evidence({ responses: [{ item: item(), correct: true }] }));
    const thick = buildSkillProfile(evidence({
      responses: Array.from({ length: 10 }, (_, i) => ({ item: item({ id: `c${i}` }), correct: i % 2 === 0 })),
      opportunities: Array.from({ length: 8 }, (_, i) => ({ correct: i % 2 === 0 })),
    }));
    expect(thick.confidence).toBeGreaterThan(thin.confidence);
  });

  it("lowers proficiency when the skill has not been reviewed in months", () => {
    const base = evidence({
      declared: true,
      responses: Array.from({ length: 6 }, (_, i) => ({ item: item({ id: `r${i}`, c: 0 }), correct: true })),
      opportunities: Array.from({ length: 6 }, () => ({ correct: true })),
    });
    const fresh = buildSkillProfile({ ...base, reviews: [{ correct: true, at: ago(1) }] });
    const stale = buildSkillProfile({ ...base, reviews: [{ correct: true, at: ago(300) }] });
    expect(stale.proficiency).toBeLessThan(fresh.proficiency);
  });

  it("always produces a rationale that is not just a number", () => {
    const p = buildSkillProfile(evidence({
      responses: [{ item: item(), correct: true }],
      opportunities: [{ correct: true }],
    }));
    expect(p.rationale).toMatch(/correct/i);
    expect(p.rationale.length).toBeGreaterThan(30);
  });

  it("keeps proficiency inside [0,1]", () => {
    for (const correct of [true, false]) {
      const p = buildSkillProfile(evidence({
        declared: correct,
        responses: Array.from({ length: 15 }, (_, i) => ({ item: item({ id: `b${i}` }), correct })),
        opportunities: Array.from({ length: 15 }, () => ({ correct })),
      }));
      expect(p.proficiency).toBeGreaterThanOrEqual(0);
      expect(p.proficiency).toBeLessThanOrEqual(1);
    }
  });
});

describe("study prioritisation", () => {
  const mk = (skill: string, over: Partial<SkillEvidence> = {}) => buildSkillProfile(evidence({ skill, ...over }));

  it("puts overdue reviews ahead of new material", () => {
    const overdue = mk("Git", {
      declared: true,
      responses: Array.from({ length: 6 }, (_, i) => ({ item: item({ id: `o${i}`, c: 0 }), correct: true })),
      reviews: [{ correct: true, at: ago(300) }],
    });
    const untouched = mk("SQL");
    const order = studyPriority([untouched, overdue]).map((x) => x.skill);
    expect(order[0]).toBe("Git");
  });

  it("gives every entry a reason", () => {
    const list = studyPriority([mk("React"), mk("Node")]);
    for (const e of list) expect(e.why.length).toBeGreaterThan(5);
  });

  it("respects the limit", () => {
    const ps = ["a", "b", "c", "d", "e", "f"].map((s) => mk(s));
    expect(studyPriority(ps, 3)).toHaveLength(3);
  });

  it("excludes mastered skills from the next test blueprint", () => {
    const mastered = buildSkillProfile(evidence({
      skill: "React", declared: true,
      responses: Array.from({ length: 10 }, (_, i) => ({ item: item({ id: `t${i}`, b: 0.5, c: 0 }), correct: true })),
      opportunities: Array.from({ length: 8 }, () => ({ correct: true })),
    }));
    const weak = mk("Node");
    expect(nextTestBlueprint([mastered, weak])).not.toContain("React");
    expect(nextTestBlueprint([mastered, weak])).toContain("Node");
  });

  it("targets the least-confident skills first", () => {
    const tested = buildSkillProfile(evidence({
      skill: "React",
      responses: Array.from({ length: 10 }, (_, i) => ({ item: item({ id: `k${i}` }), correct: i % 2 === 0 })),
      opportunities: Array.from({ length: 8 }, (_, i) => ({ correct: i % 2 === 0 })),
    }));
    const untested = mk("Node");
    expect(nextTestBlueprint([tested, untested])[0]).toBe("Node");
  });
});

// ──────────────────────── End-to-end behaviour ─────────────────────

describe("end-to-end adaptive session", () => {
  it("measures a strong student as strong and a weak one as weak", () => {
    const big: Item[] = [];
    for (let i = 0; i < 30; i++) {
      big.push({ id: `b${i}`, skill: "React", a: 1.2, b: -2 + (i % 9) * 0.5, c: 0.25 });
    }

    // A student whose true ability is +1.5 answers correctly when the item is
    // below their level, incorrectly above it.
    const simulate = (trueTheta: number) => {
      let s = startTest();
      for (let n = 0; n < CAT_DEFAULTS.maxItems; n++) {
        if (shouldStop(s, big.length - s.administered.size).stop) break;
        const pick = selectNextItem(big, s, ["React"], CAT_DEFAULTS, () => 0);
        if (!pick) break;
        s = recordAnswer(s, pick.item, trueTheta > pick.item.b);
      }
      return s;
    };

    const strong = simulate(1.5);
    const weak = simulate(-1.5);
    expect(strong.ability.theta).toBeGreaterThan(weak.ability.theta);
    expect(strong.ability.theta).toBeGreaterThan(0.4);
    expect(weak.ability.theta).toBeLessThan(-0.4);
  });

  it("terminates rather than looping forever", () => {
    let s = startTest();
    let guard = 0;
    while (!shouldStop(s, pool.length - s.administered.size).stop && guard < 100) {
      const pick = selectNextItem(pool, s, ["React", "Node"], CAT_DEFAULTS, () => 0);
      if (!pick) break;
      s = recordAnswer(s, pick.item, true);
      guard++;
    }
    expect(guard).toBeLessThan(100);
  });
});
