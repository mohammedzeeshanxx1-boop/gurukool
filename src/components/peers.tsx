"use client";
// Shared pieces for the student network (Connect): avatars, connect button, connect + session popups.
import { useMemo, useState } from "react";
import { ErrorAlert, Spinner, api, toErr, type ApiErr } from "./ui";

export type ConnStatus = "none" | "sent" | "received" | "connected";
export type Conn = { status: ConnStatus; id: string | null };
export type PeerCard = {
  id: string; name: string; headline: string; college: string; branch: string; semester: number;
  careerGoal: string; skills: string[]; interests: string[];
};

const initials = (n: string) => n.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
const AVATAR = ["#D9541E", "#2c303b", "#0b7a39", "#1570ef", "#a85a0c"];
export const avatarBg = (id: string) => AVATAR[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];

export function Avatar({ id, name, size = 48, ring = false }: { id: string; name: string; size?: number; ring?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl font-display font-bold text-white ${ring ? "ring-4 ring-white" : ""}`}
      style={{ width: size, height: size, background: avatarBg(id), fontSize: size * 0.36 }}>{initials(name)}</span>
  );
}

export function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
export const I = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  video: "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
  cal: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
  close: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  plus: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  book: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  bulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  github: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  linkedin: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};

function Modal({ title, eyebrow, peer, onClose, children }: { title: string; eyebrow: string; peer: { id: string; name: string }; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 !m-0 flex items-center justify-center bg-[#16181d]/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 bg-[#2c303b] px-7 py-5 text-white">
          <div className="flex items-center gap-4">
            <span className="rounded-2xl ring-2 ring-white/25"><Avatar id={peer.id} name={peer.name} size={44} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f29a6b]">{eyebrow}</p>
              <p className="font-display text-xl font-bold">{peer.name}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><Icon d={I.close} size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Done({ title, text, onClose }: { title: string; text: React.ReactNode; onClose: () => void }) {
  return (
    <div className="space-y-4 px-7 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e1f5e3] text-[#0b7a39]"><Icon d={I.check} size={28} /></span>
      <p className="font-display text-2xl font-bold text-[#16181d]">{title}</p>
      <p className="text-[15px] text-[#3d4250]">{text}</p>
      <button onClick={onClose} className="btn-primary mt-2 px-8">Done</button>
    </div>
  );
}

/** "Connect" popup with an optional note, like LinkedIn. */
export function ConnectModal({ peer, onClose, onDone }: { peer: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [done, setDone] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api("/api/connections", { method: "POST", body: JSON.stringify({ peerKey: peer.id, message: note }) }); setDone(true); onDone(); }
    catch (x) { setErr(toErr(x)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Connect with ${peer.name}`} eyebrow="Send a connection request" peer={peer} onClose={onClose}>
      {done ? <Done title="Invitation sent" text={<>{peer.name} will get a notification. Once they accept, you can request study sessions with each other.</>} onClose={onClose} /> : (
        <form onSubmit={send} className="space-y-4 px-7 py-6">
          <div>
            <label className="label" htmlFor="cn-note">Add a note <span className="font-normal text-[#8a909c]">(optional)</span></label>
            <textarea id="cn-note" className="input" rows={4} maxLength={300} placeholder={`Hi ${peer.name.split(" ")[0]}, I'm also preparing for… would love to study together.`} value={note} onChange={(e) => setNote(e.target.value)} />
            <p className="mt-1 text-right text-xs text-[#8a909c]">{note.length}/300</p>
          </div>
          <ErrorAlert err={err} />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1">{busy && <Spinner />} Send Invitation</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DURATIONS = [30, 45, 60, 90];
const KINDS = [
  { id: "study", label: "Study together", sub: "Work through a topic side by side", icon: I.book },
  { id: "explain", label: "Explain something", sub: "Ask them to walk you through a topic", icon: I.bulb },
] as const;

/** Request a session with a connection. */
export function SessionModal({ peer, suggestedTopic, onClose, onDone }: { peer: { id: string; name: string }; suggestedTopic?: string; onClose: () => void; onDone?: () => void }) {
  const slot = useMemo(() => { const d = new Date(Date.now() + 2 * 60 * 60 * 1000); d.setMinutes(0, 0, 0); return { date: ymd(d), time: `${pad(d.getHours())}:00` }; }, []);
  const [f, setF] = useState({ kind: "study" as "study" | "explain", topic: suggestedTopic ?? "", date: slot.date, time: slot.time, durationMinutes: 60, message: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api("/api/peer-sessions", { method: "POST", body: JSON.stringify({ peerKey: peer.id, kind: f.kind, topic: f.topic, message: f.message, durationMinutes: f.durationMinutes, startAt: new Date(`${f.date}T${f.time}`).toISOString() }) });
      setDone(true); onDone?.();
    } catch (x) { setErr(toErr(x)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Request a session with ${peer.name}`} eyebrow="Request a session" peer={peer} onClose={onClose}>
      {done ? <Done title="Request sent" text={<>{peer.name} will get a notification. Once they accept, a private meeting room appears in <b>Sessions</b>.</>} onClose={onClose} /> : (
        <form onSubmit={submit} className="max-h-[75vh] space-y-4 overflow-y-auto px-7 py-6">
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button type="button" key={k.id} onClick={() => setF({ ...f, kind: k.id })} aria-pressed={f.kind === k.id}
                className={`rounded-2xl border-2 p-3.5 text-left transition-colors ${f.kind === k.id ? "border-[#D9541E] bg-[#fbe9e1]" : "border-[#e3e5e9] hover:border-[#cfd2d8]"}`}>
                <span className={f.kind === k.id ? "text-[#D9541E]" : "text-[#2c303b]"}><Icon d={k.icon} size={20} /></span>
                <span className="mt-1.5 block font-display text-[15px] font-bold text-[#16181d]">{k.label}</span>
                <span className="block text-xs text-[#5f6573]">{k.sub}</span>
              </button>
            ))}
          </div>
          <div><label className="label" htmlFor="ss-topic">{f.kind === "explain" ? "What should they explain?" : "What will you study?"}</label>
            <input id="ss-topic" className="input" placeholder={f.kind === "explain" ? "e.g. How React useEffect works" : "e.g. DSA — linked lists"} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} required minLength={3} maxLength={120} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="ss-date">Date</label><input id="ss-date" type="date" className="input" min={ymd(new Date())} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></div>
            <div><label className="label" htmlFor="ss-time">Time</label><input id="ss-time" type="time" className="input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} required /></div>
          </div>
          <div>
            <span className="label">Duration</span>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button type="button" key={d} onClick={() => setF({ ...f, durationMinutes: d })}
                  className={`flex-1 rounded-xl py-2.5 font-display text-sm font-semibold transition-colors ${f.durationMinutes === d ? "bg-[#2c303b] text-white" : "bg-[#f0f1f3] text-[#2c303b] hover:bg-[#e4e6ea]"}`}>{d} min</button>
              ))}
            </div>
          </div>
          <div><label className="label" htmlFor="ss-msg">Message <span className="font-normal text-[#8a909c]">(optional)</span></label>
            <textarea id="ss-msg" className="input" rows={2} maxLength={500} placeholder="Anything they should prepare?" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
          <ErrorAlert err={err} />
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1">{busy && <Spinner />} Send Request</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** The one action button LinkedIn shows next to a person, driven by connection status. */
export function ConnectionAction({ peer, conn, onChanged, full = false, suggestedTopic }: { peer: { id: string; name: string }; conn: Conn; onChanged: () => void; full?: boolean; suggestedTopic?: string }) {
  const [modal, setModal] = useState<"connect" | "session" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const w = full ? "w-full" : "";
  async function act(action: "accept" | "decline" | "withdraw") {
    if (!conn.id) return;
    setBusy(true); setErr(null);
    try { await api(`/api/connections/${conn.id}`, { method: "PATCH", body: JSON.stringify({ action }) }); onChanged(); }
    catch (x) { setErr(toErr(x).error); } finally { setBusy(false); }
  }
  return (
    <>
      {conn.status === "none" && <button onClick={() => setModal("connect")} className={`btn-primary ${w}`}><Icon d={I.plus} size={16} /> Connect</button>}
      {conn.status === "sent" && <button onClick={() => act("withdraw")} disabled={busy} className={`btn-ghost ${w}`} title="Click to withdraw"><Icon d={I.clock} size={16} /> Pending</button>}
      {conn.status === "received" && (
        <div className={`flex gap-2 ${w}`}>
          <button onClick={() => act("decline")} disabled={busy} className="btn-ghost flex-1">Ignore</button>
          <button onClick={() => act("accept")} disabled={busy} className="btn-primary flex-1">Accept</button>
        </div>
      )}
      {conn.status === "connected" && <button onClick={() => setModal("session")} className={`btn-dark ${w}`}><Icon d={I.cal} size={16} /> Request Session</button>}
      {err && <p className="mt-2 text-xs text-[#b4232f]">{err}</p>}
      {modal === "connect" && <ConnectModal peer={peer} onClose={() => setModal(null)} onDone={onChanged} />}
      {modal === "session" && <SessionModal peer={peer} suggestedTopic={suggestedTopic} onClose={() => setModal(null)} onDone={onChanged} />}
    </>
  );
}
