"use client";
import { useState } from "react";
import { switchPersona, usePersona } from "./connect";

// Demo role switcher shown in the sidebar. Clearly labelled as a simulation, not authentication.
export default function PersonaSwitcher() {
  const { info, error } = usePersona();
  const [busy, setBusy] = useState(false);
  if (error || !info) return null;
  const groups = ["student", "mentor", "recruiter"] as const;
  return (
    <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Viewing as (demo)</div>
      <div className="mt-1 text-sm font-medium text-slate-800">{info.current.label}</div>
      <div className="text-xs capitalize text-slate-500">{info.current.role}</div>
      {info.demoEnabled ? (
        <select
          className="input mt-2 py-1.5 text-xs"
          disabled={busy}
          value={`${info.persona.role}|${info.persona.id}`}
          onChange={async (e) => {
            const [role, id] = e.target.value.split("|");
            setBusy(true);
            try { await switchPersona(role, id); } finally { setBusy(false); }
          }}
        >
          {groups.map((g) => (
            <optgroup key={g} label={g[0].toUpperCase() + g.slice(1) + "s"}>
              {info.options.filter((o) => o.role === g).map((o) => (
                <option key={o.id} value={`${o.role}|${o.id}`}>{o.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : <p className="mt-2 text-xs text-slate-500">Persona switching is disabled.</p>}
      <p className="mt-2 text-[10px] leading-snug text-slate-400">Simulation for the demo, not real login.</p>
    </div>
  );
}
