"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { Avatar, ConnectionAction, I, Icon, type Conn, type PeerCard } from "@/components/peers";

// ── Types ────────────────────────────────────────────────────────────────────
type Peer = PeerCard & { score: number; reasons: string[]; connection: Conn };
type NetRow = { id: string; peer: PeerCard; message: string; since: string };
type Network = { connections: NetRow[]; received: NetRow[]; sent: NetRow[] };
type PeerSession = {
  id: string; direction: "sent" | "received"; with: { id: string; name: string }; kind: "study" | "explain";
  topic: string; message: string; startAt: string; endAt: string; when: string; durationMinutes: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"; roomCode: string | null; canJoin: boolean;
};
type MeetingRecord = { _id: string; meetingCode: string; date: string };

const TABS = [
  { id: "discover", label: "Discover" },
  { id: "network", label: "My Network" },
  { id: "sessions", label: "Sessions" },
  { id: "meetings", label: "Meetings" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const profileHref = (id: string) => `/connect/people/${encodeURIComponent(id)}`;
const sharedSkill = (reasons: string[]) => reasons.find((r) => r.startsWith("Shared skills"))?.replace("Shared skills: ", "").split(",")[0]?.trim();

// ── Discover tab ─────────────────────────────────────────────────────────────
function Discover({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ needsProfile: boolean; peers: Peer[] } | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);

  const load = useCallback((query: string) => {
    api<{ needsProfile: boolean; peers: Peer[] }>(`/api/peers${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(toErr(e)));
  }, []);
  useEffect(() => { const t = setTimeout(() => load(q.trim()), 250); return () => clearTimeout(t); }, [q, load]);
  const refresh = () => { load(q.trim()); onChanged(); };

  if (data?.needsProfile) {
    return <Alert kind="warn"><b>Set up your profile first.</b> Other students see your profile when you connect. <Link href="/profile" className="font-semibold underline">Go to My Profile &rarr;</Link></Alert>;
  }

  return (
    <div className="space-y-6">
      <label className="flex max-w-2xl items-center gap-3 rounded-full border-[1.5px] border-[#d5d8de] bg-white px-5 py-3 transition-[border-color,box-shadow] focus-within:border-[#D9541E] focus-within:shadow-[0_0_0_3px_rgba(217,84,30,0.12)]">
        <span className="text-[#5f6573]"><Icon d={I.search} size={20} /></span>
        <input className="w-full bg-transparent text-[15px] text-[#16181d] outline-none placeholder:text-[#8a909c]" placeholder="Search students by name, college, skill or goal…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
      </label>

      <ErrorAlert err={err} />
      {!data && !err && <div className="text-sm text-[#5f6573]"><Spinner /> Finding students…</div>}
      {data && data.peers.length === 0 && (
        <div className="card py-12 text-center">
          <p className="font-display text-xl font-bold text-[#16181d]">{q ? "No students match that search" : "No other students yet"}</p>
          <p className="mt-2 text-sm text-[#5f6573]">{q ? "Try a skill like “React” or a college name." : "Invite your classmates to join UDAAN and they'll show up here."}</p>
        </div>
      )}

      {data && data.peers.length > 0 && (
        <>
          <p className="eyebrow">{q ? `${data.peers.length} result${data.peers.length === 1 ? "" : "s"}` : "People you may know"}</p>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.peers.map((p) => (
              <div key={p.id} className="card flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-md">
                <div className="h-14 bg-[#2c303b]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
                <div className="-mt-8 flex flex-1 flex-col px-6 pb-6">
                  <Link href={profileHref(p.id)} className="w-fit"><Avatar id={p.id} name={p.name} size={64} ring /></Link>
                  <Link href={profileHref(p.id)} className="mt-3 font-display text-lg font-bold text-[#16181d] hover:text-[#D9541E]">{p.name}</Link>
                  <p className="line-clamp-2 text-sm text-[#3d4250]">{p.headline || `${p.branch} student · Semester ${p.semester}`}</p>
                  <p className="mt-1 truncate text-[13px] text-[#5f6573]">{p.college}</p>
                  {p.reasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.reasons.slice(0, 2).map((r) => <span key={r} className="chip bg-[#fbe9e1] text-[#b3401a]">{r}</span>)}
                    </div>
                  )}
                  {p.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.skills.slice(0, 4).map((s) => <span key={s} className="chip bg-[#f0f1f3] text-[#3d4250]">{s}</span>)}
                      {p.skills.length > 4 && <span className="chip text-[#8a909c]">+{p.skills.length - 4}</span>}
                    </div>
                  )}
                  <div className="mt-auto grid grid-cols-[auto_1fr] gap-2 pt-5">
                    <Link href={profileHref(p.id)} className="btn-ghost">Profile</Link>
                    <ConnectionAction peer={p} conn={p.connection} onChanged={refresh} full suggestedTopic={sharedSkill(p.reasons)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── My Network tab ───────────────────────────────────────────────────────────
function MyNetwork({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [net, setNet] = useState<Network | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const load = useCallback(() => { api<Network>("/api/connections").then((d) => { setNet(d); setErr(null); }).catch((e) => setErr(toErr(e))); }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  const changed = () => { load(); onChanged(); };

  if (!net) return err ? <ErrorAlert err={err} /> : <div className="text-sm text-[#5f6573]"><Spinner /> Loading your network…</div>;

  const Person = ({ r, conn, note }: { r: NetRow; conn: Conn; note?: boolean }) => (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#e3e5e9] bg-white p-5 sm:flex-row sm:items-center">
      <Link href={profileHref(r.peer.id)}><Avatar id={r.peer.id} name={r.peer.name} size={52} /></Link>
      <div className="min-w-0 flex-1">
        <Link href={profileHref(r.peer.id)} className="font-display text-[17px] font-bold text-[#16181d] hover:text-[#D9541E]">{r.peer.name}</Link>
        <p className="truncate text-sm text-[#3d4250]">{r.peer.headline || `${r.peer.branch} · ${r.peer.college}`}</p>
        <p className="text-[13px] text-[#5f6573]">Goal: {r.peer.careerGoal}</p>
        {note && r.message && <p className="mt-2 rounded-xl bg-[#f4f5f7] px-3 py-2 text-sm italic text-[#3d4250]">&ldquo;{r.message}&rdquo;</p>}
      </div>
      <div className="flex shrink-0 gap-2 sm:w-auto">
        <Link href={profileHref(r.peer.id)} className="btn-ghost">Profile</Link>
        <ConnectionAction peer={r.peer} conn={conn} onChanged={changed} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <ErrorAlert err={err} />
      {net.received.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Invitations <span className="ml-1 font-sans text-sm font-medium text-[#8a909c]">{net.received.length}</span></h2>
          <div className="space-y-3">{net.received.map((r) => <Person key={r.id} r={r} conn={{ status: "received", id: r.id }} note />)}</div>
        </section>
      )}
      <section>
        <h2 className="h2 mb-3">Connections <span className="ml-1 font-sans text-sm font-medium text-[#8a909c]">{net.connections.length}</span></h2>
        {net.connections.length
          ? <div className="space-y-3">{net.connections.map((r) => <Person key={r.id} r={r} conn={{ status: "connected", id: r.id }} />)}</div>
          : <p className="rounded-2xl border border-dashed border-[#cfd2d8] bg-white/60 p-5 text-sm text-[#5f6573]">No connections yet. Go to <b>Discover</b> and connect with students who share your goals.</p>}
      </section>
      {net.sent.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Sent invitations <span className="ml-1 font-sans text-sm font-medium text-[#8a909c]">{net.sent.length}</span></h2>
          <div className="space-y-3">{net.sent.map((r) => <Person key={r.id} r={r} conn={{ status: "sent", id: r.id }} />)}</div>
          <p className="mt-2 text-xs text-[#8a909c]">Click &ldquo;Pending&rdquo; to withdraw an invitation.</p>
        </section>
      )}
    </div>
  );
}

// ── My Sessions tab ──────────────────────────────────────────────────────────
function SessionRow({ s, busy, act, join }: { s: PeerSession; busy: boolean; act: (id: string, a: "accept" | "decline" | "cancel") => void; join: (code: string) => void }) {
  const ended = new Date(s.endAt).getTime() < Date.now();
  const tone = s.status === "ACCEPTED" ? "bg-[#e1f5e3] text-[#0b5e2e]" : s.status === "PENDING" ? "bg-[#fdf0cf] text-[#7a4508]" : "bg-[#f0f1f3] text-[#5f6573]";
  const label = s.status === "PENDING" ? (s.direction === "received" ? "Needs your reply" : "Awaiting reply") : s.status === "ACCEPTED" ? (ended ? "Completed" : "Confirmed") : s.status === "DECLINED" ? "Declined" : "Cancelled";
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#e3e5e9] bg-white p-5 sm:flex-row sm:items-center">
      <Avatar id={s.with.id} name={s.with.name} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-[#e4e6ea] text-[#2c303b]">{s.kind === "explain" ? "Explain" : "Study"}</span>
          <span className="font-display text-[17px] font-bold text-[#16181d]">{s.topic}</span>
          <span className={`chip ${tone}`}>{label}</span>
        </div>
        <p className="mt-0.5 text-sm text-[#3d4250]">{s.direction === "sent" ? "with" : "from"} <Link href={`/connect/people/${encodeURIComponent(s.with.id)}`} className="font-semibold hover:text-[#D9541E]">{s.with.name}</Link> · {s.when} · {s.durationMinutes} min</p>
        {s.message && <p className="mt-1.5 line-clamp-2 text-sm italic text-[#5f6573]">&ldquo;{s.message}&rdquo;</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {s.status === "PENDING" && s.direction === "received" && <>
          <button disabled={busy} onClick={() => act(s.id, "decline")} className="btn-ghost">Decline</button>
          <button disabled={busy} onClick={() => act(s.id, "accept")} className="btn-primary">Accept</button>
        </>}
        {s.status === "PENDING" && s.direction === "sent" && <button disabled={busy} onClick={() => act(s.id, "cancel")} className="btn-ghost">Withdraw</button>}
        {s.status === "ACCEPTED" && !ended && <>
          <button disabled={busy} onClick={() => act(s.id, "cancel")} className="btn-ghost">Cancel</button>
          {s.roomCode && (s.canJoin
            ? <button onClick={() => join(s.roomCode!)} className="btn-primary"><Icon d={I.video} size={16} /> Join Meeting</button>
            : <span className="btn cursor-default bg-[#f0f1f3] text-[#5f6573]" title="The room opens 10 minutes before the start time"><Icon d={I.video} size={16} /> Opens 10 min before</span>)}
        </>}
      </div>
    </div>
  );
}

function MySessions({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const [list, setList] = useState<PeerSession[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(() => {
    api<{ sessions: PeerSession[] }>("/api/peer-sessions").then((d) => { setList(d.sessions); setErr(null); }).catch((e) => setErr(toErr(e)));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load, refreshKey]);

  async function act(id: string, action: "accept" | "decline" | "cancel") {
    setBusy(id); setErr(null);
    try { await api(`/api/peer-sessions/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }); load(); }
    catch (e) { setErr(toErr(e)); } finally { setBusy(null); }
  }
  function join(code: string) {
    api("/api/meetings/add", { method: "POST", body: JSON.stringify({ meeting_code: code }) }).catch(() => {});
    router.push(`/connect/meeting?room=${encodeURIComponent(code)}`);
  }

  if (!list) return err ? <ErrorAlert err={err} /> : <div className="text-sm text-[#5f6573]"><Spinner /> Loading sessions…</div>;
  const now = Date.now();
  const requests = list.filter((s) => s.status === "PENDING" && s.direction === "received" && new Date(s.startAt).getTime() > now);
  const upcoming = list.filter((s) => s.status === "ACCEPTED" && new Date(s.endAt).getTime() >= now);
  const sent = list.filter((s) => s.status === "PENDING" && s.direction === "sent" && new Date(s.startAt).getTime() > now);
  const past = list.filter((s) => !requests.includes(s) && !upcoming.includes(s) && !sent.includes(s)).reverse();

  const Section = ({ title, items, empty }: { title: string; items: PeerSession[]; empty?: string }) => (
    <section>
      <h2 className="h2 mb-3">{title} {items.length > 0 && <span className="ml-1 font-sans text-sm font-medium text-[#8a909c]">{items.length}</span>}</h2>
      {items.length ? <div className="space-y-3">{items.map((s) => <SessionRow key={s.id} s={s} busy={busy === s.id} act={act} join={join} />)}</div>
        : empty ? <p className="rounded-2xl border border-dashed border-[#cfd2d8] bg-white/60 p-5 text-sm text-[#5f6573]">{empty}</p> : null}
    </section>
  );

  return (
    <div className="space-y-8">
      <ErrorAlert err={err} />
      {requests.length > 0 && <Section title="Requests for you" items={requests} />}
      <Section title="Upcoming sessions" items={upcoming} empty="No confirmed sessions yet. Request one from a connection in My Network." />
      {sent.length > 0 && <Section title="Sent requests" items={sent} />}
      {past.length > 0 && (
        <section>
          <button onClick={() => setShowPast(!showPast)} className="font-display text-[15px] font-semibold text-[#5f6573] hover:text-[#16181d]">
            {showPast ? "Hide" : "Show"} past &amp; closed ({past.length})
          </button>
          {showPast && <div className="mt-3 space-y-3 opacity-80">{past.map((s) => <SessionRow key={s.id} s={s} busy={false} act={act} join={join} />)}</div>}
        </section>
      )}
    </div>
  );
}

// ── Meetings tab (instant rooms) ─────────────────────────────────────────────
function Meetings() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [inputErr, setInputErr] = useState("");
  const [history, setHistory] = useState<MeetingRecord[] | null>(null);
  const [histErr, setHistErr] = useState<ApiErr | null>(null);

  useEffect(() => {
    api<{ meetings: MeetingRecord[] }>("/api/meetings/history").then((d) => setHistory(d.meetings)).catch((e) => setHistErr(toErr(e)));
  }, []);

  const go = (c: string) => {
    api("/api/meetings/add", { method: "POST", body: JSON.stringify({ meeting_code: c }) }).catch(() => {});
    router.push(`/connect/meeting?room=${encodeURIComponent(c)}`);
  };
  const fmt = (d: string) => { const dt = new Date(d); return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };

  return (
    <div className="space-y-8">
      <div className="grid gap-5 md:grid-cols-2">
        <form className="card space-y-4 sm:p-7" onSubmit={(e) => { e.preventDefault(); const c = code.trim(); if (!c) { setInputErr("Enter a meeting code."); return; } setInputErr(""); go(c); }}>
          <div><h2 className="h2">Join with a code</h2><p className="mt-1 text-sm text-[#5f6573]">Enter the code a classmate shared with you.</p></div>
          <input className="input" placeholder="e.g. cs301-study" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Meeting code" />
          {inputErr && <p className="text-xs text-[#b4232f]">{inputErr}</p>}
          <button type="submit" className="btn-primary w-full">Join &rarr;</button>
        </form>
        <div className="card-dark flex flex-col justify-between gap-5 sm:p-7">
          <div><h2 className="font-display text-lg font-bold">Start an instant room</h2><p className="mt-1 text-sm text-white/65">Video, audio, screen share and chat in your browser. Share the code to invite others.</p></div>
          <button onClick={() => go(`udaan-${Math.random().toString(36).slice(2, 8)}`)} className="btn w-full bg-white text-[#2c303b] hover:bg-[#e4e6ea]"><Icon d={I.video} size={16} /> New Meeting Room</button>
        </div>
      </div>
      <section>
        <h2 className="h2 mb-3">Recent meetings</h2>
        <ErrorAlert err={histErr} />
        {history === null ? (!histErr && <div className="text-sm text-[#5f6573]"><Spinner /> Loading…</div>)
          : history.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cfd2d8] bg-white/60 p-5 text-sm text-[#5f6573]">Meetings you join will appear here.</p>
          : (
            <div className="divide-y divide-[#e3e5e9] overflow-hidden rounded-2xl border border-[#e3e5e9] bg-white">
              {history.map((m, i) => (
                <div key={`${m._id}-${i}`} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f1f3] text-[#2c303b]"><Icon d={I.video} size={16} /></span>
                    <div><div className="font-mono text-sm text-[#16181d]">{m.meetingCode}</div><div className="text-xs text-[#8a909c]">{fmt(m.date)}</div></div>
                  </div>
                  <button onClick={() => go(m.meetingCode)} className="btn-ghost btn-sm">Rejoin</button>
                </div>
              ))}
            </div>
          )}
      </section>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
function ConnectInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === sp.get("tab"))?.id ?? "discover") as TabId;
  const [refreshKey, setRefreshKey] = useState(0);
  const [badges, setBadges] = useState({ network: 0, sessions: 0 });
  const bump = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    Promise.all([
      api<Network>("/api/connections").then((d) => d.received.length).catch(() => 0),
      api<{ sessions: PeerSession[] }>("/api/peer-sessions").then((d) => d.sessions.filter((s) => s.status === "PENDING" && s.direction === "received" && new Date(s.startAt).getTime() > Date.now()).length).catch(() => 0),
    ]).then(([network, sessions]) => setBadges({ network, sessions }));
  }, [refreshKey, tab]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Learn together"
        title="Connect"
        subtitle="Find students, grow your network, and request sessions to study together or get something explained."
        right={<Link href="/profile" className="btn-ghost">Edit my profile</Link>}
      />

      <div role="tablist" className="mb-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-[#e4e6ea] p-1">
        {TABS.map((t) => {
          const n = t.id === "network" ? badges.network : t.id === "sessions" ? badges.sessions : 0;
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id}
              onClick={() => router.replace(`/connect?tab=${t.id}`, { scroll: false })}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 font-display text-[15px] font-semibold transition-colors ${tab === t.id ? "bg-[#2c303b] text-white" : "text-[#2c303b] hover:bg-white/60"}`}>
              {t.label}
              {n > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D9541E] px-1.5 text-[11px] font-bold text-white">{n}</span>}
            </button>
          );
        })}
      </div>

      {tab === "discover" && <Discover onChanged={bump} />}
      {tab === "network" && <MyNetwork refreshKey={refreshKey} onChanged={bump} />}
      {tab === "sessions" && <MySessions refreshKey={refreshKey} />}
      {tab === "meetings" && <Meetings />}
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[#5f6573]"><Spinner /> Loading…</div>}>
      <ConnectInner />
    </Suspense>
  );
}
