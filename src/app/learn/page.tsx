"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, useStudent, type ApiErr } from "@/components/ui";
import { CAREER_GOALS } from "@/lib/careers";
import RecommendedTraining from "@/components/RecommendedTraining";

type Gap = {
  analysis: { goal: string; existing: string[]; missing: string[]; priorities: { skill: string; level: string }[]; readiness: number };
  explanation: string | null; aiConfigured: boolean; aiError: string | null;
};
type PublicAssessment = { id: string; careerGoal: string; source: string; questions: { question: string; options: string[]; topic: string }[] };
type Result = { score: number; total: number; weakTopics: string[]; results: { question: string; options: string[]; topic: string; selected: number; answerIndex: number; correct: boolean; explanation: string }[] };
type Stage = { _id: string; topic: string; description: string; duration: string; youtubeUrl: string; completed: boolean; reason?: string; prerequisites?: string[] };
type RoadmapT = { _id: string; careerGoal: string; source: string; basedOn: { missingSkills: string[]; weakTopics: string[] }; stages: Stage[] };

function ReadinessRing({ pct }: { pct: number }) {
  const r = 36, circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#D9541E" : "#ef4444";
  return (
    <svg width={96} height={96} viewBox="0 0 96 96">
      <circle cx={48} cy={48} r={r} stroke="#e3e5e9" strokeWidth={8} fill="none" />
      <circle cx={48} cy={48} r={r} stroke={color} strokeWidth={8} fill="none"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform="rotate(-90 48 48)" />
      <text x={48} y={53} textAnchor="middle" fontSize={18} fontWeight={700} fill="#16181d">{pct}%</text>
    </svg>
  );
}

export default function LearnPage() {
  const { student, loading, error } = useStudent();
  const [goal, setGoal] = useState<string>(CAREER_GOALS[2]);
  useEffect(() => { if (student?.careerGoal) setGoal(student.careerGoal); }, [student]);

  // 1. Skill gap
  const [gap, setGap] = useState<Gap | null>(null);
  const [gapBusy, setGapBusy] = useState(false);
  const [gapErr, setGapErr] = useState<ApiErr | null>(null);
  async function runGap() {
    setGapBusy(true); setGapErr(null);
    try { setGap(await api<Gap>("/api/learn/skill-gap", { method: "POST", body: JSON.stringify({ goal }) })); }
    catch (e) { setGapErr(toErr(e)); } finally { setGapBusy(false); }
  }

  // 2. Assessment
  const [quiz, setQuiz] = useState<PublicAssessment | null>(null);
  const [quizNote, setQuizNote] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizErr, setQuizErr] = useState<ApiErr | null>(null);
  async function genQuiz() {
    setQuizBusy(true); setQuizErr(null); setResult(null); setQuizNote(null);
    try {
      const d = await api<{ assessment: PublicAssessment; aiConfigured: boolean; aiError: string | null }>("/api/learn/assessment", { method: "POST", body: JSON.stringify({ goal }) });
      setQuiz(d.assessment);
      setAnswers(d.assessment.questions.map(() => null));
      setQuizNote(d.aiError ?? (!d.aiConfigured ? "Questions from GURUKOOL's built-in question bank (AI not configured)." : null));
    } catch (e) { setQuizErr(toErr(e)); } finally { setQuizBusy(false); }
  }
  async function submitQuiz() {
    if (!quiz) return;
    setQuizBusy(true); setQuizErr(null);
    try { setResult(await api<Result>(`/api/learn/assessment/${quiz.id}/submit`, { method: "POST", body: JSON.stringify({ answers }) })); }
    catch (e) { setQuizErr(toErr(e)); } finally { setQuizBusy(false); }
  }

  // 3. Roadmap
  const [roadmap, setRoadmap] = useState<RoadmapT | null>(null);
  const [rmNote, setRmNote] = useState<string | null>(null);
  const [rmBusy, setRmBusy] = useState(false);
  const [rmErr, setRmErr] = useState<ApiErr | null>(null);
  useEffect(() => { api<{ roadmap: RoadmapT | null }>("/api/learn/roadmap").then((d) => setRoadmap(d.roadmap)).catch(() => {}); }, []);
  async function genRoadmap() {
    setRmBusy(true); setRmErr(null); setRmNote(null);
    try {
      const d = await api<{ roadmap: RoadmapT; aiConfigured: boolean; aiError: string | null }>("/api/learn/roadmap", { method: "POST", body: JSON.stringify({ goal }) });
      setRoadmap(d.roadmap);
      setRmNote(!d.aiConfigured ? "Roadmap built by the GURUKOOL Skill Engine (AI not configured)." : null);
    } catch (e) { setRmErr(toErr(e)); } finally { setRmBusy(false); }
  }
  async function toggleStage(s: Stage) {
    if (!roadmap) return;
    const next = !s.completed;
    setRoadmap({ ...roadmap, stages: roadmap.stages.map((x) => (x._id === s._id ? { ...x, completed: next } : x)) });
    try { await api(`/api/learn/roadmap/${roadmap._id}`, { method: "PATCH", body: JSON.stringify({ stageId: s._id, completed: next }) }); }
    catch (e) {
      setRmErr(toErr(e));
      setRoadmap((r) => r && { ...r, stages: r.stages.map((x) => (x._id === s._id ? { ...x, completed: !next } : x)) });
    }
  }
  const done = roadmap?.stages.filter((s) => s.completed).length ?? 0;

  if (loading) return <div className="text-sm text-[#5f6573]"><Spinner /> Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Learn"
        subtitle="Analyse your skill gaps, test yourself with a quick quiz, and follow a personalised roadmap to your goal."
        eyebrow="Your learning path"
        right={
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#5f6573]">Goal</label>
            <select className="input w-52" value={goal} onChange={(e) => { setGoal(e.target.value); setGap(null); setQuiz(null); setResult(null); }}>
              {CAREER_GOALS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        }
      />
      <ErrorAlert err={error} />
      {!error && !student && (
        <Alert kind="warn">No student profile yet. <Link className="font-semibold underline" href="/profile">Set up your profile</Link> first.</Alert>
      )}

      {/* ── 1. SKILL GAP ── */}
      <section className="card sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="eyebrow">Step 1</span>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#16181d]">Where are you vs. where you need to be?</h2>
            <p className="mt-1 text-[15px] text-[#5f6573]">We compare your profile skills to what a <b>{goal}</b> role needs and show exactly what&apos;s missing.</p>
          </div>
          <button className="btn-primary shrink-0" onClick={runGap} disabled={gapBusy || !student}>
            {gapBusy ? <><Spinner /> Analysing…</> : gap ? "Re-analyse" : "Analyse my skills"}
          </button>
        </div>
        <ErrorAlert err={gapErr} />

        {!gap ? (
          <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-[#e3e5e9] bg-[#f7f8fa]">
            <p className="text-sm text-[#8a909c]">Hit &ldquo;Analyse my skills&rdquo; to see your gap report</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* readiness banner */}
            <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-[#f4f5f7] px-6 py-5">
              <ReadinessRing pct={gap.analysis.readiness} />
              <div>
                <div className="font-display text-lg font-bold text-[#16181d]">Job readiness for {gap.analysis.goal}</div>
                <p className="mt-1 text-sm text-[#5f6573]">
                  {gap.analysis.readiness >= 70 ? "You're well on your way! Focus on a few remaining skills." :
                   gap.analysis.readiness >= 40 ? "Good foundation — keep building the skills below." :
                   "Lots to learn, but that's why you're here. Start from the top of your roadmap."}
                </p>
              </div>
            </div>

            {/* chips */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-3 font-display text-sm font-semibold text-[#16181d]">✓ Skills you already have</div>
                <div className="flex flex-wrap gap-2">
                  {gap.analysis.existing.length
                    ? gap.analysis.existing.map((s) => <span key={s} className="rounded-full border border-[#b5e8c8] bg-[#edfaf3] px-3 py-1 text-sm font-medium text-[#15803d]">{s}</span>)
                    : <span className="text-sm text-[#8a909c]">None listed yet — add skills to your profile</span>}
                </div>
              </div>
              <div>
                <div className="mb-3 font-display text-sm font-semibold text-[#16181d]">✗ Skills you need to learn</div>
                <div className="flex flex-wrap gap-2">
                  {gap.analysis.missing.length
                    ? gap.analysis.missing.map((s) => <span key={s} className="rounded-full border border-[#f5c6b4] bg-[#fef1ec] px-3 py-1 text-sm font-medium text-[#b3401a]">{s}</span>)
                    : <span className="text-sm text-[#15803d]">No gaps — nice!</span>}
                </div>
              </div>
            </div>

            {/* priorities */}
            {gap.analysis.priorities.length > 0 && (
              <div>
                <div className="mb-3 font-display text-sm font-semibold text-[#16181d]">What to learn first</div>
                <ol className="space-y-2">
                  {gap.analysis.priorities.map((p, i) => (
                    <li key={p.skill} className="flex items-center gap-3 rounded-xl border border-[#e3e5e9] bg-white px-4 py-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2c303b] text-xs font-bold text-white">{i + 1}</span>
                      <span className="flex-1 text-sm font-medium text-[#16181d]">{p.skill}</span>
                      <span className={`chip text-xs ${p.level === "High" ? "bg-red-100 text-red-700" : p.level === "Medium" ? "bg-amber-100 text-amber-700" : "bg-[#f0f1f3] text-[#5f6573]"}`}>{p.level} priority</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {gap.explanation && (
              <div className="rounded-2xl border border-[#e3e5e9] bg-[#f7f8fa] px-5 py-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#5f6573]">
                  <span className="rounded bg-[#D9541E] px-1.5 py-0.5 text-white">AI</span> Analysis
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3d4250]">{gap.explanation}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 2. QUIZ ── */}
      <section className="card sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="eyebrow">Step 2</span>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#16181d]">Quick skills quiz</h2>
            <p className="mt-1 text-[15px] text-[#5f6573]">5 questions tailored to <b>{goal}</b>. Your answers are saved and shape your roadmap.</p>
          </div>
          <button className="btn-primary shrink-0" onClick={genQuiz} disabled={quizBusy || !student}>
            {quizBusy && !quiz ? <><Spinner /> Generating…</> : quiz ? "New questions" : "Start quiz"}
          </button>
        </div>
        <ErrorAlert err={quizErr} />
        {quizNote && <Alert kind="warn">{quizNote}</Alert>}

        {!quiz ? (
          <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-[#e3e5e9] bg-[#f7f8fa]">
            <p className="text-sm text-[#8a909c]">Hit &ldquo;Start quiz&rdquo; — takes about 2 minutes</p>
          </div>
        ) : (
          <div className="space-y-5">
            {quiz.questions.map((q, qi) => {
              const r = result?.results[qi];
              return (
                <div key={qi} className={`rounded-2xl border p-5 ${r ? (r.correct ? "border-[#b5e8c8] bg-[#edfaf3]/60" : "border-[#f5c6b4] bg-[#fef1ec]/60") : "border-[#e3e5e9] bg-white"}`}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <p className="font-display text-[15px] font-semibold text-[#16181d]">{qi + 1}. {q.question}</p>
                    <span className="chip bg-[#f0f1f3] text-[#5f6573] text-xs">{q.topic}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {q.options.map((o, oi) => {
                      // After submitting, the server's `selected` is the source of truth.
                      const picked = r ? r.selected === oi : answers[qi] === oi;
                      const isRight = r && oi === r.answerIndex;
                      const isWrongPick = r && picked && !r.correct;
                      return (
                        <label key={oi} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${r ? "cursor-default" : "cursor-pointer"} ${
                          isRight ? "border-[#22c55e] bg-[#edfaf3] font-medium text-[#15803d]"
                          : isWrongPick ? "border-[#ef4444] bg-[#fef1ec] font-medium text-[#b3401a]"
                          : r ? "border-[#e3e5e9] text-[#8a909c]"
                          : picked ? "border-[#2c303b] bg-[#f4f5f7] font-medium text-[#16181d]"
                          : "border-[#e3e5e9] hover:border-[#2c303b] hover:bg-[#f7f8fa] text-[#3d4250]"}`}>
                          <input type="radio" name={`q${qi}`} disabled={!!result} checked={picked}
                            onChange={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))}
                            className="accent-[#D9541E]" />
                          {o}
                        </label>
                      );
                    })}
                  </div>
                  {r && (
                    <div className={`mt-3 flex gap-2 rounded-xl px-4 py-3 text-sm ${r.correct ? "bg-[#edfaf3] text-[#15803d]" : "bg-[#fef1ec] text-[#b3401a]"}`}>
                      <span className="shrink-0 font-bold">{r.correct ? "✓ Correct." : "✗ Incorrect."}</span>
                      <span>{r.explanation}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {!result ? (
              <div className="flex items-center gap-4 pt-2">
                <button className="btn-primary" onClick={submitQuiz} disabled={quizBusy || answers.some((a) => a === null)}>
                  {quizBusy ? <><Spinner /> Submitting…</> : "Submit answers"}
                </button>
                <span className="text-sm text-[#5f6573]">{answers.filter((a) => a !== null).length}/{quiz.questions.length} answered</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-[#2c303b] px-6 py-5">
                <span className="font-display text-5xl font-bold text-white">{result.score}<span className="text-2xl text-white/50">/{result.total}</span></span>
                <div>
                  <div className="font-display text-lg font-semibold text-white">
                    {result.score === result.total ? "Perfect score! 🎉" : result.score >= result.total * 0.6 ? "Good job!" : "Keep practising!"}
                  </div>
                  {result.weakTopics.length > 0
                    ? <p className="mt-1 text-sm text-white/60">Weak areas: {result.weakTopics.join(", ")} — these get prioritised in your roadmap.</p>
                    : <p className="mt-1 text-sm text-white/60">No weak areas — excellent!</p>}
                </div>
                <button className="ml-auto btn-dark" onClick={genQuiz}>{quizBusy ? <Spinner /> : "Try again"}</button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 3. ROADMAP ── */}
      <section className="card sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="eyebrow">Step 3</span>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#16181d]">Your learning roadmap</h2>
            <p className="mt-1 text-[15px] text-[#5f6573]">Built from your skill gaps and quiz results. Each stage links straight to a free YouTube resource.</p>
          </div>
          <button className="btn-primary shrink-0" onClick={genRoadmap} disabled={rmBusy || !student}>
            {rmBusy ? <><Spinner /> Building…</> : roadmap ? "Regenerate" : "Build my roadmap"}
          </button>
        </div>
        <ErrorAlert err={rmErr} />
        {rmNote && <Alert kind="warn">{rmNote}</Alert>}

        {!roadmap ? (
          <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-[#e3e5e9] bg-[#f7f8fa]">
            <p className="text-sm text-[#8a909c]">Hit &ldquo;Build my roadmap&rdquo; — takes the quiz results into account</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* progress bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 overflow-hidden rounded-full bg-[#e3e5e9] h-3">
                <div className="h-3 rounded-full bg-[#D9541E] transition-all" style={{ width: `${(done / Math.max(roadmap.stages.length, 1)) * 100}%` }} />
              </div>
              <span className="shrink-0 font-display text-sm font-semibold text-[#16181d]">{done}/{roadmap.stages.length} done</span>
            </div>

            {/* stages */}
            <ol className="space-y-3">
              {roadmap.stages.map((s, i) => {
                const isDone = s.completed;
                return (
                  <li key={s._id} className={`group relative flex gap-4 rounded-2xl border p-5 transition-colors ${isDone ? "border-[#b5e8c8] bg-[#edfaf3]/50" : "border-[#e3e5e9] bg-white hover:border-[#2c303b]"}`}>
                    {/* step number / check */}
                    <button
                      onClick={() => toggleStage(s)}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors font-bold text-sm ${isDone ? "border-[#22c55e] bg-[#22c55e] text-white" : "border-[#c4c8d2] bg-white text-[#5f6573] hover:border-[#D9541E]"}`}
                      title={isDone ? "Mark incomplete" : "Mark complete"}
                    >
                      {isDone ? "✓" : i + 1}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className={`font-display text-base font-bold ${isDone ? "text-[#5f6573] line-through" : "text-[#16181d]"}`}>{s.topic}</div>
                          <p className="mt-1 text-sm text-[#5f6573]">{s.description}</p>
                          {s.prerequisites && s.prerequisites.length > 0 && (
                            <p className="mt-1 text-xs text-[#8a909c]">After: {s.prerequisites.join(", ")}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="chip bg-[#f0f1f3] text-[#5f6573] text-xs">{s.duration}</span>
                          <a href={s.youtubeUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-full bg-[#ff0000] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80">
                            ▶ YouTube
                          </a>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/build" className="btn-ghost">Practice in CodeLab →</Link>
              <Link href="/connect" className="btn-ghost">Find a study partner →</Link>
            </div>
          </div>
        )}
      </section>

      {/* Recommended courses */}
      {student && <RecommendedTraining refreshKey={`${goal}|${gap?.analysis.readiness ?? ""}|${result?.score ?? ""}|${roadmap?._id ?? ""}`} />}
    </div>
  );
}
