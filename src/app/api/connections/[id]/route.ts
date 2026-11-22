// PATCH /api/connections/:id { action: "accept" | "decline" | "withdraw" | "remove" }
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { PeerConnection, PeerSession, type PeerConnectionDoc } from "@/models/peer";
import { requireRole } from "@/lib/persona";
import { apiError, badRequest, notFound } from "@/lib/api";
import { notifyProfile } from "@/lib/notify";
import { connTransition, type ConnAction, type ConnStatus } from "@/lib/peers";

export const dynamic = "force-dynamic";
const ACTIONS: ConnAction[] = ["accept", "decline", "withdraw", "remove"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireRole("student");
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return notFound("Connection not found");
    const action = (await req.json().catch(() => ({})))?.action as ConnAction;
    if (!ACTIONS.includes(action)) return badRequest("Action must be accept, decline, withdraw or remove");

    await connectDB();
    const c = await PeerConnection.findById(id).lean<PeerConnectionDoc>();
    if (!c || (c.requesterKey !== me.id && c.addresseeKey !== me.id)) return notFound("Connection not found");
    const t = connTransition(c.status as ConnStatus, action, c.requesterKey === me.id);
    if (!t.ok) return NextResponse.json({ error: t.error, code: t.code === 403 ? "FORBIDDEN" : "CONFLICT" }, { status: t.code });

    if (t.to === "delete") {
      await PeerConnection.deleteOne({ _id: id, status: c.status });
      if (action === "remove") {
        // Removing a connection also cancels any upcoming sessions between the two students.
        await PeerSession.updateMany(
          { status: { $in: ["PENDING", "ACCEPTED"] }, startAt: { $gt: new Date() }, $or: [{ requesterKey: c.requesterKey, peerKey: c.addresseeKey }, { requesterKey: c.addresseeKey, peerKey: c.requesterKey }] },
          { $set: { status: "CANCELLED", respondedAt: new Date() } },
        );
      }
      return NextResponse.json({ connection: { id, status: "none" } });
    }

    const updated = await PeerConnection.findOneAndUpdate({ _id: id, status: "PENDING" }, { $set: { status: t.to, respondedAt: new Date() } }, { new: true }).lean<PeerConnectionDoc>();
    if (!updated) return NextResponse.json({ error: "This invitation just changed. Refresh and try again.", code: "CONFLICT" }, { status: 409 });
    if (t.to === "ACCEPTED") {
      const mine = await Student.findOne({ key: me.id }).select("name").lean<{ name: string }>();
      await notifyProfile("student", c.requesterKey, { title: `${mine?.name ?? "A student"} accepted your connection request`, body: "You can now request study sessions with each other.", link: `/connect/people/${encodeURIComponent(me.id)}` });
    }
    // Declines are silent: the sender keeps seeing "Pending".
    return NextResponse.json({ connection: { id, status: t.to === "ACCEPTED" ? "connected" : "none" } });
  } catch (e) {
    return apiError(e);
  }
}
