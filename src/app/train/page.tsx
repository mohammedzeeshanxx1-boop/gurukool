"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { JoinSessionButton, PersonaGate, usePersona } from "@/components/connect";
import { CourseCardView, ProgressBar, type CourseCard } from "@/components/train";
import { RESOURCES, RESOURCE_DOMAINS } from "@/lib/train/resources";

const TABS = [
  { id: "resources", label: "Free Resources" },
  { id: "my", label: "My Learning" },
  { id: "trainer", label: "Trainer Dashboard" },
] as const;
type Facets = { categories: string[]; difficulties: string[] };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      {!courses ? <div className="text-sm text-zinc-500"><Spinner /> Loading courses…</div>
        : courses.length === 0 ? <Alert kind="info">No training programs match these filters.</Alert>
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{courses.map((c) => <CourseCardView key={c.id} c={c} busy={busy === c.id} onEnroll={() => enroll(c)} />)}</div>}
    </div>
  );
}

type MyEnroll = { id: string; courseId: string; title: string; trainer: string; isDemo: boolean; engagementPct: number; completedLessons: number; totalLessons: number; submitted: number; reviewed: number; totalAssignments: number; demonstratedPct: number | null; showInPortfolio: boolean; completed: boolean };
type MySession = { id: string; courseId: string; courseTitle: string; title: string; agenda: string; trainer: string; when: string; durationMinutes: number; status: string; isDemo: boolean };
type MyFeedback = { assignmentTitle: string; courseId: string; courseTitle: string; score: number; maxMarks: number; feedback: string };
type FreeEnroll = { id: string; resourceId: string; title: string; url: string; domain: string; enrolledAt: string };

function MyTraining() {
  const { info } = usePersona();
  const [d, setD] = useState<{ enrollments: MyEnroll[]; upcomingSessions: MySession[]; feedback: MyFeedback[]; mentorshipSessions: { id: string; mentorId: string; mentor: string; topic: string; startAt: string; endAt: string; when: string; durationMinutes: number }[] } | null>(null);
  const [freeEnrolls, setFreeEnrolls] = useState<FreeEnroll[]>([]);
  const [err, setErr] = useState<ApiErr | null>(null);
  useEffect(() => {
    if (info?.persona.role !== "student") return;
    api<typeof d>("/api/train/me").then((x) => setD(x)).catch((e) => setErr(toErr(e)));
    api<{ enrollments: FreeEnroll[] }>("/api/train/free-enroll").then((x) => setFreeEnrolls(x.enrollments)).catch(() => {});
  }, [info]);
  return (
    <PersonaGate need="student" info={info}>
      <ErrorAlert err={err} />
      {!d ? (!err && <div className="text-sm text-zinc-500"><Spinner /> Loading your training…</div>) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <h2 className="h2">Enrolled programs</h2>
            {d.enrollments.length === 0 && freeEnrolls.length === 0 ? <Alert kind="info">You haven&apos;t started any courses yet. Browse <Link className="font-semibold underline" href="/train?tab=resources">Free Resources</Link> to get started.</Alert>
              : d.enrollments.map((e) => (
                <div key={e.id} className="card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="font-semibold">{e.title}</h3><p className="text-sm text-zinc-500">Trainer: {e.trainer}</p></div>
                    {e.completed && <span className="chip bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>}
                  </div>
                  <ProgressBar pct={e.engagementPct} label={`Lessons completed: ${e.completedLessons}/${e.totalLessons} (engagement)`} />
                  <div className="text-sm text-zinc-600">
                    Assignments: {e.submitted}/{e.totalAssignments} submitted · {e.reviewed} reviewed
                    {e.demonstratedPct !== null && <> · <b className="text-zinc-700">{e.demonstratedPct}% average trainer-evaluated score</b></>}
                  </div>
                  <Link href={`/train/courses/${e.courseId}`} className="btn-primary">Continue learning →</Link>
                </div>
              ))}
            {freeEnrolls.length > 0 && (
              <>
                <h3 className="font-medium text-zinc-700 mt-2">Free YouTube Courses</h3>
                {freeEnrolls.map((e) => (
                  <div key={e.id} className="card flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold text-zinc-900">{e.title}</p>
                      <p className="text-xs text-zinc-500">{e.domain}</p>
                    </div>
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="btn-primary whitespace-nowrap text-sm">Watch ↗</a>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="space-y-6">
            <div className="card space-y-3">
              <h2 className="h2">Upcoming sessions</h2>
              {d.mentorshipSessions.map((m) => (
                <div key={m.id} className="space-y-1 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <div className="flex items-start justify-between gap-2"><b className="text-sm">{m.topic}</b><span className="chip bg-emerald-50 text-emerald-600">1:1 mentorship</span></div>
                  <p className="text-xs text-zinc-500">with <span className="text-zinc-700">{m.mentor}</span></p>
                  <p className="text-sm text-zinc-700">{m.when} · {m.durationMinutes} min</p>
                  <JoinSessionButton startAt={m.startAt} endAt={m.endAt} />
                </div>
              ))}
              {d.upcomingSessions.length === 0 && d.mentorshipSessions.length === 0 ? <p className="text-sm text-zinc-500">No upcoming classes or mentorship sessions.</p> : d.upcomingSessions.map((s) => (
                <div key={s.id} className="space-y-1 rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-start justify-between gap-2"><b className="text-sm">{s.title}</b><span className="chip bg-emerald-50 text-emerald-600">{s.status}</span></div>
                  <p className="text-xs text-zinc-500">{s.courseTitle} · {s.trainer}{s.isDemo && " · demo session"}</p>
                  <p className="text-sm text-zinc-700">{s.when} · {s.durationMinutes} min</p>
                  {s.agenda && <p className="text-xs text-zinc-500">{s.agenda}</p>}
                  <p className="text-xs text-zinc-500">Joining: open the GURUKOOL collaboration space at the scheduled time.</p>
                  <JoinSessionButton />
                </div>
              ))}
            </div>
            <div className="card space-y-3">
              <h2 className="h2">Trainer feedback</h2>
              {d.feedback.length === 0 ? <p className="text-sm text-zinc-500">No reviewed assignments yet.</p> : d.feedback.map((f, i) => (
                <div key={i} className="rounded-lg border border-zinc-200 p-3 text-sm">
                  <div className="flex justify-between gap-2"><b>{f.assignmentTitle}</b><span className="font-semibold text-zinc-700">{f.score}/{f.maxMarks}</span></div>
                  <p className="mt-1 text-zinc-600">{f.feedback}</p>
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
      <p className="mb-4 text-xs text-zinc-500">Trainers are existing GURUKOOL mentor profiles. Trainer access uses the demo persona (simulation, not real login).</p>
      <ErrorAlert err={err} />
      {!d ? (!err && <div className="text-sm text-zinc-500"><Spinner /> Loading…</div>) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card"><div className="label">My courses</div><div className="text-3xl font-semibold text-zinc-900">{d.courses.length}</div></div>
            <div className="card"><div className="label">Enrolled students</div><div className="text-3xl font-semibold text-zinc-900">{d.students.length}</div></div>
            <div className="card"><div className="label">Awaiting review</div><div className="text-3xl font-semibold text-zinc-900">{d.pendingReviews}</div></div>
          </div>

          <section className="card space-y-3">
            <h2 className="h2">Submissions to review</h2>
            {!subs ? <Spinner /> : subs.filter((s) => s.status === "SUBMITTED").length === 0 ? <p className="text-sm text-zinc-500">Nothing waiting for review.</p>
              : subs.filter((s) => s.status === "SUBMITTED").map((s) => (
                <div key={s.id} className="rounded-lg border border-zinc-200 p-4">
                  <div className="flex flex-wrap justify-between gap-2"><b>{s.assignmentTitle}</b><span className="text-xs text-zinc-500">{s.courseTitle}</span></div>
                  <p className="text-sm text-zinc-600">{s.studentName} · submitted {s.submitted}{s.late && <span className="text-amber-600"> · late</span>}</p>
                  {s.submissionText && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs">{s.submissionText}</pre>}
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {s.repositoryUrl && <a className="text-zinc-700 hover:underline" href={s.repositoryUrl} target="_blank" rel="noopener noreferrer nofollow">Repository ↗</a>}
                    {s.projectUrl && <a className="text-zinc-700 hover:underline" href={s.projectUrl} target="_blank" rel="noopener noreferrer nofollow">Project ↗</a>}
                  </div>
                  <ReviewForm s={s} onDone={load} />
                </div>
              ))}
            {subs && subs.some((s) => s.status === "REVIEWED") && (
              <details className="text-sm"><summary className="cursor-pointer text-zinc-500">Reviewed ({subs.filter((s) => s.status === "REVIEWED").length})</summary>
                {subs.filter((s) => s.status === "REVIEWED").map((s) => <p key={s.id} className="mt-1 text-zinc-600">{s.studentName}: {s.assignmentTitle}: <b>{s.score}/{s.maxMarks}</b></p>)}
              </details>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card space-y-3">
              <h2 className="h2">My courses</h2>
              {d.courses.length === 0 ? <p className="text-sm text-zinc-500">No courses yet. Create one below.</p> : d.courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-3">
                  <div><b className="text-sm">{c.title}</b><p className="text-xs text-zinc-500">{c.published ? "Published" : "Draft"} · {c.moduleCount} modules · {c.enrolledCount} enrolled</p></div>
                  <Link href={`/train/courses/${c.id}`} className="btn-ghost px-3 py-1.5">Manage</Link>
                </div>
              ))}
            </section>
            <section className="card space-y-3">
              <h2 className="h2">Weekend live sessions</h2>
              {d.mentorshipSessions.map((m) => (
                <div key={m.id} className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm">
                  <b>{m.topic}</b> <span className="chip bg-emerald-50 text-emerald-600">1:1 mentorship</span>
                  <p className="text-zinc-500">{m.student} · {m.when}</p>
                </div>
              ))}
              {d.sessions.length === 0 ? <p className="text-sm text-zinc-500">No scheduled sessions. Schedule one from a course page.</p> : d.sessions.map((s) => (
                <div key={s.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                  <b>{s.title}</b><p className="text-zinc-500">{s.courseTitle} · {s.when}</p>
                  <div className="mt-2 flex gap-3">
                    {s.started && <button className="text-zinc-700 hover:underline" onClick={() => sessionAction(s.id, "COMPLETED")}>Mark completed</button>}
                    <button className="text-red-500 hover:underline" onClick={() => confirm("Cancel this session?") && sessionAction(s.id, "CANCELLED")}>Cancel</button>
                  </div>
                </div>
              ))}
            </section>
          </div>

          <section className="card space-y-3">
            <h2 className="h2">Enrolled students</h2>
            {d.students.length === 0 ? <p className="text-sm text-zinc-500">No enrollments yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-zinc-400"><th className="py-2">Student</th><th>Course</th><th className="w-48">Lesson progress</th></tr></thead>
                <tbody>{d.students.map((s, i) => <tr key={i} className="border-t border-zinc-100"><td className="py-2">{s.name}</td><td>{s.courseTitle}</td><td><ProgressBar pct={s.engagementPct} /></td></tr>)}</tbody>
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

const LEVEL_COLOR: Record<string, string> = {
  "Beginner": "bg-emerald-50 text-emerald-600",
  "Intermediate": "bg-zinc-50 text-zinc-600",
  "Advanced": "bg-zinc-100 text-zinc-700",
};
const LANG_COLOR: Record<string, string> = {
  "English": "bg-zinc-100 text-zinc-500",
  "Hindi+English": "bg-amber-50 text-amber-600",
  "Hindi": "bg-amber-50 text-amber-600",
};

function FreeResources() {
  const { info } = usePersona();
  const [domain, setDomain] = useState("All");
  const [level, setLevel] = useState("All");
  const [q, setQ] = useState("");
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => {
    if (info?.persona.role !== "student") return;
    api<{ enrollments: { resourceId: string }[] }>("/api/train/free-enroll")
      .then((d) => setEnrolled(new Set(d.enrollments.map((e) => e.resourceId))))
      .catch(() => {});
  }, [info]);

  async function enroll(r: { id: string; title: string }) {
    if (enrolling) return;
    setEnrolling(r.id);
    try {
      await api("/api/train/free-enroll", { method: "POST", body: JSON.stringify({ resourceId: r.id }) });
      setEnrolled((prev) => new Set([...prev, r.id]));
    } catch {}
    finally { setEnrolling(null); }
  }

  const filtered = RESOURCES.filter((r) => {
    if (domain !== "All" && r.domain !== domain) return false;
    if (level !== "All" && r.level !== level) return false;
    if (q && !`${r.title} ${r.creator} ${r.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters — compact inline */}
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search courses, creators…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[200px]" value={domain} onChange={(e) => setDomain(e.target.value)}>
          {RESOURCE_DOMAINS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="input max-w-[160px]" value={level} onChange={(e) => setLevel(e.target.value)}>
          {["All", "Beginner", "Intermediate", "Advanced"].map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>

      {filtered.length === 0 && <Alert kind="info">No resources match these filters.</Alert>}

      {/* Domain sections */}
      {(domain === "All" ? RESOURCE_DOMAINS.filter((d) => d !== "All") : [domain]).map((dom) => {
        const items = filtered.filter((r) => r.domain === dom);
        if (!items.length) return null;
        return (
          <div key={dom} className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">{dom}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => {
                const isEnrolled = enrolled.has(r.id);
                return (
                  <div key={r.id} className="card flex flex-col gap-3 p-5">
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-900 leading-snug">{r.title}</p>
                      <p className="text-xs text-zinc-400 mt-1">{r.creator}</p>
                      <p className="text-[13px] text-zinc-500 leading-relaxed mt-2">{r.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`chip ${LEVEL_COLOR[r.level]}`}>{r.level}</span>
                      <span className={`chip ${LANG_COLOR[r.language]}`}>{r.language}</span>
                      {r.lessons && <span className="chip bg-zinc-100 text-zinc-500">{r.lessons}+ videos</span>}
                    </div>
                    <div className="flex gap-2 mt-auto pt-1">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm flex-1 text-center">Watch ↗</a>
                      {info?.persona.role === "student" && (
                        isEnrolled
                          ? <span className="flex-1 text-center rounded-lg py-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-600">Saved</span>
                          : <button className="btn-primary btn-sm flex-1" disabled={enrolling === r.id} onClick={() => enroll(r)}>{enrolling === r.id ? <Spinner /> : "Save course"}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-zinc-300 pt-4">All resources link to free publicly available YouTube content. UDAAN does not host any of this content.</p>
    </div>
  );
}

function TrainInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { role } = usePersona();
  const tabs = TABS.filter((t) => (t.id === "trainer" ? role === "mentor" : t.id === "my" ? role === "student" : true));
  const tab = (tabs.find((t) => t.id === sp.get("tab"))?.id ?? "resources") as (typeof TABS)[number]["id"];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Upskill" subtitle="Curated courses, structured learning, real progress." />
      <div role="tablist" className="mb-8 flex gap-1 rounded-xl bg-zinc-100 p-1 max-w-fit">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => router.replace(`/train?tab=${t.id}`, { scroll: false })}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-medium transition-colors duration-150 ${
              tab === t.id
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-600"
            }`}>{t.label}</button>
        ))}
      </div>
      {tab === "resources" && <FreeResources />}
      {tab === "my" && <MyTraining />}
      {tab === "trainer" && <TrainerDashboard />}
      <p className="mt-10 text-xs text-zinc-400">Lesson completion measures engagement, not mastery. Demonstrated skill comes from trainer-evaluated assignments. Courses marked “Demo content” are sample material; their trainer is a fictional demo profile. Times are IST.</p>
    </div>
  );
}

export default function TrainPage() {
  return <Suspense fallback={<div className="text-sm text-zinc-500"><Spinner /> Loading…</div>}><TrainInner /></Suspense>;
}
