"use client";
import Link from "next/link";
import { useState } from "react";
import { ErrorAlert, Spinner, api, toErr, type ApiErr } from "./ui";
import { PORTAL_INFO, type PortalKey } from "@/lib/portals";


export default function AuthForm({ portal, mode, next }: { portal: PortalKey; mode: "login" | "register"; next?: string }) {
  const info = PORTAL_INFO[portal];
  const [f, setF] = useState({ name: "", email: "", password: "", organization: "", designation: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiErr | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api<{ redirect: string }>(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ portal, ...f }) });
      // Only follow same-site relative paths from ?next=
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : r.redirect;
      window.location.href = target;
    } catch (x) {
      setErr(toErr(x));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center">
      <div className="w-full max-w-md">
        <Link href="/welcome" className="mb-6 block text-center">
          <div className="text-3xl font-extrabold tracking-tight text-blue-700">GURUKOOL</div>
          <div className="text-xs text-slate-500">Learn. Build. Connect. Compete. Grow.</div>
        </Link>
        <form onSubmit={submit} className="card space-y-4 p-7">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{info.name} {mode === "login" ? "Sign In" : "Registration"}</h1>
            <p className="mt-1 text-sm text-slate-500">{info.blurb}</p>
          </div>
          {mode === "register" && (
            <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input" value={f.name} onChange={set("name")} required autoComplete="name" /></div>
          )}
          {mode === "register" && portal !== "student" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="org">Organization</label><input id="org" className="input" value={f.organization} onChange={set("organization")} required={portal === "recruiter"} /></div>
              <div><label className="label" htmlFor="des">Designation</label><input id="des" className="input" value={f.designation} onChange={set("designation")} required={portal === "recruiter"} /></div>
            </div>
          )}
          <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></div>
          <div><label className="label" htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" value={f.password} onChange={set("password")} required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {mode === "register" && <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>}
          </div>
          <ErrorAlert err={err} />
          <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner />} {mode === "login" ? "Sign In" : "Create account"}</button>
          {mode === "register" && portal === "recruiter" && <p className="text-xs text-amber-700">Recruiter accounts can sign in immediately but see student data only after admin approval.</p>}
          <div className="flex justify-between text-sm">
            {info.canRegister
              ? mode === "login"
                ? <Link href={`/${portal}/register`} className="text-blue-700 hover:underline">Create a {info.name.toLowerCase()} account</Link>
                : <Link href={`/${portal}/login`} className="text-blue-700 hover:underline">Already registered? Sign in</Link>
              : <span />}
            <Link href="/welcome" className="text-slate-500 hover:underline">All portals</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
