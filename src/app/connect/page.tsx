"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { usePersona } from "@/components/connect";

// ── Types ────────────────────────────────────────────────────────────────────
type MentorRow = {
  id: string; name: string; designation: string; organization: string;
  yearsOfExperience: number; bio: string; expertise: string[]; verified: boolean;
  availability: { day: string; start: string; end: string }[];
};
type ConnectionRow = {
  _id: string; status: "pending" | "accepted" | "rejected";
  mentorId: { _id: string; name: string; designation: string; organization: string; expertise: string[]; verified: boolean };
  message: string; createdAt: string;
};
type MeetingRecord = { _id: string; meetingCode: string; date: string };

const TABS = [
  { id: "mentors", label: "Find Mentor" },
  { id: "connections", label: "My Connections" },
  { id: "meetings", label: "Meetings" },
] as const;

// ── Become a Mentor modal ────────────────────────────────────────────────────
function BecomeMentorModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", designation: "", organization: "",
    yearsOfExperience: "", expertise: "", bio: "", linkedin: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("/api/mentor-apply", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          yearsOfExperience: Number(form.yearsOfExperience),
          expertise: form.expertise.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      setDone(true);
    } catch (e) { setErr(toErr(e).error); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Apply to become a mentor</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>
        {done ? (
          <div className="px-6 py-8 text-center space-y-3">
            <p className="font-semibold text-zinc-900">Application submitted.</p>
            <p className="text-sm text-zinc-500">Our admin will review and get back to you soon.</p>
            <button onClick={onClose} className="btn-primary mt-2">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="block text-xs font-medium text-zinc-700 mb-1">Full name *</label>
                <input className="input" value={form.name} onChange={set("name")} required /></div>
              <div><label className="block text-xs font-medium text-zinc-700 mb-1">Email *</label>
                <input className="input" type="email" value={form.email} onChange={set("email")} required /></div>
              <div><label className="block text-xs font-medium text-zinc-700 mb-1">Job title *</label>
                <input className="input" placeholder="e.g. Senior Engineer" value={form.designation} onChange={set("designation")} required /></div>
              <div><label className="block text-xs font-medium text-zinc-700 mb-1">Company *</label>
                <input className="input" placeholder="e.g. Google" value={form.organization} onChange={set("organization")} required /></div>
              <div><label className="block text-xs font-medium text-zinc-700 mb-1">Years of experience *</label>
                <input className="input" type="number" min={0} max={50} value={form.yearsOfExperience} onChange={set("yearsOfExperience")} required /></div>
              <div><label className="block text-xs font-medium text-zinc-700 mb-1">LinkedIn URL</label>
                <input className="input" placeholder="https://linkedin.com/in/..." value={form.linkedin} onChange={set("linkedin")} /></div>
            </div>
            <div><label className="block text-xs font-medium text-zinc-700 mb-1">Expertise (comma separated) *</label>
              <input className="input" placeholder="React, Node.js, System Design" value={form.expertise} onChange={set("expertise")} required /></div>
            <div><label className="block text-xs font-medium text-zinc-700 mb-1">Short bio</label>
              <textarea className="input" rows={3} placeholder="Tell students about yourself and what you can help with…" value={form.bio} onChange={set("bio")} /></div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? "Submitting…" : "Submit application"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Find Mentor tab ──────────────────────────────────────────────────────────
function FindMentor() {
  const { info } = usePersona();
  const [mentors, setMentors] = useState<MentorRow[] | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<ApiErr | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [msgMap, setMsgMap] = useState<Record<string, string>>({});
  const [expandMsg, setExpandMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ mentors: MentorRow[] }>("/api/mentors?limit=50")
      .then((d) => { setMentors(d.mentors); setErr(null); })
      .catch((e) => setErr(toErr(e)));
    api<{ connections: ConnectionRow[] }>("/api/mentor-connections")
      .then((d) => setConnections(d.connections))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const connMap = Object.fromEntries(connections.map((c) => [String(c.mentorId?._id ?? ""), c]));

  const filtered = mentors?.filter((m) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return m.name.toLowerCase().includes(ql) || m.designation.toLowerCase().includes(ql) ||
      m.organization.toLowerCase().includes(ql) || m.expertise.some((e) => e.toLowerCase().includes(ql));
  });

  async function sendRequest(mentorId: string) {
    setBusy(mentorId);
    try {
      await api("/api/mentor-connections", {
        method: "POST",
        body: JSON.stringify({ mentorId, message: msgMap[mentorId] ?? "" }),
      });
      setExpandMsg(null);
      load();
    } catch (e) { alert(toErr(e).error); }
    finally { setBusy(null); }
  }

  async function withdraw(connId: string) {
    if (!confirm("Withdraw this connection request?")) return;
    try {
      await api(`/api/mentor-connections/${connId}`, { method: "PATCH", body: JSON.stringify({ status: "withdrawn" }) });
      load();
    } catch (e) { alert(toErr(e).error); }
  }

  return (
    <div className="space-y-6">
      {showApply && <BecomeMentorModal onClose={() => { setShowApply(false); }} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Find Your Mentor</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Connect with verified professionals. Once accepted, book a video call in their available hours.</p>
        </div>
        <button onClick={() => setShowApply(true)} className="btn-ghost text-sm">
          Become a mentor
        </button>
      </div>

      <input
        className="input max-w-md"
        placeholder="Search by name, company, skill…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <ErrorAlert err={err} />

      {!mentors ? (
        <div className="text-sm text-zinc-500"><Spinner /> Loading mentors…</div>
      ) : filtered?.length === 0 ? (
        <Alert kind="info">No mentors match &ldquo;{q}&rdquo;.</Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered?.map((m) => {
            const conn = connMap[m.id];
            const isPending = conn?.status === "pending";
            const isAccepted = conn?.status === "accepted";
            const isRejected = conn?.status === "rejected";
            const isExpanding = expandMsg === m.id;

            return (
              <div key={m.id} className="card flex flex-col gap-3">
                {/* Avatar + name */}
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-50 font-semibold text-zinc-700 text-sm">
                    {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-zinc-900">{m.name}</span>
                      {m.verified && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">✓ Verified</span>}
                    </div>
                    <p className="text-xs text-zinc-500">{m.designation} · {m.organization} · {m.yearsOfExperience}y exp</p>
                  </div>
                </div>

                {/* Bio */}
                {m.bio && <p className="text-sm text-zinc-600 line-clamp-2">{m.bio}</p>}

                {/* Expertise chips */}
                <div className="flex flex-wrap gap-1.5">
                  {m.expertise.slice(0, 5).map((e) => (
                    <span key={e} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{e}</span>
                  ))}
                </div>

                {/* Available slots */}
                {m.availability.length > 0 && (
                  <div className="text-xs text-zinc-500">
                    {m.availability.map((s) => `${s.day} ${s.start}–${s.end}`).join(", ")}
                  </div>
                )}

                {/* Action */}
                <div className="mt-auto pt-1">
                  {isAccepted && (
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        ✓ Connected — book a video call below
                      </span>
                      <a
                        href={`/connect/meeting?room=mentor-${m.id.slice(-6)}-${info?.current?.label?.replace(/\s/g, "") ?? "student"}`}
                        className="btn-primary block w-full text-center text-sm"
                      >
                        Start video call
                      </a>
                    </div>
                  )}
                  {isPending && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-700 font-medium">⏳ Request pending…</span>
                      <button onClick={() => withdraw(conn._id)} className="text-xs text-red-500 hover:underline">Withdraw</button>
                    </div>
                  )}
                  {isRejected && (
                    <span className="text-xs text-zinc-400">Request declined. You can send a new request.</span>
                  )}
                  {(!conn || isRejected) && (
                    isExpanding ? (
                      <div className="space-y-2">
                        <textarea
                          className="input text-xs"
                          rows={2}
                          placeholder="Introduce yourself (optional)…"
                          value={msgMap[m.id] ?? ""}
                          onChange={(e) => setMsgMap((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setExpandMsg(null)} className="btn-ghost flex-1 text-xs">Cancel</button>
                          <button
                            onClick={() => sendRequest(m.id)}
                            disabled={busy === m.id}
                            className="btn-primary flex-1 text-xs"
                          >{busy === m.id ? "Sending…" : "Send request"}</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setExpandMsg(m.id)}
                        className="btn-ghost w-full text-sm"
                      >Connect →</button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── My Connections tab ───────────────────────────────────────────────────────
function MyConnections() {
  const { info } = usePersona();
  const [connections, setConnections] = useState<ConnectionRow[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const router = useRouter();

  const load = useCallback(() => {
    api<{ connections: ConnectionRow[] }>("/api/mentor-connections")
      .then((d) => { setConnections(d.connections); setErr(null); })
      .catch((e) => setErr(toErr(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function withdraw(id: string) {
    if (!confirm("Withdraw this request?")) return;
    try {
      await api(`/api/mentor-connections/${id}`, { method: "PATCH", body: JSON.stringify({ status: "withdrawn" }) });
      load();
    } catch (e) { alert(toErr(e).error); }
  }

  const statusColor = (s: string) =>
    s === "accepted" ? "text-green-700 bg-green-50" : s === "rejected" ? "text-red-600 bg-red-50" : "text-amber-700 bg-amber-50";
  const statusLabel = (s: string) => s === "accepted" ? "✓ Connected" : s === "rejected" ? "✗ Declined" : "Pending";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">My Connections</h2>
        <p className="mt-0.5 text-sm text-zinc-500">Track your mentor connection requests. Once accepted you can book a video call.</p>
      </div>
      <ErrorAlert err={err} />
      {connections === null ? (
        <div className="text-sm text-zinc-500"><Spinner /> Loading…</div>
      ) : connections.length === 0 ? (
        <Alert kind="info">No connection requests yet. Go to <b>Find Mentor</b> and send your first request.</Alert>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {connections.map((c) => {
            const m = c.mentorId;
            return (
              <div key={c._id} className="flex flex-wrap items-start gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-sm font-semibold text-zinc-700">
                  {m?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("") ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900">{m?.name ?? "Unknown"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(c.status)}`}>{statusLabel(c.status)}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{m?.designation} · {m?.organization}</p>
                  {c.message && <p className="mt-1 text-xs text-zinc-400 italic">&ldquo;{c.message}&rdquo;</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {c.status === "accepted" && (
                    <button
                      onClick={() => router.push(`/connect/meeting?room=mentor-${String(m?._id).slice(-6)}-${info?.current?.label?.replace(/\s/g, "") ?? "student"}`)}
                      className="btn-primary text-xs"
                    >Video call</button>
                  )}
                  {c.status === "pending" && (
                    <button onClick={() => withdraw(c._id)} className="text-xs text-red-500 hover:underline">Withdraw</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Meetings tab (SparkMeet) ─────────────────────────────────────────────────
function Meetings() {
  const router = useRouter();
  const { info } = usePersona();
  const [meetingCode, setMeetingCode] = useState("");
  const [inputErr, setInputErr] = useState("");
  const [history, setHistory] = useState<MeetingRecord[] | null>(null);
  const [histErr, setHistErr] = useState<ApiErr | null>(null);

  const loadHistory = useCallback(() => {
    api<{ meetings: MeetingRecord[] }>("/api/meetings/history")
      .then((d) => { setHistory(d.meetings); setHistErr(null); })
      .catch((e) => setHistErr(toErr(e)));
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = meetingCode.trim();
    if (!code) { setInputErr("Enter a meeting code."); return; }
    setInputErr("");
    api("/api/meetings/add", { method: "POST", body: JSON.stringify({ meeting_code: code }) }).catch(() => {});
    router.push(`/connect/meeting?room=${encodeURIComponent(code)}`);
  };

  const handleNew = () => {
    const code = `gurukool-${Math.random().toString(36).slice(2, 8)}`;
    api("/api/meetings/add", { method: "POST", body: JSON.stringify({ meeting_code: code }) }).catch(() => {});
    router.push(`/connect/meeting?room=${encodeURIComponent(code)}`);
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(dt);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Video Meetings</h2>
        <p className="mt-0.5 text-sm text-zinc-500">Start or join a meeting. Powered by WebRTC — no downloads needed.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold text-zinc-900 mb-1">Join a meeting</h3>
          <p className="text-sm text-zinc-500 mb-4">Enter the code shared by your host.</p>
          <form onSubmit={handleJoin} className="space-y-3">
            <input className="input" placeholder="Meeting code (e.g. cs301-study)" value={meetingCode} onChange={(e) => setMeetingCode(e.target.value)} />
            {inputErr && <p className="text-xs text-red-600">{inputErr}</p>}
            <button type="submit" className="btn-primary w-full">Join →</button>
          </form>
        </div>
        <div className="card flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-zinc-900 mb-1">Start a new meeting</h3>
            <p className="text-sm text-zinc-500 mb-4">Create an instant room and share the code.</p>
          </div>
          <button onClick={handleNew} className="btn-ghost w-full">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            New meeting room
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-center text-sm">
        {[["Video & Audio"], ["Screen Share"], ["In-call Chat"], ["Share by Code"]].map(([label]) => (
          <div key={label} className="card py-4">
            <div className="text-xs font-medium text-zinc-700">{label}</div>
          </div>
        ))}
      </div>
      <section>
        <h3 className="font-semibold text-zinc-900 mb-3">Recent meetings</h3>
        <ErrorAlert err={histErr} />
        {history === null ? (
          <div className="text-sm text-zinc-500"><Spinner /> Loading…</div>
        ) : history.length === 0 ? (
          <Alert kind="info">Your past meetings will appear here once you join one.</Alert>
        ) : (
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {history.map((m, i) => (
              <div key={`${m._id}-${i}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 text-zinc-600">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{m.meetingCode}</div>
                    <div className="text-xs text-zinc-400">{formatDate(m.date)}</div>
                  </div>
                </div>
                <button onClick={() => router.push(`/connect/meeting?room=${encodeURIComponent(m.meetingCode)}`)} className="btn-ghost text-xs">Rejoin</button>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="text-xs text-zinc-400">Meetings use browser WebRTC (no recordings stored). Signed in as <b>{info?.current?.label ?? "you"}</b>.</p>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
function ConnectInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === sp.get("tab"))?.id ?? "mentors") as (typeof TABS)[number]["id"];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Connect & Grow"
        subtitle="Find a mentor, send a connection request, and book a 1:1 video call once accepted."
      />

      <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => router.replace(`/connect?tab=${t.id}`, { scroll: false })}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? "border-[#D9541E] text-[#D9541E]" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "mentors" && <FindMentor />}
      {tab === "connections" && <MyConnections />}
      {tab === "meetings" && <Meetings />}
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500"><Spinner /> Loading…</div>}>
      <ConnectInner />
    </Suspense>
  );
}
