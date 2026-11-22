// PATCH /api/peer-sessions/:id { action: "accept" | "decline" | "cancel" }
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PeerSession, type PeerSessionDoc } from "@/models/peer";
import { requireRole } from "@/lib/persona";
import { apiError, badRequest, notFound } from "@/lib/api";
import { notifyProfile } from "@/lib/notify";
import { newRoomCode, nextStatus, type PeerAction, type PeerStatus } from "@/lib/peers";
import { fmtDateTimeIST } from "@/lib/slots";
import { publicPeerSession } from "@/lib/peer-view";

export const dynamic = "force-dynamic";
const ACTIONS: PeerAction[] = ["accept", "decline", "cancel"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireRole("student");
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return notFound("Session not found");
    const action = (await req.json().catch(() => ({})))?.action as PeerAction;
    if (!ACTIONS.includes(action)) return badRequest("Action must be accept, decline or cancel");

    await connectDB();
    const s = await PeerSession.findById(id).lean<PeerSessionDoc>();
    // Only the two participants may see or change a session.
    if (!s || (s.requesterKey !== me.id && s.peerKey !== me.id)) return notFound("Session not found");
    const isRequester = s.requesterKey === me.id;
    const t = nextStatus(s.status as PeerStatus, action, isRequester);
    if (!t.ok) return NextResponse.json({ error: t.error, code: t.code === 403 ? "FORBIDDEN" : "CONFLICT" }, { status: t.code });

    const set: Record<string, unknown> = { status: t.status, respondedAt: new Date() };
    if (t.status === "ACCEPTED") set.roomCode = newRoomCode();
    // Conditional update guards against two clicks racing each other.
    const updated = await PeerSession.findOneAndUpdate({ _id: id, status: s.status }, { $set: set }, { new: true }).lean<PeerSessionDoc>();
    if (!updated) return NextResponse.json({ error: "This session was just changed. Refresh and try again.", code: "CONFLICT" }, { status: 409 });

    const myName = isRequester ? s.requesterName : s.peerName;
    const otherKey = isRequester ? s.peerKey : s.requesterKey;
    const when = fmtDateTimeIST(s.startAt);
    const title = t.status === "ACCEPTED" ? `${myName} accepted your study session` : t.status === "DECLINED" ? `${myName} declined your study session` : `${myName} cancelled a study session`;
    await notifyProfile("student", otherKey, { title, body: `${s.topic} · ${when}`, link: "/connect?tab=sessions" });
    return NextResponse.json({ session: publicPeerSession(updated, me.id) });
  } catch (e) {
    return apiError(e);
  }
}
