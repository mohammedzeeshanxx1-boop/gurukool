// GET  /api/connections — my network: connections, invitations received, invitations sent
// POST /api/connections { peerKey, message? } — send a connection request
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { PeerConnection, type PeerConnectionDoc } from "@/models/peer";
import { requireRole } from "@/lib/persona";
import { apiError, badRequest, conflict, isDupKey, notFound } from "@/lib/api";
import { notifyProfile } from "@/lib/notify";
import { connView, pairKey } from "@/lib/peers";
import { cardsFor, myConnections, otherKey, suspendedKeys } from "@/lib/peer-network";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const me = await requireRole("student");
    await connectDB();
    const [conns, suspended] = await Promise.all([myConnections(me.id), suspendedKeys()]);
    const live = conns.filter((c) => !suspended.includes(otherKey(c, me.id)));
    const cards = await cardsFor(live.map((c) => otherKey(c, me.id)));
    const row = (c: PeerConnectionDoc) => ({ id: String(c._id), peer: cards.get(otherKey(c, me.id)), message: c.message, since: c.respondedAt ?? c.createdAt });
    const by = (v: string) => live.filter((c) => connView(c, me.id) === v && cards.has(otherKey(c, me.id))).map(row);
    return NextResponse.json({ connections: by("connected"), received: by("received"), sent: by("sent") });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole("student");
    const b = await req.json().catch(() => null);
    const peerKey = String(b?.peerKey ?? "").trim().slice(0, 100);
    const message = String(b?.message ?? "").trim();
    if (!peerKey) return badRequest("Pick a student");
    if (peerKey === me.id) return badRequest("You can't connect with yourself");
    if (message.length > 300) return badRequest("Note is too long (max 300 characters)");

    await connectDB();
    const [mine, peer, suspended] = await Promise.all([
      Student.findOne({ key: me.id }).select("name").lean<{ name: string }>(),
      Student.findOne({ key: peerKey, peerDiscoverable: { $ne: false } }).select("key name").lean<{ key: string; name: string }>(),
      suspendedKeys(),
    ]);
    if (!mine) return badRequest("Save your profile on the My Profile page first.");
    if (!peer || suspended.includes(peerKey)) return notFound("That student isn't available");

    const pk = pairKey(me.id, peerKey);
    const existing = await PeerConnection.findOne({ pairKey: pk }).lean<PeerConnectionDoc>();
    if (existing) {
      const v = connView(existing, me.id);
      if (v === "connected") return conflict("You're already connected");
      if (v === "sent") return conflict("Invitation already sent");
      if (v === "received") return conflict(`${peer.name} already invited you. Accept their invitation instead.`);
      // They had sent me an invitation that I declined: replace it with my own request.
      await PeerConnection.deleteOne({ _id: existing._id, status: "DECLINED" });
    }
    try {
      const c = await PeerConnection.create({ pairKey: pk, requesterKey: me.id, addresseeKey: peerKey, message });
      await notifyProfile("student", peerKey, { title: `${mine.name} wants to connect`, body: message.slice(0, 140), link: `/connect/people/${encodeURIComponent(me.id)}` });
      return NextResponse.json({ connection: { id: String(c._id), status: "sent" } }, { status: 201 });
    } catch (e) {
      if (isDupKey(e)) return conflict("Invitation already exists");
      throw e;
    }
  } catch (e) {
    return apiError(e);
  }
}
