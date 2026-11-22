"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "./ui";

type Item = { id: string; title: string; body: string; link: string; read: boolean; createdAt: string };

/** Persistent in-app notifications (MongoDB), refreshed by authenticated polling every 30s. */
export default function Notifications() {
  const [d, setD] = useState<{ unread: number; items: Item[] } | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => { api<{ unread: number; items: Item[] }>("/api/notifications").then(setD).catch(() => {}); }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);
  if (!d) return null;
  async function toggle() {
    setOpen(!open);
    if (!open && d!.unread) { await api("/api/notifications", { method: "PATCH" }).catch(() => {}); setD({ ...d!, unread: 0 }); }
  }
  return (
    <div className="mt-1">
      <button onClick={toggle} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] font-medium text-[#3d4250] transition-colors hover:bg-[#f0f1f3] hover:text-[#16181d]" aria-expanded={open}>
        <span className="flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4"><path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg> Notifications</span>
        {d.unread > 0 && <span className="rounded-full px-1.5 text-[10px] font-medium text-white" style={{background:"#D9541E"}}>{d.unread}</span>}
      </button>
      {open && (
        <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
          {d.items.length === 0 ? <p className="px-2 text-xs text-[#5f6573]">No notifications yet.</p> : d.items.map((n) => (
            <Link key={n.id} href={n.link || "#"} className={`block rounded-lg border border-[#e3e5e9] p-2.5 text-xs ${n.read ? "bg-white" : "bg-[#fbe9e1]"}`}>
              <div className="font-semibold text-[#16181d]">{n.title}</div>
              {n.body && <div className="text-[#3d4250]">{n.body}</div>}
              <div className="mt-0.5 text-[10px] text-[#5f6573]">{new Date(n.createdAt).toLocaleString("en-IN")}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
