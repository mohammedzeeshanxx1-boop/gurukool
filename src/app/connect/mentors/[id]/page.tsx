"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { Alert, ErrorAlert, Spinner, api, toErr, useStudent, type ApiErr } from "@/components/ui";
import { PersonaGate, ProfileBadge, slotText, usePersona, type Mentor, type UpcomingSlot } from "@/components/connect";

type Detail = { mentor: Mentor; slots: UpcomingSlot[]; myRequests: string[]; isOwner: boolean; timezone: string };
const DURATIONS = [30, 45, 60, 90, 120];

export default function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { info } = usePersona();
  const { student } = useStudent();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);

  const [form, setForm] = useState({ studentName: "", studentEmail: "", topic: "", startAt: "", durationMinutes: 60, message: "" });
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<ApiErr | null>(null);
  const [done, setDone] = useState(false);

  const load = () => api<Detail>(`/api/mentors/${id}`).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(toErr(e)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (student) setForm((f) => ({ ...f, studentName: f.studentName || student.name, studentEmail: f.studentEmail || student.email }));
  }, [student]);
  useEffect(() => {
    if (d && !form.topic) setForm((f) => ({ ...f, topic: d.mentor.teachingTopics[0] ?? "" }));
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  const slot = useMemo(() => d?.slots.find((s) => s.startAt === form.startAt), [d, form.startAt]);
  const durations = DURATIONS.filter((x) => !slot || x <= slot.slotMinutes);
  useEffect(() => {
    if (slot && form.durationMinutes > slot.slotMinutes) setForm((f) => ({ ...f, durationMinutes: Math.max(...DURATIONS.filter((x) => x <= slot.slotMinutes)) }));
  }, [slot]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setSubmitErr(null);
    try {
      await api("/api/mentor-sessions", { method: "POST", body: JSON.stringify({ ...form, mentorId: id }) });
      setDone(true);
      load();
    } catch (e) { setSubmitErr(toErr(e)); } finally { setBusy(false); }
  }

  if (err) return <div className="mx-auto max-w-4xl"><ErrorAlert err={err} /><Link href="/connect" className="mt-4 inline-block text-sm text-blue-700">← Back to Connect</Link></div>;
  if (!d) return <div className="text-sm text-slate-500"><Spinner /> Loading profile…</div>;
  const m = d.mentor;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: k === "durationMinutes" ? Number(e.target.value) : e.target.value });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/connect" className="text-sm text-blue-700 hover:underline">← Back to Connect</Link>
      {m.isDemo && <Alert kind="warn">This is a <b>fictional demonstration profile</b>. It does not represent a real person, employer or employment history.</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card space-y-4 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{m.name}</h1>
              <p className="text-slate-600">{m.headline}</p>
              <p className="mt-1 text-sm text-slate-500">{m.designation} · {m.organization} · {m.yearsOfExperience} years of experience</p>
            </div>
            <ProfileBadge isDemo={m.isDemo} />
          </div>
          <div><div className="label">Professional background</div><p className="text-sm text-slate-700">{m.bio || "—"}</p></div>
          <div><div className="label">Technical skills</div>
            <div className="flex flex-wrap gap-1.5">{m.expertise.map((x) => <span key={x} className="chip bg-slate-100 text-slate-700">{x}</span>)}</div></div>
          <div><div className="label">Topics offered</div>
            <div className="flex flex-wrap gap-1.5">{m.teachingTopics.map((x) => <span key={x} className="chip bg-blue-50 text-blue-700">{x}</span>)}</div></div>
          <div><div className="label">Session description</div><p className="text-sm text-slate-700">{m.sessionDescription || "—"}</p>
            <p className="mt-1 text-xs text-slate-500">Formats: {m.sessionFormats.join(", ")}</p></div>
          <div><div className="label">Weekly availability (IST)</div>
            <div className="flex flex-wrap gap-1.5">{m.availability.length ? m.availability.map((s, i) => <span key={i} className="chip bg-emerald-50 text-emerald-700">{slotText(s)}</span>) : <span className="text-sm text-slate-400">No slots published</span>}</div></div>
          {d.isOwner && <Alert kind="info">This is your profile. Manage it from the <Link href="/connect/mentor" className="font-semibold underline">Mentor Dashboard</Link>.</Alert>}
        </div>

        <div id="book" className="lg:col-span-2">
          <PersonaGate need="student" info={info}>
            <form onSubmit={submit} className="card space-y-3">
              <h2 className="h2">Request a weekend session</h2>
              {done ? (
                <div className="space-y-3">
                  <Alert kind="success">Your mentorship request has been sent successfully. You&apos;ll receive confirmation when the mentor accepts.</Alert>
                  <p className="text-xs text-slate-500">Status updates appear in My Sessions. No email or notification has been sent.</p>
                  <div className="flex gap-2">
                    <Link href="/connect?tab=sessions" className="btn-primary flex-1">View My Sessions</Link>
                    <button type="button" className="btn-ghost" onClick={() => { setDone(false); setForm((f) => ({ ...f, startAt: "", message: "" })); }}>New request</button>
                  </div>
                </div>
              ) : d.slots.length === 0 ? (
                <Alert kind="info">This mentor has no open weekend slots in the next 4 weeks.</Alert>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Your name</label><input className="input bg-slate-50" value={form.studentName} readOnly /></div>
                    <div><label className="label">Your email</label><input className="input bg-slate-50" type="email" value={form.studentEmail} readOnly /></div>
                  </div>
                  <div><label className="label">Mentor</label><input className="input bg-slate-50" value={m.name} readOnly /></div>
                  <div><label className="label">Topic</label>
                    <select className="input" value={form.topic} onChange={set("topic")} required>
                      {m.teachingTopics.map((t) => <option key={t}>{t}</option>)}
                    </select></div>
                  <div><label className="label">Preferred date &amp; time (IST)</label>
                    <select className="input" value={form.startAt} onChange={set("startAt")} required>
                      <option value="">Select an available slot…</option>
                      {d.slots.map((s) => (
                        <option key={s.startAt} value={s.startAt} disabled={d.myRequests.includes(s.startAt)}>
                          {s.label}{d.myRequests.includes(s.startAt) ? " (already requested)" : ""}
                        </option>
                      ))}
                    </select></div>
                  <div><label className="label">Duration</label>
                    <select className="input" value={form.durationMinutes} onChange={set("durationMinutes")}>
                      {durations.map((x) => <option key={x} value={x}>{x} minutes</option>)}
                    </select></div>
                  <div><label className="label">What do you want to learn?</label>
                    <textarea className="input" rows={4} minLength={10} maxLength={1000} required value={form.message} onChange={set("message")}
                      placeholder="e.g. I'm weak in Node.js async patterns and want help structuring a REST API for my project." /></div>
                  <ErrorAlert err={submitErr} />
                  <button className="btn-primary w-full" disabled={busy || !form.startAt}>{busy && <Spinner />} Request Session</button>
                  <p className="text-xs text-slate-500">Only this mentor&apos;s published slots are offered. The mentor must accept before the session is confirmed.</p>
                </>
              )}
            </form>
          </PersonaGate>
        </div>
      </div>
    </div>
  );
}
