"use client";
import Link from "next/link";
import { PORTAL_INFO, type PortalKey } from "@/lib/portals";

export default function Welcome() {
  return (
    <div className="mx-auto max-w-4xl py-16 px-6">
      <div className="mb-14 text-center">
        <img src="/udaan-logo.png" alt="UDAAN" style={{width:"180px",height:"60px"}} className="mx-auto object-contain" />
        <p className="mt-5 text-lg font-medium tracking-tight" style={{color:"#6b6460"}}>Learn. Build. Connect. Compete. Grow.</p>
        <p className="mt-1.5 text-sm" style={{color:"#a89e94"}}>An intelligent, industry-connected learning ecosystem.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(PORTAL_INFO) as PortalKey[]).map((p) => (
          <Link key={p} href={`/${p}/login`} className="card-hover group flex flex-col p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150 group-hover:text-white" style={{background:"#ede8e0",color:"#6b6460"}} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="#D9541E"} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="#ede8e0"}>{PORTAL_INFO[p].name.slice(0,1)}</span>
            <h2 className="mt-5 font-semibold" style={{color:"#111111"}}>{PORTAL_INFO[p].name}</h2>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed" style={{color:"#a89e94"}}>{PORTAL_INFO[p].blurb}</p>
            <span className="mt-5 text-[13px] font-semibold group-hover:translate-x-0.5 transition-transform duration-200" style={{color:"#D9541E"}}>Sign in →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
