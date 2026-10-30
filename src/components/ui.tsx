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

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const cls = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[kind];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function ErrorAlert({ err }: { err: ApiErr | null }) {
  if (!err) return null;
  if (err.code === "DB_NOT_CONFIGURED")
    return (
      <Alert kind="warn">
        <b>MongoDB not configured.</b> Add <code>MONGODB_URI</code> to <code>.env.local</code> and restart <code>npm run dev</code>.
      </Alert>
    );
  if (err.code === "AI_NOT_CONFIGURED")
    return (
      <Alert kind="warn">
        <b>AI not configured.</b> Add <code>AI_API_KEY</code>, <code>AI_MODEL</code> and <code>AI_BASE_URL</code> to <code>.env.local</code> and restart.
      </Alert>
    );
  return <Alert kind="error">{err.error}</Alert>;
}

export function SourceBadge({ source }: { source: string }) {
  const ai = source === "ai";
  return (
    <span className={`chip ${ai ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
      {ai ? "AI-generated" : source === "rules" ? "Rule-based (AI not used)" : "Question bank (AI not used)"}
    </span>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export const toErr = (e: unknown): ApiErr => ({ error: (e as Error).message, code: (e as { code?: string }).code });
