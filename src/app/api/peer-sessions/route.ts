// GET  /api/peer-sessions — sessions I requested or was invited to
// POST /api/peer-sessions — request a study session with another student
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { User } from "@/models/user";
import { PeerConnection, PeerSession, type PeerSessionDoc } from "@/models/peer";
import { requireRole } from "@/lib/persona";
import { apiError, badRequest, conflict, notFound } from "@/lib/api";
import { notifyProfile } from "@/lib/notify";
import { SESSION_KINDS, overlaps, pairKey, validatePeerRequest } from "@/lib/peers";
import { publicPeerSession } from "@/lib/peer-view";
import { fmtDateTimeIST } from "@/lib/slots";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const me = await requireRole("student");
    await connectDB();
    const list = await PeerSession.find({ $or: [{ requesterKey: me.id }, { peerKey: me.id }] }).sort({ startAt: 1 }).limit(200).lean<PeerSessionDoc[]>();
    return NextResponse.json({ sessions: list.map((s) => publicPeerSession(s, me.id)) });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole("student");
    const v = validatePeerRequest(await req.json().catch(() => null));
    if (!v.ok) return badRequest(v.error);
    const { peerKey, kind, topic, message, startAt, durationMinutes } = v.value;
    if (peerKey === me.id) return badRequest("You can't book a session with yourself");

    await connectDB();
    const [mine, peer] = await Promise.all([
      Student.findOne({ key: me.id }).select("name").lean<{ name: string }>(),
      Student.findOne({ key: peerKey }).select("key name").lean<{ key: string; name: string }>(),
    ]);
    if (!mine) return badRequest("Save your profile on the My Profile page first.");
    if (!peer) return notFound("That student isn't available for sessions");
    const peerUser = await User.findOne({ role: "student", profileId: peerKey }).select("active").lean<{ active?: boolean }>();
    if (peerUser?.active === false) return notFound("That student isn't available for sessions");
    // Sessions are only between connections.
    if (!(await PeerConnection.exists({ pairKey: pairKey(me.id, peerKey), status: "ACCEPTED" })))
      return NextResponse.json({ error: `Connect with ${peer.name} first, then request a session.`, code: "FORBIDDEN" }, { status: 403 });

    // One open request per pair, and no double-booking either student.
    if (await PeerSession.exists({ status: "PENDING", $or: [{ requesterKey: me.id, peerKey }, { requesterKey: peerKey, peerKey: me.id }] }))
      return conflict("You already have a pending request with this student");
    const dayMs = 24 * 60 * 60 * 1000;
    const nearby = await PeerSession.find({
      status: { $in: ["PENDING", "ACCEPTED"] },
      startAt: { $gt: new Date(startAt.getTime() - dayMs), $lt: new Date(startAt.getTime() + dayMs) },
      $or: [{ requesterKey: { $in: [me.id, peerKey] } }, { peerKey: { $in: [me.id, peerKey] } }],
    }).lean<PeerSessionDoc[]>();
    if (nearby.some((s) => overlaps(new Date(s.startAt), s.durationMinutes, startAt, durationMinutes)))
      return conflict("One of you already has a session at that time. Pick another slot.");

    const s = await PeerSession.create({ requesterKey: me.id, requesterName: mine.name, peerKey, peerName: peer.name, kind, topic, message, startAt, durationMinutes });
    await notifyProfile("student", peerKey, { title: kind === "explain" ? `${mine.name} asked you to explain something` : `${mine.name} wants to study with you`, body: `${SESSION_KINDS[kind]}: ${topic} · ${fmtDateTimeIST(startAt)}`, link: "/connect?tab=sessions" });
    return NextResponse.json({ session: publicPeerSession(s.toObject() as PeerSessionDoc, me.id) }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
