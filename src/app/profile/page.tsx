"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorAlert, PageHeader, Spinner, api, toErr, useStudent, type ApiErr } from "@/components/ui";
import { CAREER_GOALS } from "@/lib/careers";

// Empty form; name/email come from the signed-in account (single source of truth: MongoDB).
const EMPTY_FORM = {
  name: "", email: "", college: "", branch: "", semester: 1, skills: "", careerGoal: "Full Stack Developer", interests: "",
};

export default function ProfilePage() {
  const { student, setStudent, loading, error } = useStudent();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<ApiErr | null>(null);

  useEffect(() => {
    api<{ user: { name: string; email: string } }>("/api/auth/me").then((d) => {
      setForm((f) => ({ ...f, name: f.name || d.user.name, email: d.user.email }));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (student) setForm({ ...student, skills: student.skills.join(", "), interests: student.interests.join(", ") });
  }, [student]);

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null); setSaveErr(null);
    try {
      const d = await api<{ student: typeof student }>("/api/student", { method: "PUT", body: JSON.stringify(form) });
      setStudent(d.student);
      setMsg("Profile saved.");
      window.dispatchEvent(new Event("gk-account-updated"));
    } catch (e) {
      setSaveErr(toErr(e));
    } finally {
      setSaving(false);
    }
  }

  const skills = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
  const interests = form.interests.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Your details"
        title="My Profile"
        subtitle="Your career goal, skills and interests drive skill-gap analysis, recommendations and hackathon matches across UDAAN."
        right={<Link href="/" className="btn-ghost">&larr; Dashboard</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={save} className="card space-y-6 lg:col-span-2 sm:p-8">
          {loading ? <div className="text-sm text-[#5f6573]"><Spinner /> Loading profile…</div> : <ErrorAlert err={error} />}

          <section>
            <h2 className="h2">Personal</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="pf-name">Name</label><input id="pf-name" className="input" value={form.name} onChange={set("name")} required /></div>
              <div><label className="label" htmlFor="pf-email">Email (account)</label><input id="pf-email" className="input" type="email" value={form.email} readOnly title="Your sign-in email. Change it in Account settings." /></div>
            </div>
          </section>

          <section className="border-t border-[#e3e5e9] pt-6">
            <h2 className="h2">Education</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label" htmlFor="pf-college">College</label><input id="pf-college" className="input" value={form.college} onChange={set("college")} required /></div>
              <div><label className="label" htmlFor="pf-branch">Engineering branch</label><input id="pf-branch" className="input" value={form.branch} onChange={set("branch")} required /></div>
              <div><label className="label" htmlFor="pf-sem">Semester</label>
                <select id="pf-sem" className="input" value={form.semester} onChange={set("semester")}>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="border-t border-[#e3e5e9] pt-6">
            <h2 className="h2">Career</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label" htmlFor="pf-skills">Existing skills (comma separated)</label><input id="pf-skills" className="input" value={form.skills} onChange={set("skills")} placeholder="e.g. HTML, CSS, JavaScript" /></div>
              <div><label className="label" htmlFor="pf-goal">Career goal</label>
                <select id="pf-goal" className="input" value={form.careerGoal} onChange={set("careerGoal")}>
                  {CAREER_GOALS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="pf-int">Interests (for Compete)</label><input id="pf-int" className="input" value={form.interests} onChange={set("interests")} placeholder="e.g. AI, Web3, FinTech" /></div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-[#e3e5e9] pt-6">
            <button className="btn-primary px-6" disabled={saving}>{saving && <Spinner />} Save Profile</button>
            {msg && <span className="text-sm font-medium text-[#0b7a39]">✓ {msg}</span>}
          </div>
          <ErrorAlert err={saveErr} />
        </form>

        {/* Live summary card, navy like the landing page panels */}
        <aside className="card-dark h-fit space-y-5 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl font-display text-xl font-bold text-white" style={{ background: "#D9541E" }}>
              {(form.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate font-display text-xl font-bold">{form.name || "Your name"}</div>
              <div className="truncate text-sm text-white/60">{form.college || "College"}</div>
            </div>
          </div>
          <dl className="space-y-3 text-[15px]">
            <div className="flex justify-between gap-4"><dt className="text-white/60">Goal</dt><dd className="text-right font-medium">{form.careerGoal}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-white/60">Branch</dt><dd className="text-right font-medium">{form.branch || "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-white/60">Semester</dt><dd className="text-right font-medium">{form.semester}</dd></div>
          </dl>
          <div>
            <div className="mb-2 text-sm text-white/60">Skills</div>
            <div className="flex flex-wrap gap-2">
              {skills.length ? skills.map((s) => <span key={s} className="chip bg-white/10 text-white">{s}</span>) : <span className="text-sm text-white/40">None listed yet</span>}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm text-white/60">Interests</div>
            <div className="flex flex-wrap gap-2">
              {interests.length ? interests.map((s) => <span key={s} className="chip bg-[#D9541E]/25 text-[#ffb08f]">{s}</span>) : <span className="text-sm text-white/40">None listed yet</span>}
            </div>
          </div>
          <p className="border-t border-white/10 pt-4 text-xs text-white/50">This preview updates as you type. Save to apply it everywhere.</p>
        </aside>
      </div>
    </div>
  );
}
