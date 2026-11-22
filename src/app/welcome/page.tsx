"use client";
import Link from "next/link";
import { useState } from "react";
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
  backgroundImage: "radial-gradient(#c9ccd2 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};

/* ─── Content (only real UDAAN features — no invented stats) ─── */
const MODULES = [
  { icon: "book", title: "Learn", desc: "Skill-gap analysis against your career goal, a quiz to check what you know, and a personal roadmap." },
  { icon: "layers", title: "Upskill", desc: "Training courses and weekend sessions run by mentors and industry experts." },
  { icon: "code", title: "CodeLab", desc: "Write and run code in the browser with an AI mentor beside you to explain and review." },
  { icon: "users", title: "Connect", desc: "A peer community with channels and mentors, so you never get stuck alone." },
  { icon: "trophy", title: "Compete", desc: "Hackathons and challenges matched to your interests." },
  { icon: "file", title: "Grow", desc: "A resume builder that turns your progress into a portfolio recruiters can discover." },
];
const PRINCIPLES = [
  { icon: "target", label: "Goal-driven learning paths" },
  { icon: "spark", label: "AI help where it matters" },
  { icon: "map", label: "One roadmap across every module" },
  { icon: "chat", label: "Real mentors, real feedback" },
  { icon: "lock", label: "Students choose what recruiters see" },
  { icon: "shield", label: "Recruiters approved by admins" },
];
const PORTAL_ICON: Record<PortalKey, string> = { student: "book", recruiter: "briefcase", expert: "mentor", admin: "shield" };

/* ─── Interactive sample panel ─── */
const SAMPLE_TABS = [
  { icon: "bell", key: "alerts" },
  { icon: "chart", key: "progress" },
  { icon: "pointer", key: "badges" },
  { icon: "edit", key: "profile" },
] as const;

function SamplePanel() {
  const [tab, setTab] = useState<(typeof SAMPLE_TABS)[number]["key"]>("progress");
  const [view, setView] = useState<"preview" | "details">("preview");
  return (
    <div className="rounded-3xl p-5 sm:p-8" style={{ background: C.grey, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1">
          {SAMPLE_TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} aria-label={t.key}
              className="rounded-xl p-3 transition-colors" style={{ color: tab === t.key ? C.orange : C.navy, background: tab === t.key ? "#fff" : "transparent" }}>
              <Icon name={t.icon} size={24} />
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-full" style={{ background: "#e2e4e8" }}>
          {(["preview", "details"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className="px-5 py-2 text-sm font-semibold capitalize transition-colors"
              style={{ background: view === v ? C.orange : "transparent", color: view === v ? "#fff" : C.text, borderRadius: 9999 }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "details" ? (
        <div className="rounded-2xl bg-white p-6 text-[15px] leading-relaxed" style={{ color: C.text }}>
          {tab === "progress" && <p>Every module feeds one roadmap. Finish a quiz in <b>Learn</b> or a session in <b>Upskill</b> and your progress updates everywhere.</p>}
          {tab === "alerts" && <p>Notifications tell you when a mentor replies, a hackathon opens, or a recruiter views your opted-in portfolio.</p>}
          {tab === "badges" && <p>Channels in <b>Connect</b> show unread counts so you can jump straight to the conversation that needs you.</p>}
          {tab === "profile" && <p>Your profile — college, branch, semester, skills and career goal — drives skill-gap analysis and recommendations.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {tab === "progress" && (
            <div className="rounded-2xl bg-white p-6">
              <div className="mb-3 flex justify-between text-[15px] font-semibold" style={{ color: C.ink }}>
                <span>Full Stack Developer roadmap</span><span style={{ color: C.muted }}>50%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full" style={{ background: "#e2e4e8" }}>
                <div className="h-full rounded-full" style={{ width: "50%", background: C.orange }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs" style={{ color: C.muted }}>
                {["Learn", "CodeLab", "Grow"].map((m, i) => (
                  <div key={m} className="rounded-lg py-2" style={{ background: C.grey }}>
                    <div className="text-base font-bold" style={{ color: C.ink }}>{["4/6", "2/5", "1/3"][i]}</div>{m}
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "alerts" && (
            <div className="space-y-4 rounded-2xl bg-white p-6">
              <div className="flex items-start gap-4 rounded-2xl p-5" style={{ background: "#e3f6e6" }}>
                <Icon name="check" color="#0a8a3c" />
                <div>
                  <p className="text-[15px]" style={{ color: C.ink }}>Your mentor reviewed your CodeLab submission.</p>
                  <span className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "#0a8a3c" }}>Open review</span>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl p-5" style={{ background: "#fdf1d6" }}>
                <Icon name="trophy" color="#b45d09" />
                <div>
                  <p className="text-[15px]" style={{ color: C.ink }}>A hackathon matching your interests closes soon.</p>
                  <span className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "#b45d09" }}>Register</span>
                </div>
              </div>
            </div>
          )}
          {tab === "badges" && (
            <div className="flex flex-wrap gap-6 rounded-2xl bg-white p-6 pt-8">
              {[["general", 0, "#0a8a3c"], ["dsa-help", 2, "#d62f45"], ["web-dev", 1, C.navy], ["placements", 6, C.navy]].map(([n, c, col]) => (
                <span key={n as string} className="relative rounded-lg px-4 py-2.5 text-[15px]" style={{ background: "#e2e4e8", color: C.text }}>
                  #{n}
                  <span className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: col as string }}>{c}</span>
                </span>
              ))}
            </div>
          )}
          {tab === "profile" && (
            <div className="grid gap-3 rounded-2xl bg-white p-6 sm:grid-cols-2">
              {[["Branch", "Computer Science"], ["Semester", "5"], ["Career goal", "Full Stack Developer"], ["Skills", "JavaScript, SQL, Git"]].map(([k, v]) => (
                <div key={k}>
                  <div className="mb-1 text-xs font-medium" style={{ color: C.muted }}>{k}</div>
                  <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.line, color: C.ink }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          <p className="text-center text-xs" style={{ color: C.muted }}>Sample data, for illustration.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Page ─── */
export default function Welcome() {
  return (
    // Break out of the layout's <main> padding and switch to a light canvas.
    <div className="-m-5 md:-mx-10 md:-my-7 min-h-screen overflow-x-hidden bg-white" style={{ color: C.ink }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur" style={{ borderColor: C.line }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/welcome" className="flex items-center gap-2">
            <img src="/udaan-logo.png" alt="UDAAN" style={{ height: 36, width: "auto" }} />
          </Link>
          <nav className="hidden items-center gap-8 text-[15px] font-medium sm:flex" style={{ color: C.text }}>
            <a href="#modules" className="hover:text-[#D9541E]">Modules</a>
            <a href="#how" className="hover:text-[#D9541E]">How it works</a>
            <a href="#portals" className="hover:text-[#D9541E]">Portals</a>
          </nav>
          <Link href="/student/login" className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: C.navy }} aria-label="Sign in">
            <span className="hidden sm:inline">Sign in</span><Icon name="login" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <OutlinePattern />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl" style={{ ...display, color: C.ink }}>
              Engineering Careers, Built End&nbsp;to&nbsp;End
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed sm:text-xl" style={{ color: C.text }}>
              UDAAN is one connected platform where engineering students learn, build, find mentors, compete and grow
              into the roles they want.
            </p>
            <div className="mt-9 flex max-w-xl flex-col gap-3">
              <Link href="/student/register" className="flex items-center justify-center gap-3 rounded-xl py-4 text-lg font-semibold text-white transition-colors"
                style={{ ...display, background: C.orange }} onMouseEnter={(e) => (e.currentTarget.style.background = C.orangeDark)} onMouseLeave={(e) => (e.currentTarget.style.background = C.orange)}>
                <Icon name="rocket" /> Get Started
              </Link>
              <a href="#modules" className="flex items-center justify-center gap-3 rounded-xl py-4 text-lg font-semibold text-white" style={{ ...display, background: C.navy }}>
                <Icon name="grid" /> Explore Modules
              </a>
              <a href="#portals" className="flex items-center justify-center gap-3 rounded-xl py-4 text-lg font-semibold" style={{ ...display, background: "#e4e6ea", color: C.navy }}>
                <Icon name="login" /> Choose Your Portal
              </a>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-[16px]" style={{ color: C.text }}>
              <span className="flex items-center gap-3"><Icon name="grid" size={20} /> 6 Learning Modules</span>
              <span className="flex items-center gap-3"><Icon name="users" size={20} /> 4 Role Portals</span>
              <span className="flex items-center gap-3"><Icon name="spark" size={20} /> AI Mentor</span>
              <span className="flex items-center gap-3"><Icon name="file" size={20} /> Resume Builder</span>
            </div>
          </div>

          {/* Code-style "path" card */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-3xl shadow-xl" style={{ background: C.navy }}>
              <div className="flex gap-2 px-6 pt-5">
                {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}
              </div>
              <pre className="overflow-x-auto px-6 pb-7 pt-5 text-[14px] leading-7" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#c9ccd4" }}>
<span style={{ color: "#8b90a0" }}>{"// your path on UDAAN"}</span>{"\n"}
<span style={{ color: "#f29a6b" }}>const</span> me = <span style={{ color: "#f29a6b" }}>await</span> udaan.<span style={{ color: "#8fd3ff" }}>signUp</span>({"{"} role: <span style={{ color: "#a8e6a3" }}>{'"student"'}</span> {"}"});{"\n\n"}
me.<span style={{ color: "#8fd3ff" }}>learn</span>()   <span style={{ color: "#8b90a0" }}>{"// find your skill gaps"}</span>{"\n"}
  .<span style={{ color: "#8fd3ff" }}>build</span>()   <span style={{ color: "#8b90a0" }}>{"// code with an AI mentor"}</span>{"\n"}
  .<span style={{ color: "#8fd3ff" }}>connect</span>() <span style={{ color: "#8b90a0" }}>{"// learn with peers"}</span>{"\n"}
  .<span style={{ color: "#8fd3ff" }}>compete</span>() <span style={{ color: "#8b90a0" }}>{"// join hackathons"}</span>{"\n"}
  .<span style={{ color: "#8fd3ff" }}>grow</span>();   <span style={{ color: "#8b90a0" }}>{"// get discovered"}</span>
              </pre>
            </div>
            <div className="-mt-4 rounded-b-3xl border border-t-0 bg-white px-7 pb-6 pt-9 text-[16px] leading-relaxed shadow-sm" style={{ borderColor: C.line, color: C.text }}>
              <span className="mr-1">👉</span><b style={{ ...display, color: C.ink }}>Five steps, one platform.</b> Set your career goal once and every
              module works toward it.
            </div>
          </div>
        </div>
      </section>

      {/* Modules — dotted section */}
      <section id="modules" className="border-y py-24" style={{ ...dotted, borderColor: C.line }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm font-bold uppercase tracking-[0.18em]" style={{ ...display, color: C.orange }}>Everything you need to take off</p>
          <h2 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl" style={{ ...display, color: C.ink }}>
            What&rsquo;s Inside UDAAN?
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div key={m.title} className="rounded-2xl border bg-white p-8 transition-shadow hover:shadow-md" style={{ borderColor: C.line, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                <Icon name={m.icon} size={40} color={C.ink} />
                <h3 className="mt-5 text-xl font-bold" style={{ ...display, color: C.ink }}>{m.title}</h3>
                <p className="mt-3 text-[16px] leading-relaxed" style={{ color: C.muted }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm font-bold uppercase tracking-[0.18em]" style={{ ...display, color: C.orange }}>Put the &ldquo;go&rdquo; in your goals</p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl" style={{ ...display, color: C.ink }}>
            Simple Steps.<br />Powerful Progress.
          </h2>
          <div className="mt-12 grid gap-14 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            <div className="min-w-0"><SamplePanel /></div>
            <div className="min-w-0">
              <p className="text-lg leading-relaxed" style={{ color: C.text }}>
                UDAAN connects the pieces most students juggle across a dozen apps — courses, practice, mentors,
                competitions and placements — so the effort you put in one place counts everywhere.
              </p>
              <ul className="mt-8 space-y-5">
                {PRINCIPLES.map((p) => (
                  <li key={p.label} className="flex items-center gap-4 text-[17px]" style={{ color: C.ink }}>
                    <Icon name={p.icon} size={26} /> {p.label}
                  </li>
                ))}
              </ul>
              <div className="mt-10 border-t pt-8" style={{ borderColor: C.line }}>
                <Link href="/student/register" className="flex items-center justify-center gap-3 rounded-xl py-4 text-lg font-semibold text-white" style={{ ...display, background: C.navy }}>
                  <Icon name="grid" /> Create a Free Student Account
                </Link>
                <p className="mt-4 text-center text-[15px]" style={{ color: C.muted }}>
                  Already have one? <Link href="/student/login" className="font-medium underline decoration-dotted underline-offset-4" style={{ color: C.orange }}>Sign in</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portals — orange CTA */}
      <section id="portals" className="relative overflow-hidden py-24" style={{ background: C.orange }}>
        <OutlinePattern stroke="rgba(255,255,255,0.09)" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
          <div className="text-white">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl" style={display}>One Platform, Four Portals.</h2>
            <p className="mt-6 text-lg leading-relaxed text-white/90">
              Students, recruiters, mentors and admins each get a workspace built for what they do — all sharing the
              same source of truth.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-white/90">
              <b className="text-white">Recruiters</b> see only portfolios students have opted in to share, and only after an admin approves their account.
            </p>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              <Link href="/student/register" className="flex items-center justify-center gap-3 rounded-xl py-4 text-lg font-semibold" style={{ ...display, background: "#e4e6ea", color: C.navy }}>
                <Icon name="rocket" /> Start as a Student
              </Link>
              <Link href="/expert/register" className="flex items-center justify-center gap-3 rounded-xl py-4 text-lg font-semibold text-white" style={{ ...display, background: C.navy }}>
                <Icon name="mentor" /> Join as a Mentor
              </Link>
            </div>
          </div>
          <div className="rounded-3xl p-3 sm:p-4" style={{ background: C.navy }}>
            {(Object.keys(PORTAL_INFO) as PortalKey[]).map((p) => (
              <Link key={p} href={`/${p}/login`} className="group flex items-start gap-4 rounded-2xl p-5 transition-colors hover:bg-white/5">
                <span className="mt-0.5" style={{ color: "#f29a6b" }}><Icon name={PORTAL_ICON[p]} size={24} /></span>
                <span className="flex-1">
                  <span className="block text-lg font-semibold text-white underline decoration-dotted decoration-white/40 underline-offset-4" style={display}>{PORTAL_INFO[p].name}</span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-white/60">{PORTAL_INFO[p].blurb}</span>
                </span>
                <span className="mt-1 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-white"><Icon name="arrow" size={20} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10" style={{ background: C.ink }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm sm:flex-row" style={{ color: "#9aa0ad" }}>
          <img src="/udaan-logo-dark.png" alt="UDAAN" style={{ height: 30, width: "auto" }} />
          <span>Learn. Build. Connect. Compete. Grow.</span>
          <span>© {new Date().getFullYear()} GURUKOOL</span>
        </div>
      </footer>
    </div>
  );
}
