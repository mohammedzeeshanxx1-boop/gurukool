"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────
type Peer = {
  id: string; name: string; college: string; branch: string; semester: number;
  skills: string[]; interests: string[]; careerGoal: string; score: number; reasons: string[];
};
type PeerSession = {
  id: string; direction: "sent" | "received"; with: { id: string; name: string };
  topic: string; message: string; startAt: string; endAt: string; when: string; durationMinutes: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"; roomCode: string | null; canJoin: boolean;
};
type MeetingRecord = { _id: string; meetingCode: string; date: string };

const TABS = [
  { id: "students", label: "Find Students" },
  { id: "sessions", label: "My Sessions" },
  { id: "meetings", label: "Meetings" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DURATIONS = [30, 45, 60, 90];
const initials = (n: string) => n.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
const AVATAR = ["#D9541E", "#2c303b", "#0b7a39", "#1570ef", "#a85a0c"];
const avatarBg = (id: string) => AVATAR[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];

function Avatar({ id, name, size = 48 }: { id: string; name: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-2xl font-display font-bold text-white"
      style={{ width: size, height: size, background: avatarBg(id), fontSize: size * 0.36 }}>{initials(name)}</span>
  );
}

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const I = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  video: "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
  cal: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
  close: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
};

// ── Book a session modal ─────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function defaultSlot() {
  // Next whole hour at least 1 hour from now, in the browser's local time.
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:00` };
}

function BookModal({ peer, onClose, onBooked }: { peer: Peer; onClose: () => void; onBooked: () => void }) {
  const slot = useMemo(defaultSlot, []);
  const suggested = peer.reasons.find((r) => r.startsWith("Shared skills"))?.replace("Shared skills: ", "").split(",")[0]?.trim();
  const [f, setF] = useState({ topic: suggested ? `${suggested} study session` : "", date: slot.date, time: slot.time, durationMinutes: 60, message: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [done, setDone] = useState(false);
  const today = new Date();
  const minDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const startAt = new Date(`${f.date}T${f.time}`);
      await api("/api/peer-sessions", { method: "POST", body: JSON.stringify({ peerKey: peer.id, topic: f.topic, message: f.message, durationMinutes: f.durationMinutes, startAt: startAt.toISOString() }) });
      setDone(true);
      onBooked();
    } catch (x) { setErr(toErr(x)); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 !m-0 flex items-center justify-center bg-[#16181d]/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Book a session with ${peer.name}`}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 bg-[#2c303b] px-7 py-5 text-white">
          <div className="flex items-center gap-4">
            <span className="rounded-2xl ring-2 ring-white/25"><Avatar id={peer.id} name={peer.name} size={44} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f29a6b]">Book a study session</p>
              <p className="font-display text-xl font-bold">{peer.name}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><Icon d={I.close} size={20} /></button>
        </div>

        {done ? (
          <div className="space-y-4 px-7 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e1f5e3] text-[#0b7a39]"><Icon d={I.check} size={28} /></span>
            <p className="font-display text-2xl font-bold text-[#16181d]">Request sent</p>
            <p className="text-[15px] text-[#3d4250]">{peer.name} will get a notification. Once they accept, a private meeting room appears in <b>My Sessions</b>.</p>
            <button onClick={onClose} className="btn-primary mt-2 px-8">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-7 py-6">
            <div><label className="label" htmlFor="bk-topic">What do you want to work on?</label>
              <input id="bk-topic" className="input" placeholder="e.g. DSA practice, React project help" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} required minLength={3} maxLength={120} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="bk-date">Date</label>
                <input id="bk-date" type="date" className="input" min={minDate} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></div>
              <div><label className="label" htmlFor="bk-time">Time</label>
                <input id="bk-time" type="time" className="input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} required /></div>
            </div>
            <div>
              <span className="label">Duration</span>
              <div className="flex gap-2">
                {DURATIONS.map((d) => (
                  <button type="button" key={d} onClick={() => setF({ ...f, durationMinutes: d })}
                    className={`flex-1 rounded-xl py-2.5 font-display text-sm font-semibold transition-colors ${f.durationMinutes === d ? "bg-[#2c303b] text-white" : "bg-[#f0f1f3] text-[#2c303b] hover:bg-[#e4e6ea]"}`}>
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div><label className="label" htmlFor="bk-msg">Message <span className="font-normal text-[#8a909c]">(optional)</span></label>
              <textarea id="bk-msg" className="input" rows={3} maxLength={500} placeholder="Say hi and what you'd like to cover…" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
            <ErrorAlert err={err} />
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">{busy && <Spinner />} Send Request</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Find Students tab ────────────────────────────────────────────────────────
function FindStudents({ onBooked }: { onBooked: () => void }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ needsProfile: boolean; peers: Peer[] } | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [booking, setBooking] = useState<Peer | null>(null);

  const load = useCallback((query: string) => {
    api<{ needsProfile: boolean; peers: Peer[] }>(`/api/peers${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(toErr(e)));
  }, []);
  useEffect(() => { const t = setTimeout(() => load(q.trim()), 250); return () => clearTimeout(t); }, [q, load]);

  if (data?.needsProfile) {
    return <Alert kind="warn"><b>Set up your profile first.</b> We use your goal, skills and interests to find students to study with. <Link href="/profile" className="font-semibold underline">Go to My Profile &rarr;</Link></Alert>;
  }

  return (
    <div className="space-y-6">
      <label className="flex max-w-2xl items-center gap-3 rounded-full border-[1.5px] border-[#d5d8de] bg-white px-5 py-3 transition-[border-color,box-shadow] focus-within:border-[#D9541E] focus-within:shadow-[0_0_0_3px_rgba(217,84,30,0.12)]">
        <span className="text-[#5f6573]"><Icon d={I.search} size={20} /></span>
        <input className="w-full bg-transparent text-[15px] text-[#16181d] outline-none placeholder:text-[#8a909c]" placeholder="Search by name, college, skill or goal…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
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
          <p className="eyebrow">{q ? `${data.peers.length} result${data.peers.length === 1 ? "" : "s"}` : "Best matches for you"}</p>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.peers.map((p) => (
              <div key={p.id} className="card flex flex-col p-6 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-4">
                  <Avatar id={p.id} name={p.name} />
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-bold text-[#16181d]">{p.name}</h3>
                    <p className="truncate text-sm text-[#5f6573]">{p.college}</p>
                    <p className="text-sm text-[#5f6573]">{p.branch} · Sem {p.semester}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm"><span className="text-[#5f6573]">Goal:</span> <span className="font-medium text-[#16181d]">{p.careerGoal}</span></p>
                {p.reasons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.reasons.slice(0, 2).map((r) => <span key={r} className="chip bg-[#fbe9e1] text-[#b3401a]">{r}</span>)}
                  </div>
                )}
                {p.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.skills.slice(0, 5).map((s) => <span key={s} className="chip bg-[#f0f1f3] text-[#3d4250]">{s}</span>)}
                    {p.skills.length > 5 && <span className="chip text-[#8a909c]">+{p.skills.length - 5}</span>}
                  </div>
                )}
                <div className="mt-auto pt-5">
                  <button onClick={() => setBooking(p)} className="btn-dark w-full"><Icon d={I.cal} size={16} /> Book a Session</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {booking && <BookModal peer={booking} onClose={() => setBooking(null)} onBooked={onBooked} />}
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
          <span className="font-display text-[17px] font-bold text-[#16181d]">{s.topic}</span>
          <span className={`chip ${tone}`}>{label}</span>
        </div>
        <p className="mt-0.5 text-sm text-[#3d4250]">{s.direction === "sent" ? "with" : "from"} <b>{s.with.name}</b> · {s.when} · {s.durationMinutes} min</p>
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
      <Section title="Upcoming sessions" items={upcoming} empty="No confirmed sessions yet. Find a student and book one." />
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
  const tab = (TABS.find((t) => t.id === sp.get("tab"))?.id ?? "students") as TabId;
  const [refreshKey, setRefreshKey] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    api<{ sessions: PeerSession[] }>("/api/peer-sessions")
      .then((d) => setPending(d.sessions.filter((s) => s.status === "PENDING" && s.direction === "received" && new Date(s.startAt).getTime() > Date.now()).length))
      .catch(() => {});
  }, [refreshKey, tab]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Learn together"
        title="Connect"
        subtitle="Find students with the same goals, book a study session, and meet over video once they accept."
      />

      <div role="tablist" className="mb-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-[#e4e6ea] p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => router.replace(`/connect?tab=${t.id}`, { scroll: false })}
            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 font-display text-[15px] font-semibold transition-colors ${tab === t.id ? "bg-[#2c303b] text-white" : "text-[#2c303b] hover:bg-white/60"}`}>
            {t.label}
            {t.id === "sessions" && pending > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D9541E] px-1.5 text-[11px] font-bold text-white">{pending}</span>}
          </button>
        ))}
      </div>

      {tab === "students" && <FindStudents onBooked={() => setRefreshKey((k) => k + 1)} />}
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
