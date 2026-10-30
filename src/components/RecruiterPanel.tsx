"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, ErrorAlert, Spinner, api, toErr, type ApiErr } from "./ui";
import { StatusBadge, usePersona } from "./connect";

type Visibility = { recruiterDiscoverable: boolean; portfolioLinks: { github: string; linkedin: string; portfolio: string }; projects: string[] };
type Interest = {
  id: string; recruiterName: string; organization: string; designation: string; recruiterIsDemo: boolean;
  type: string; opportunityTitle: string; message: string; status: string; createdAt: string;
};

/** Student-side Recruiter Connect: opt-in visibility (private by default) + incoming requests. */
export default function RecruiterPanel({ resume }: { resume: { github: string; linkedin: string; projects: string } }) {
  const { info } = usePersona();
  const [v, setV] = useState<Visibility | null>(null);
  const [form, setForm] = useState({ github: "", linkedin: "", portfolio: "", projects: "" });
  const [interests, setInterests] = useState<Interest[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [vis, ints] = await Promise.all([
        api<Visibility>("/api/student/visibility"),
        api<{ interests: Interest[] }>("/api/recruiter-interests"),
      ]);
      setV(vis);
      setForm({ ...vis.portfolioLinks, projects: vis.projects.join("\n") });
      setInterests(ints.interests);
      setErr(null);
    } catch (e) { setErr(toErr(e)); }
  }, []);
  useEffect(() => { if (info?.persona.role === "student") load(); }, [info, load]);

  if (!info || info.persona.role !== "student") return null;

  async function save(patch: Record<string, unknown>, okMsg: string) {
    setBusy(true); setErr(null); setMsg(null);
    try { setV(await api<Visibility>("/api/student/visibility", { method: "PATCH", body: JSON.stringify(patch) })); setMsg(okMsg); }
    catch (e) { setErr(toErr(e)); } finally { setBusy(false); }
  }
  async function respond(id: string, status: "ACCEPTED" | "DECLINED") {
    try { await api(`/api/recruiter-interests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); load(); }
    catch (e) { setErr(toErr(e)); }
  }

  return (
    <div className="no-print mt-6 grid gap-6 lg:grid-cols-2">
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="h2">Recruiter Connect</h2><p className="text-sm text-slate-500">Let recruiters discover your portfolio. Private by default.</p></div>
          {v && <span className={`chip ${v.recruiterDiscoverable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{v.recruiterDiscoverable ? "Discoverable" : "Private"}</span>}
        </div>
        {!v ? (err ? <ErrorAlert err={err} /> : <Spinner />) : (
          <>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-600" checked={v.recruiterDiscoverable} disabled={busy}
                onChange={(e) => save({ recruiterDiscoverable: e.target.checked }, e.target.checked ? "You're now visible to recruiters." : "Your profile is private again.")} />
              <span className="text-sm">
                <b>Allow recruiters to discover my profile</b><br />
                <span className="text-slate-500">Recruiters will see your name, college, branch, semester, career goal, skills, projects and the links below. Never your email, assessment scores or other personal details.</span>
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["github", "linkedin", "portfolio"] as const).map((k) => (
                <div key={k} className={k === "portfolio" ? "sm:col-span-2" : ""}>
                  <label className="label">{k}</label>
                  <input className="input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={k === "portfolio" ? "https://your-site.dev" : `${k}.com/username`} />
                </div>
              ))}
            </div>
            <div><label className="label">Projects (one per line)</label><textarea className="input" rows={3} value={form.projects} onChange={(e) => setForm({ ...form, projects: e.target.value })} /></div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => save({ portfolioLinks: { github: form.github, linkedin: form.linkedin, portfolio: form.portfolio }, projects: form.projects }, "Portfolio details saved.")}>
                {busy && <Spinner />} Save portfolio details
              </button>
              <button className="btn-ghost" onClick={() => setForm({ ...form, github: resume.github || form.github, linkedin: resume.linkedin || form.linkedin, projects: resume.projects || form.projects })}>Copy from resume</button>
            </div>
            {msg && <p className="text-sm text-emerald-600">✓ {msg}</p>}
            <ErrorAlert err={err} />
          </>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="h2">Recruiter requests</h2>
        <p className="text-xs text-slate-500">Interest from a recruiter is not a job or internship offer.</p>
        {!interests ? <Spinner /> : interests.length === 0 ? (
          <Alert kind="info">No requests yet.{v && !v.recruiterDiscoverable && " Turn on recruiter discovery so recruiters can find you."}</Alert>
        ) : interests.map((i) => (
          <div key={i.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><StatusBadge status={i.status} /><span className="chip bg-slate-100 text-slate-600">{i.type === "INVITE" ? "Invitation to apply" : "Interest"}</span></div>
              {i.recruiterIsDemo && <span className="chip bg-amber-100 text-amber-800">Demo recruiter · fictional</span>}
            </div>
            <p className="mt-2 text-sm"><b>{i.recruiterName}</b> · {i.designation}, {i.organization}</p>
            {i.opportunityTitle && <p className="text-sm text-slate-600">Opportunity: {i.opportunityTitle}</p>}
            <p className="mt-1 text-sm text-slate-500">“{i.message}”</p>
            {i.status === "PENDING" && (
              <div className="mt-3 flex gap-2">
                <button className="btn-primary px-3 py-1.5" onClick={() => respond(i.id, "ACCEPTED")}>Accept connection</button>
                <button className="btn-ghost px-3 py-1.5" onClick={() => respond(i.id, "DECLINED")}>Decline</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
