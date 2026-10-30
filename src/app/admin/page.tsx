"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";

type U = { id: string; name: string; email: string; role: string; approved: boolean; active: boolean; organization: string; createdAt: string };
const ROLE: Record<string, string> = { student: "Student", mentor: "Expert / Mentor", recruiter: "Recruiter", admin: "Admin" };

export default function AdminPage() {
  const [role, setRole] = useState("");
  const [list, setList] = useState<U[] | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ users: U[] }>(`/api/admin/users${role ? `?role=${role}` : ""}`).then((d) => { setList(d.users); setErr(null); }).catch((e) => setErr(toErr(e)));
  }, [role]);
  useEffect(() => { load(); }, [load]);
  async function update(id: string, patch: { approved?: boolean; active?: boolean }) {
    setBusy(id);
    try { await api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id, ...patch }) }); load(); }
    catch (e) { setErr(toErr(e)); } finally { setBusy(null); }
  }
  const pending = list?.filter((u) => u.role === "recruiter" && !u.approved).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader title="Admin · User Management" subtitle="All registered GURUKOOL accounts, loaded from MongoDB." />
      <ErrorAlert err={err} />
      {pending > 0 && <Alert kind="warn">{pending} recruiter account{pending > 1 ? "s" : ""} awaiting approval.</Alert>}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">Users {list && <span className="text-sm font-normal text-slate-500">({list.length})</span>}</h2>
          <select className="input w-48" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
            <option value="">All roles</option><option value="student">Students</option><option value="mentor">Experts / Mentors</option>
            <option value="recruiter">Recruiters</option><option value="admin">Admins</option>
          </select>
        </div>
        {!list ? <Spinner /> : list.length === 0 ? <p className="text-sm text-slate-500">No accounts found.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium">{u.name}{u.organization && <div className="text-xs font-normal text-slate-500">{u.organization}</div>}</td>
                    <td className="text-slate-600">{u.email}</td>
                    <td>{ROLE[u.role] ?? u.role}</td>
                    <td className="space-x-1">
                      <span className={`chip ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{u.active ? "Active" : "Suspended"}</span>
                      {u.role === "recruiter" && <span className={`chip ${u.approved ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>{u.approved ? "Approved" : "Pending approval"}</span>}
                    </td>
                    <td className="text-slate-500">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      {u.role === "recruiter" && (u.approved
                        ? <button className="text-xs text-slate-600 hover:underline" disabled={busy === u.id} onClick={() => update(u.id, { approved: false })}>Revoke approval</button>
                        : <button className="btn-primary px-2.5 py-1 text-xs" disabled={busy === u.id} onClick={() => update(u.id, { approved: true })}>Approve</button>)}
                      {u.role !== "admin" && (u.active
                        ? <button className="text-xs text-red-600 hover:underline" disabled={busy === u.id} onClick={() => confirm(`Suspend ${u.name}?`) && update(u.id, { active: false })}>Suspend</button>
                        : <button className="text-xs text-emerald-700 hover:underline" disabled={busy === u.id} onClick={() => update(u.id, { active: true })}>Reactivate</button>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
