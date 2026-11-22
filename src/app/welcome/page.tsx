"use client";
import Link from "next/link";
import { useState } from "react";
import Logo from "@/components/Logo";
import { PORTAL_INFO, type PortalKey } from "@/lib/portals";

/* ─── Palette (light landing, WebAwesome-inspired) ─── */
const C = {
  ink: "#16181d",
  navy: "#2c303b",
  text: "#3d4250",
  muted: "#5f6573",
  orange: "#D9541E",
  orangeDark: "#bf4518",
  grey: "#f0f1f3",
  line: "#e3e5e9",
};
const display = { fontFamily: "'Outfit', 'Inter', ui-sans-serif, system-ui, sans-serif" };

/* ─── Minimal inline icon set (stroke icons, 24×24) ─── */
const ICONS: Record<string, string> = {
  rocket: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  book: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  trophy: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z",
  sprout: "M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z",
  layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  spark: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  check: "M20 6 9 17l-5-5",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  map: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  lock: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  arrow: "M5 12h14M12 5l7 7-7 7",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  chart: "M3 3v18h18M7 14l4-4 4 4 5-5",
  pointer: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z",
  edit: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
  briefcase: "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  mentor: "M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5",
};
function Icon({ name, size = 22, className = "", color }: { name: string; size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ─── Decorative backgrounds ─── */
function OutlinePattern({ stroke = "#e6e7eb" }: { stroke?: string }) {
  // Faint outlines of UI shapes, like the WebAwesome hero.
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 800" aria-hidden="true">
      <g fill="none" stroke={stroke} strokeWidth="3">
        <rect x="-40" y="-60" width="300" height="180" rx="40" />
        <rect x="170" y="120" width="320" height="560" rx="36" />
        <rect x="560" y="300" width="260" height="320" rx="32" />
        <rect x="880" y="40" width="360" height="220" rx="36" />
        <rect x="920" y="520" width="330" height="200" rx="36" />
        <rect x="30" y="520" width="140" height="300" rx="28" />
        <circle cx="60" cy="430" r="50" />
        <circle cx="720" cy="520" r="40" />
        <path d="M940 120l30-50 30 50zM960 640l25-42 25 42z" />
        <path d="M990 150h200M990 190h200M1010 600h180M1010 640h140" />
        <path d="M300 760 480 580M600 160h260M600 220h180" />
        <rect x="590" y="370" width="50" height="50" rx="12" />
        <rect x="590" y="460" width="50" height="50" rx="12" />
      </g>
    </svg>
  );
}
const dotted = {
  backgroundColor: C.grey,
  backgroundImage: "radial-gradient(#c3c6cd 1.2px, transparent 1.2px)",
  backgroundSize: "24px 24px",
};
const EXTRA_ICONS: Record<string, string> = {
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  copy: "M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24",
  close: "M18 6 6 18M6 6l12 12",
  hand: "M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
};
Object.assign(ICONS, EXTRA_ICONS);

/* ─── Content: only real UDAAN features, no invented numbers ─── */
const MODULES = [
  { icon: "book", title: "Learn", href: "/learn", badge: "AI", desc: "Skill-gap analysis against your career goal, a quiz to test what you know, and a personal roadmap." },
  { icon: "layers", title: "Upskill", href: "/train", desc: "Training courses and weekend sessions run by mentors and industry experts." },
  { icon: "code", title: "CodeLab", href: "/build", badge: "AI", desc: "Write and run code in your browser with an AI mentor to explain and review it." },
  { icon: "users", title: "Connect", href: "/connect", desc: "A peer community with channels and mentors, so you never get stuck alone." },
  { icon: "trophy", title: "Compete", href: "/compete", desc: "Hackathons and challenges matched to your interests." },
  { icon: "file", title: "Grow", href: "/grow", desc: "A resume builder that turns your progress into a portfolio recruiters can discover." },
  { icon: "briefcase", title: "Recruiter Portal", href: "/recruiter/login", badge: "Portal", desc: "Approved recruiters discover portfolios that students have chosen to share." },
  { icon: "mentor", title: "Mentor Portal", href: "/expert/login", badge: "Portal", desc: "Experts run sessions, courses and evaluations for students." },
];
const PRINCIPLES: { icon: string; label: string; href?: string }[] = [
  { icon: "target", label: "Goal-Driven Learning Paths" },
  { icon: "spark", label: "AI Help Where It Matters", href: "/build" },
  { icon: "map", label: "One Roadmap Across Modules", href: "/learn" },
  { icon: "chat", label: "Real Mentors, Real Feedback", href: "/connect" },
  { icon: "trophy", label: "Hackathons Matched to You", href: "/compete" },
  { icon: "lock", label: "Students Choose What Recruiters See" },
  { icon: "shield", label: "Recruiters Approved by Admins" },
];
const PORTAL_ICON: Record<PortalKey, string> = { student: "book", recruiter: "briefcase", expert: "mentor", admin: "shield" };

const SNIPPET = `// Your path on UDAAN
const me = await udaan.signUp({ role: "student" });

me.learn()      // find your skill gaps
  .upskill()    // courses & sessions
  .build()      // code with an AI mentor
  .connect()    // learn with peers
  .compete()    // join hackathons
  .grow();      // get discovered`;

const ORANGE_TEXT = "#f2a27f";
function Snippet() {
  // Lightweight syntax colouring for the hero code card.
  return (
    <>
      {SNIPPET.split("\n").map((line, i) => {
        const [code, comment] = line.split("//");
        const parts = code.split(/(\b(?:const|await)\b|"[^"]*"|\.\w+(?=\())/g);
        return (
          <div key={i} className="whitespace-pre">
            {parts.map((p, j) =>
              /^(const|await)$/.test(p) ? <span key={j} style={{ color: ORANGE_TEXT }}>{p}</span>
              : p.startsWith('"') ? <span key={j} style={{ color: "#e6c07b" }}>{p}</span>
              : p.startsWith(".") ? <span key={j}>.<span style={{ color: ORANGE_TEXT }}>{p.slice(1)}</span></span>
              : <span key={j}>{p}</span>)}
            {comment !== undefined && <span style={{ color: "#8b90a0" }}>{"//" + comment}</span>}
            {line === "" && " "}
          </div>
        );
      })}
    </>
  );
}

/* ─── Shared buttons ─── */
const btnBase = "flex w-full items-center justify-center gap-3 rounded-xl px-5 py-4 text-lg font-semibold transition-[filter] hover:brightness-110";

/* ─── Preview panel (mirrors the "Simple Syntax" demo) ─── */
function PreviewPanel() {
  const [view, setView] = useState<"preview" | "code">("preview");
  const [focus, setFocus] = useState<string>("chart");
  return (
    <div className="rounded-3xl p-5 sm:p-8" style={{ background: C.grey, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-4">
          {["bell", "chart", "pointer", "edit"].map((ic) => (
            <button key={ic} onClick={() => setFocus(ic)} aria-label={ic} className="rounded-lg p-2" style={{ color: focus === ic ? C.orange : C.navy }}>
              <Icon name={ic} size={26} />
            </button>
          ))}
        </div>
        <div className="flex rounded-full p-0" style={{ background: "#e2e4e8" }}>
          {(["preview", "code"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className="rounded-full px-4 py-2 text-[15px] font-semibold capitalize sm:px-5"
              style={{ background: view === v ? C.orange : "transparent", color: view === v ? "#fff" : C.text }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "code" ? (
        <pre className="overflow-x-auto rounded-2xl p-6 text-[13px] leading-6" style={{ background: C.navy, color: "#c9ccd4", fontFamily: "'JetBrains Mono', monospace" }}>
{`<Progress label="Full Stack roadmap" value={50} />

<Callout kind="success" action="Open review">
  Your mentor reviewed your CodeLab submission.
</Callout>

<Callout kind="warning" action="Register">
  A hackathon matching your interests closes soon.
</Callout>

<Channel name="dsa-help" unread={2} />`}
        </pre>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white p-6" style={{ outline: focus === "chart" ? `2px solid ${C.orange}` : "none" }}>
            <p className="mb-4 text-[16px] font-semibold" style={{ color: C.ink }}>Whoa, you&rsquo;re halfway there&hellip;</p>
            <div className="h-3.5 overflow-hidden rounded-full" style={{ background: "#e2e4e8" }}>
              <div className="h-full rounded-full" style={{ width: "50%", background: "#1570ef" }} />
            </div>
          </div>
          <div className="space-y-5 rounded-2xl bg-white p-6" style={{ outline: focus === "bell" ? `2px solid ${C.orange}` : "none" }}>
            <div className="flex items-start gap-5 rounded-2xl p-5" style={{ background: "#e1f5e3" }}>
              <span className="mt-3"><Icon name="mentor" color="#0b7a39" size={26} /></span>
              <div>
                <p className="text-[17px]" style={{ color: C.ink }}>Your mentor reviewed your code.</p>
                <span className="mt-4 inline-block rounded-lg px-5 py-2.5 text-[16px] font-semibold text-white" style={{ background: "#0b8a40" }}>Open Review</span>
              </div>
            </div>
            <div className="flex items-start gap-5 rounded-2xl p-5" style={{ background: "#fdf0cf" }}>
              <span className="mt-3"><Icon name="trophy" color="#a85a0c" size={26} /></span>
              <div>
                <p className="text-[17px]" style={{ color: C.ink }}>A hackathon closes soon.</p>
                <span className="mt-4 inline-block rounded-lg px-5 py-2.5 text-[16px] font-semibold text-white" style={{ background: "#b45d09" }}>Register Now</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-7 rounded-2xl bg-white p-6 pt-8" style={{ outline: focus === "pointer" ? `2px solid ${C.orange}` : "none" }}>
            {([["Learn", 0, "#0b8a40"], ["CodeLab", 2, "#d62f45"], ["Connect", 1, C.navy], ["Compete", 6, C.navy]] as const).map(([n, c, col]) => (
              <span key={n} className="relative rounded-lg px-4 py-2.5 text-[17px]" style={{ background: "#e2e4e8", color: C.text }}>
                {n}
                <span className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: col, boxShadow: c === 2 ? "0 0 0 5px rgba(214,47,69,0.25)" : "none" }}>{c}</span>
              </span>
            ))}
          </div>
          <div className="grid gap-4 rounded-2xl bg-white p-6 sm:grid-cols-2" style={{ outline: focus === "edit" ? `2px solid ${C.orange}` : "none" }}>
            {[["Career goal", "Full Stack Developer"], ["Semester", "5"]].map(([k, v]) => (
              <label key={k} className="block">
                <span className="mb-1.5 block text-sm font-medium" style={{ color: C.muted }}>{k}</span>
                <span className="block rounded-lg border px-3 py-2.5 text-[15px]" style={{ borderColor: "#cfd2d8", color: C.ink }}>{v}</span>
              </label>
            ))}
          </div>
          <p className="text-center text-xs" style={{ color: C.muted }}>Sample data, for illustration.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Search (filters modules & portals) ─── */
function ModuleSearch() {
  const [q, setQ] = useState("");
  const items = [
    ...MODULES.map((m) => ({ label: m.title, desc: m.desc, href: m.href })),
    ...(Object.keys(PORTAL_INFO) as PortalKey[]).map((p) => ({ label: `${PORTAL_INFO[p].name} sign in`, desc: PORTAL_INFO[p].blurb, href: `/${p}/login` })),
  ];
  const hits = q.trim() ? items.filter((i) => (i.label + " " + i.desc).toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  return (
    <div className="relative">
      <label className="flex items-center gap-4 rounded-full border-2 bg-white px-6 py-4" style={{ borderColor: "#c9ccd3" }}>
        <Icon name="search" size={24} color={C.muted} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a module to start with…"
          className="w-full bg-transparent text-lg outline-none placeholder:text-[#6b7180]" style={{ ...display, color: C.ink }} />
      </label>
      {hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border bg-white shadow-xl" style={{ borderColor: C.line }}>
          {hits.map((h) => (
            <Link key={h.href + h.label} href={h.href} className="block px-6 py-3 hover:bg-[#f4f5f7]">
              <span className="block font-semibold" style={{ color: C.ink }}>{h.label}</span>
              <span className="block truncate text-sm" style={{ color: C.muted }}>{h.desc}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page ─── */
export default function Welcome() {
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(SNIPPET).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  return (
    // Break out of the app layout's padding; light canvas for the public landing page.
    <div className="-m-5 min-h-screen overflow-x-hidden bg-white md:-mx-10 md:-my-7" style={{ color: C.ink, fontFeatureSettings: "normal" }}>
      {/* ── Header: menu · centered logo · sign-in ── */}
      <header className="sticky top-0 z-30 border-b bg-white" style={{ borderColor: C.line }}>
        <div className="mx-auto grid h-[72px] max-w-6xl grid-cols-3 items-center px-5">
          <button onClick={() => setMenu(!menu)} aria-label="Menu" className="justify-self-start p-2" style={{ color: C.muted }}>
            <Icon name={menu ? "close" : "menu"} size={26} />
          </button>
          <Link href="/welcome" className="justify-self-center"><Logo size={34} /></Link>
          <Link href="/student/login" aria-label="Sign in" className="justify-self-end p-2" style={{ color: C.muted }}><Icon name="login" size={26} /></Link>
        </div>
        {menu && (
          <nav className="border-t bg-white px-5 py-3" style={{ borderColor: C.line }}>
            <div className="mx-auto grid max-w-6xl gap-1 sm:grid-cols-4">
              {[["#modules", "Modules"], ["#how", "How it works"], ["#portals", "Portals"], ["/student/login", "Sign in"]].map(([h, l]) => (
                <a key={h} href={h} onClick={() => setMenu(false)} className="rounded-lg px-3 py-2.5 text-[16px] font-medium hover:bg-[#f4f5f7]" style={{ ...display, color: C.navy }}>{l}</a>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <OutlinePattern />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-16 sm:pt-24">
          <h1 className="text-[44px] font-bold leading-[1.15] tracking-tight sm:text-6xl lg:text-7xl" style={{ ...display, color: C.ink }}>
            The Engineer&rsquo;s All-in-One Career Platform
          </h1>
          <p className="mt-8 text-xl leading-[1.6] sm:text-2xl" style={{ color: C.ink }}>
            UDAAN brings skill-gap analysis, courses, an AI-assisted code lab, mentors, hackathons and a recruiter-ready
            portfolio together in one connected place.
          </p>

          <div className="mt-10 space-y-4">
            <Link href="/student/register" className={btnBase + " text-white"} style={{ ...display, background: C.orange }}>
              <Icon name="rocket" size={26} /> Get Started
            </Link>
            <div className="flex overflow-hidden rounded-xl" style={{ background: C.navy }}>
              <a href="#modules" className="flex flex-1 items-center justify-center gap-3 px-5 py-4 text-lg font-semibold text-white hover:brightness-110" style={display}>
                <Icon name="grid" size={26} /> Modules
              </a>
              <a href="#find" aria-label="Search modules" className="flex items-center border-l px-5 text-white" style={{ borderColor: "rgba(255,255,255,0.35)" }}>
                <Icon name="search" size={26} />
              </a>
            </div>
            <a href="#portals" className={btnBase} style={{ ...display, background: "#e4e6ea", color: C.navy }}>
              <Icon name="login" size={26} /> Choose Your Portal
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 text-[17px] sm:text-lg" style={{ color: C.ink }}>
            <span className="flex items-center gap-3"><Icon name="tag" size={24} /> 6 Modules</span>
            <span className="flex items-center gap-3"><Icon name="users" size={24} /> 4 Portals</span>
            <span className="flex items-center gap-3"><Icon name="spark" size={24} /> AI Mentor</span>
            <span className="flex items-center gap-3"><Icon name="file" size={24} /> Resume Builder</span>
          </div>

          {/* Code card + attached caption */}
          <div className="mt-12 overflow-hidden rounded-3xl border shadow-sm" style={{ borderColor: C.line }}>
            <div className="relative" style={{ background: C.navy }}>
              <button onClick={copy} aria-label="Copy" className="absolute right-4 top-4 rounded-lg p-2 text-white/80 hover:bg-white/10">
                <Icon name={copied ? "check" : "copy"} size={22} />
              </button>
              <div className="overflow-x-auto px-7 py-8 text-[15px] leading-8 sm:text-base" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#c9ccd4" }}>
                <Snippet />
              </div>
            </div>
            <div className="bg-white px-7 py-7 text-lg leading-relaxed sm:text-xl" style={{ color: C.ink }}>
              <span className="mr-2 inline-block align-[-4px]" style={{ color: C.orange }}><Icon name="hand" size={26} /></span>
              <b style={display}>Sign up &amp; take off!</b> Set your career goal once and every
              {" "}<code className="rounded px-1 text-[0.9em]" style={{ color: "#b3401a", fontFamily: "'JetBrains Mono', monospace" }}>&lt;module&gt;</code>{" "}
              works toward it.
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 px-2 text-[17px] sm:text-lg" style={{ color: C.ink }}>
            <Link href="/student/register" className="flex items-center gap-3 hover:text-[#D9541E]"><Icon name="book" size={24} /> Student Sign-up</Link>
            <Link href="/expert/register" className="flex items-center gap-3 hover:text-[#D9541E]"><Icon name="mentor" size={24} /> Become a Mentor</Link>
            <Link href="/recruiter/register" className="flex items-center gap-3 hover:text-[#D9541E]"><Icon name="briefcase" size={24} /> For Recruiters</Link>
            <a href="#how" className="flex items-center gap-3 hover:text-[#D9541E]"><Icon name="help" size={24} /> How It Works</a>
          </div>
        </div>
      </section>

      {/* ── What's included (dotted) ── */}
      <section id="modules" className="border-y py-24" style={{ ...dotted, borderColor: C.line }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl lg:mx-0">
            <p className="text-[15px] font-semibold uppercase tracking-[0.16em] sm:text-base" style={{ ...display, color: C.orange }}>All you need to make your career take off</p>
            <h2 className="mt-5 text-[40px] font-bold leading-[1.15] tracking-tight sm:text-5xl" style={{ ...display, color: C.ink }}>
              What&rsquo;s Included<br />in UDAAN?
            </h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-3xl gap-8 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
            {MODULES.map((m) => (
              <Link key={m.title} href={m.href} className="group rounded-2xl border bg-white p-8 sm:p-10 transition-shadow hover:shadow-lg"
                style={{ borderColor: C.line, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div className="flex items-start justify-between">
                  <Icon name={m.icon} size={46} color={C.ink} />
                  {m.badge && <span className="rounded-full px-4 py-1.5 text-[15px] font-medium text-white" style={{ background: "#ec6a3f" }}>{m.badge}</span>}
                </div>
                <h3 className="mt-6 text-2xl font-bold" style={{ ...display, color: C.ink }}>{m.title}</h3>
                <p className="mt-5 text-lg leading-[1.65]" style={{ color: C.text }}>{m.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Simple steps / preview ── */}
      <section id="how" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl lg:mx-0">
            <p className="text-[15px] font-semibold uppercase tracking-[0.16em] sm:text-base" style={{ ...display, color: C.orange }}>Put the &ldquo;go&rdquo; in goals</p>
            <h2 className="mt-5 text-[40px] font-bold leading-[1.15] tracking-tight sm:text-5xl" style={{ ...display, color: C.ink }}>
              Simple Steps.<br />Powerful Progress.
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-3xl gap-16 lg:max-w-none lg:grid-cols-2 lg:items-start">
            <div className="min-w-0"><PreviewPanel /></div>
            <div className="min-w-0">
              <p className="text-xl leading-[1.7]" style={{ color: C.ink }}>
                We&rsquo;re committed to learning that leads somewhere real. Courses, practice, mentors, competitions and
                placements usually live in a dozen apps &mdash; UDAAN connects them, so the effort you put in one place
                counts everywhere.
              </p>
              <ul className="mt-10 space-y-7">
                {PRINCIPLES.map((p) => (
                  <li key={p.label} className="flex items-center gap-5 text-lg" style={{ color: C.ink }}>
                    <Icon name={p.icon} size={30} />
                    {p.href
                      ? <Link href={p.href} className="underline decoration-dotted decoration-2 underline-offset-[6px] hover:text-[#D9541E]" style={{ textDecorationColor: "#9aa0ab" }}>{p.label}</Link>
                      : <span>{p.label}</span>}
                  </li>
                ))}
              </ul>
              <hr className="my-12" style={{ borderColor: C.line }} />
              <div id="find" className="scroll-mt-28 space-y-8">
                <ModuleSearch />
                <a href="#modules" className={btnBase + " text-white"} style={{ ...display, background: C.navy }}>
                  <Icon name="grid" size={26} /> View All Modules
                </a>
                <p className="text-center text-lg" style={{ color: C.text }}>
                  like{" "}
                  {[["learn", "/learn"], ["codelab", "/build"], ["connect", "/connect"]].map(([l, h], i) => (
                    <span key={l}>
                      <Link href={h} className="underline decoration-dotted decoration-2 underline-offset-[6px]" style={{ color: "#b3401a" }}>{l}</Link>
                      {i < 2 ? ", or " : ""}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Orange CTA ── */}
      <section id="portals" className="relative overflow-hidden py-24" style={{ background: "#cd4a24" }}>
        <OutlinePattern stroke="rgba(255,255,255,0.08)" />
        <div className="relative mx-auto grid max-w-3xl gap-14 px-6 lg:max-w-6xl lg:grid-cols-2 lg:items-center">
          <div className="text-white">
            <h2 className="text-[40px] font-bold leading-[1.15] tracking-tight sm:text-5xl" style={display}>Get More with UDAAN Portals!</h2>
            <p className="mt-8 text-xl leading-[1.7] text-white/95">
              UDAAN gives students everything they need to grow &mdash;{" "}
              <span className="underline decoration-2 underline-offset-[7px]">in one place</span>.
            </p>
            <p className="mt-5 text-xl leading-[1.7] text-white/95">
              <b className="text-white">Mentors and recruiters make it even more awesome</b> with weekend sessions,
              training courses, evaluations and opportunities for opted-in students.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4">
              <Link href="/student/register" className="flex items-center justify-center gap-3 rounded-xl px-4 py-4 text-lg font-semibold hover:brightness-105" style={{ ...display, background: "#e4e6ea", color: C.ink }}>
                <Icon name="rocket" size={24} /> Start Learning
              </Link>
              <Link href="/expert/register" className="flex items-center justify-center gap-3 rounded-xl px-4 py-4 text-lg font-semibold text-white hover:brightness-110" style={{ ...display, background: C.navy }}>
                <Icon name="mentor" size={24} /> Join as Mentor
              </Link>
            </div>
          </div>
          <div className="rounded-3xl px-7 py-8 sm:px-10" style={{ background: C.navy }}>
            <ul className="space-y-7">
              {(Object.keys(PORTAL_INFO) as PortalKey[]).map((p) => (
                <li key={p}>
                  <Link href={`/${p}/login`} className="flex items-center gap-5 text-lg text-white">
                    <Icon name={PORTAL_ICON[p]} size={26} color="#f0825a" />
                    <span className="underline decoration-dotted decoration-2 underline-offset-[6px]" style={{ textDecorationColor: "rgba(255,255,255,0.45)" }}>{PORTAL_INFO[p].name} Portal</span>
                  </Link>
                </li>
              ))}
              {[["spark", "AI Mentor in CodeLab"], ["map", "Personal Roadmaps"], ["file", "Resume & Portfolio Builder"]].map(([ic, l]) => (
                <li key={l} className="flex items-center gap-5 text-lg text-white">
                  <Icon name={ic} size={26} color="#f0825a" /> {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="py-10" style={{ background: C.ink }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm sm:flex-row" style={{ color: "#9aa0ad" }}>
          <Logo size={28} tone="dark" />
          <span>Learn. Build. Connect. Compete. Grow.</span>
          <span>&copy; {new Date().getFullYear()} GURUKOOL</span>
        </div>
      </footer>
    </div>
  );
}
