"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { PersonaGate, StatusBadge, usePersona } from "@/components/connect";
import { CAREER_GOALS } from "@/lib/careers";
import ApprovalBanner from "@/components/ApprovalBanner";

type Student = {
  id: string; name: string; college: string; branch: string; semester: number; careerGoal: string; skills: string[];
  projects: string[]; links: { github: string; linkedin: string; portfolio: string }; isDemo: boolean; myRequestStatus: string | null; shortlisted: boolean;
};
type Sent = { id: string; studentName: string; type: string; opportunityTitle: string; message: string; status: string };

function InterestForm({ s, onDone }: { s: Student; onDone: () => void }) {
  const [type, setType] = useState<"INTEREST" | "INVITE">("INTEREST");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState(`Hi ${s.name.split(" ")[0]}, your ${s.careerGoal} portfolio caught our attention. Would you be open to a conversation?`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiErr | null>(null);
  return (
    <form className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try {
        await api("/api/recruiter-interests", { method: "POST", body: JSON.stringify({ studentId: s.id, type, opportunityTitle: title, message }) });
        onDone();
      } catch (x) { setErr(toErr(x)); } finally { setBusy(false); }
    }}>
      <div className="flex gap-2 text-sm">
        <label className="flex items-center gap-1"><input type="radio" checked={type === "INTEREST"} onChange={() => setType("INTEREST")} /> Express interest</label>
        <label className="flex items-center gap-1"><input type="radio" checked={type === "INVITE"} onChange={() => setType("INVITE")} /> Invite to apply</label>
      </div>
      {type === "INVITE" && <input className="input" placeholder="Opportunity title (e.g. Backend Intern, demo role)" value={title} onChange={(e) => setTitle(e.target.value)} required />}
      <textarea className="input" rows={3} minLength={10} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} required />
      <ErrorAlert err={err} />
      <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Send</button>
    </form>
  );
}

export default function RecruiterDashboard() {
  const { info } = usePersona();
  const [skill, setSkill] = useState("");
  const [goal, setGoal] = useState("");
  const [students, setStudents] = useState<Student[] | null>(null);
  const [sent, setSent] = useState<Sent[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [onlyShort, setOnlyShort] = useState(false);
  async function toggleShort(s: Student) {
    try { await api("/api/recruiters/shortlist", { method: "POST", body: JSON.stringify({ studentId: s.id, shortlisted: !s.shortlisted }) }); load(); }
    catch (e) { setErr(toErr(e)); }
  }

  const load = useCallback(async () => {
    const qs = new URLSearchParams(Object.entries({ skill, goal }).filter(([, v]) => v));
    try {
      const [s, i] = await Promise.all([
        api<{ students: Student[] }>(`/api/recruiters/students?${qs}`),
        api<{ interests: Sent[] }>("/api/recruiter-interests"),
      ]);
      setStudents(s.students); setSent(i.interests); setErr(null);
    } catch (e) { setErr(toErr(e)); }
  }, [skill, goal]);
  useEffect(() => {
    if (info?.persona.role !== "recruiter") return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [info, load]);

  async function withdraw(id: string) {
    try { await api(`/api/recruiter-interests/${id}`, { method: "PATCH", body: JSON.stringify({ status: "WITHDRAWN" }) }); load(); }
    catch (e) { setErr(toErr(e)); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Recruiter Dashboard" subtitle="Discover students who have opted in to recruiter visibility." />
      <ApprovalBanner />
      <p className="text-xs text-slate-500">Only students who opted in to recruiter discovery are shown. Expressing interest is not a job offer.</p>
      <PersonaGate need="recruiter" info={info}>
        <div className="card grid gap-3 sm:grid-cols-3">
          <input className="input sm:col-span-2" placeholder="Search by skill (e.g. React, Python, Node.js)…" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Search by skill" />
          <select className="input" value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Career goal">
            <option value="">All career goals</option>{CAREER_GOALS.map((g) => <option key={g}>{g}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={onlyShort} onChange={(e) => setOnlyShort(e.target.checked)} /> Shortlisted only</label>
        </div>
        <ErrorAlert err={err} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {!students ? <div className="text-sm text-slate-500"><Spinner /> Loading students…</div>
              : students.length === 0 ? <Alert kind="info">No opted-in students match. Students appear here only after turning on recruiter discovery in GROW.</Alert>
              : students.filter((s) => !onlyShort || s.shortlisted).map((s) => (
                <div key={s.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{s.name}</h3>
                      <p className="text-sm text-slate-500">{s.branch} · Semester {s.semester} · {s.college}</p>
                      <p className="text-sm text-slate-600">Goal: <b>{s.careerGoal}</b></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className={`chip border px-2.5 py-1 ${s.shortlisted ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600"}`} onClick={() => toggleShort(s)}>{s.shortlisted ? "★ Shortlisted" : "☆ Shortlist"}</button>
                      {s.isDemo && <span className="chip bg-amber-100 text-amber-800">Demo student</span>}
                      {s.myRequestStatus && <StatusBadge status={s.myRequestStatus} />}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{s.skills.map((k) => <span key={k} className="chip bg-slate-100 text-slate-700">{k}</span>)}</div>
                  {s.projects.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{s.projects.map((p) => <li key={p}>{p}</li>)}</ul>}
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {(["github", "linkedin", "portfolio"] as const).map((k) => s.links[k] && (
                      <a key={k} href={s.links[k]} target="_blank" rel="noopener noreferrer nofollow" className="capitalize text-blue-700 hover:underline">{k} ↗</a>
                    ))}
                    {!s.links.github && !s.links.linkedin && !s.links.portfolio && <span className="text-slate-400">No links shared</span>}
                  </div>
                  {s.myRequestStatus === "PENDING" ? <p className="mt-3 text-sm text-slate-500">Request sent, waiting for the student.</p>
                    : open === s.id ? <InterestForm s={s} onDone={() => { setOpen(null); load(); }} />
                    : <button className="btn-primary mt-3" onClick={() => setOpen(s.id)}>Express Interest</button>}
                </div>
              ))}
          </div>
          <div className="card h-fit space-y-3">
            <h2 className="h2">Sent requests</h2>
            {!sent ? <Spinner /> : sent.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : sent.map((i) => (
              <div key={i.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2"><b>{i.studentName}</b><StatusBadge status={i.status} /></div>
                <p className="text-slate-500">{i.type === "INVITE" ? `Invite: ${i.opportunityTitle}` : "Interest"}</p>
                {i.status === "PENDING" && <button className="mt-1 text-xs text-red-600 hover:underline" onClick={() => withdraw(i.id)}>Withdraw</button>}
              </div>
            ))}
          </div>
        </div>
      </PersonaGate>
    </div>
  );
}
