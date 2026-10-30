"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import {
  JoinSessionButton, ProfileBadge, StatusBadge, fmtTime, switchPersona, usePersona,
  type Booking, type Mentor, type Slot,
} from "@/components/connect";

const DOMAINS = ["Backend Development", "Frontend Development", "Full Stack Development", "AI/ML", "Cloud Computing", "Cybersecurity", "DSA and Interview Preparation"];
const FORMATS = ["1:1 Mentorship", "Weekend Masterclass", "Mock Interview", "Project Review"];
const EMPTY = {
  name: "", headline: "", designation: "", organization: "", yearsOfExperience: 1, bio: "",
  expertise: "", teachingTopics: "", domains: [] as string[], sessionFormats: ["1:1 Mentorship"], sessionDescription: "",
};
type ProfileForm = typeof EMPTY;

function ProfileEditor({ initial, onSave, saveLabel }: { initial: ProfileForm; onSave: (f: ProfileForm) => Promise<void>; saveLabel: string }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  useEffect(() => setF(initial), [initial]);
  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (k: "domains" | "sessionFormats", v: string) =>
    setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null); setMsg(null);
      try { await onSave(f); setMsg("Saved."); } catch (x) { setErr(toErr(x)); } finally { setBusy(false); }
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={set("name")} required /></div>
        <div><label className="label">Headline</label><input className="input" value={f.headline} onChange={set("headline")} required placeholder="Backend Engineer · Node.js & APIs" /></div>
        <div><label className="label">Designation</label><input className="input" value={f.designation} onChange={set("designation")} required /></div>
        <div><label className="label">Organization</label><input className="input" value={f.organization} onChange={set("organization")} required /></div>
        <div><label className="label">Years of experience</label><input className="input" type="number" min={0} max={50} value={f.yearsOfExperience} onChange={set("yearsOfExperience")} required /></div>
      </div>
      <div><label className="label">Professional background</label><textarea className="input" rows={3} value={f.bio} onChange={set("bio")} /></div>
      <div><label className="label">Technical expertise (comma separated)</label><input className="input" value={f.expertise} onChange={set("expertise")} required placeholder="Node.js, MongoDB, REST APIs" /></div>
      <div><label className="label">Teaching topics (comma separated)</label><input className="input" value={f.teachingTopics} onChange={set("teachingTopics")} required placeholder="Backend Development, Interview Preparation" /></div>
      <div><label className="label">Domains</label>
        <div className="flex flex-wrap gap-2">{DOMAINS.map((d) => (
          <button type="button" key={d} onClick={() => toggle("domains", d)} className={`chip border px-3 py-1 ${f.domains.includes(d) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{d}</button>
        ))}</div></div>
      <div><label className="label">Session formats</label>
        <div className="flex flex-wrap gap-2">{FORMATS.map((d) => (
          <button type="button" key={d} onClick={() => toggle("sessionFormats", d)} className={`chip border px-3 py-1 ${f.sessionFormats.includes(d) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{d}</button>
        ))}</div></div>
      <div><label className="label">Session description</label><textarea className="input" rows={2} value={f.sessionDescription} onChange={set("sessionDescription")} /></div>
      <ErrorAlert err={err} />
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={busy}>{busy && <Spinner />} {saveLabel}</button>{msg && <span className="text-sm text-emerald-600">✓ {msg}</span>}</div>
    </form>
  );
}

function AvailabilityEditor({ mentor, onSaved }: { mentor: Mentor; onSaved: (m: Mentor) => void }) {
  const [slots, setSlots] = useState<Slot[]>(mentor.availability);
  const [draft, setDraft] = useState<Slot>({ day: "Saturday", start: "10:00", end: "11:00" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setSlots(mentor.availability), [mentor]);
  const dirty = JSON.stringify(slots) !== JSON.stringify(mentor.availability);

  async function save() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await api<{ mentor: Mentor }>(`/api/mentors/${mentor.id}`, { method: "PATCH", body: JSON.stringify({ availability: slots }) });
      onSaved(r.mentor); setMsg("Availability saved.");
    } catch (e) { setErr(toErr(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      {(["Saturday", "Sunday"] as const).map((day) => (
        <div key={day}>
          <div className="label">{day}</div>
          <div className="flex flex-wrap gap-2">
            {slots.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start)).map((s) => (
              <span key={s.start} className="chip gap-2 bg-emerald-50 py-1 text-emerald-800">
                {fmtTime(s.start)} – {fmtTime(s.end)}
                <button aria-label={`Remove ${day} ${s.start}`} className="text-emerald-700 hover:text-red-600" onClick={() => setSlots(slots.filter((x) => x !== s))}>✕</button>
              </span>
            ))}
            {!slots.some((s) => s.day === day) && <span className="text-sm text-slate-400">No slots</span>}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
        <div><label className="label">Day</label>
          <select className="input" value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })}><option>Saturday</option><option>Sunday</option></select></div>
        <div><label className="label">From</label><input type="time" className="input" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></div>
        <div><label className="label">To</label><input type="time" className="input" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></div>
        <button className="btn-ghost" onClick={() => setSlots([...slots, { ...draft }])}>+ Add slot</button>
      </div>
      <ErrorAlert err={err} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy || !dirty} onClick={save}>{busy && <Spinner />} Save availability</button>
        {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
        {msg && !dirty && <span className="text-sm text-emerald-600">✓ {msg}</span>}
      </div>
      <p className="text-xs text-slate-500">Times are IST (Asia/Kolkata). Slots must be 30 min – 3 h and can&apos;t overlap. Validation happens on save.</p>
    </div>
  );
}

function BookingRow({ b, actions }: { b: Booking; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={b.status} /><span className="font-semibold">{b.topic}</span></div>
        <p className="mt-1 text-sm text-slate-600">{b.studentName}{b.studentEmail && <> · <a className="text-blue-700" href={`mailto:${b.studentEmail}`}>{b.studentEmail}</a></>}</p>
        <p className="text-sm text-slate-600">{b.when} · {b.durationMinutes} min</p>
        <p className="mt-1 text-sm text-slate-500">“{b.message}”</p>
        {b.statusNote && <p className="mt-1 text-xs text-slate-500">Note: {b.statusNote}</p>}
      </div>
      {actions && <div className="flex flex-col items-end gap-2">{actions}</div>}
    </div>
  );
}

const toForm = (m: Mentor): ProfileForm => ({
  name: m.name, headline: m.headline, designation: m.designation, organization: m.organization, yearsOfExperience: m.yearsOfExperience,
  bio: m.bio, expertise: m.expertise.join(", "), teachingTopics: m.teachingTopics.join(", "), domains: m.domains,
  sessionFormats: m.sessionFormats, sessionDescription: m.sessionDescription,
});

export default function MentorDashboard() {
  const { info } = usePersona();
  const isMentor = info?.persona.role === "mentor";
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!info || info.persona.role !== "mentor") return;
    try {
      const [m, s] = await Promise.all([
        api<{ mentor: Mentor }>(`/api/mentors/${info.persona.id}`),
        api<{ sessions: Booking[] }>("/api/mentor-sessions"),
      ]);
      setMentor(m.mentor); setBookings(s.sessions); setErr(null);
    } catch (e) { setErr(toErr(e)); }
  }, [info]);
  useEffect(() => { load(); }, [load]);

  async function act(id: string, status: string) {
    let note = "";
    if (status === "REJECTED") note = prompt("Optional note to the student (reason for declining):") ?? "";
    setBusy(id); setErr(null); setNotice(null);
    try {
      const r = await api<{ autoRejected?: number }>(`/api/mentor-sessions/${id}`, { method: "PATCH", body: JSON.stringify({ status, note }) });
      if (status === "ACCEPTED") setNotice(`Session accepted. It now shows as ACCEPTED for the student.${r.autoRejected ? ` ${r.autoRejected} other pending request(s) for the same slot were closed.` : ""}`);
      await load();
    } catch (e) { setErr(toErr(e)); } finally { setBusy(null); }
  }

  if (!info) return <div className="text-sm text-slate-500"><Spinner /> Loading…</div>;

  if (!isMentor) {
    const mentorOpts = info.options.filter((o) => o.role === "mentor");
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title="Mentor Dashboard" subtitle="Manage your professional profile, weekend availability and session requests." />
        <div className="card space-y-3">
          <h2 className="h2">Continue as a mentor</h2>
          <p className="text-sm text-slate-600">You&apos;re currently viewing as <b>{info.current.label}</b>. Pick a mentor persona (demo simulation, not real login):</p>
          <div className="flex flex-wrap gap-2">
            {info.demoEnabled ? mentorOpts.map((o) => <button key={o.id} className="btn-ghost" onClick={() => switchPersona(o.role, o.id)}>{o.label}</button>)
              : <span className="text-sm text-slate-500">Persona switching is disabled.</span>}
          </div>
        </div>
        <div className="card space-y-3">
          <h2 className="h2">Create a professional profile</h2>
          <p className="text-sm text-slate-500">New profiles are marked <b>Not verified</b>. You&apos;ll be switched to this mentor after creating it.</p>
          <ProfileEditor initial={EMPTY} saveLabel="Create profile" onSave={async (f) => {
            await api("/api/mentors", { method: "POST", body: JSON.stringify(f) });
            window.location.reload();
          }} />
        </div>
      </div>
    );
  }

  const now = Date.now();
  const pending = bookings?.filter((b) => b.status === "PENDING") ?? [];
  const upcoming = bookings?.filter((b) => b.status === "ACCEPTED") ?? [];
  const history = bookings?.filter((b) => ["COMPLETED", "REJECTED", "CANCELLED"].includes(b.status)) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Mentor Dashboard" subtitle={mentor ? `${mentor.name} · ${mentor.designation}` : "Loading…"}
        right={mentor && <div className="flex items-center gap-2"><ProfileBadge isDemo={mentor.isDemo} /><Link href={`/connect/mentors/${mentor.id}`} className="btn-ghost">View public profile</Link></div>} />
      <ErrorAlert err={err} />
      {notice && <Alert kind="success">{notice}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        {[["Pending requests", pending.length, "text-amber-700"], ["Upcoming sessions", upcoming.length, "text-emerald-700"], ["Completed", history.filter((b) => b.status === "COMPLETED").length, "text-blue-700"]].map(([l, n, c]) => (
          <div key={l as string} className="card"><div className="label">{l}</div><div className={`text-3xl font-bold ${c}`}>{bookings ? n : "–"}</div></div>
        ))}
      </div>

      <section className="card space-y-3">
        <h2 className="h2">Pending Requests</h2>
        {!bookings ? <Spinner /> : pending.length === 0 ? <p className="text-sm text-slate-500">No pending requests.</p> : pending.map((b) => (
          <BookingRow key={b.id} b={b} actions={<>
            <button className="btn-primary px-3 py-1.5" disabled={busy === b.id} onClick={() => act(b.id, "ACCEPTED")}>Accept</button>
            <button className="btn-ghost px-3 py-1.5 text-red-600" disabled={busy === b.id} onClick={() => act(b.id, "REJECTED")}>Reject</button>
          </>} />
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Upcoming Sessions</h2>
        {!bookings ? <Spinner /> : upcoming.length === 0 ? <p className="text-sm text-slate-500">No accepted sessions yet.</p> : upcoming.map((b) => {
          const started = new Date(b.startAt).getTime() <= now;
          return (
            <BookingRow key={b.id} b={b} actions={<>
              <JoinSessionButton />
              {started
                ? <button className="btn-ghost px-3 py-1.5" disabled={busy === b.id} onClick={() => act(b.id, "COMPLETED")}>Mark completed</button>
                : <span className="text-xs text-slate-400">Can be marked completed after it starts</span>}
              <button className="text-xs text-red-600 hover:underline" disabled={busy === b.id} onClick={() => confirm("Cancel this accepted session?") && act(b.id, "CANCELLED")}>Cancel session</button>
            </>} />
          );
        })}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Completed Sessions &amp; History</h2>
        {!bookings ? <Spinner /> : history.length === 0 ? <p className="text-sm text-slate-500">Nothing here yet.</p> : history.map((b) => <BookingRow key={b.id} b={b} />)}
      </section>

      {mentor && (
        <>
          <section className="card space-y-3"><h2 className="h2">Availability Management</h2><AvailabilityEditor mentor={mentor} onSaved={setMentor} /></section>
          <section className="card space-y-3">
            <h2 className="h2">Professional Profile</h2>
            <ProfileEditor initial={toForm(mentor)} saveLabel="Save profile" onSave={async (f) => {
              const r = await api<{ mentor: Mentor }>(`/api/mentors/${mentor.id}`, { method: "PATCH", body: JSON.stringify(f) });
              setMentor(r.mentor);
            }} />
          </section>
        </>
      )}
    </div>
  );
}
