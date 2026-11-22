// GET /api/peers?q= — other students to discover, best matches first, with my connection status to each.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { requireRole } from "@/lib/persona";
import { apiError } from "@/lib/api";
import { connView, peerMatch } from "@/lib/peers";
import { CARD_FIELDS, discoverableFilter, myConnections, otherKey, toCard } from "@/lib/peer-network";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
type Row = Parameters<typeof toCard>[0];

export async function GET(req: Request) {
  try {
    const me = await requireRole("student");
    await connectDB();
    const mine = await Student.findOne({ key: me.id }).select("skills interests careerGoal college").lean<Row>();
    if (!mine) return NextResponse.json({ needsProfile: true, peers: [] });

    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
    const rx = q ? new RegExp(esc(q), "i") : null;
    const filter = { ...(await discoverableFilter([me.id])), ...(rx ? { $or: [{ name: rx }, { headline: rx }, { college: rx }, { branch: rx }, { careerGoal: rx }, { skills: rx }, { interests: rx }] } : {}) };
    const [rows, conns] = await Promise.all([Student.find(filter).select(CARD_FIELDS).limit(200).lean<Row[]>(), myConnections(me.id)]);
    const byPeer = new Map(conns.map((c) => [otherKey(c, me.id), c]));

    const peers = rows
      .map((r) => { const c = byPeer.get(r.key); return { ...toCard(r), ...peerMatch(mine, r), connection: { status: connView(c, me.id), id: c ? String(c._id) : null } }; })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 60);
    return NextResponse.json({ needsProfile: false, peers });
  } catch (e) {
    return apiError(e);
  }
}
