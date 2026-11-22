// ============================================================================
// Loads adaptive-engine evidence from MongoDB.
//
// Two distinct reads happen here, and keeping them separate matters:
//
//   1. ITEM CALIBRATION is a *population* statistic. How hard a question is,
//      and how well it separates students, can only be learned from how the
//      whole cohort answered it — never from one student's attempt.
//   2. ABILITY ESTIMATION is a *per-student* statistic, computed against those
//      calibrated items.
//
// Questions are identified by a stable hash of their text, so the same question
// generated for two different students calibrates as one item.
// ============================================================================

import "server-only";
import crypto from "crypto";
import { Assessment, Student } from "@/models";
import { TrainingAssignment, TrainingSubmission } from "@/models/train";
import type { CareerGoal } from "../careers";
import { calibrate, type Item, type ItemStats, type Response } from "./irt";
import { buildSkillProfile, studyPriority, nextTestBlueprint, type SkillEvidence, type SkillProfile } from "./profile";
import type { Opportunity } from "./bkt";
import type { ReviewOutcome } from "./retention";
import { canonicalSkill, skillsForGoal } from "./planner";

type Q = { question: string; options: string[]; answerIndex: number; topic: string };
type AssessmentDoc = { questions: Q[]; answers: number[]; submittedAt: Date; studentKey: string };

/** Stable item id from the question text, so identical questions share calibration. */
export const itemId = (question: string) =>
  crypto.createHash("sha1").update(question.trim().toLowerCase()).digest("hex").slice(0, 16);

/**
 * Calibrate every question the platform has ever asked, from the full response
 * matrix.
 *
 * Point-biserial discrimination is computed as the difference in overall score
 * between students who answered the item correctly and those who did not,
 * standardised — the classical discrimination index. Items answered too few
 * times keep neutral defaults rather than being calibrated from noise.
 */
export async function calibrateItemBank(): Promise<Map<string, Item>> {
  const docs = await Assessment.find({ submittedAt: { $ne: null } })
    .select("questions answers")
    .lean<AssessmentDoc[]>();

  // Per-item tallies, plus the total scores needed for point-biserial.
  type Tally = { skill: string; options: number; correct: number; total: number; scoresCorrect: number[]; scoresWrong: number[] };
  const tally = new Map<string, Tally>();

  for (const d of docs) {
    if (!Array.isArray(d.questions) || !Array.isArray(d.answers)) continue;
    const graded = d.questions.map((q, i) => d.answers[i] === q.answerIndex);
    const totalScore = graded.filter(Boolean).length / Math.max(1, graded.length);

    d.questions.forEach((q, i) => {
      const skill = canonicalSkill(q.topic);
      if (!skill || !q.question) return;
      const id = itemId(q.question);
      const t = tally.get(id) ?? { skill, options: q.options?.length ?? 4, correct: 0, total: 0, scoresCorrect: [], scoresWrong: [] };
      t.total += 1;
      if (graded[i]) { t.correct += 1; t.scoresCorrect.push(totalScore); }
      else t.scoresWrong.push(totalScore);
      tally.set(id, t);
    });
  }

  const bank = new Map<string, Item>();
  for (const [id, t] of tally) {
    const stats: ItemStats = {
      id,
      skill: t.skill,
      correct: t.correct,
      total: t.total,
      options: t.options,
      pointBiserial: pointBiserial(t.scoresCorrect, t.scoresWrong),
    };
    bank.set(id, calibrate(stats));
  }
  return bank;
}

/**
 * Point-biserial correlation between answering an item correctly and total score.
 *
 *   r_pb = (M₁ − M₀)/s · sqrt(p·q)
 *
 * Returns undefined when either group is too small to be meaningful, so the
 * caller falls back to a neutral discrimination rather than noise.
 */
export function pointBiserial(scoresCorrect: number[], scoresWrong: number[]): number | undefined {
  const n1 = scoresCorrect.length, n0 = scoresWrong.length;
  if (n1 < 3 || n0 < 3) return undefined;
  const all = [...scoresCorrect, ...scoresWrong];
  const n = all.length;
  const mean = all.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(all.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  if (sd < 1e-9) return undefined;
  const m1 = scoresCorrect.reduce((s, x) => s + x, 0) / n1;
  const m0 = scoresWrong.reduce((s, x) => s + x, 0) / n0;
  const p = n1 / n, q = n0 / n;
  return ((m1 - m0) / sd) * Math.sqrt(p * q);
}

/** Per-skill evidence for one student, ready for the fusion layer. */
export async function loadAdaptiveEvidence(studentKey: string, goal: CareerGoal): Promise<SkillEvidence[]> {
  const [student, docs, bank] = await Promise.all([
    Student.findOne({ key: studentKey }).select("skills").lean<{ skills: string[] }>(),
    Assessment.find({ studentKey, submittedAt: { $ne: null } })
      .select("questions answers submittedAt")
      .sort({ submittedAt: 1 })
      .lean<AssessmentDoc[]>(),
    calibrateItemBank(),
  ]);

  const declared = new Set((student?.skills ?? []).map(canonicalSkill).filter((x): x is string => Boolean(x)));
  const skills = skillsForGoal(goal);

  const responses = new Map<string, Response[]>();
  const opportunities = new Map<string, Opportunity[]>();
  const reviews = new Map<string, ReviewOutcome[]>();

  for (const d of docs) {
    if (!Array.isArray(d.questions) || !Array.isArray(d.answers)) continue;
    d.questions.forEach((q, i) => {
      const skill = canonicalSkill(q.topic);
      if (!skill || !q.question) return;
      const id = itemId(q.question);
      const item: Item = bank.get(id) ?? { id, skill, a: 1, b: 0, c: q.options?.length ? 1 / q.options.length : 0.25 };
      const correct = d.answers[i] === q.answerIndex;
      push(responses, skill, { item, correct });
      push(opportunities, skill, { correct, at: d.submittedAt });
      push(reviews, skill, { correct, at: d.submittedAt });
    });
  }

  // Trainer-graded assignments count as practice opportunities and as reviews,
  // but not as IRT responses — they have no calibrated item parameters.
  const subs = await TrainingSubmission.find({ studentId: studentKey, status: "REVIEWED" })
    .select("assignmentId score reviewedAt")
    .lean<{ assignmentId: unknown; score: number; reviewedAt: Date }[]>();

  if (subs.length) {
    const asg = await TrainingAssignment.find({ _id: { $in: subs.map((s) => s.assignmentId) } })
      .select("skillTags maxMarks")
      .lean<{ _id: unknown; skillTags: string[]; maxMarks: number }[]>();
    const amap = new Map(asg.map((x) => [String(x._id), x]));
    for (const s of subs) {
      const a = amap.get(String(s.assignmentId));
      if (!a?.maxMarks) continue;
      const passed = s.score / a.maxMarks >= 0.6;
      for (const tag of a.skillTags) {
        const skill = canonicalSkill(tag);
        if (!skill) continue;
        push(opportunities, skill, { correct: passed, at: s.reviewedAt });
        push(reviews, skill, { correct: passed, at: s.reviewedAt });
      }
    }
  }

  return skills.map((skill) => ({
    skill,
    responses: responses.get(skill) ?? [],
    opportunities: sortByDate(opportunities.get(skill) ?? []),
    reviews: sortByDate(reviews.get(skill) ?? []),
    declared: declared.has(skill),
  }));
}

/** The full adaptive profile: per-skill fusion, study queue and next-test blueprint. */
export async function adaptiveProfile(studentKey: string, goal: CareerGoal): Promise<{
  skills: SkillProfile[];
  priority: { skill: string; why: string }[];
  blueprint: string[];
  itemBankSize: number;
  calibratedItems: number;
}> {
  const [evidence, bank] = await Promise.all([
    loadAdaptiveEvidence(studentKey, goal),
    calibrateItemBank(),
  ]);
  const skills = evidence.map((e) => buildSkillProfile(e));
  return {
    skills,
    priority: studyPriority(skills),
    blueprint: nextTestBlueprint(skills),
    itemBankSize: bank.size,
    // An item only counts as calibrated once it has moved off the neutral defaults.
    calibratedItems: [...bank.values()].filter((i) => i.b !== 0 || i.a !== 1).length,
  };
}

function push<T>(m: Map<string, T[]>, k: string, v: T) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

const sortByDate = <T extends { at?: Date }>(xs: T[]) =>
  [...xs].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
