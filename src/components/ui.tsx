"use client";
import { useCallback, useEffect, useState } from "react";

export type Student = {
  name: string; email: string; college: string; branch: string; semester: number;
  skills: string[]; careerGoal: string; interests: string[];
};

export type ApiErr = { error: string; code?: string };

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Request failed"), { code: data.code });
  return data as T;
}

export function useStudent() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErr | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ student: Student | null }>("/api/student");
      setStudent(d.student);
      setError(null);
    } catch (e) {
      setError({ error: (e as Error).message, code: (e as { code?: string }).code });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { student, setStudent, loading, error, reload };
}

export function PageHeader({ title, subtitle, right, eyebrow }: { title: string; subtitle?: string; right?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#16181d] sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#3d4250]">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const cls = {
    info:    "bg-white border-[#e3e5e9] text-[#3d4250]",
    warn:    "bg-[#fdf0cf] border-[#f3dc9f] text-[#7a4508]",
    error:   "bg-[#fde7ea] border-[#f6c4cb] text-[#9b1c2e]",
    success: "bg-[#e1f5e3] border-[#bfe6c4] text-[#0b5e2e]",
  }[kind];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <div>{children}</div>
    </div>
  );
}

export function ErrorAlert({ err }: { err: ApiErr | null }) {
  if (!err) return null;
  if (err.code === "DB_NOT_CONFIGURED")
    return (
      <Alert kind="warn">
        <b>MongoDB not configured.</b> Add <code className="rounded bg-white/60 px-1">MONGODB_URI</code> to <code className="rounded bg-white/60 px-1">.env.local</code> and restart.
      </Alert>
    );
  if (err.code === "AI_NOT_CONFIGURED")
    return (
      <Alert kind="warn">
        <b>AI not configured.</b> Add <code className="rounded bg-white/60 px-1">AI_API_KEY</code>, <code className="rounded bg-white/60 px-1">AI_MODEL</code> and <code className="rounded bg-white/60 px-1">AI_BASE_URL</code> to <code className="rounded bg-white/60 px-1">.env.local</code>.
      </Alert>
    );
  return <Alert kind="error">{err.error}</Alert>;
}

export function SourceBadge({ source }: { source: string }) {
  const ai = source === "ai";
  return (
    <span className={`chip ${ai ? "bg-zinc-100 text-zinc-600" : "bg-zinc-100 text-zinc-500"}`}>
      {ai ? "AI" : source === "rules" ? "Skill Engine" : "Question Bank"}
    </span>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />;
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card">
      <div className="text-[13px] font-medium text-[#5f6573]">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums text-[#16181d]">{value}</div>
      {sub && <div className="mt-1 text-xs text-[#5f6573]">{sub}</div>}
    </div>
  );
}

export const toErr = (e: unknown): ApiErr => ({ error: (e as Error).message, code: (e as { code?: string }).code });
