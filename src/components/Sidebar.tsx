"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import PersonaSwitcher from "./PersonaSwitcher";
import { usePersona } from "./connect";

type R = "student" | "mentor" | "recruiter" | "admin";
const NAV: { href: string; label: string; icon: string; sub?: boolean; roles: R[] }[] = [
  { href: "/", label: "Dashboard", icon: "▦", roles: ["student"] },
  { href: "/learn", label: "Learn", icon: "✦", roles: ["student"] },
  { href: "/train", label: "Train", icon: "▤", roles: ["student", "mentor"] },
  { href: "/build", label: "Build", icon: "⌘", roles: ["student"] },
  { href: "/connect", label: "Connect", icon: "◎", roles: ["student", "mentor"] },
  { href: "/connect/mentor", label: "Mentor Dashboard", icon: "·", sub: true, roles: ["mentor"] },
  { href: "/compete", label: "Compete", icon: "⚑", roles: ["student"] },
  { href: "/grow", label: "Grow", icon: "↗", roles: ["student"] },
  { href: "/grow/recruiter", label: "Recruiter Dashboard", icon: "·", sub: true, roles: ["recruiter"] },
  { href: "/admin", label: "Admin", icon: "⚙", roles: ["admin"] },
];
const PUBLIC = /^\/(welcome|(student|recruiter|expert|admin)\/(login|register))\/?$/;
const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || (path.startsWith(href + "/") && !NAV.some((n) => n.href !== href && n.href.startsWith(href) && path.startsWith(n.href)));

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { role } = usePersona();
  if (PUBLIC.test(path)) return null; // sign-in pages render without the app sidebar
  const links = (
    <nav className="flex flex-col gap-1">
      {NAV.filter((n) => role && n.roles.includes(role as R)).map((n) => {
        const active = isActive(path, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 ${n.sub ? "ml-4 py-1.5 text-xs" : "py-2 text-sm"} font-medium ${
              active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="w-4 text-center">{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
  const brand = (
    <div className="mb-6 px-3">
      <div className="text-xl font-extrabold tracking-tight text-blue-700">GURUKOOL</div>
      <div className="text-[11px] text-slate-500">Learn. Build. Connect. Compete. Grow.</div>
    </div>
  );
  return (
    <>
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-extrabold text-blue-700">GURUKOOL</span>
        <button className="btn-ghost px-3 py-1" onClick={() => setOpen(!open)} aria-label="Toggle menu">☰</button>
      </header>
      {open && <div className="no-print border-b border-slate-200 bg-white p-3 md:hidden">{links}<PersonaSwitcher /></div>}
      <aside className="no-print sticky top-0 hidden h-screen w-60 overflow-y-auto shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        {brand}
        {links}
        <PersonaSwitcher />
      </aside>
    </>
  );
}
