"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner, api } from "./ui";
import { ProfileBadge, type Mentor, type UpcomingSlot } from "./connect";

type Components = { weakness: number; roadmap: number; careerGoal: number; availability: number };
export type MatchRec = {
  mentor: Mentor; matchScore: number; components: Components; basis: "evidence" | "interest";
  matchingSkills: { studentTopic: string; mentorTerm: string; source: string }[]; explanation: string; availableSlots: UpcomingSlot[];
};

const PARTS: [keyof Components, string, number][] = [
  ["weakness", "Weak skills", 40], ["roadmap", "Roadmap", 30], ["careerGoal", "Career goal", 20], ["availability", "Weekend slots", 10],
];

/** Shows the Mentor Match Engine's score breakdown so judges can see how the match was computed. */
export function MatchBreakdown({ r }: { r: MatchRec }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">Mentor Match Engine</span>
        <span className="font-bold text-blue-700">{r.matchScore}% match</span>
      </div>
      {PARTS.map(([k, label, w]) => (
        <div key={k} className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="w-24 shrink-0">{label} ({w}%)</span>
          <div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.round(r.components[k] * 100)}%` }} /></div>
          <span className="w-8 text-right">{Math.round(r.components[k] * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/** LEARN → CONNECT bridge. Consumes existing skill-gap / assessment / roadmap outputs via the match engine. */
export default function MentorRecommendations({ refreshKey }: { refreshKey: string }) {
  const [recs, setRecs] = useState<MatchRec[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setRecs(null);
    api<{ recommendations: MatchRec[]; reason?: string }>("/api/mentors/recommendations?limit=2")
      .then((d) => { setRecs(d.recommendations); setNote(d.reason ?? null); setFailed(false); })
      .catch(() => { setRecs([]); setFailed(true); });
  }, [refreshKey]);

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="h2">Get Help from an Industry Expert</h2>
          <p className="text-sm text-slate-500">Matched by the GURUKOOL Mentor Match Engine from your skill gaps, assessment and roadmap. Deterministic, no AI call.</p>
        </div>
        <Link href="/connect" className="btn-ghost">Browse all mentors →</Link>
      </div>
      {recs === null ? <div className="text-sm text-slate-500"><Spinner /> Matching mentors…</div>
        : recs.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            {failed ? "Mentor matching is unavailable right now. Check the MongoDB connection."
              : note ?? "No mentor matches your current gaps yet. Analyze your skills or take the assessment, or browse all mentors."}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recs.map((r) => {
              const m = r.mentor;
              const expertise = [...new Set(r.matchingSkills.map((x) => x.mentorTerm))];
              const next = r.availableSlots[0];
              return (
                <div key={m.id} className="flex flex-col rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-semibold">{m.name}</div><div className="text-sm text-slate-500">{m.designation} · {m.organization}</div></div>
                    <ProfileBadge isDemo={m.isDemo} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`chip ${r.basis === "evidence" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                      {r.basis === "evidence" ? "Evidence-based (assessment)" : "Interest-based"}
                    </span>
                    {expertise.slice(0, 4).map((e) => <span key={e} className="chip bg-blue-50 text-blue-700">{e}</span>)}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{r.explanation}</p>
                  <div className="mt-3"><MatchBreakdown r={r} /></div>
                  <p className="mt-3 text-xs text-slate-500">{next ? <>Next available: <b>{next.label}</b></> : "No open weekend slots in the next 4 weeks"}</p>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/connect/mentors/${m.id}`} className="btn-ghost flex-1">View Mentor</Link>
                    {next && <Link href={`/connect/mentors/${m.id}#book`} className="btn-primary flex-1">Book Session</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </section>
  );
}
