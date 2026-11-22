"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./ui";

export type PersonaOption = { role: "student" | "mentor" | "recruiter"; id: string; label: string; sub: string };
export type PersonaInfo = { persona: { role: string; id: string }; current: PersonaOption; options: PersonaOption[]; demoEnabled: boolean };

export const CONNECT_URL = process.env.NEXT_PUBLIC_CONNECT_URL ?? "";

export function usePersona() {
  const [info, setInfo] = useState<PersonaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    api<PersonaInfo>("/api/persona").then((d) => { setInfo(d); setError(null); }).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener("gk-account-updated", reload);
    return () => window.removeEventListener("gk-account-updated", reload);
  }, [reload]);
  return { info, role: info?.persona.role, id: info?.persona.id, error, reload };
}

export async function switchPersona(role: string, id: string) {
  await api("/api/persona", { method: "POST", body: JSON.stringify({ role, id }) });
  window.location.reload();
}

const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800", ACCEPTED: "bg-emerald-100 text-emerald-700", REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-zinc-100 text-zinc-600", COMPLETED: "bg-zinc-100 text-zinc-600", DECLINED: "bg-red-100 text-red-700", WITHDRAWN: "bg-zinc-100 text-zinc-600",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`chip font-semibold ${STATUS_CLS[status] ?? "bg-zinc-100"}`}>{status}</span>;
}

/** Opens the existing GURUKOOL collaboration platform. No per-session room is created or claimed. */
export function JoinSessionButton({ startAt, endAt }: { startAt?: string; endAt?: string } = {}) {
  if (startAt && endAt) {
    const now = Date.now(), open = new Date(startAt).getTime() - 15 * 60000, close = new Date(endAt).getTime();
    if (now < open) return <p className="text-xs text-zinc-500">Join opens 15 minutes before the session.</p>;
    if (now > close) return <p className="text-xs text-zinc-500">This session has ended.</p>;
  }
  if (!CONNECT_URL)
    return <p className="text-sm text-amber-700">Video collaboration is not configured. Please contact the administrator.</p>;
  return (
    <div>
      <a href={CONNECT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary px-3 py-1.5">Join Mentorship Session ↗</a>
      <p className="mt-1 text-xs text-zinc-500">Opens the GURUKOOL collaboration space (shared link, not a private room).</p>
    </div>
  );
}

export function PersonaGate({ need, info, children }: { need: "student" | "mentor" | "recruiter"; info: PersonaInfo | null; children: React.ReactNode }) {
  if (!info) return null;
  if (info.persona.role === need) return <>{children}</>;
  const opts = info.options.filter((o) => o.role === need);
  return (
    <div className="card space-y-3">
      <p className="text-sm text-zinc-600">You&apos;re viewing as <b>{info.current.label}</b> ({info.current.role}). This section is for {need}s.</p>
      {info.demoEnabled && opts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {opts.slice(0, 6).map((o) => (
            <button key={o.id} className="btn-ghost" onClick={() => switchPersona(o.role, o.id)}>Switch to {o.label}</button>
          ))}
        </div>
      )}
      <p className="text-xs text-zinc-400">Demo simulation: persona switching is not real authentication.</p>
    </div>
  );
}
