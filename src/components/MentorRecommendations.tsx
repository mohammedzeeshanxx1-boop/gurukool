"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner, api } from "./ui";
import { ProfileBadge, type Mentor, type UpcomingSlot } from "./connect";

type Rec = { mentor: Mentor; score: number; reasons: string[]; nextSlots: UpcomingSlot[] };

/** LEARN → CONNECT bridge. `refreshKey` changes when the student's gaps/quiz/roadmap change. */
export default function MentorRecommendations({ refreshKey }: { refreshKey: string }) {
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setRecs(null);
    api<{ recommendations: Rec[]; reason?: string }>("/api/mentors/recommendations?limit=2")
      .then((d) => { setRecs(d.recommendations); setNote(d.reason ?? null); setFailed(false); })
      .catch(() => { setRecs([]); setFailed(true); });
  }, [refreshKey]);

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="h2">Learn from an Industry Expert</h2>
          <p className="text-sm text-slate-500">Mentors matched to your weak topics, roadmap and skill gaps (rule-based, explainable).</p>
        </div>
        <Link href="/connect" className="btn-primary">Find an Industry Mentor →</Link>
      </div>
      {recs === null ? <div className="text-sm text-slate-500"><Spinner /> Finding mentors…</div>
        : recs.length === 0 ? (
          <p className="text-sm text-slate-500">{failed ? "Mentor recommendations are unavailable right now." : note ?? "No mentor matches yet. Analyze your skills, take the assessment or generate a roadmap to get matches."}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recs.map(({ mentor: m, reasons, nextSlots }) => (
              <div key={m.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-semibold">{m.name}</div><div className="text-sm text-slate-500">{m.designation}</div></div>
                  <ProfileBadge isDemo={m.isDemo} />
                </div>
                <p className="mt-2 text-sm text-blue-900">{reasons[0]}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{m.expertise.slice(0, 4).map((e) => <span key={e} className="chip bg-slate-100 text-slate-700">{e}</span>)}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {nextSlots.length ? <>Next slots: {nextSlots.slice(0, 2).map((s) => s.label).join(" · ")}</> : "No open weekend slots in the next 4 weeks"}
                </div>
                <Link href={`/connect/mentors/${m.id}`} className="btn-ghost mt-3 w-full">View Mentor</Link>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}
