import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { apiError, badRequest } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { isCareerGoal } from "@/lib/careers";
import { Student } from "@/models";
import { adaptiveProfile } from "@/lib/skill-engine/adaptive-evidence";
import { CAT_DEFAULTS } from "@/lib/skill-engine/cat";
import { MASTERY_THRESHOLD } from "@/lib/skill-engine/bkt";
import { RETENTION } from "@/lib/skill-engine/retention";

export const dynamic = "force-dynamic";

/**
 * GET ?goal= — the fused adaptive skill profile.
 *
 * Returns, per skill: the IRT ability estimate with its standard error, the
 * knowledge-tracing belief, the retention forecast, and a plain-language
 * rationale. Also returns the study queue and the blueprint for the next
 * adaptive test.
 */
export async function GET(req: Request) {
  try {
    const me = await requireRole("student");
    await connectDB();

    const student = await Student.findOne({ key: me.id }).select("careerGoal").lean<{ careerGoal: string }>();
    const goal = new URL(req.url).searchParams.get("goal") ?? student?.careerGoal;
    if (!isCareerGoal(goal)) return badRequest("Pick a valid career goal");

    const profile = await adaptiveProfile(me.id, goal);

    return NextResponse.json({
      goal,
      ...profile,
      model: {
        targetSe: CAT_DEFAULTS.targetSe,
        minItems: CAT_DEFAULTS.minItems,
        maxItems: CAT_DEFAULTS.maxItems,
        bktMasteryThreshold: MASTERY_THRESHOLD,
        targetRetention: RETENTION.targetRetention,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
