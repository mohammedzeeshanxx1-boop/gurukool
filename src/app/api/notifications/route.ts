import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getPersona } from "@/lib/persona";
import { Notification } from "@/models/notification";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const p = await getPersona();
    const [items, unread] = await Promise.all([
      Notification.find({ userId: p.uid }).sort({ createdAt: -1 }).limit(30).lean<{ _id: unknown; title: string; body: string; link: string; read: boolean; createdAt: Date }[]>(),
      Notification.countDocuments({ userId: p.uid, read: false }),
    ]);
    return NextResponse.json({ unread, items: items.map((n) => ({ id: String(n._id), title: n.title, body: n.body, link: n.link, read: n.read, createdAt: n.createdAt })) });
  } catch (e) {
    return apiError(e);
  }
}

// PATCH — mark all of the signed-in user's notifications read.
export async function PATCH() {
  try {
    const p = await getPersona();
    await Notification.updateMany({ userId: p.uid, read: false }, { $set: { read: true } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
