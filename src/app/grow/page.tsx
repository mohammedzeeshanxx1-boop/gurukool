"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Spinner, Alert, ErrorAlert, api, useStudent, toErr, type ApiErr } from "@/components/ui";
import RecruiterPanel from "@/components/RecruiterPanel";
import { CAREER_GOALS, isCareerGoal, type CareerGoal } from "@/lib/careers";
import { ATS_WEIGHTS, analyzeResume } from "@/lib/ats";

// ── Types ────────────────────────────────────────────────────────────────────
type R = { name: string; email: string; github: string; linkedin: string; education: string; skills: string; projects: string };
const EMPTY: R = { name: "", email: "", github: "", linkedin: "", education: "", skills: "", projects: "" };

type Job = {
  id: string; title: string; company: string; location: string;
  url: string; salary: string; postedAt: string; tags: string[]; remote: boolean;
};

const TABS = [
  { id: "resume", label: "Resume Studio" },
  { id: "jobs", label: "Job Board" },
] as const;

// ── Resume Studio ─────────────────────────────────────────────────────────────
function ResumeStudio() {
  const { student } = useStudent();
  const [r, setR] = useState<R>(EMPTY);
  const [training, setTraining] = useState<{ title: string; trainer: string; engagementPct: number; demonstratedPct: number | null; completed: boolean }[]>([]);
  const [target, setTarget] = useState<CareerGoal>("Backend Developer");
  const [polishing, setPolishing] = useState(false);
  const [polishErr, setPolishErr] = useState("");
  const [atsTab, setAtsTab] = useState<"role" | "jd">("role");
  const [jdText, setJdText] = useState("");
  const [jdScore, setJdScore] = useState<number | null>(null);
  const [jdChecking, setJdChecking] = useState(false);

  useEffect(() => {
    api<{ enrollments: { title: string; trainer: string; engagementPct: number; demonstratedPct: number | null; completed: boolean; showInPortfolio: boolean }[] }>("/api/train/me")
      .then((d) => setTraining(d.enrollments.filter((e) => e.showInPortfolio)))
      .catch(() => setTraining([]));
  }, []);

  useEffect(() => {
    if (!student) return;
    setR((cur) => ({
      ...cur,
      name: cur.name || student.name,
      email: cur.email || student.email,
      education: cur.education || `B.E./B.Tech in ${student.branch}, ${student.college} — Semester ${student.semester} (pursuing)`,
      skills: cur.skills || student.skills.join(", "),
    }));
    if (isCareerGoal(student.careerGoal)) setTarget(student.careerGoal as CareerGoal);
  }, [student]);

  const ats = useMemo(() => analyzeResume(r, target), [r, target]);
  const set = (k: keyof R) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setR({ ...r, [k]: e.target.value });
  const projects = r.projects.split("\n").map((s) => s.trim()).filter(Boolean);
  const links = [r.email, r.github, r.linkedin].filter(Boolean);

  async function polishProjects() {
    if (!r.projects.trim()) return;
    setPolishing(true); setPolishErr("");
    try {
      const lines = r.projects.split("\n").filter((l) => l.trim());
      const polished = await Promise.all(
        lines.map((line) =>
          api<{ polished: string }>("/api/grow/polish-bullet", {
            method: "POST",
            body: JSON.stringify({ text: line, role: target }),
          }).then((d) => d.polished).catch(() => line)
        )
      );
      setR((prev) => ({ ...prev, projects: polished.join("\n") }));
    } catch { setPolishErr("AI polish failed. Check AI_API_KEY in .env.local."); }
    finally { setPolishing(false); }
  }

  async function checkJd() {
    if (!jdText.trim()) return;
    setJdChecking(true);
    // Simple keyword overlap score: count how many words from resume appear in JD
    const resumeText = `${r.skills} ${r.projects} ${r.education}`.toLowerCase();
    const jdWords = jdText.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
    const unique = [...new Set(jdWords)];
    const matches = unique.filter((w) => resumeText.includes(w));
    const score = Math.min(100, Math.round((matches.length / Math.max(unique.length, 1)) * 200));
    setTimeout(() => { setJdScore(score); setJdChecking(false); }, 600);
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Resume Studio</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Build an ATS-friendly resume pre-filled from your profile. Use AI to polish your project descriptions.</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>Export PDF</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="card no-print space-y-3">
          <h3 className="font-semibold text-zinc-900">Your details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={r.name} onChange={set("name")} /></div>
            <div><label className="label">Email</label><input className="input" value={r.email} onChange={set("email")} /></div>
            <div><label className="label">GitHub</label><input className="input" placeholder="github.com/username" value={r.github} onChange={set("github")} /></div>
            <div><label className="label">LinkedIn</label><input className="input" placeholder="linkedin.com/in/username" value={r.linkedin} onChange={set("linkedin")} /></div>
          </div>
          <div><label className="label">Education</label><textarea className="input" rows={2} value={r.education} onChange={set("education")} /></div>
          <div><label className="label">Skills (comma separated)</label><textarea className="input" rows={2} value={r.skills} onChange={set("skills")} /></div>
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="label mb-0">Projects (one per line)</label>
              <button
                onClick={polishProjects}
                disabled={polishing || !r.projects.trim()}
                className="btn-ghost text-xs py-1 px-2"
              >{polishing ? <><Spinner /> Polishing…</> : "AI Polish"}</button>
            </div>
            <textarea
              className="input"
              rows={5}
              placeholder={"GURUKOOL — AI learning platform using Next.js, MongoDB and LLM APIs"}
              value={r.projects}
              onChange={set("projects")}
            />
            {polishErr && <p className="text-xs text-red-600 mt-1">{polishErr}</p>}
            <p className="text-xs text-zinc-400 mt-1">Tip: write rough notes, then hit AI Polish to get strong action-verb bullets.</p>
          </div>
          <p className="text-xs text-zinc-400">In the print dialog choose &ldquo;Save as PDF&rdquo; and turn off headers/footers.</p>
        </div>

        {/* Live preview */}
        <div className="card print-area bg-white font-serif text-[13px] leading-relaxed text-black">
          <h1 className="text-center text-2xl font-semibold">{r.name || "Your Name"}</h1>
          {links.length > 0 && <p className="text-center text-xs">{links.join("  |  ")}</p>}
          {[
            ["EDUCATION", r.education && <p>{r.education}</p>],
            ["TECHNICAL SKILLS", r.skills && <p>{r.skills}</p>],
            ["PROJECTS", projects.length > 0 && <ul className="list-disc pl-5">{projects.map((p, i) => <li key={i}>{p}</li>)}</ul>],
            ["TRAINING", training.length > 0 && <ul className="list-disc pl-5">{training.map((t) => (
              <li key={t.title}>{t.title}, GURUKOOL TRAIN (trainer: {t.trainer}): {t.completed ? "completed" : `${t.engagementPct}% completed`}{t.demonstratedPct !== null ? `; ${t.demonstratedPct}% demonstrated` : ""}</li>
            ))}</ul>],
          ].map(([h, body]) => body && (
            <section key={h as string} className="mt-4">
              <h2 className="border-b border-black text-sm font-bold">{h}</h2>
              <div className="mt-1">{body}</div>
            </section>
          ))}
        </div>
      </div>

      {/* ATS Check */}
      <section className="card no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-900">ATS Check</h3>
            <p className="text-xs text-zinc-500">Score your resume against a role or paste a real job description.</p>
          </div>
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-sm">
            <button onClick={() => setAtsTab("role")} className={`px-3 py-1.5 ${atsTab === "role" ? "bg-[#D9541E] text-white" : "text-zinc-600 hover:bg-zinc-50"}`}>By Role</button>
            <button onClick={() => setAtsTab("jd")} className={`px-3 py-1.5 ${atsTab === "jd" ? "bg-[#D9541E] text-white" : "text-zinc-600 hover:bg-zinc-50"}`}>Paste JD</button>
          </div>
        </div>

        {atsTab === "role" ? (
          <>
            <div className="flex items-center gap-4">
              <select className="input w-auto" value={target} onChange={(e) => setTarget(e.target.value as CareerGoal)} aria-label="Target role">
                {CAREER_GOALS.map((g) => <option key={g}>{g}</option>)}
              </select>
              <span className={`text-4xl font-semibold ${ats.score >= 75 ? "text-emerald-600" : ats.score >= 50 ? "text-amber-600" : "text-red-600"}`}>{ats.score}<span className="text-base font-normal text-zinc-400">/100</span></span>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {(Object.keys(ATS_WEIGHTS) as (keyof typeof ATS_WEIGHTS)[]).map((k) => (
                <div key={k} className="text-sm">
                  <div className="mb-1 flex justify-between"><span className="capitalize text-zinc-600">{k}</span><span className="text-zinc-400">{Math.round(ATS_WEIGHTS[k] * 100)}%</span></div>
                  <div className="h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-zinc-500 transition-colors" style={{ width: `${ats.components[k] * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ats.keywords.map((k) => (
                <span key={k.skill} className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.status === "demonstrated" ? "bg-emerald-100 text-emerald-700" : k.status === "listed" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-400 line-through"}`}>
                  {k.skill}
                </span>
              ))}
            </div>
            <p className="text-xs text-zinc-400">🟢 Used in project · 🟡 Only listed · Strikethrough: missing</p>
            {ats.suggestions.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">{ats.suggestions.map((x) => <li key={x}>{x}</li>)}</ul>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <textarea
              className="input"
              rows={6}
              placeholder="Paste the job description here…"
              value={jdText}
              onChange={(e) => { setJdText(e.target.value); setJdScore(null); }}
            />
            <div className="flex items-center gap-4">
              <button onClick={checkJd} disabled={jdChecking || !jdText.trim()} className="btn-primary">
                {jdChecking ? <><Spinner /> Checking…</> : "Check match"}
              </button>
              {jdScore !== null && (
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-semibold ${jdScore >= 60 ? "text-emerald-600" : jdScore >= 40 ? "text-amber-600" : "text-red-600"}`}>{jdScore}<span className="text-sm font-normal text-zinc-400">/100</span></span>
                  <span className="text-sm text-zinc-500">{jdScore >= 60 ? "Good match" : jdScore >= 40 ? "Partial match — add more keywords" : "Low match — update skills & projects"}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-400">Scores keyword overlap between your resume and the JD. Add missing skills to your Skills field and rebuild.</p>
          </div>
        )}
      </section>

      <RecruiterPanel resume={{ github: r.github, linkedin: r.linkedin, projects: r.projects }} />
    </div>
  );
}

// ── Job Board ─────────────────────────────────────────────────────────────────
function JobBoard() {
  const { student } = useStudent();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback((query: string, loc: string, rem: boolean) => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (query) qs.set("q", query);
    if (loc) qs.set("location", loc);
    if (rem) qs.set("remote", "true");
    api<{ jobs: Job[] }>(`/api/jobs?${qs}`)
      .then((d) => { setJobs(d.jobs); setErr(null); })
      .catch((e) => setErr(toErr(e)))
      .finally(() => setLoading(false));
  }, []);

  // Auto-load with student's career goal on first load
  useEffect(() => {
    if (student) {
      const defaultQ = student.careerGoal || "software engineer";
      setQ(defaultQ);
      load(defaultQ, "", false);
    } else {
      load("", "", false);
    }
  }, [student, load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(q, location, remote);
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Job Board</h2>
        <p className="mt-0.5 text-sm text-zinc-500">Real job listings filtered for your profile. Click to apply directly on the company site.</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="card flex flex-wrap gap-3">
        <input
          className="input flex-1 min-w-[180px]"
          placeholder="Role (e.g. React Developer, Backend Engineer)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input w-40"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
          <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-zinc-600" />
          Remote only
        </label>
        <button type="submit" className="btn-primary">Search</button>
      </form>

      <ErrorAlert err={err} />

      {jobs === null || loading ? (
        <div className="text-sm text-zinc-500"><Spinner /> {loading ? "Searching jobs…" : "Loading…"}</div>
      ) : jobs.length === 0 ? (
        <Alert kind="info">No jobs found. Try a different search term or uncheck &ldquo;Remote only&rdquo;.</Alert>
      ) : (
        <>
          <p className="text-sm text-zinc-500">{jobs.length} jobs found</p>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {jobs.map((j) => (
              <div key={j.id} className="flex flex-wrap items-start gap-4 p-4 hover:bg-zinc-50 transition-colors">
                {/* Company avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-xs font-bold text-zinc-700">
                  {j.company.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900">{j.title}</span>
                    {j.remote && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">Remote</span>}
                    {j.salary && <span className="text-xs text-zinc-500">{j.salary}</span>}
                  </div>
                  <p className="text-sm text-zinc-500">{j.company} · {j.location}</p>
                  {j.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {j.tags.map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{t}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {j.postedAt && <span className="text-xs text-zinc-400">{formatDate(j.postedAt)}</span>}
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-xs"
                  >Apply →</a>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-400">Jobs sourced from Remotive and Adzuna. Clicking Apply opens the company&apos;s own site.</p>
        </>
      )}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function GrowInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === sp.get("tab"))?.id ?? "resume") as (typeof TABS)[number]["id"];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="no-print">
        <PageHeader title="Grow" subtitle="Build your resume, check your ATS score, and find real jobs — all in one place." />
      </div>

      <div role="tablist" className="no-print mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => router.replace(`/grow?tab=${t.id}`, { scroll: false })}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "resume" && <ResumeStudio />}
      {tab === "jobs" && <JobBoard />}
    </div>
  );
}

export default function GrowPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500"><Spinner /> Loading…</div>}>
      <GrowInner />
    </Suspense>
  );
}
