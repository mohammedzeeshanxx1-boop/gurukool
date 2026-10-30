"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner, api } from "./ui";
import { DemoContentBadge } from "./train";

type Rec = {
  courseId: string; matchScore: number; components: { weakSkills: number; roadmap: number; careerGoal: number }; basis: "evidence" | "interest";
  relevantSkills: { studentTopic: string; courseTerm: string; source: string }[]; explanation: string; enrollUrl: string; enrolled: boolean;
  course: { id: string; title: string; difficulty: string; durationWeeks: number; moduleCount: number; isDemo: boolean };
};

/** LEARN → TRAIN: training programs matched to the student's existing skill-gap / assessment / roadmap outputs. */
export default function RecommendedTraining({ refreshKey }: { refreshKey: string }) {
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setRecs(null);
    api<{ recommendations: Rec[]; reason?: string }>("/api/train/recommendations")
      .then((d) => { setRecs(d.recommendations); setNote(d.reason ?? null); })
      .catch(() => { setRecs([]); setNote("Training recommendations are unavailable right now."); });
  }, [refreshKey]);

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="h2">Recommended Training</h2>
          <p className="text-sm text-slate-500">Structured programs matched to your skill gaps: weak skills 50% · roadmap 30% · career goal 20%.</p>
        </div>
        <Link href="/train" className="btn-ghost">Open GURUKOOL TRAIN →</Link>
      </div>
      {recs === null ? <div className="text-sm text-slate-500"><Spinner /> Matching training…</div>
        : recs.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{note ?? "No training program matches your current gaps yet. Browse the catalog in TRAIN."}</p>
        : (
          <div className="space-y-3">
            {recs.map((r) => (
              <div key={r.courseId} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{r.course.title}</b>{r.course.isDemo && <DemoContentBadge />}
                    <span className={`chip ${r.basis === "evidence" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{r.basis === "evidence" ? "Evidence-based" : "Interest-based"}</span>
                  </div>
                  <p className="text-xs text-slate-500">{r.course.difficulty} · {r.course.moduleCount} modules · {r.course.durationWeeks} weeks</p>
                  <p className="text-sm text-slate-700">{r.explanation}</p>
                  <div className="flex flex-wrap gap-1.5">{[...new Set(r.relevantSkills.map((s) => s.courseTerm))].slice(0, 5).map((s) => <span key={s} className="chip bg-blue-50 text-blue-700">{s}</span>)}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-lg font-bold text-blue-700">{r.matchScore}% match</span>
                  <Link href={r.enrollUrl} className="btn-primary">{r.enrolled ? "Continue training" : "View & enroll"}</Link>
                </div>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}
