"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { JoinSessionButton, PersonaGate, usePersona } from "@/components/connect";
import { CourseCardView, ProgressBar, type CourseCard } from "@/components/train";

const TABS = [
  { id: "catalog", label: "Training Catalog" },
  { id: "my", label: "My Training" },
  { id: "trainer", label: "Trainer Dashboard" },
] as const;
type Facets = { categories: string[]; difficulties: string[] };

function Catalog() {
  const [q, setQ] = useState(""), [category, setCategory] = useState(""), [difficulty, setDifficulty] = useState("");
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const qs = new URLSearchParams(Object.entries({ q, category, difficulty }).filter(([, v]) => v));
    try { const d = await api<{ courses: CourseCard[]; facets: Facets }>(`/api/train/courses?${qs}`); setCourses(d.courses); setFacets(d.facets); setErr(null); }
    catch (e) { setErr(toErr(e)); }
  }, [q, category, difficulty]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function enroll(c: CourseCard) {
    setBusy(c.id); setErr(null); setMsg(null);
    try { await api(`/api/train/courses/${c.id}/enroll`, { method: "POST" }); setMsg(`Enrolled in ${c.title}. Saved to your training.`); await load(); }
    catch (e) { setErr(toErr(e)); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-4">
        <input className="input sm:col-span-2" placeholder="Search courses or skills (e.g. Node.js, MongoDB)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search courses" />
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Domain">
          <option value="">All domains</option>{facets?.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
          <option value="">All levels</option>{facets?.difficulties.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <ErrorAlert err={err} />
      {msg && <Alert kind="success">{msg} <Link href="/train?tab=my" className="font-semibold underline">Go to My Training</Link></Alert>}
      {!courses ? <div className="text-sm text-slate-500"><Spinner /> Loading courses…</div>
        : courses.length === 0 ? <Alert kind="info">No training programs match these filters.</Alert>
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{courses.map((c) => <CourseCardView key={c.id} c={c} busy={busy === c.id} onEnroll={() => enroll(c)} />)}</div>}
    </div>
  );
}

type MyEnroll = { id: string; courseId: string; title: string; trainer: string; isDemo: boolean; engagementPct: number; completedLessons: number; totalLessons: number; submitted: number; reviewed: number; totalAssignments: number; demonstratedPct: number | null; showInPortfolio: boolean; completed: boolean };
type MySession = { id: string; courseId: string; courseTitle: string; title: string; agenda: string; trainer: string; when: string; durationMinutes: number; status: string; isDemo: boolean };
type MyFeedback = { assignmentTitle: string; courseId: string; courseTitle: string; score: number; maxMarks: number; feedback: string };

function MyTraining() {
  const { info } = usePersona();
  const [d, setD] = useState<{ enrollments: MyEnroll[]; upcomingSessions: MySession[]; feedback: MyFeedback[]; mentorshipSessions: { id: string; mentorId: string; mentor: string; topic: string; startAt: string; endAt: string; when: string; durationMinutes: number }[] } | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  useEffect(() => {
    if (info?.persona.role !== "student") return;
    api<typeof d>("/api/train/me").then((x) => setD(x)).catch((e) => setErr(toErr(e)));
  }, [info]);
  return (
    <PersonaGate need="student" info={info}>
      <ErrorAlert err={err} />
      {!d ? (!err && <div className="text-sm text-slate-500"><Spinner /> Loading your training…</div>) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <h2 className="h2">Enrolled programs</h2>
            {d.enrollments.length === 0 ? <Alert kind="info">You haven&apos;t enrolled yet. Browse the <Link className="font-semibold underline" href="/train?tab=catalog">Training Catalog</Link>.</Alert>
              : d.enrollments.map((e) => (
                <div key={e.id} className="card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="font-semibold">{e.title}</h3><p className="text-sm text-slate-500">Trainer: {e.trainer}</p></div>
                    {e.completed && <span className="chip bg-emerald-100 text-emerald-700">Completed</span>}
                  </div>
                  <ProgressBar pct={e.engagementPct} label={`Lessons completed: ${e.completedLessons}/${e.totalLessons} (engagement)`} />
                  <div className="text-sm text-slate-600">
                    Assignments: {e.submitted}/{e.totalAssignments} submitted · {e.reviewed} reviewed
                    {e.demonstratedPct !== null && <> · <b className="text-blue-700">{e.demonstratedPct}% average trainer-evaluated score</b></>}
                  </div>
                  <Link href={`/train/courses/${e.courseId}`} className="btn-primary">Continue learning →</Link>
                </div>
              ))}
          </div>
          <div className="space-y-6">
            <div className="card space-y-3">
              <h2 className="h2">Upcoming sessions</h2>
              {d.mentorshipSessions.map((m) => (
                <div key={m.id} className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                  <div className="flex items-start justify-between gap-2"><b className="text-sm">{m.topic}</b><span className="chip bg-emerald-100 text-emerald-700">1:1 mentorship</span></div>
                  <p className="text-xs text-slate-500">with <Link className="text-blue-700 hover:underline" href={`/connect/mentors/${m.mentorId}`}>{m.mentor}</Link></p>
                  <p className="text-sm text-slate-700">{m.when} · {m.durationMinutes} min</p>
                  <JoinSessionButton startAt={m.startAt} endAt={m.endAt} />
                </div>
              ))}
              {d.upcomingSessions.length === 0 && d.mentorshipSessions.length === 0 ? <p className="text-sm text-slate-500">No upcoming classes or mentorship sessions.</p> : d.upcomingSessions.map((s) => (
                <div key={s.id} className="space-y-1 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2"><b className="text-sm">{s.title}</b><span className="chip bg-emerald-100 text-emerald-700">{s.status}</span></div>
                  <p className="text-xs text-slate-500">{s.courseTitle} · {s.trainer}{s.isDemo && " · demo session"}</p>
                  <p className="text-sm text-slate-700">{s.when} · {s.durationMinutes} min</p>
                  {s.agenda && <p className="text-xs text-slate-500">{s.agenda}</p>}
                  <p className="text-xs text-slate-500">Joining: open the GURUKOOL collaboration space at the scheduled time.</p>
                  <JoinSessionButton />
                </div>
              ))}
            </div>
            <div className="card space-y-3">
              <h2 className="h2">Trainer feedback</h2>
              {d.feedback.length === 0 ? <p className="text-sm text-slate-500">No reviewed assignments yet.</p> : d.feedback.map((f, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex justify-between gap-2"><b>{f.assignmentTitle}</b><span className="font-semibold text-blue-700">{f.score}/{f.maxMarks}</span></div>
                  <p className="mt-1 text-slate-600">{f.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PersonaGate>
  );
}

type TCourse = CourseCard & { enrolledCount: number };
type TSub = { id: string; assignmentTitle: string; maxMarks: number; courseTitle: string; studentName: string; submissionText: string; repositoryUrl: string; projectUrl: string; submitted: string; late: boolean; status: string; score: number | null; feedback: string };
type TData = { mentorshipSessions: { id: string; student: string; topic: string; when: string }[]; courses: TCourse[]; students: { courseId: string; courseTitle: string; name: string; engagementPct: number }[]; pendingReviews: number; sessions: { id: string; courseTitle: string; title: string; when: string; started: boolean }[] };

function ReviewForm({ s, onDone }: { s: TSub; onDone: () => void }) {
  const [score, setScore] = useState(""), [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState<ApiErr | null>(null);
  return (
    <form className="mt-3 space-y-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await api(`/api/train/submissions/${s.id}`, { method: "PATCH", body: JSON.stringify({ score: Number(score), feedback }) }); onDone(); }
      catch (x) { setErr(toErr(x)); } finally { setBusy(false); }
    }}>
      <div className="flex gap-2">
        <input className="input w-28" type="number" min={0} max={s.maxMarks} step="0.5" placeholder={`/ ${s.maxMarks}`} value={score} onChange={(e) => setScore(e.target.value)} required aria-label="Marks" />
        <input className="input" placeholder="Feedback for the student" value={feedback} onChange={(e) => setFeedback(e.target.value)} required minLength={5} aria-label="Feedback" />
      </div>
      <ErrorAlert err={err} />
      <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save review</button>
    </form>
  );
}

function TrainerDashboard() {
  const { info } = usePersona();
  const [d, setD] = useState<TData | null>(null);
  const [subs, setSubs] = useState<TSub[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "Backend Development", difficulty: "Beginner", durationWeeks: 4, skillTags: "" });
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([api<TData>("/api/train/trainer"), api<{ submissions: TSub[] }>("/api/train/submissions")]);
      setD(t); setSubs(s.submissions); setErr(null);
    } catch (e) { setErr(toErr(e)); }
  }, []);
  useEffect(() => { if (info?.persona.role === "mentor") load(); }, [info, load]);

  async function sessionAction(id: string, status: string) {
    try { await api(`/api/train/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); load(); } catch (e) { setErr(toErr(e)); }
  }

  return (
    <PersonaGate need="mentor" info={info}>
      <p className="mb-4 text-xs text-slate-500">Trainers are existing GURUKOOL mentor profiles. Trainer access uses the demo persona (simulation, not real login).</p>
      <ErrorAlert err={err} />
      {!d ? (!err && <div className="text-sm text-slate-500"><Spinner /> Loading…</div>) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card"><div className="label">My courses</div><div className="text-3xl font-bold text-blue-700">{d.courses.length}</div></div>
            <div className="card"><div className="label">Enrolled students</div><div className="text-3xl font-bold text-emerald-700">{d.students.length}</div></div>
            <div className="card"><div className="label">Awaiting review</div><div className="text-3xl font-bold text-amber-700">{d.pendingReviews}</div></div>
          </div>

          <section className="card space-y-3">
            <h2 className="h2">Submissions to review</h2>
            {!subs ? <Spinner /> : subs.filter((s) => s.status === "SUBMITTED").length === 0 ? <p className="text-sm text-slate-500">Nothing waiting for review.</p>
              : subs.filter((s) => s.status === "SUBMITTED").map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap justify-between gap-2"><b>{s.assignmentTitle}</b><span className="text-xs text-slate-500">{s.courseTitle}</span></div>
                  <p className="text-sm text-slate-600">{s.studentName} · submitted {s.submitted}{s.late && <span className="text-amber-700"> · late</span>}</p>
                  {s.submissionText && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{s.submissionText}</pre>}
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {s.repositoryUrl && <a className="text-blue-700 hover:underline" href={s.repositoryUrl} target="_blank" rel="noopener noreferrer nofollow">Repository ↗</a>}
                    {s.projectUrl && <a className="text-blue-700 hover:underline" href={s.projectUrl} target="_blank" rel="noopener noreferrer nofollow">Project ↗</a>}
                  </div>
                  <ReviewForm s={s} onDone={load} />
                </div>
              ))}
            {subs && subs.some((s) => s.status === "REVIEWED") && (
              <details className="text-sm"><summary className="cursor-pointer text-slate-500">Reviewed ({subs.filter((s) => s.status === "REVIEWED").length})</summary>
                {subs.filter((s) => s.status === "REVIEWED").map((s) => <p key={s.id} className="mt-1 text-slate-600">{s.studentName}: {s.assignmentTitle}: <b>{s.score}/{s.maxMarks}</b></p>)}
              </details>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card space-y-3">
              <h2 className="h2">My courses</h2>
              {d.courses.length === 0 ? <p className="text-sm text-slate-500">No courses yet. Create one below.</p> : d.courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div><b className="text-sm">{c.title}</b><p className="text-xs text-slate-500">{c.published ? "Published" : "Draft"} · {c.moduleCount} modules · {c.enrolledCount} enrolled</p></div>
                  <Link href={`/train/courses/${c.id}`} className="btn-ghost px-3 py-1.5">Manage</Link>
                </div>
              ))}
            </section>
            <section className="card space-y-3">
              <h2 className="h2">Weekend live sessions</h2>
              {d.mentorshipSessions.map((m) => (
                <div key={m.id} className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-sm">
                  <b>{m.topic}</b> <span className="chip bg-emerald-100 text-emerald-700">1:1 mentorship</span>
                  <p className="text-slate-500">{m.student} · {m.when}</p>
                </div>
              ))}
              {d.sessions.length === 0 ? <p className="text-sm text-slate-500">No scheduled sessions. Schedule one from a course page.</p> : d.sessions.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <b>{s.title}</b><p className="text-slate-500">{s.courseTitle} · {s.when}</p>
                  <div className="mt-2 flex gap-3">
                    {s.started && <button className="text-blue-700 hover:underline" onClick={() => sessionAction(s.id, "COMPLETED")}>Mark completed</button>}
                    <button className="text-red-600 hover:underline" onClick={() => confirm("Cancel this session?") && sessionAction(s.id, "CANCELLED")}>Cancel</button>
                  </div>
                </div>
              ))}
            </section>
          </div>

          <section className="card space-y-3">
            <h2 className="h2">Enrolled students</h2>
            {d.students.length === 0 ? <p className="text-sm text-slate-500">No enrollments yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">Student</th><th>Course</th><th className="w-48">Lesson progress</th></tr></thead>
                <tbody>{d.students.map((s, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2">{s.name}</td><td>{s.courseTitle}</td><td><ProgressBar pct={s.engagementPct} /></td></tr>)}</tbody>
              </table></div>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="h2">Create a training course</h2>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
              e.preventDefault(); setCreating(true); setErr(null);
              try { const r = await api<{ course: { id: string } }>("/api/train/courses", { method: "POST", body: JSON.stringify(form) }); window.location.href = `/train/courses/${r.course.id}`; }
              catch (x) { setErr(toErr(x)); setCreating(false); }
            }}>
              <div className="sm:col-span-2"><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
              <div><label className="label">Domain</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["Backend Development", "Frontend Development", "Full Stack Development", "AI/ML", "Cloud Computing", "Cybersecurity", "DSA and Interview Preparation"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Difficulty</label><select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                {["Beginner", "Intermediate", "Advanced"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Duration (weeks)</label><input className="input" type="number" min={1} max={52} value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: Number(e.target.value) })} /></div>
              <div><label className="label">Skill tags (comma separated)</label><input className="input" value={form.skillTags} onChange={(e) => setForm({ ...form, skillTags: e.target.value })} required placeholder="React, TypeScript" /></div>
              <div className="sm:col-span-2"><button className="btn-primary" disabled={creating}>{creating && <Spinner />} Create course (draft)</button></div>
            </form>
          </section>
        </div>
      )}
    </PersonaGate>
  );
}

function TrainInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { role } = usePersona();
  const tabs = TABS.filter((t) => (t.id === "trainer" ? role === "mentor" : t.id === "my" ? role === "student" : true));
  const tab = (tabs.find((t) => t.id === sp.get("tab"))?.id ?? "catalog") as (typeof TABS)[number]["id"];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="GURUKOOL TRAIN" subtitle="Structured learning. Industry-led training. Measurable progress." />
      <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => router.replace(`/train?tab=${t.id}`, { scroll: false })}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{t.label}</button>
        ))}
      </div>
      {tab === "catalog" && <Catalog />}
      {tab === "my" && <MyTraining />}
      {tab === "trainer" && <TrainerDashboard />}
      <p className="mt-10 text-xs text-slate-400">Lesson completion measures engagement, not mastery. Demonstrated skill comes from trainer-evaluated assignments. Courses marked “Demo content” are sample material; their trainer is a fictional demo profile. Times are IST.</p>
    </div>
  );
}

export default function TrainPage() {
  return <Suspense fallback={<div className="text-sm text-slate-500"><Spinner /> Loading…</div>}><TrainInner /></Suspense>;
}
