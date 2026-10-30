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
    <div className="mt-3">
      <button onClick={toggle} className="btn-ghost w-full justify-between py-1.5 text-xs" aria-expanded={open}>
        <span>🔔 Notifications</span>
        {d.unread > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">{d.unread}</span>}
      </button>
      {open && (
        <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
          {d.items.length === 0 ? <p className="text-xs text-slate-500">No notifications yet.</p> : d.items.map((n) => (
            <Link key={n.id} href={n.link || "#"} className={`block rounded-md border p-2 text-xs ${n.read ? "border-slate-100 bg-white" : "border-blue-200 bg-blue-50"}`}>
              <div className="font-semibold text-slate-800">{n.title}</div>
              {n.body && <div className="text-slate-600">{n.body}</div>}
              <div className="mt-0.5 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString("en-IN")}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
