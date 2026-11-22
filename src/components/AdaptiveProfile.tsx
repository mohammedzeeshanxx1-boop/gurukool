"use client";
import { useEffect, useState } from "react";
import { Spinner, api } from "./ui";

type SkillProfile = {
  skill: string;
  proficiency: number;
  measuredProficiency: number;
  irt: { theta: number; se: number; proficiency: number; items: number };
  bkt: { pKnown: number; pCorrectNext: number; opportunities: number; toMastery: number };
  retention: { halfLifeDays: number; retrievability: number; daysUntilReview: number; due: boolean; priority: "overdue" | "due-soon" | "scheduled" };
  confidence: number;
  status: "mastered" | "proficient" | "developing" | "gap" | "unassessed";
  rationale: string;
};

type Payload = {
  goal: string;
  skills: SkillProfile[];
  priority: { skill: string; why: string }[];
  blueprint: string[];
  itemBankSize: number;
  calibratedItems: number;
  model: { targetSe: number; minItems: number; maxItems: number; bktMasteryThreshold: number; targetRetention: number };
};

const STATUS = {
  mastered:   { label: "Mastered",   bar: "#16a34a", chip: "bg-[#edfaf3] text-[#15803d] border-[#b5e8c8]" },
  proficient: { label: "Proficient", bar: "#0ea5e9", chip: "bg-[#eaf6fd] text-[#0369a1] border-[#b6e0f5]" },
  developing: { label: "Developing", bar: "#D9541E", chip: "bg-[#fef1ec] text-[#b3401a] border-[#f5c6b4]" },
  gap:        { label: "Gap",        bar: "#ef4444", chip: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]" },
  unassessed: { label: "Untested",   chip: "bg-[#f0f1f3] text-[#5f6573] border-[#e3e5e9]", bar: "#c4c8d2" },
} as const;

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Ability on the θ scale, drawn with its 95% confidence interval. */
function AbilityScale({ theta, se }: { theta: number; se: number }) {
  const toX = (t: number) => ((Math.max(-3, Math.min(3, t)) + 3) / 6) * 100;
  const lo = toX(theta - 1.96 * se);
  const hi = toX(theta - 1.96 * se + 2 * 1.96 * se);
  return (
    <div className="relative h-7">
      <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-[#e3e5e9]" />
      {/* confidence interval */}
      <div className="absolute top-[9px] h-2.5 rounded-full bg-[#D9541E]/25" style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 1)}%` }} />
      {/* point estimate */}
      <div className="absolute top-1.5 h-4 w-1 -translate-x-1/2 rounded-full bg-[#D9541E]" style={{ left: `${toX(theta)}%` }} />
      {/* average marker */}
      <div className="absolute top-2 h-3 w-px bg-[#8a909c]" style={{ left: "50%" }} />
    </div>
  );
}

function SkillRow({ s }: { s: SkillProfile }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[s.status];

  return (
    <div className={`rounded-2xl border p-4 transition-colors ${open ? "border-[#2c303b] bg-[#f7f8fa]" : "border-[#e3e5e9] bg-white hover:border-[#c4c8d2]"}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[15px] font-bold text-[#16181d]">{s.skill}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${st.chip}`}>{st.label}</span>
            {s.retention.priority === "overdue" && s.retention.halfLifeDays > 0 && (
              <span className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-xs font-semibold text-[#b45309]">Review due</span>
            )}
          </span>
          <span className="mt-2 flex items-center gap-3">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#e3e5e9]">
              <span className="block h-2 rounded-full transition-all" style={{ width: `${s.proficiency * 100}%`, background: st.bar }} />
            </span>
            <span className="w-10 shrink-0 text-right font-display text-sm font-bold text-[#16181d]">{pct(s.proficiency)}</span>
          </span>
        </span>
        <span className={`shrink-0 text-xs text-[#8a909c] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-[#e3e5e9] pt-4">
          <p className="text-[13px] leading-relaxed text-[#3d4250]">{s.rationale}</p>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* IRT */}
            <div className="rounded-xl border border-[#e3e5e9] bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a909c]">Ability (IRT)</div>
              <div className="mt-1 font-display text-lg font-bold text-[#16181d]">
                {s.irt.theta >= 0 ? "+" : ""}{s.irt.theta.toFixed(2)}
                <span className="ml-1 text-xs font-normal text-[#5f6573]">± {s.irt.se.toFixed(2)}</span>
              </div>
              <AbilityScale theta={s.irt.theta} se={s.irt.se} />
              <div className="flex justify-between text-[10px] text-[#8a909c]"><span>−3</span><span>avg</span><span>+3</span></div>
              <div className="mt-1 text-[11px] text-[#5f6573]">{s.irt.items} scored item{s.irt.items === 1 ? "" : "s"}</div>
            </div>

            {/* BKT */}
            <div className="rounded-xl border border-[#e3e5e9] bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a909c]">P(known) — BKT</div>
              <div className="mt-1 font-display text-lg font-bold text-[#16181d]">{pct(s.bkt.pKnown)}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e3e5e9]">
                <div className="h-1.5 rounded-full bg-[#2c303b]" style={{ width: `${s.bkt.pKnown * 100}%` }} />
              </div>
              <div className="mt-2 text-[11px] text-[#5f6573]">
                {s.bkt.opportunities === 0 ? "No practice yet"
                  : s.bkt.toMastery === 0 ? `Next answer correct: ${pct(s.bkt.pCorrectNext)}`
                  : `~${s.bkt.toMastery} more correct to mastery`}
              </div>
            </div>

            {/* Retention */}
            <div className="rounded-xl border border-[#e3e5e9] bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a909c]">Retention</div>
              {s.retention.halfLifeDays > 0 ? (
                <>
                  <div className="mt-1 font-display text-lg font-bold text-[#16181d]">{pct(s.retention.retrievability)}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e3e5e9]">
                    <div className="h-1.5 rounded-full" style={{ width: `${s.retention.retrievability * 100}%`, background: s.retention.due ? "#ef4444" : "#16a34a" }} />
                  </div>
                  <div className="mt-2 text-[11px] text-[#5f6573]">
                    Half-life {s.retention.halfLifeDays < 1 ? "<1" : Math.round(s.retention.halfLifeDays)}d ·{" "}
                    {s.retention.due ? "review now" : `review in ${Math.max(0, Math.round(s.retention.daysUntilReview))}d`}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-[13px] text-[#8a909c]">No review history yet</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#8a909c]">
            <span>Estimate confidence</span>
            <span className="h-1 w-24 overflow-hidden rounded-full bg-[#e3e5e9]">
              <span className="block h-1 rounded-full bg-[#D9541E]" style={{ width: `${s.confidence * 100}%` }} />
            </span>
            <span>{pct(s.confidence)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Adaptive skill profile: IRT ability, knowledge tracing and retention, fused
 * into one proficiency per skill with the components kept visible.
 */
export default function AdaptiveProfile({ goal, refreshKey }: { goal: string; refreshKey: string }) {
  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setD(null); setErr(false);
    api<Payload>(`/api/learn/adaptive?goal=${encodeURIComponent(goal)}`)
      .then(setD).catch(() => setErr(true));
  }, [goal, refreshKey]);

  if (err) return null;

  return (
    <section className="card sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow">Skill Intelligence</span>
          <h2 className="mt-1 font-display text-2xl font-bold text-[#16181d]">What we actually know about your skills</h2>
          <p className="mt-1 text-[15px] text-[#5f6573]">
            Every estimate combines three models: how you performed against question difficulty, whether the skill looks learned across attempts, and how much you are likely to have forgotten since.
          </p>
        </div>
      </div>

      {!d ? (
        <div className="text-sm text-[#5f6573]"><Spinner /> Estimating…</div>
      ) : (
        <div className="space-y-6">
          {/* Study queue */}
          {d.priority.length > 0 && (
            <div className="rounded-2xl bg-[#2c303b] p-5">
              <div className="font-display text-sm font-bold text-white">Study this next</div>
              <ol className="mt-3 space-y-2">
                {d.priority.map((p, i) => (
                  <li key={p.skill} className="flex items-start gap-3 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D9541E] text-[11px] font-bold text-white">{i + 1}</span>
                    <span><span className="font-semibold text-white">{p.skill}</span> <span className="text-white/60">— {p.why}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-2.5">
            {d.skills.map((s) => <SkillRow key={s.skill} s={s} />)}
          </div>

          {/* Method note — the honesty line */}
          <div className="rounded-2xl border border-[#e3e5e9] bg-[#f7f8fa] p-4 text-[13px] leading-relaxed text-[#5f6573]">
            <b className="text-[#16181d]">How this is computed.</b> Ability uses a 3-parameter logistic IRT model, so a correct
            answer on a hard question counts for more than one on an easy question, and a 25% guessing floor is assumed for
            4-option questions. Question difficulty is calibrated from how everyone on the platform answered it
            {d.calibratedItems > 0
              ? <> — {d.calibratedItems} of {d.itemBankSize} questions have enough responses to be calibrated so far.</>
              : <>; until a question has around 20 responses it keeps neutral parameters, which is why early estimates are wide.</>}
            {" "}Retention follows a forgetting curve with reviews scheduled at {pct(d.model.targetRetention)} predicted recall.
          </div>
        </div>
      )}
    </section>
  );
}
