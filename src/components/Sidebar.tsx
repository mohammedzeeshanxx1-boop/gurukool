"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import PersonaSwitcher from "./PersonaSwitcher";
import { usePersona } from "./connect";

type R = "student" | "mentor" | "recruiter" | "admin";

const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  learn: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  train: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]">
      <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
    </svg>
  ),
  build: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]">
      <path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/>
    </svg>
  ),
  connect: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]">
      <path d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
    </svg>
  ),
  compete: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]">
      <path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/>
    </svg>
  ),
  grow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]">
      <path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]">
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  ),
  sub: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[16px] w-[16px]">
      <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/>
    </svg>
  ),
};

const NAV: { href: string; label: string; iconKey: string; sub?: boolean; roles: R[] }[] = [
  { href: "/",               label: "Dashboard",        iconKey: "dashboard", roles: ["student"] },
  { href: "/learn",          label: "Learn",            iconKey: "learn",     roles: ["student"] },
  { href: "/train",          label: "Upskill",          iconKey: "train",     roles: ["student", "mentor"] },
  { href: "/build",          label: "CodeLab",          iconKey: "build",     roles: ["student"] },
  { href: "/connect",        label: "Connect",          iconKey: "connect",   roles: ["student", "mentor"] },
  { href: "/connect/mentor", label: "Mentor Dashboard", iconKey: "sub",       sub: true, roles: ["mentor"] },
  { href: "/compete",        label: "Compete",          iconKey: "compete",   roles: ["student"] },
  { href: "/grow",           label: "Grow",             iconKey: "grow",      roles: ["student"] },
  { href: "/grow/recruiter", label: "Recruiter",        iconKey: "sub",       sub: true, roles: ["recruiter"] },
  { href: "/admin",          label: "Admin",            iconKey: "admin",     roles: ["admin"] },
];

const PUBLIC = /^\/(welcome|(student|recruiter|expert|admin)\/(login|register))\/?$/;
const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || (path.startsWith(href + "/") && !NAV.some((n) => n.href !== href && n.href.startsWith(href) && path.startsWith(n.href)));

function NavLinks({ role, onClose }: { role: string | undefined; onClose?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV.filter((n) => role && n.roles.includes(role as R)).map((n) => {
        const active = isActive(path, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onClose}
            className={`group flex items-center gap-2.5 rounded-lg transition-colors duration-150
              ${n.sub ? "ml-5 py-1.5 px-2.5 text-xs" : "py-2 px-3 text-[13px] font-medium"}
              ${active
                ? "border-l-2 pl-[10px] font-semibold"
                : "border-l-2 border-transparent pl-[10px]"
              }`}
            style={active ? {background:"rgba(217,84,30,0.15)",color:"#D9541E",borderColor:"#D9541E"} : {color:"#9a9490"}}
            onMouseEnter={e=>{ if(!active){(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.07)";(e.currentTarget as HTMLElement).style.color="#fff";} }}
            onMouseLeave={e=>{ if(!active){(e.currentTarget as HTMLElement).style.background="";(e.currentTarget as HTMLElement).style.color="#9a9490";} }}
          >
            <span className={`flex-shrink-0 transition-opacity duration-150 ${active ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}>
              {ICONS[n.iconKey]}
            </span>
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { role } = usePersona();
  if (PUBLIC.test(path)) return null;

  return (
    <>
      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between px-4 py-2 md:hidden" style={{background:"#111111",borderBottom:"1px solid #2a2a2a"}}>
        <img src="/udaan-logo-dark.png" alt="UDAAN" style={{width:"120px",height:"36px"}} className="object-contain" />
        <button
          className="rounded-lg p-1.5 transition-colors" style={{color:"#a89e94"}} onMouseEnter={e=>(e.currentTarget.style.background="#2a2a2a",e.currentTarget.style.color="#fff")} onMouseLeave={e=>(e.currentTarget.style.background="",e.currentTarget.style.color="#a89e94")}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            {open
              ? <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              : <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm.75-5.25h14.5a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5z" clipRule="evenodd" />
            }
          </svg>
        </button>
      </header>

      {/* Mobile dropdown */}
      {open && (
        <div className="no-print z-20 pb-4 md:hidden" style={{background:"#111111",borderBottom:"1px solid #2a2a2a"}}>
          <div className="py-2">
            <NavLinks role={role} onClose={() => setOpen(false)} />
          </div>
          <div className="mt-2 px-3 pt-4" style={{borderTop:"1px solid #2a2a2a"}}>
            <PersonaSwitcher />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col overflow-y-auto md:flex" style={{background:"#111111",borderRight:"1px solid #2a2a2a"}}>
        <div className="flex items-center justify-center px-5 py-4" style={{borderBottom:"1px solid #2a2a2a"}}>
          <img src="/udaan-logo-dark.png" alt="UDAAN" style={{width:"140px",height:"42px"}} className="object-contain" />
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <NavLinks role={role} />
        </div>

        <div className="p-3" style={{borderTop:"1px solid #2a2a2a"}}>
          <PersonaSwitcher />
        </div>
      </aside>
    </>
  );
}
