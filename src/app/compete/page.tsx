"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, PageHeader, Spinner, api, toErr, useStudent, type ApiErr } from "@/components/ui";
import { rankHackathons } from "@/lib/compete-ranking";

type Hackathon = {
  id: string; title: string; url: string; organization: string; location: string; state: string;
  dates: string; timeLeft: string; themes: string[]; prize: string; registrations: number; thumbnail: string;
};
type Live = { source: string; fetchedAt: string; total: number; hackathons: Hackathon[] };

// Map profile words → Devpost theme keywords, so interests like "AI" match "Machine Learning/AI".
const INTEREST_HINTS: Record<string, string[]> = {
  ai: ["machine learning", "ai"], ml: ["machine learning", "ai"], "machine learning": ["machine learning"],
  "data science": ["machine learning", "databases"], web: ["web"], frontend: ["web", "design"], backend: ["web", "databases", "devops"],
  "full stack": ["web"], "open source": ["open ended", "beginner"], mobile: ["mobile"], iot: ["iot"],
  blockchain: ["blockchain"], security: ["cybersecurity"], cybersecurity: ["cybersecurity"], design: ["design"],
  education: ["education"], health: ["health"], fintech: ["fintech"], game: ["gaming"], cloud: ["devops", "enterprise"],
};

function preferredThemes(words: string, available: string[]) {
  const w = words.toLowerCase();
  const keys = Object.entries(INTEREST_HINTS).filter(([k]) => new RegExp(`\\b${k}\\b`).test(w)).flatMap(([, v]) => v);
  return available.filter((t) => keys.some((k) => t.toLowerCase().includes(k)));
}

export default function CompetePage() {
  const { student } = useStudent();
  const [live, setLive] = useState<Live | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sort, setSort] = useState<"match" | "deadline">("match");

  const load = useCallback(async (search = "") => {
    setLoading(true); setErr(null);
    try { setLive(await api<Live>(`/api/compete/hackathons${search ? `?q=${encodeURIComponent(search)}` : ""}`)); }
    catch (e) { setErr(toErr(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const allThemes = useMemo(() => {
    const counts = new Map<string, number>();
    live?.hackathons.forEach((h) => h.themes.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [live]);

  // Pre-select themes matching the student's interests + career goal once data arrives.
  useEffect(() => {
    if (!student || !allThemes.length) return;
    setSelected(preferredThemes([...student.interests, student.careerGoal].join(" "), allThemes));
  }, [student, allThemes]);

  // TF-IDF cosine relevance of each hackathon to the student's interests, goal and skills.
  const ranking = useMemo(
    () => (live && student ? rankHackathons(live.hackathons, student) : null),
    [live, student]
  );

  const shown = useMemo(() => {
    let list = live?.hackathons ?? [];
    if (onlineOnly) list = list.filter((h) => /online/i.test(h.location));
    if (selected.length) list = list.filter((h) => h.themes.some((t) => selected.includes(t)));
    // Devpost already returns deadline order; a stable sort keeps it as the tie-breaker.
    if (sort === "match" && ranking) list = [...list].sort((a, b) => (ranking.get(b.id)?.relevance ?? 0) - (ranking.get(a.id)?.relevance ?? 0));
    return list;
  }, [live, selected, onlineOnly, sort, ranking]);

  const toggle = (t: string) => setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Compete"
        subtitle="Live, open and upcoming hackathons matched to your interests."
        right={live && <span className="chip bg-emerald-100 text-emerald-700">● Live from Devpost · updated {new Date(live.fetchedAt).toLocaleTimeString()}</span>}
      />

      <div className="card mb-6 space-y-4">
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q.trim()); }}>
          <input className="input max-w-md" placeholder="Search hackathons (e.g. AI, education, fintech)…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-primary" disabled={loading}>{loading && <Spinner />} Search</button>
          <select className="input ml-auto w-auto" value={sort} onChange={(e) => setSort(e.target.value as "match" | "deadline")} aria-label="Sort hackathons">
            <option value="match">Sort: best match for you</option>
            <option value="deadline">Sort: deadline</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} /> Online only
          </label>
        </form>
        {allThemes.length > 0 && (
          <div>
            <div className="label">Filter by theme {student && "(pre-selected from your profile interests)"}</div>
            <div className="flex flex-wrap gap-2">
              {allThemes.map((t) => (
                <button key={t} onClick={() => toggle(t)} className={`chip border px-3 py-1 ${selected.includes(t) ? "border-[#D9541E] bg-[#D9541E] text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"}`}>{t}</button>
              ))}
              {selected.length > 0 && <button className="text-xs text-zinc-500 hover:underline" onClick={() => setSelected([])}>Show all</button>}
            </div>
          </div>
        )}
      </div>

      {err && <Alert kind="error">{err.error}. Check your internet connection and refresh.</Alert>}
      {loading && !live && <div className="text-sm text-zinc-500"><Spinner /> Loading live hackathons…</div>}

      {live && (
        <>
          <p className="mb-3 text-sm text-zinc-500">
            Showing {shown.length} of {live.hackathons.length} loaded ({live.total} open/upcoming on Devpost).
            {sort === "match" && ranking && " Ranked by TF-IDF similarity between each event's themes and your interests, goal and skills."}
          </p>
          {shown.length === 0 && <Alert kind="info">No hackathons match these filters. Try clearing themes or a different search.</Alert>}
          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((h) => (
              <a key={h.id} href={h.url} target="_blank" rel="noopener noreferrer" className="card flex gap-4 transition-colors hover:border-zinc-300">
                {h.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-zinc-100 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-zinc-900">{h.title}</h3>
                    {ranking && (ranking.get(h.id)?.relevance ?? 0) > 0 && (
                      <span className="chip shrink-0 bg-zinc-100 text-zinc-700" title={`Matched on: ${ranking.get(h.id)!.matchedTerms.join(", ")}`}>
                        {ranking.get(h.id)!.relevance}% match
                      </span>
                    )}
                    {h.state && <span className={`chip shrink-0 ${h.state === "open" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>{h.state}</span>}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {[h.organization, h.location, h.dates].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-1 text-sm">
                    {h.prize && <span className="font-medium text-zinc-700">{h.prize}</span>}
                    {h.timeLeft && <span className="ml-2 text-amber-700">{h.timeLeft}</span>}
                    {h.registrations > 0 && <span className="ml-2 text-zinc-500">{h.registrations.toLocaleString()} registrations</span>}
                  </div>
                  {ranking && (ranking.get(h.id)?.matchedTerms.length ?? 0) > 0 && (
                    <div className="mt-1 text-xs text-zinc-600">Why: matches your {ranking.get(h.id)!.matchedTerms.join(", ")}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {h.themes.map((t) => <span key={t} className={`chip ${selected.includes(t) ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-600"}`}>{t}</span>)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
