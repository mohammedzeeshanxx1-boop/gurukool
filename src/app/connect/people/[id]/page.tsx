"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ErrorAlert, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { Avatar, ConnectionAction, I, Icon, type ConnStatus } from "@/components/peers";

type Profile = {
  profile: {
    id: string; name: string; headline: string; about: string; college: string; branch: string; semester: number;
    careerGoal: string; skills: string[]; interests: string[]; projects: string[];
    links: { github: string; linkedin: string; portfolio: string }; joinedAt: string | null;
  };
  isMe: boolean;
  connection: { status: ConnStatus; id: string | null; message: string };
  connectionsCount: number;
  mutual: { count: number; people: { id: string; name: string }[] };
  match: { score: number; reasons: string[] };
  activity: null | {
    roadmap: { goal: string; done: number; total: number; current: string | null } | null;
    quizzesTaken: number;
    courses: string[];
  };
};

const href = (id: string) => `/connect/people/${encodeURIComponent(id)}`;
const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card sm:p-7">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="h2">{title}</h2>{right}</div>
      {children}
    </section>
  );
}

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Profile | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const load = useCallback(() => {
    api<Profile>(`/api/peers/${encodeURIComponent(decodeURIComponent(id))}`).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(toErr(e)));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ErrorAlert err={err} />
      <Link href="/connect" className="btn-ghost">&larr; Back to Connect</Link>
    </div>
  );
  if (!d) return <div className="text-sm text-[#5f6573]"><Spinner /> Loading profile…</div>;

  const p = d.profile;
  const first = p.name.split(" ")[0];
  const connected = d.connection.status === "connected" || d.isMe;
  const links = ([["github", "GitHub", I.github], ["linkedin", "LinkedIn", I.linkedin], ["portfolio", "Portfolio", I.link]] as const).filter(([k]) => p.links[k]);
  const sharedSkill = d.match.reasons.find((r) => r.startsWith("Shared skills"))?.replace("Shared skills: ", "").split(",")[0]?.trim();

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/connect" className="mb-5 inline-flex items-center gap-1.5 font-display text-[15px] font-semibold text-[#5f6573] hover:text-[#16181d]">&larr; Connect</Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* ── Header card ── */}
          <section className="card overflow-hidden p-0">
            <div className="h-36 bg-[#2c303b] sm:h-44" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1.2px, transparent 1.2px), linear-gradient(120deg, #2c303b 0%, #2c303b 55%, #D9541E 140%)", backgroundSize: "18px 18px, 100% 100%" }} />
            <div className="px-6 pb-7 sm:px-8">
              <div className="-mt-14 flex flex-wrap items-end justify-between gap-4">
                <Avatar id={p.id} name={p.name} size={112} ring />
                <div className="flex flex-wrap gap-2 pb-1">
                  {d.isMe
                    ? <Link href="/profile" className="btn-dark">Edit Profile</Link>
                    : <ConnectionAction peer={p} conn={d.connection} onChanged={load} suggestedTopic={sharedSkill} />}
                </div>
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#16181d] sm:text-4xl">{p.name}</h1>
              {p.headline && <p className="mt-1 text-lg text-[#3d4250]">{p.headline}</p>}
              <p className="mt-2 text-[15px] text-[#5f6573]">{p.college} · {p.branch} · Semester {p.semester}</p>
              <p className="mt-2 text-[15px]">
                <span className="font-semibold text-[#D9541E]">{d.connectionsCount} connection{d.connectionsCount === 1 ? "" : "s"}</span>
                {!d.isMe && d.mutual.count > 0 && <span className="text-[#5f6573]"> · {d.mutual.count} mutual</span>}
              </p>
              {d.connection.status === "received" && (
                <div className="mt-5 rounded-2xl border border-[#f3c9b6] bg-[#fbe9e1] p-4 text-[15px] text-[#3d4250]">
                  <b className="text-[#16181d]">{first} wants to connect with you.</b>
                  {d.connection.message && <p className="mt-1 italic">&ldquo;{d.connection.message}&rdquo;</p>}
                </div>
              )}
              {d.connection.status === "sent" && <p className="mt-4 text-sm text-[#5f6573]">Invitation sent. You can request sessions once {first} accepts.</p>}
            </div>
          </section>

          {p.about && (
            <Section title="About"><p className="whitespace-pre-line text-[15px] leading-relaxed text-[#3d4250]">{p.about}</p></Section>
          )}

          {/* ── Learning on UDAAN (connections only) ── */}
          <Section title="Learning on UDAAN" right={!connected ? <span className="chip bg-[#f0f1f3] text-[#5f6573]">Connections only</span> : null}>
            <div className="flex items-center gap-4 rounded-2xl bg-[#f4f5f7] p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2c303b] text-white"><Icon d={I.book} size={20} /></span>
              <div><div className="text-[13px] text-[#5f6573]">Career goal</div><div className="font-display text-lg font-bold text-[#16181d]">{p.careerGoal}</div></div>
            </div>
            {connected && d.activity ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#e3e5e9] p-4">
                  <div className="text-[13px] text-[#5f6573]">Roadmap</div>
                  <div className="mt-1 font-display text-2xl font-bold text-[#16181d]">{d.activity.roadmap ? `${d.activity.roadmap.done}/${d.activity.roadmap.total}` : "—"}</div>
                  {d.activity.roadmap && <div className="mt-2 progress-track"><div className="progress-bar" style={{ width: `${(d.activity.roadmap.done / Math.max(d.activity.roadmap.total, 1)) * 100}%` }} /></div>}
                  <div className="mt-2 text-xs text-[#5f6573]">{d.activity.roadmap?.current ? `Now: ${d.activity.roadmap.current}` : d.activity.roadmap ? "All stages done" : "No roadmap yet"}</div>
                </div>
                <div className="rounded-2xl border border-[#e3e5e9] p-4">
                  <div className="text-[13px] text-[#5f6573]">Skill quizzes taken</div>
                  <div className="mt-1 font-display text-2xl font-bold text-[#16181d]">{d.activity.quizzesTaken}</div>
                </div>
                <div className="rounded-2xl border border-[#e3e5e9] p-4">
                  <div className="text-[13px] text-[#5f6573]">Upskill courses</div>
                  <div className="mt-1 font-display text-2xl font-bold text-[#16181d]">{d.activity.courses.length}</div>
                  {d.activity.courses.length > 0 && <div className="mt-1 line-clamp-2 text-xs text-[#5f6573]">{d.activity.courses.join(" · ")}</div>}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#5f6573]">Connect with {first} to see their roadmap progress, quizzes and courses.</p>
            )}
          </Section>

          <Section title="Skills">
            {p.skills.length
              ? <div className="flex flex-wrap gap-2">{p.skills.map((s) => <span key={s} className="rounded-full border border-[#e3e5e9] bg-white px-3.5 py-1.5 text-sm font-medium text-[#2c303b]">{s}</span>)}</div>
              : <p className="text-sm text-[#5f6573]">No skills listed yet.</p>}
            {p.interests.length > 0 && (
              <>
                <h3 className="mt-6 font-display text-[15px] font-bold text-[#16181d]">Interests</h3>
                <div className="mt-2 flex flex-wrap gap-2">{p.interests.map((s) => <span key={s} className="chip bg-[#fbe9e1] px-3 py-1.5 text-sm text-[#b3401a]">{s}</span>)}</div>
              </>
            )}
          </Section>

          {(p.projects.length > 0 || links.length > 0) && (
            <Section title="Projects & links">
              {p.projects.length > 0 && (
                <ul className="space-y-3">
                  {p.projects.map((x, i) => (
                    <li key={i} className="flex gap-3 text-[15px] text-[#3d4250]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D9541E]" />{x}
                    </li>
                  ))}
                </ul>
              )}
              {links.length > 0 && (
                <div className={`flex flex-wrap gap-2 ${p.projects.length ? "mt-5" : ""}`}>
                  {links.map(([k, label, icon]) => (
                    <a key={k} href={p.links[k]} target="_blank" rel="noopener noreferrer nofollow" className="btn-ghost">
                      <Icon d={icon} size={16} /> {label} <span className="font-sans text-xs font-normal text-[#5f6573]">{host(p.links[k])}</span>
                    </a>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-6">
          {!d.isMe && d.match.reasons.length > 0 && (
            <section className="card-dark">
              <p className="eyebrow" style={{ color: "#f29a6b" }}>Why you match</p>
              <ul className="mt-3 space-y-2.5">
                {d.match.reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-[15px]"><span className="mt-0.5 text-[#f29a6b]"><Icon d={I.check} size={16} /></span>{r}</li>
                ))}
              </ul>
            </section>
          )}
          {!d.isMe && (
            <section className="card">
              <h2 className="h2">Mutual connections</h2>
              {d.mutual.people.length ? (
                <ul className="mt-4 space-y-3">
                  {d.mutual.people.map((m) => (
                    <li key={m.id}><Link href={href(m.id)} className="flex items-center gap-3 font-medium text-[#16181d] hover:text-[#D9541E]"><Avatar id={m.id} name={m.name} size={36} />{m.name}</Link></li>
                  ))}
                  {d.mutual.count > d.mutual.people.length && <li className="text-sm text-[#5f6573]">+{d.mutual.count - d.mutual.people.length} more</li>}
                </ul>
              ) : <p className="mt-2 text-sm text-[#5f6573]">None yet.</p>}
            </section>
          )}
          <section className="card text-sm text-[#5f6573]">
            <h2 className="h2 mb-2">How sessions work</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Connect with {d.isMe ? "a student" : first}.</li>
              <li>Request a session to study together or get something explained.</li>
              <li>Once accepted, join the private video room from <Link href="/connect?tab=sessions" className="font-semibold text-[#D9541E]">Sessions</Link>.</li>
            </ol>
          </section>
          {p.joinedAt && <p className="px-1 text-xs text-[#8a909c]">On UDAAN since {new Date(p.joinedAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>}
        </aside>
      </div>
    </div>
  );
}
