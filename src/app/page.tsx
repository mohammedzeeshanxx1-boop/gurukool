"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, useStudent } from "@/components/ui";

/* ─── API shapes (only the fields the dashboard reads) ─── */
type Status = { db: { configured: boolean; connected: boolean; error?: string }; ai: { configured: boolean; model: string | null }; connectUrlConfigured: boolean };
type MasteryRow = { skill: string; mean: number; status: "mastered" | "developing" | "gap"; verified: boolean };
type MasteryRes = { goal: string; mastery: MasteryRow[]; evidenceCount: number; nextTopics: string[] };
type AssessRes = { latest: { score: number; total: number; weakTopics: string[]; submittedAt: string } | null; count: number };
type Stage = { _id: string; topic: string; duration: string; completed: boolean };
type RoadmapRes = { roadmap: { careerGoal: string; stages: Stage[] } | null };
type TrainRes = {
  enrollments: { id: string; courseId: string; title: string; trainer: string; engagementPct: number; completed: boolean }[];
  upcomingSessions: { id: string; courseTitle: string; title: string; when: string; trainer: string }[];
  mentorshipSessions: { id: string; mentor: string; topic: string; when: string }[];
};
type NotifRes = { unread: number; items: { id: string; title: string; body: string; link: string; read: boolean; createdAt: string }[] };

const MODULES = [
  { href: "/learn", title: "Learn", desc: "Skill gaps, quiz, roadmap", icon: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" },
  { href: "/train", title: "Upskill", desc: "Courses & sessions", icon: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/build", title: "CodeLab", desc: "Code + AI mentor", icon: "M16 18l6-6-6-6M8 6l-6 6 6 6" },
  { href: "/connect", title: "Connect", desc: "Peers & mentors", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/compete", title: "Compete", desc: "Hackathons", icon: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M18 2H6v7a6 6 0 0 0 12 0V2z" },
  { href: "/grow", title: "Grow", desc: "Resume builder", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8" },
];

function Svg({ d, size = 22, color = "currentColor" }: { d: string; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Ring({ pct }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" aria-label={`${pct}% ready`}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
      <circle cx="66" cy="66" r={r} fill="none" stroke="#D9541E" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 66 66)" style={{ transition: "stroke-dashoffset .6s" }} />
      <text x="66" y="64" textAnchor="middle" fill="#fff" style={{ font: "700 30px Outfit, Inter, sans-serif" }}>{pct}%</text>
      <text x="66" y="86" textAnchor="middle" fill="rgba(255,255,255,0.6)" style={{ font: "500 12px Inter, sans-serif" }}>goal ready</text>
    </svg>
  );
}

function Stat({ label, value, sub, href }: { label: string; value: string; sub: string; href: string }) {
  return (
    <Link href={href} className="card-hover block">
      <div className="text-[13px] font-medium text-[#5f6573]">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums text-[#16181d]">{value}</div>
      <div className="mt-1 text-xs text-[#5f6573]">{sub}</div>
    </Link>
  );
}

function Empty({ children, href, cta }: { children: React.ReactNode; href: string; cta: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#cfd2d8] bg-[#f7f8fa] p-5 text-sm text-[#3d4250]">
      {children} <Link href={href} className="font-semibold text-[#D9541E] underline decoration-dotted underline-offset-4">{cta}</Link>
    </div>
  );
}

export default function Dashboard() {
  const { student, loading, error } = useStudent();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [mastery, setMastery] = useState<MasteryRes | null>(null);
  const [assess, setAssess] = useState<AssessRes | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapRes["roadmap"]>(null);
  const [train, setTrain] = useState<TrainRes | null>(null);
  const [notifs, setNotifs] = useState<NotifRes | null>(null);

  useEffect(() => {
    api<{ user: { name: string } }>("/api/auth/me").then((d) => setName(d.user.name)).catch(() => {});
    api<Status>("/api/status").then(setStatus).catch(() => {});
    api<AssessRes>("/api/learn/assessment").then(setAssess).catch(() => {});
    api<RoadmapRes>("/api/learn/roadmap").then((d) => setRoadmap(d.roadmap)).catch(() => {});
    api<TrainRes>("/api/train/me").then(setTrain).catch(() => {});
    api<NotifRes>("/api/notifications").then(setNotifs).catch(() => {});
  }, []);
  useEffect(() => {
    if (student) api<MasteryRes>("/api/learn/mastery").then(setMastery).catch(() => {});
  }, [student]);

  const first = (student?.name || name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const skills = mastery?.mastery ?? [];
  const mastered = skills.filter((s) => s.status === "mastered").length;
  const readiness = skills.length ? Math.round((mastered / skills.length) * 100) : 0;
  const focus = [...skills].filter((s) => s.status !== "mastered").sort((a, b) => a.mean - b.mean).slice(0, 5);
  const stagesDone = roadmap?.stages.filter((s) => s.completed).length ?? 0;
  const nextStages = roadmap?.stages.filter((s) => !s.completed).slice(0, 3) ?? [];
  const upcoming = [
    ...(train?.upcomingSessions ?? []).map((s) => ({ id: s.id, title: s.title, meta: `${s.courseTitle} · ${s.trainer}`, when: s.when, href: "/train" })),
    ...(train?.mentorshipSessions ?? []).map((s) => ({ id: s.id, title: s.topic, meta: `Mentorship · ${s.mentor}`, when: s.when, href: "/connect" })),
  ].slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        title={first ? `${greet}, ${first}` : "Dashboard"}
        subtitle="Your progress across learning, practice and career readiness — all in one place."
        right={<><Link href="/profile" className="btn-ghost">My Profile</Link><Link href="/learn" className="btn-primary">Continue Learning &rarr;</Link></>}
      />

      {loading ? <div className="text-sm text-[#5f6573]"><Spinner /> Loading…</div> : <ErrorAlert err={error} />}
      {!loading && !student && !error && (
        <Alert kind="warn"><b>Complete your profile</b> to unlock skill-gap analysis, recommendations and hackathon matches. <Link href="/profile" className="font-semibold underline">Set up profile &rarr;</Link></Alert>
      )}

      {/* ── Hero: goal readiness (navy panel like the landing page) ── */}
      <section className="card-dark grid gap-8 overflow-hidden p-7 sm:p-9 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="eyebrow" style={{ color: "#f29a6b" }}>Your career goal</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{student?.careerGoal ?? "Not set yet"}</h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/70">
            {skills.length
              ? <>You&rsquo;ve mastered <b className="text-white">{mastered} of {skills.length}</b> skills this goal needs, based on {mastery?.evidenceCount ?? 0} pieces of evidence from quizzes and graded work.</>
              : student ? "Take a quiz in Learn to start measuring your skills against this goal." : "Set a career goal in your profile to see how ready you are."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/learn" className="btn-primary">Take a Skill Quiz</Link>
            <Link href="/build" className="btn rounded-xl bg-white/10 text-white hover:bg-white/15">Open CodeLab</Link>
          </div>
        </div>
        <div className="justify-self-center"><Ring pct={readiness} /></div>
      </section>

      {/* ── Stats ── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat href="/learn" label="Skills mastered" value={skills.length ? `${mastered}/${skills.length}` : "—"} sub={skills.length ? `${skills.filter((s) => s.status === "developing").length} developing` : "No data yet"} />
        <Stat href="/learn" label="Latest quiz" value={assess?.latest ? `${assess.latest.score}/${assess.latest.total}` : "—"} sub={assess ? `${assess.count} quiz${assess.count === 1 ? "" : "zes"} taken` : "No quizzes yet"} />
        <Stat href="/learn" label="Roadmap" value={roadmap ? `${stagesDone}/${roadmap.stages.length}` : "—"} sub={roadmap ? "stages completed" : "Not generated yet"} />
        <Stat href="/train" label="Courses" value={train ? String(train.enrollments.length) : "—"} sub={train ? `${train.enrollments.filter((e) => e.completed).length} completed` : "Not enrolled yet"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Focus skills */}
          <section className="card sm:p-7">
            <div className="flex items-center justify-between"><h2 className="h2">Skills to focus on</h2><Link href="/learn" className="text-sm font-semibold text-[#D9541E]">View all &rarr;</Link></div>
            <div className="mt-5 space-y-4">
              {focus.length ? focus.map((s) => (
                <div key={s.skill}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium text-[#16181d]">{s.skill}</span>
                    <span className={s.status === "gap" ? "text-[#b4232f]" : "text-[#a85a0c]"}>{s.status === "gap" ? "Gap" : "Developing"} · {Math.round(s.mean * 100)}%</span>
                  </div>
                  <div className="progress-track"><div className="progress-bar" style={{ width: `${Math.round(s.mean * 100)}%` }} /></div>
                </div>
              )) : skills.length ? <p className="text-sm text-[#0b7a39]">You&rsquo;ve mastered every skill for this goal.</p>
                : <Empty href={student ? "/learn" : "/profile"} cta={student ? "Take a quiz →" : "Complete profile →"}>Skill estimates appear once you have a goal and some quiz results.</Empty>}
            </div>
          </section>

          {/* Roadmap */}
          <section className="card sm:p-7">
            <div className="flex items-center justify-between"><h2 className="h2">Next on your roadmap</h2><Link href="/learn" className="text-sm font-semibold text-[#D9541E]">Open roadmap &rarr;</Link></div>
            {roadmap ? (
              <>
                <div className="mt-4 progress-track"><div className="progress-bar" style={{ width: `${(stagesDone / Math.max(roadmap.stages.length, 1)) * 100}%` }} /></div>
                <ol className="mt-5 space-y-3">
                  {nextStages.length ? nextStages.map((s, i) => (
                    <li key={s._id} className="flex items-center gap-4 rounded-xl bg-[#f4f5f7] p-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2c303b] font-display text-sm font-bold text-white">{stagesDone + i + 1}</span>
                      <span className="flex-1 font-medium text-[#16181d]">{s.topic}</span>
                      {s.duration && <span className="text-xs text-[#5f6573]">{s.duration}</span>}
                    </li>
                  )) : <p className="text-sm text-[#0b7a39]">All stages complete.</p>}
                </ol>
              </>
            ) : <div className="mt-4"><Empty href="/learn" cta="Generate roadmap →">No roadmap yet.</Empty></div>}
          </section>

          {/* Modules */}
          <section>
            <p className="eyebrow">Jump back in</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {MODULES.map((m) => (
                <Link key={m.href} href={m.href} className="card-hover group flex items-start gap-4 p-5">
                  <span className="text-[#16181d] group-hover:text-[#D9541E]"><Svg d={m.icon} size={28} /></span>
                  <span>
                    <span className="block font-display text-[17px] font-bold text-[#16181d]">{m.title}</span>
                    <span className="block text-[13px] text-[#5f6573]">{m.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Upcoming */}
          <section className="card">
            <h2 className="h2">Upcoming</h2>
            <div className="mt-4 space-y-3">
              {upcoming.length ? upcoming.map((u) => (
                <Link key={u.id} href={u.href} className="block rounded-xl border border-[#e3e5e9] p-4 hover:border-[#D9541E]">
                  <div className="text-xs font-semibold text-[#D9541E]">{u.when}</div>
                  <div className="mt-1 font-medium text-[#16181d]">{u.title}</div>
                  <div className="text-xs text-[#5f6573]">{u.meta}</div>
                </Link>
              )) : <Empty href="/train" cta="Browse courses →">No sessions scheduled.</Empty>}
            </div>
          </section>

          {/* Notifications */}
          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="h2">Notifications</h2>
              {!!notifs?.unread && <span className="chip bg-[#D9541E] text-white">{notifs.unread} new</span>}
            </div>
            <div className="mt-4 space-y-2">
              {notifs?.items.length ? notifs.items.slice(0, 4).map((n) => (
                <Link key={n.id} href={n.link || "#"} className={`block rounded-xl p-3 text-sm ${n.read ? "bg-[#f4f5f7]" : "bg-[#fbe9e1]"}`}>
                  <div className="font-medium text-[#16181d]">{n.title}</div>
                  <div className="text-xs text-[#5f6573]">{new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
                </Link>
              )) : <p className="text-sm text-[#5f6573]">You&rsquo;re all caught up.</p>}
            </div>
          </section>

          {/* Profile snapshot */}
          <section className="card-dark">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Profile</h2><Link href="/profile" className="text-sm font-semibold text-[#f29a6b]">Edit &rarr;</Link></div>
            {student ? (
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-white/60">College</dt><dd className="truncate text-right">{student.college}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/60">Branch</dt><dd>{student.branch} · Sem {student.semester}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/60">Skills listed</dt><dd>{student.skills.length}</dd></div>
              </dl>
            ) : <p className="mt-3 text-sm text-white/60">Not set up yet.</p>}
          </section>

          {/* System status (compact) */}
          {status && (
            <section className="card">
              <h2 className="h2">System status</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {([
                  ["Database", status.db.connected, status.db.connected ? "Connected" : status.db.configured ? "Not reachable" : "Set MONGODB_URI"],
                  ["AI", status.ai.configured, status.ai.configured ? status.ai.model ?? "Configured" : "Set AI_API_KEY, AI_MODEL, AI_BASE_URL"],
                  ["Connect link", status.connectUrlConfigured, status.connectUrlConfigured ? "Configured" : "Set NEXT_PUBLIC_CONNECT_URL"],
                ] as const).map(([l, ok, d]) => (
                  <li key={l} className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <span><span className="font-medium text-[#16181d]">{l}</span> <span className="break-all text-xs text-[#5f6573]">{d}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
