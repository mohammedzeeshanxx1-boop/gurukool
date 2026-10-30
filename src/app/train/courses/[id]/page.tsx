"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Alert, ErrorAlert, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { JoinSessionButton } from "@/components/connect";
import { DemoContentBadge, ProgressBar } from "@/components/train";

type Lesson = { id: string; title: string; durationMinutes: number; objectives: string[]; explanation: string | null };
type Module = { id: string; title: string; summary: string; lessons: Lesson[] };
type MySub = { id: string; status: string; score: number | null; feedback: string; submissionText: string; repositoryUrl: string; projectUrl: string; late: boolean };
type Assignment = { id: string; moduleId: string; title: string; description: string; instructions: string; skillTags: string[]; due: string; dueAt: string; maxMarks: number; mySubmission: MySub | null };
type Session = { id: string; title: string; agenda: string; when: string; status: string; isDemo: boolean; past: boolean };
type Detail = {
  course: { id: string; title: string; description: string; category: string; difficulty: string; durationWeeks: number; skillTags: string[]; published: boolean; isDemo: boolean; lessonCount: number;
    trainer: { id: string; name: string; designation: string; isDemo: boolean }; modules: Module[] };
  assignments: Assignment[]; sessions: Session[];
  enrollment: { id: string; completedLessonIds: string[]; showInPortfolio: boolean } | null;
  progress: { completedLessons: number; totalLessons: number; engagementPct: number; submitted: number; reviewed: number; totalAssignments: number; demonstratedPct: number | null } | null;
  isOwner: boolean; role: string;
};

function SubmitForm({ a, onDone }: { a: Assignment; onDone: () => void }) {
  const s = a.mySubmission;
  const [f, setF] = useState({ submissionText: s?.submissionText ?? "", repositoryUrl: s?.repositoryUrl ?? "", projectUrl: s?.projectUrl ?? "" });
  const [busy, setBusy] = useState(false), [err, setErr] = useState<ApiErr | null>(null), [ok, setOk] = useState<string | null>(null);
  return (
    <form className="mt-3 space-y-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null); setOk(null);
      try { const r = await api<{ resubmitted: boolean }>("/api/train/submissions", { method: "POST", body: JSON.stringify({ assignmentId: a.id, ...f }) }); setOk(r.resubmitted ? "Submission updated." : "Submitted. Your trainer will review it."); onDone(); }
      catch (x) { setErr(toErr(x)); } finally { setBusy(false); }
    }}>
      <textarea className="input font-mono text-xs" rows={5} placeholder="Your answer or code…" value={f.submissionText} onChange={(e) => setF({ ...f, submissionText: e.target.value })} aria-label="Answer" />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder="GitHub repository URL" value={f.repositoryUrl} onChange={(e) => setF({ ...f, repositoryUrl: e.target.value })} aria-label="GitHub repository URL" />
        <input className="input" placeholder="Project / deployed URL (optional)" value={f.projectUrl} onChange={(e) => setF({ ...f, projectUrl: e.target.value })} aria-label="Project URL" />
      </div>
      <ErrorAlert err={err} />
      {ok && <Alert kind="success">{ok}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={busy}>{busy && <Spinner />} {s ? "Update submission" : "Submit assignment"}</button>
        <Link href="/build" className="text-sm text-blue-700 hover:underline">Practise in the BUILD editor →</Link>
      </div>
    </form>
  );
}

function OwnerTools({ d, reload }: { d: Detail; reload: () => void }) {
  const c = d.course;
  const [err, setErr] = useState<ApiErr | null>(null), [ok, setOk] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [mod, setMod] = useState({ title: "", summary: "" });
  const [les, setLes] = useState({ moduleId: c.modules[0]?.id ?? "", title: "", explanation: "", objectives: "", durationMinutes: 30 });
  const [asg, setAsg] = useState({ moduleId: c.modules[0]?.id ?? "", title: "", description: "", instructions: "", skillTags: "", dueDate: "", maxMarks: 10 });
  const [ses, setSes] = useState({ title: "", agenda: "", date: "", startTime: "11:00", durationMinutes: 90 });
  async function send(body: object, msg: string, reset: () => void) {
    setBusy(true); setErr(null); setOk(null);
    try { await api(`/api/train/courses/${c.id}/content`, { method: "POST", body: JSON.stringify(body) }); setOk(msg); reset(); reload(); }
    catch (x) { setErr(toErr(x)); } finally { setBusy(false); }
  }
  async function publish(v: boolean) {
    setErr(null);
    try { await api(`/api/train/courses/${c.id}`, { method: "PATCH", body: JSON.stringify({ published: v }) }); reload(); } catch (x) { setErr(toErr(x)); }
  }
  const modSelect = (v: string, on: (x: string) => void) => (
    <select className="input" value={v} onChange={(e) => on(e.target.value)} required>
      <option value="">Module…</option>{c.modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
    </select>
  );
  return (
    <section className="card space-y-4 border-blue-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">Trainer tools</h2>
        <button className={c.published ? "btn-ghost" : "btn-primary"} onClick={() => publish(!c.published)}>{c.published ? "Unpublish" : "Publish course"}</button>
      </div>
      <ErrorAlert err={err} />{ok && <Alert kind="success">{ok}</Alert>}
      <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer font-medium">Add module</summary>
        <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); send({ type: "module", ...mod }, "Module added.", () => setMod({ title: "", summary: "" })); }}>
          <input className="input" placeholder="Module title" value={mod.title} onChange={(e) => setMod({ ...mod, title: e.target.value })} required />
          <input className="input" placeholder="Summary" value={mod.summary} onChange={(e) => setMod({ ...mod, summary: e.target.value })} />
          <button className="btn-primary w-fit" disabled={busy}>Add module</button>
        </form></details>
      <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer font-medium">Add lesson</summary>
        <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); send({ type: "lesson", ...les, objectives: les.objectives.split("\n") }, "Lesson added.", () => setLes({ ...les, title: "", explanation: "", objectives: "" })); }}>
          {modSelect(les.moduleId, (x) => setLes({ ...les, moduleId: x }))}
          <input className="input" placeholder="Lesson title" value={les.title} onChange={(e) => setLes({ ...les, title: e.target.value })} required />
          <textarea className="input" rows={4} placeholder="Explanation" value={les.explanation} onChange={(e) => setLes({ ...les, explanation: e.target.value })} required />
          <textarea className="input" rows={2} placeholder="Learning objectives (one per line)" value={les.objectives} onChange={(e) => setLes({ ...les, objectives: e.target.value })} />
          <label className="text-sm">Estimated minutes <input className="input mt-1 w-28" type="number" min={5} max={600} value={les.durationMinutes} onChange={(e) => setLes({ ...les, durationMinutes: Number(e.target.value) })} /></label>
          <button className="btn-primary w-fit" disabled={busy}>Add lesson</button>
        </form></details>
      <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer font-medium">Add assignment</summary>
        <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); send({ type: "assignment", ...asg }, "Assignment added.", () => setAsg({ ...asg, title: "", description: "", instructions: "" })); }}>
          {modSelect(asg.moduleId, (x) => setAsg({ ...asg, moduleId: x }))}
          <input className="input" placeholder="Title" value={asg.title} onChange={(e) => setAsg({ ...asg, title: e.target.value })} required />
          <input className="input" placeholder="Short description" value={asg.description} onChange={(e) => setAsg({ ...asg, description: e.target.value })} required />
          <textarea className="input" rows={3} placeholder="Instructions" value={asg.instructions} onChange={(e) => setAsg({ ...asg, instructions: e.target.value })} />
          <input className="input" placeholder="Skill tags (comma separated)" value={asg.skillTags} onChange={(e) => setAsg({ ...asg, skillTags: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <label className="text-sm">Due date (IST) <input className="input mt-1" type="date" value={asg.dueDate} onChange={(e) => setAsg({ ...asg, dueDate: e.target.value })} required /></label>
            <label className="text-sm">Max marks <input className="input mt-1 w-28" type="number" min={1} max={1000} value={asg.maxMarks} onChange={(e) => setAsg({ ...asg, maxMarks: Number(e.target.value) })} /></label>
          </div>
          <button className="btn-primary w-fit" disabled={busy}>Add assignment</button>
        </form></details>
      <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer font-medium">Schedule weekend live class</summary>
        <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); send({ type: "session", ...ses }, "Live class scheduled. Enrolled students can see it.", () => setSes({ ...ses, title: "", agenda: "" })); }}>
          <input className="input" placeholder="Session topic" value={ses.title} onChange={(e) => setSes({ ...ses, title: e.target.value })} required />
          <input className="input" placeholder="Agenda (optional)" value={ses.agenda} onChange={(e) => setSes({ ...ses, agenda: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <label className="text-sm">Date (Sat/Sun) <input className="input mt-1" type="date" value={ses.date} onChange={(e) => setSes({ ...ses, date: e.target.value })} required /></label>
            <label className="text-sm">Start (IST) <input className="input mt-1" type="time" value={ses.startTime} onChange={(e) => setSes({ ...ses, startTime: e.target.value })} required /></label>
            <label className="text-sm">Minutes <input className="input mt-1 w-24" type="number" min={30} max={240} value={ses.durationMinutes} onChange={(e) => setSes({ ...ses, durationMinutes: Number(e.target.value) })} /></label>
          </div>
          <button className="btn-primary w-fit" disabled={busy}>Schedule</button>
        </form></details>
      <p className="text-xs text-slate-500">Review submissions in the <Link href="/train?tab=trainer" className="text-blue-700 underline">Trainer Dashboard</Link>.</p>
    </section>
  );
}

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [actErr, setActErr] = useState<ApiErr | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => api<Detail>(`/api/train/courses/${id}`).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(toErr(e))), [id]);
  useEffect(() => { load(); }, [load]);

  async function enroll() {
    setBusy(true); setActErr(null);
    try { await api(`/api/train/courses/${id}/enroll`, { method: "POST" }); setNotice("You're enrolled. Your enrollment is saved."); await load(); }
    catch (e) { setActErr(toErr(e)); } finally { setBusy(false); }
  }
  async function toggleLesson(lid: string, completed: boolean) {
    setActErr(null);
    try { await api("/api/train/progress", { method: "POST", body: JSON.stringify({ courseId: id, lessonId: lid, completed }) }); await load(); }
    catch (e) { setActErr(toErr(e)); }
  }
  async function togglePortfolio(v: boolean) {
    if (!d?.enrollment) return;
    try { await api(`/api/train/enrollments/${d.enrollment.id}`, { method: "PATCH", body: JSON.stringify({ showInPortfolio: v }) }); await load(); }
    catch (e) { setActErr(toErr(e)); }
  }

  if (err) return <div className="mx-auto max-w-4xl space-y-4"><ErrorAlert err={err} /><Link href="/train" className="text-sm text-blue-700">← Back to TRAIN</Link></div>;
  if (!d) return <div className="text-sm text-slate-500"><Spinner /> Loading course…</div>;
  const c = d.course;
  const done = new Set(d.enrollment?.completedLessonIds ?? []);
  const allLessons = c.modules.flatMap((m) => m.lessons);
  const lesson = allLessons.find((l) => l.id === lessonId) ?? null;
  const canLearn = Boolean(d.enrollment) || d.isOwner;
  const upcoming = d.sessions.filter((s) => !s.past && s.status === "SCHEDULED");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/train" className="text-sm text-blue-700 hover:underline">← Back to TRAIN</Link>
      <div className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{c.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{c.category} · {c.difficulty} · {c.durationWeeks} weeks · {c.modules.length} modules · {c.lessonCount} lessons</p>
            <p className="text-sm text-slate-500">Trainer: <Link className="text-blue-700 hover:underline" href={`/connect/mentors/${c.trainer.id}`}>{c.trainer.name}</Link>{c.trainer.isDemo && <span className="text-amber-700"> (fictional demo profile)</span>}</p>
          </div>
          <div className="flex gap-1">{c.isDemo && <DemoContentBadge />}{!c.published && <span className="chip bg-slate-100 text-slate-600">Draft</span>}</div>
        </div>
        <p className="text-sm text-slate-700">{c.description}</p>
        <div className="flex flex-wrap gap-1.5">{c.skillTags.map((s) => <span key={s} className="chip bg-blue-50 text-blue-700">{s}</span>)}</div>
        {d.role === "student" && !d.enrollment && <button className="btn-primary" onClick={enroll} disabled={busy}>{busy && <Spinner />} Enroll in this course</button>}
        {d.role !== "student" && !d.isOwner && <p className="text-sm text-slate-500">Switch to the student persona to enroll.</p>}
        {notice && <Alert kind="success">{notice}</Alert>}
        <ErrorAlert err={actErr} />
        {d.progress && (
          <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <ProgressBar pct={d.progress.engagementPct} label={`Lessons completed ${d.progress.completedLessons}/${d.progress.totalLessons}`} />
              <p className="mt-1 text-xs text-slate-500">Engagement progress, not proof of mastery.</p>
            </div>
            <div>
              {d.progress.demonstratedPct !== null
                ? <ProgressBar pct={d.progress.demonstratedPct} color="bg-emerald-600" label={`Trainer-evaluated score (${d.progress.reviewed} reviewed)`} />
                : <p className="text-sm text-slate-600">Assignments: {d.progress.submitted}/{d.progress.totalAssignments} submitted. Demonstrated proficiency appears after trainer review.</p>}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
              <input type="checkbox" checked={d.enrollment?.showInPortfolio ?? false} onChange={(e) => togglePortfolio(e.target.checked)} />
              Show this training on my GROW resume
            </label>
          </div>
        )}
      </div>

      {d.isOwner && <OwnerTools d={d} reload={load} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {c.modules.length === 0 && <Alert kind="info">No modules yet.</Alert>}
          {c.modules.map((m) => {
            const ml = m.lessons.length, md = m.lessons.filter((l) => done.has(l.id)).length;
            return (
              <div key={m.id} className="card space-y-2 p-4">
                <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{m.title}</h3>{d.enrollment && <span className="text-xs text-slate-500">{md}/{ml}</span>}</div>
                {m.summary && <p className="text-xs text-slate-500">{m.summary}</p>}
                <ul className="space-y-1">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <button onClick={() => setLessonId(l.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${lessonId === l.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}>
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${done.has(l.id) ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>{done.has(l.id) && "✓"}</span>
                        <span className="flex-1">{l.title}</span><span className="text-xs text-slate-400">{l.durationMinutes}m</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {d.assignments.filter((a) => a.moduleId === m.id).map((a) => (
                  <button key={a.id} onClick={() => setLessonId(`a:${a.id}`)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${lessonId === `a:${a.id}` ? "bg-amber-50 text-amber-800" : "hover:bg-slate-50"}`}>
                    <span className="text-xs">📝</span><span className="flex-1">{a.title}</span>
                    {a.mySubmission && <span className={`chip ${a.mySubmission.status === "REVIEWED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{a.mySubmission.status === "REVIEWED" ? `${a.mySubmission.score}/${a.maxMarks}` : "Submitted"}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="space-y-6 lg:col-span-3">
          <div className="card min-h-[200px]">
            {lessonId?.startsWith("a:") ? (() => {
              const a = d.assignments.find((x) => `a:${x.id}` === lessonId);
              if (!a) return null;
              const s = a.mySubmission;
              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="h2">{a.title}</h2><span className="chip bg-slate-100 text-slate-600">Max {a.maxMarks} marks</span></div>
                  <p className="text-sm text-slate-700">{a.description}</p>
                  {a.instructions && <div><div className="label">Instructions</div><p className="whitespace-pre-wrap text-sm text-slate-700">{a.instructions}</p></div>}
                  <p className="text-sm text-slate-500">Due: {a.due}</p>
                  <div className="flex flex-wrap gap-1.5">{a.skillTags.map((t) => <span key={t} className="chip bg-blue-50 text-blue-700">{t}</span>)}</div>
                  {s?.status === "REVIEWED" ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <div className="font-semibold text-emerald-800">Reviewed: {s.score}/{a.maxMarks}</div>
                      <p className="mt-1 text-sm text-slate-700">{s.feedback}</p>
                    </div>
                  ) : d.role === "student" && d.enrollment ? (
                    <>{s && <Alert kind="info">Submitted{s.late ? " (late)" : ""}. Awaiting trainer review. You can update it until it&apos;s reviewed.</Alert>}<SubmitForm a={a} onDone={load} /></>
                  ) : !d.isOwner && <Alert kind="info">Enroll to submit this assignment.</Alert>}
                </div>
              );
            })() : lesson ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="h2">{lesson.title}</h2><span className="chip bg-slate-100 text-slate-600">⏱ {lesson.durationMinutes} min</span></div>
                {lesson.objectives.length > 0 && <div><div className="label">Learning objectives</div><ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">{lesson.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>}
                {canLearn && lesson.explanation ? <div className="space-y-3 text-sm leading-relaxed text-slate-700">{lesson.explanation.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}</div>
                  : <Alert kind="info">Enroll to read the full lesson.</Alert>}
                {d.enrollment && (
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={done.has(lesson.id)} onChange={(e) => toggleLesson(lesson.id, e.target.checked)} />
                    Mark lesson completed
                  </label>
                )}
              </div>
            ) : <p className="text-sm text-slate-500">Select a lesson or assignment from the modules on the left.</p>}
          </div>

          <div className="card space-y-3">
            <h2 className="h2">Upcoming weekend live classes</h2>
            {upcoming.length === 0 ? <p className="text-sm text-slate-500">No live classes scheduled.</p> : upcoming.map((s) => (
              <div key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div><b className="text-sm">{s.title}</b><p className="text-sm text-slate-600">{s.when} · {c.trainer.name}{s.isDemo && " · demo session"}</p>{s.agenda && <p className="text-xs text-slate-500">{s.agenda}</p>}</div>
                {(d.enrollment || d.isOwner) ? <JoinSessionButton /> : <span className="text-xs text-slate-500">Enroll to join</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
