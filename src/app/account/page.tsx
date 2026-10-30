"use client";
import { useEffect, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";

type Me = { name: string; email: string; role: string; approved: boolean; active: boolean; createdAt: string };
const ROLE: Record<string, string> = { student: "Student", mentor: "Expert / Mentor", recruiter: "Recruiter", admin: "Admin" };

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [err, setErr] = useState<ApiErr | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api<{ user: Me }>("/api/auth/me").then((d) => { setMe(d.user); setName(d.user.name); }).catch((e) => setErr(toErr(e)));
  useEffect(() => { load(); }, []);

  async function save(body: object, ok: string) {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      setMsg(ok); setPw({ currentPassword: "", newPassword: "" }); await load();
      window.dispatchEvent(new Event("gk-account-updated"));
    } catch (e) { setErr(toErr(e)); } finally { setBusy(false); }
  }

  if (!me) return err ? <ErrorAlert err={err} /> : <div className="text-sm text-slate-500"><Spinner /> Loading…</div>;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Account Settings" subtitle="Your sign-in details, stored in GURUKOOL's database." />
      {msg && <Alert kind="success">{msg}</Alert>}
      <ErrorAlert err={err} />
      <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); save({ name }, "Name updated everywhere on GURUKOOL."); }}>
        <h2 className="h2">Profile</h2>
        <div><label className="label" htmlFor="n">Full name</label><input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></div>
        <div><label className="label">Email</label><input className="input bg-slate-50" value={me.email} readOnly /></div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="chip bg-blue-50 text-blue-700">{ROLE[me.role] ?? me.role}</span>
          <span className={`chip ${me.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{me.active ? "Active" : "Suspended"}</span>
          {me.role === "recruiter" && <span className={`chip ${me.approved ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>{me.approved ? "Approved" : "Pending admin approval"}</span>}
          <span className="text-slate-500">Member since {new Date(me.createdAt).toLocaleDateString("en-IN")}</span>
        </div>
        <button className="btn-primary" disabled={busy || name.trim() === me.name}>{busy && <Spinner />} Save name</button>
      </form>
      <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); save(pw, "Password changed."); }}>
        <h2 className="h2">Change password</h2>
        <div><label className="label" htmlFor="c">Current password</label><input id="c" type="password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required autoComplete="current-password" /></div>
        <div><label className="label" htmlFor="p">New password</label><input id="p" type="password" className="input" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required autoComplete="new-password" /></div>
        <button className="btn-primary" disabled={busy}>Change password</button>
      </form>
    </div>
  );
}
