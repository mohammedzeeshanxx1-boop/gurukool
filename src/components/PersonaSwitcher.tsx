"use client";
import Link from "next/link";
import { api } from "./ui";
import { usePersona } from "./connect";

const ROLE_LABEL: Record<string, string> = { student: "Student", mentor: "Expert / Mentor", recruiter: "Recruiter", admin: "Admin" };

// Signed-in account box (replaces the old demo persona switcher).
export default function PersonaSwitcher() {
  const { info } = usePersona();
  if (!info) return null;
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Signed in</div>
      <div className="mt-1 truncate text-sm font-medium text-slate-800">{info.current.label}</div>
      <div className="text-xs text-slate-500">{ROLE_LABEL[info.persona.role] ?? info.persona.role}</div>
      <Link href="/account" className="btn-ghost mt-3 w-full py-1.5 text-xs">Account settings</Link>
      <button
        className="btn-ghost mt-2 w-full py-1.5 text-xs"
        onClick={async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); window.location.href = "/welcome"; }}
      >Sign out</button>
    </div>
  );
}
