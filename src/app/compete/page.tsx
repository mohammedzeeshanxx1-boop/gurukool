"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, PageHeader, useStudent } from "@/components/ui";

// Illustrative sample data for the demo — NOT live events. No registration links are provided.
const DEMO_EVENTS = [
  { title: "Campus Web Sprint", type: "Hackathon", tags: ["Web Development", "Frontend", "Full Stack"], mode: "Online", duration: "24 hours", level: "Beginner" },
  { title: "AI for Bharat Challenge", type: "Hackathon", tags: ["AI", "Machine Learning", "Data Science"], mode: "Hybrid", duration: "36 hours", level: "Intermediate" },
  { title: "Backend Blitz API Contest", type: "Competition", tags: ["Backend", "Full Stack", "Web Development"], mode: "Online", duration: "3 hours", level: "Intermediate" },
  { title: "DSA Weekly Coding Round", type: "Coding Contest", tags: ["DSA", "Competitive Programming"], mode: "Online", duration: "2 hours", level: "All levels" },
  { title: "Open Source Contribution Month", type: "Program", tags: ["Open Source", "Git", "Web Development"], mode: "Online", duration: "4 weeks", level: "Beginner" },
  { title: "Smart India-style Problem Solving Sprint", type: "Hackathon", tags: ["AI", "IoT", "Full Stack"], mode: "Offline", duration: "48 hours", level: "Advanced" },
  { title: "UI/UX Design Jam", type: "Competition", tags: ["Frontend", "Design"], mode: "Online", duration: "8 hours", level: "Beginner" },
  { title: "ML Model Kaggle-style Leaderboard", type: "Competition", tags: ["Machine Learning", "Data Science", "AI"], mode: "Online", duration: "2 weeks", level: "Intermediate" },
];
const ALL_TAGS = [...new Set(DEMO_EVENTS.flatMap((e) => e.tags))].sort();

export default function CompetePage() {
  const { student } = useStudent();
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (!student) return;
    const words = [...student.interests, student.careerGoal].join(" ").toLowerCase();
    const match = ALL_TAGS.filter((t) => words.includes(t.toLowerCase()) || (t === "Full Stack" && words.includes("full stack")) || (t === "AI" && /\bai\b|ml/.test(words)));
    setSelected(match);
  }, [student]);

  const events = useMemo(
    () => (selected.length ? DEMO_EVENTS.filter((e) => e.tags.some((t) => selected.includes(t))) : DEMO_EVENTS),
    [selected]
  );
  const toggle = (t: string) => setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Compete" subtitle="Hackathons and competitions matched to your interests." />
      <Alert kind="warn"><b>Demo data:</b> these are sample listings for illustration only, not live events. Live event integration is planned for a later version.</Alert>
      <div className="card my-6">
        <div className="label">Filter by interest {student && "(pre-selected from your profile)"}</div>
        <div className="flex flex-wrap gap-2">
          {ALL_TAGS.map((t) => (
            <button key={t} onClick={() => toggle(t)} className={`chip border px-3 py-1 ${selected.includes(t) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"}`}>{t}</button>
          ))}
          {selected.length > 0 && <button className="text-xs text-slate-500 hover:underline" onClick={() => setSelected([])}>Clear</button>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((e) => (
          <div key={e.title} className="card">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="font-semibold">{e.title}</h3>
              <span className="chip bg-amber-100 text-amber-700">DEMO</span>
            </div>
            <div className="mb-3 text-sm text-slate-500">{e.type} · {e.mode} · {e.duration} · {e.level}</div>
            <div className="flex flex-wrap gap-1.5">{e.tags.map((t) => <span key={t} className={`chip ${selected.includes(t) ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{t}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
