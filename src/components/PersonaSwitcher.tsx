"use client";
import Link from "next/link";
import { api } from "./ui";
import { usePersona } from "./connect";
import Notifications from "./Notifications";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  mentor: "Expert / Mentor",
  recruiter: "Recruiter",
  admin: "Admin",
};

export default function PersonaSwitcher({ dark: _dark }: { dark?: boolean }) {
  const { info } = usePersona();
  if (!info) return null;

  const initials = info.current.label
    ?.split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="space-y-1">
      {/* Avatar + name */}
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{background:"#D9541E"}}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold" style={{color:"#f0ebe4"}}>{info.current.label}</div>
          <div className="text-[11px]" style={{color:"#9a9490"}}>{ROLE_LABEL[info.persona.role] ?? info.persona.role}</div>
        </div>
      </div>

      <Notifications />

      {/* Account link */}
      <Link
        href="/account"
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors" style={{color:"#9a9490"}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.07)";(e.currentTarget as HTMLElement).style.color="#fff";}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";(e.currentTarget as HTMLElement).style.color="#9a9490";}}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
        Account settings
      </Link>

      {/* Sign out */}
      <button
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors" style={{color:"#9a9490"}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.1)";(e.currentTarget as HTMLElement).style.color="#f87171";}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";(e.currentTarget as HTMLElement).style.color="#9a9490";}}
        onClick={async () => {
          await api("/api/auth/logout", { method: "POST" }).catch(() => {});
          window.location.href = "/welcome";
        }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z" clipRule="evenodd" />
        </svg>
        Sign out
      </button>
    </div>
  );
}
