import Link from "next/link";
import { PORTAL_INFO, type PortalKey } from "@/lib/portals";

const ICON: Record<PortalKey, string> = { student: "✦", recruiter: "◎", expert: "▤", admin: "⚙" };

export default function Welcome() {
  return (
    <div className="mx-auto max-w-5xl py-10">
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">GURUKOOL</h1>
        <p className="mt-2 text-lg text-blue-700">Learn. Build. Connect. Compete. Grow.</p>
        <p className="mt-2 text-sm text-slate-500">An intelligent, industry-connected learning &amp; training ecosystem.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(PORTAL_INFO) as PortalKey[]).map((p) => (
          <Link key={p} href={`/${p}/login`} className="card group flex flex-col transition hover:border-blue-300 hover:shadow-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-lg text-blue-700">{ICON[p]}</span>
            <h2 className="mt-4 font-semibold text-slate-900">{PORTAL_INFO[p].name} Sign In</h2>
            <p className="mt-1 flex-1 text-sm text-slate-500">{PORTAL_INFO[p].blurb}</p>
            <span className="mt-4 text-sm font-medium text-blue-700 group-hover:underline">Continue →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
