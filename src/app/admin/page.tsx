"use client";
import { useCallback, useEffect, useState } from "react";
import { ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";

type R = { id: string; email: string; name: string; organization: string; designation: string; approved: boolean };

export default function AdminPage() {
  const [list, setList] = useState<R[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const load = useCallback(() => api<{ recruiters: R[] }>("/api/admin/recruiters").then((d) => { setList(d.recruiters); setErr(null); }).catch((e) => setErr(toErr(e))), []);
  useEffect(() => { load(); }, [load]);
  async function set(id: string, approved: boolean) {
    try { await api("/api/admin/recruiters", { method: "PATCH", body: JSON.stringify({ id, approved }) }); load(); } catch (e) { setErr(toErr(e)); }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Admin" subtitle="Approve recruiter accounts before they can access student data." />
      <ErrorAlert err={err} />
      <div className="card space-y-3">
        <h2 className="h2">Recruiter accounts</h2>
        {!list ? <Spinner /> : list.length === 0 ? <p className="text-sm text-slate-500">No recruiter accounts yet.</p> : list.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div><b className="text-sm">{r.name}</b><p className="text-xs text-slate-500">{r.email} · {r.designation}, {r.organization}</p></div>
            <div className="flex items-center gap-2">
              <span className={`chip ${r.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{r.approved ? "Approved" : "Pending"}</span>
              {r.approved ? <button className="btn-ghost px-3 py-1.5" onClick={() => set(r.id, false)}>Revoke</button>
                : <button className="btn-primary px-3 py-1.5" onClick={() => set(r.id, true)}>Approve</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
