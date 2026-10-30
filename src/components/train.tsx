"use client";
import Link from "next/link";

export type CourseCard = {
  id: string; title: string; description: string; category: string; difficulty: string; durationWeeks: number;
  skillTags: string[]; published: boolean; isDemo: boolean; moduleCount: number; lessonCount: number;
  trainer: { id: string; name: string; designation: string; isDemo: boolean }; enrolled?: boolean; isOwner?: boolean;
};

export function DemoContentBadge() {
  return <span className="chip bg-amber-100 text-amber-800" title="Sample course content for the demo">Demo content</span>;
}

export function ProgressBar({ pct, color = "bg-blue-600", label }: { pct: number; color?: string; label?: string }) {
  return (
    <div>
      {label && <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{label}</span><span>{pct}%</span></div>}
      <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>
    </div>
  );
}

export function CourseCardView({ c, onEnroll, busy }: { c: CourseCard; onEnroll?: () => void; busy?: boolean }) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{c.title}</h3>
        <div className="flex shrink-0 gap-1">{c.isDemo && <DemoContentBadge />}{!c.published && <span className="chip bg-slate-100 text-slate-600">Draft</span>}</div>
      </div>
      <p className="mt-1 line-clamp-3 text-sm text-slate-600">{c.description}</p>
      <p className="mt-2 text-sm text-slate-500">
        Trainer: <b className="font-medium text-slate-700">{c.trainer.name}</b>{c.trainer.isDemo && <span className="text-amber-700"> (fictional demo profile)</span>}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 p-2"><div className="font-semibold text-slate-800">{c.difficulty}</div><div className="text-slate-500">Level</div></div>
        <div className="rounded-lg bg-slate-50 p-2"><div className="font-semibold text-slate-800">{c.moduleCount}</div><div className="text-slate-500">Modules</div></div>
        <div className="rounded-lg bg-slate-50 p-2"><div className="font-semibold text-slate-800">{c.durationWeeks} wk</div><div className="text-slate-500">Duration</div></div>
      </div>
      <div className="mt-3 text-xs text-slate-500">{c.category}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">{c.skillTags.map((s) => <span key={s} className="chip bg-blue-50 text-blue-700">{s}</span>)}</div>
      <div className="mt-4 flex gap-2 pt-1">
        <Link href={`/train/courses/${c.id}`} className="btn-ghost flex-1">View Course</Link>
        {c.isOwner ? <Link href={`/train/courses/${c.id}`} className="btn-primary flex-1">Manage</Link>
          : c.enrolled ? <span className="btn flex-1 bg-emerald-50 text-emerald-700">✓ Enrolled</span>
          : onEnroll ? <button className="btn-primary flex-1" onClick={onEnroll} disabled={busy}>Enroll</button> : null}
      </div>
    </div>
  );
}
