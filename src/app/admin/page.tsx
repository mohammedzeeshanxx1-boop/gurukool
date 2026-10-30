"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";

type U = { id: string; name: string; email: string; role: string; approved: boolean; active: boolean; organization: string; createdAt: string };
const ROLE: Record<string, string> = { student: "Student", mentor: "Expert / Mentor", recruiter: "Recruiter", admin: "Admin" };

type Overview = {
  stats: { users: Record<string, number>; pendingApprovals: number; bookings: Record<string, number>; courses: Record<string, number>; enrollments: number; submissions: Record<string, number>; recruiterRequests: number };
  recentBookings: { id: string; student: string; mentor: string; topic: string; when: string; status: string }[];
  courses: { id: string; title: string; published: boolean; isDemo: boolean; enrollments: number }[];
};
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

function OverviewPanel() {
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const load = useCallback(() => { api<Overview>("/api/admin/overview").then(setO).catch((e) => setErr(toErr(e))); }, []);
  useEffect(() => { load(); }, [load]);
  async function unpublish(id: string) {
    if (!confirm("Unpublish this course? The trainer will be notified.")) return;
    try { await api("/api/admin/courses", { method: "PATCH", body: JSON.stringify({ id, published: false }) }); load(); } catch (e) { setErr(toErr(e)); }
  }
  if (err) return <ErrorAlert err={err} />;
  if (!o) return <div className="text-sm text-slate-500"><Spinner /> Loading platform data…</div>;
  const cards: [string, number][] = [
    ["Students", o.stats.users.student ?? 0], ["Experts", o.stats.users.mentor ?? 0], ["Recruiters", o.stats.users.recruiter ?? 0],
    ["Pending approvals", o.stats.pendingApprovals], ["Session requests", sum(o.stats.bookings)], ["Accepted sessions", o.stats.bookings.ACCEPTED ?? 0],
    ["Published courses", o.stats.courses.published ?? 0], ["Enrollments", o.stats.enrollments], ["Submissions", sum(o.stats.submissions)], ["Recruiter requests", o.stats.recruiterRequests],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map(([l, n]) => <div key={l} className="card p-4"><div className="label">{l}</div><div className="text-2xl font-bold text-slate-900">{n}</div></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-2">
          <h2 className="h2">Recent mentorship requests</h2>
          {o.recentBookings.length === 0 ? <p className="text-sm text-slate-500">No sessions requested yet.</p> : o.recentBookings.map((b) => (
            <div key={b.id} className="flex justify-between gap-2 border-t border-slate-100 pt-2 text-sm">
              <span><b>{b.student}</b> → {b.mentor}<span className="block text-xs text-slate-500">{b.topic} · {b.when}</span></span>
              <span className="chip h-fit bg-slate-100 text-slate-700">{b.status}</span>
            </div>
          ))}
        </div>
        <div className="card space-y-2">
          <h2 className="h2">Courses</h2>
          {o.courses.length === 0 ? <p className="text-sm text-slate-500">No courses created yet.</p> : o.courses.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm">
              <span>{c.title}<span className="block text-xs text-slate-500">{c.published ? "Published" : "Draft"} · {c.enrollments} enrolled{c.isDemo ? " · demo" : ""}</span></span>
              {c.published && <button className="text-xs text-red-600 hover:underline" onClick={() => unpublish(c.id)}>Unpublish</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const pending = list?.filter((u) => (u.role === "recruiter" || u.role === "mentor") && !u.approved).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader title="Admin Portal" subtitle="Platform data, user verification and content, loaded live from MongoDB." />
      <OverviewPanel />
      <ErrorAlert err={err} />
      {pending > 0 && <Alert kind="warn">{pending} expert/recruiter account{pending > 1 ? "s" : ""} awaiting approval.</Alert>}
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
                      {(u.role === "recruiter" || u.role === "mentor") && <span className={`chip ${u.approved ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>{u.approved ? "Approved" : "Pending approval"}</span>}
                    </td>
                    <td className="text-slate-500">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      {(u.role === "recruiter" || u.role === "mentor") && (u.approved
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
