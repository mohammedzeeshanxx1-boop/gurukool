"use client";
import { useEffect, useState } from "react";
import { PageHeader, api, useStudent } from "@/components/ui";
import RecruiterPanel from "@/components/RecruiterPanel";

type R = { name: string; email: string; github: string; linkedin: string; education: string; skills: string; projects: string };
const EMPTY: R = { name: "", email: "", github: "", linkedin: "", education: "", skills: "", projects: "" };

export default function GrowPage() {
  const { student } = useStudent();
  const [r, setR] = useState<R>(EMPTY);
  // Training programs the student chose to show on their resume (GURUKOOL TRAIN, opt-in per course).
  const [training, setTraining] = useState<{ title: string; trainer: string; engagementPct: number; demonstratedPct: number | null; completed: boolean }[]>([]);
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
  }, [student]);
  const set = (k: keyof R) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setR({ ...r, [k]: e.target.value });
  const projects = r.projects.split("\n").map((s) => s.trim()).filter(Boolean);
  const links = [r.email, r.github, r.linkedin].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="no-print">
        <PageHeader title="Grow" subtitle="Build an ATS-friendly resume, pre-filled from your profile." right={<button className="btn-primary" onClick={() => window.print()}>⤓ Export PDF</button>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card no-print space-y-3">
          <h2 className="h2">Resume details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={r.name} onChange={set("name")} /></div>
            <div><label className="label">Email</label><input className="input" value={r.email} onChange={set("email")} /></div>
            <div><label className="label">GitHub</label><input className="input" placeholder="github.com/username" value={r.github} onChange={set("github")} /></div>
            <div><label className="label">LinkedIn</label><input className="input" placeholder="linkedin.com/in/username" value={r.linkedin} onChange={set("linkedin")} /></div>
          </div>
          <div><label className="label">Education</label><textarea className="input" rows={2} value={r.education} onChange={set("education")} /></div>
          <div><label className="label">Skills (comma separated)</label><textarea className="input" rows={2} value={r.skills} onChange={set("skills")} /></div>
          <div><label className="label">Projects (one per line: Title — what you built &amp; tech used)</label>
            <textarea className="input" rows={5} placeholder={"GURUKOOL — AI learning platform using Next.js, MongoDB and LLM APIs"} value={r.projects} onChange={set("projects")} /></div>
          <p className="text-xs text-slate-500">Tip: in the print dialog choose “Save as PDF” and turn off headers/footers.</p>
        </div>

        {/* ATS-friendly: single column, plain text, standard headings, no tables/images */}
        <div className="card print-area bg-white font-serif text-[13px] leading-relaxed text-black">
          <h1 className="text-center text-2xl font-bold tracking-wide">{r.name || "Your Name"}</h1>
          {links.length > 0 && <p className="text-center text-xs">{links.join("  |  ")}</p>}
          {[
            ["EDUCATION", r.education && <p>{r.education}</p>],
            ["TECHNICAL SKILLS", r.skills && <p>{r.skills}</p>],
            ["PROJECTS", projects.length > 0 && <ul className="list-disc pl-5">{projects.map((p, i) => <li key={i}>{p}</li>)}</ul>],
            ["TRAINING", training.length > 0 && <ul className="list-disc pl-5">{training.map((t) => (
              <li key={t.title}>{t.title}, GURUKOOL TRAIN (trainer: {t.trainer}): {t.completed ? "completed" : `${t.engagementPct}% of lessons completed`}{t.demonstratedPct !== null ? `; trainer-evaluated assignments ${t.demonstratedPct}%` : ""}</li>
            ))}</ul>],
          ].map(([h, body]) => body && (
            <section key={h as string} className="mt-4">
              <h2 className="border-b border-black text-sm font-bold tracking-wider">{h}</h2>
              <div className="mt-1">{body}</div>
            </section>
          ))}
        </div>
      </div>
      <RecruiterPanel resume={{ github: r.github, linkedin: r.linkedin, projects: r.projects }} />
    </div>
  );
}
