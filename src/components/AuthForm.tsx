"use client";
import Link from "next/link";
import { useState } from "react";
import { ErrorAlert, Spinner, api, toErr, type ApiErr } from "./ui";
import { PORTAL_INFO, type PortalKey } from "@/lib/portals";
import Logo from "./Logo";


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

  const portals = (Object.keys(PORTAL_INFO) as PortalKey[]).filter((p) => mode === "login" || PORTAL_INFO[p].canRegister);
  return (
    // Break out of the app layout padding: full-page landing-style canvas.
    <div className="-m-5 flex min-h-screen flex-col md:-mx-10 md:-my-7">
      <header className="border-b border-[#e3e5e9] bg-white">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5">
          <Link href="/welcome"><Logo size={32} /></Link>
          <Link href="/welcome" className="font-display text-[15px] font-semibold text-[#2c303b] hover:text-[#D9541E]">&larr; Home</Link>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center px-5 py-14 sm:py-20">
        <div className="w-full max-w-[460px]">
          <p className="eyebrow">{info.name} portal</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-[#16181d] sm:text-[44px]">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[#3d4250]">{info.blurb}</p>

          {/* Portal switcher */}
          <div className="mt-7 flex flex-wrap gap-2">
            {portals.map((p) => (
              <Link key={p} href={`/${p}/${mode}`}
                className={`rounded-full px-4 py-1.5 font-display text-sm font-semibold transition-colors ${p === portal ? "bg-[#2c303b] text-white" : "bg-[#e4e6ea] text-[#2c303b] hover:bg-[#d9dce1]"}`}>
                {PORTAL_INFO[p].name}
              </Link>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-[#e3e5e9] bg-white p-7 shadow-sm sm:p-8">
            {mode === "register" && (
              <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input py-3" value={f.name} onChange={set("name")} required autoComplete="name" /></div>
            )}
            {mode === "register" && portal !== "student" && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label" htmlFor="org">Organization</label><input id="org" className="input py-3" value={f.organization} onChange={set("organization")} required={portal === "recruiter"} /></div>
                <div><label className="label" htmlFor="des">Designation</label><input id="des" className="input py-3" value={f.designation} onChange={set("designation")} required={portal === "recruiter"} /></div>
              </div>
            )}
            <div><label className="label" htmlFor="email">Email</label><input id="email" className="input py-3" type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></div>
            <div><label className="label" htmlFor="pw">Password</label>
              <input id="pw" className="input py-3" type="password" value={f.password} onChange={set("password")} required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              {mode === "register" && <p className="mt-1.5 text-xs text-[#5f6573]">At least 8 characters.</p>}
            </div>
            <ErrorAlert err={err} />
            <button className="btn-primary w-full py-3.5 text-base" disabled={busy}>{busy && <Spinner />} {mode === "login" ? "Sign In" : "Create Account"}</button>
            {mode === "register" && portal === "recruiter" && <p className="text-xs text-[#7a4508]">Recruiter accounts can sign in immediately but see student data only after admin approval.</p>}
          </form>

          <p className="mt-6 text-center text-[15px] text-[#3d4250]">
            {info.canRegister
              ? mode === "login"
                ? <>New here? <Link href={`/${portal}/register`} className="font-semibold text-[#D9541E] underline decoration-dotted decoration-2 underline-offset-4">Create an account</Link></>
                : <>Already registered? <Link href={`/${portal}/login`} className="font-semibold text-[#D9541E] underline decoration-dotted decoration-2 underline-offset-4">Sign in</Link></>
              : <>Admin accounts are issued by the GURUKOOL team.</>}
          </p>
        </div>
      </div>
    </div>
  );
}
