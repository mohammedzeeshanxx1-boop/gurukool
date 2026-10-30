"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "./ui";

export type Slot = { day: string; start: string; end: string };
export type Mentor = {
  id: string; name: string; headline: string; designation: string; organization: string; yearsOfExperience: number;
  bio: string; expertise: string[]; teachingTopics: string[]; domains: string[]; sessionFormats: string[];
  sessionDescription: string; availability: Slot[]; profileStatus: string; isDemo: boolean; verified: boolean;
};
export type UpcomingSlot = { startAt: string; endAt: string; day: string; date: string; label: string; slotMinutes: number };
export type Booking = {
  id: string; mentorId: string; mentorName: string; studentName: string; studentEmail?: string; topic: string;
  startAt: string; endAt: string; when: string; durationMinutes: number; message: string; status: string; statusNote: string;
};
export type PersonaOption = { role: "student" | "mentor" | "recruiter"; id: string; label: string; sub: string };
export type PersonaInfo = { persona: { role: string; id: string }; current: PersonaOption; options: PersonaOption[]; demoEnabled: boolean };

export const CONNECT_URL = process.env.NEXT_PUBLIC_CONNECT_URL ?? "";

export function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export const slotText = (s: Slot) => `${s.day.slice(0, 3)} ${fmtTime(s.start)}–${fmtTime(s.end)}`;

export function usePersona() {
  const [info, setInfo] = useState<PersonaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    api<PersonaInfo>("/api/persona").then((d) => { setInfo(d); setError(null); }).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener("gk-account-updated", reload);
    return () => window.removeEventListener("gk-account-updated", reload);
  }, [reload]);
  return { info, role: info?.persona.role, id: info?.persona.id, error, reload };
}

export async function switchPersona(role: string, id: string) {
  await api("/api/persona", { method: "POST", body: JSON.stringify({ role, id }) });
  window.location.reload();
}

export function ProfileBadge({ isDemo }: { isDemo: boolean }) {
  return isDemo
    ? <span className="chip bg-amber-100 text-amber-800" title="Fictional profile created for demonstration">Demo · fictional</span>
    : <span className="chip bg-slate-100 text-slate-600" title="Self-created profile; identity not verified">Not verified</span>;
}

const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800", ACCEPTED: "bg-emerald-100 text-emerald-700", REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-600", COMPLETED: "bg-blue-100 text-blue-700", DECLINED: "bg-red-100 text-red-700", WITHDRAWN: "bg-slate-100 text-slate-600",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`chip font-semibold ${STATUS_CLS[status] ?? "bg-slate-100"}`}>{status}</span>;
}

/** Opens the existing GURUKOOL collaboration platform. No per-session room is created or claimed. */
export function JoinSessionButton({ startAt, endAt }: { startAt?: string; endAt?: string } = {}) {
  if (startAt && endAt) {
    const now = Date.now(), open = new Date(startAt).getTime() - 15 * 60000, close = new Date(endAt).getTime();
    if (now < open) return <p className="text-xs text-slate-500">Join opens 15 minutes before the session.</p>;
    if (now > close) return <p className="text-xs text-slate-500">This session has ended.</p>;
  }
  if (!CONNECT_URL)
    return <p className="text-sm text-amber-700">Video collaboration is not configured. Please contact the administrator.</p>;
  return (
    <div>
      <a href={CONNECT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary px-3 py-1.5">Join Mentorship Session ↗</a>
      <p className="mt-1 text-xs text-slate-500">Opens the GURUKOOL collaboration space (shared link, not a private room).</p>
    </div>
  );
}

export function MentorCard({ m, reason, extra }: { m: Mentor; reason?: string[]; extra?: React.ReactNode }) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{m.name}</h3>
          <p className="text-sm text-slate-600">{m.headline}</p>
        </div>
        <ProfileBadge isDemo={m.isDemo} />
      </div>
      <p className="mt-2 text-sm text-slate-500">{m.designation} · {m.organization} · {m.yearsOfExperience} yrs experience</p>
      {m.bio && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{m.bio}</p>}
      {reason && reason.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {reason.map((r) => <p key={r}>{r}</p>)}
          {extra}
        </div>
      )}
      <div className="mt-3"><div className="label">Expertise</div>
        <div className="flex flex-wrap gap-1.5">{m.expertise.map((e) => <span key={e} className="chip bg-slate-100 text-slate-700">{e}</span>)}</div>
      </div>
      <div className="mt-3"><div className="label">Teaches</div><p className="text-sm text-slate-600">{m.teachingTopics.join(" · ")}</p></div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><div className="label">Availability (IST)</div>
          {m.availability.length ? m.availability.map((s, i) => <div key={i} className="text-slate-600">{slotText(s)}</div>) : <span className="text-slate-400">No slots yet</span>}
        </div>
        <div><div className="label">Format</div>{m.sessionFormats.map((f) => <div key={f} className="text-slate-600">{f}</div>)}</div>
      </div>
      <div className="mt-4 flex gap-2 pt-1">
        <Link href={`/connect/mentors/${m.id}`} className="btn-ghost flex-1">View Profile</Link>
        <Link href={`/connect/mentors/${m.id}#book`} className="btn-primary flex-1" aria-disabled={!m.availability.length}>Request Session</Link>
      </div>
    </div>
  );
}

export function PersonaGate({ need, info, children }: { need: "student" | "mentor" | "recruiter"; info: PersonaInfo | null; children: React.ReactNode }) {
  if (!info) return null;
  if (info.persona.role === need) return <>{children}</>;
  const opts = info.options.filter((o) => o.role === need);
  return (
    <div className="card space-y-3">
      <p className="text-sm text-slate-600">You&apos;re viewing as <b>{info.current.label}</b> ({info.current.role}). This section is for {need}s.</p>
      {info.demoEnabled && opts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {opts.slice(0, 6).map((o) => (
            <button key={o.id} className="btn-ghost" onClick={() => switchPersona(o.role, o.id)}>Switch to {o.label}</button>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">Demo simulation: persona switching is not real authentication.</p>
    </div>
  );
}
