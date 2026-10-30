import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Mentor, MentorSession, type MentorT } from "@/models/connect";
import { apiError, badRequest, conflict, isDupKey, notFound } from "@/lib/api";
import { ForbiddenError, getPersona } from "@/lib/persona";
import { toMinutes } from "@/lib/slots";
import { publicSession, type SessionDoc } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/*
  Allowed transitions (enforced server-side, atomically via status preconditions):
    mentor (owner):  PENDING → ACCEPTED | REJECTED,  ACCEPTED → COMPLETED (after start) | CANCELLED
    student (owner): PENDING → CANCELLED,             ACCEPTED → CANCELLED
  A student can never accept/reject; a mentor can only act on bookings addressed to them.
*/
const RULES: Record<string, Record<string, string[]>> = {
  mentor: { ACCEPTED: ["PENDING"], REJECTED: ["PENDING"], COMPLETED: ["ACCEPTED"], CANCELLED: ["ACCEPTED"] },
  student: { CANCELLED: ["PENDING", "ACCEPTED"] },
};

const IST_MS = 330 * 60000;
function stillInAvailability(m: MentorT, start: Date) {
  const ist = new Date(start.getTime() + IST_MS);
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][ist.getUTCDay()];
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return m.availability.some((a) => a.day === day && toMinutes(a.start) === mins);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound("Booking not found");
    const p = await getPersona();
    if (p.role === "recruiter") throw new ForbiddenError("Recruiters can't change mentorship bookings.");
    const b = await req.json().catch(() => null);
    const to = String(b?.status ?? "");
    const note = String(b?.note ?? "").trim().slice(0, 300);
    const allowedFrom = RULES[p.role][to];
    if (!allowedFrom) throw new ForbiddenError(`A ${p.role} can't set a booking to ${to || "that status"}.`);

    await connectDB();
    const owner = p.role === "student" ? { studentId: p.id } : { mentorId: p.id };
    const s = await MentorSession.findOne({ _id: id, ...owner }).lean<{
      status: string; mentorId: mongoose.Types.ObjectId; requestedStartAt: Date; studentId: string;
    }>();
    if (!s) return notFound("Booking not found");
    if (!allowedFrom.includes(s.status)) return conflict(`Can't change a ${s.status} booking to ${to}.`);

    const startIso = s.requestedStartAt.toISOString();
    const set: Record<string, unknown> = { status: to, statusNote: note };
    const unset: Record<string, 1> = {};

    if (to === "ACCEPTED") {
      const mentor = (await Mentor.findById(s.mentorId).lean()) as MentorT | null;
      if (!mentor || !stillInAvailability(mentor, s.requestedStartAt))
        return conflict("This slot is no longer in your availability. Re-add it or reject the request.");
      if (s.requestedStartAt.getTime() <= Date.now()) return conflict("This session time has already passed.");
      set.slotLock = `${s.mentorId}|${startIso}`; // unique index → atomic double-booking prevention
    }
    if (to === "COMPLETED" && s.requestedStartAt.getTime() > Date.now())
      return conflict("A session can only be marked completed after it has started.");
    if (to === "REJECTED" || to === "CANCELLED") { unset.activeKey = 1; unset.slotLock = 1; }
    if (to === "COMPLETED") unset.activeKey = 1;

    let updated;
    try {
      updated = await MentorSession.findOneAndUpdate(
        { _id: id, ...owner, status: { $in: allowedFrom } }, // precondition makes the transition atomic
        { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true }
      ).lean();
    } catch (e) {
      if (isDupKey(e)) return conflict("You already accepted another booking for this slot. Reject this one instead.");
      throw e;
    }
    if (!updated) return conflict("This booking was changed by someone else. Refresh and try again.");

    // Once a slot is accepted, other pending requests for it can't be honoured — close them clearly.
    let autoRejected = 0;
    if (to === "ACCEPTED") {
      const r = await MentorSession.updateMany(
        { mentorId: s.mentorId, requestedStartAt: s.requestedStartAt, status: "PENDING", _id: { $ne: id } },
        { $set: { status: "REJECTED", statusNote: "This slot was booked by another student." }, $unset: { activeKey: 1 } }
      );
      autoRejected = r.modifiedCount;
    }
    return NextResponse.json({ session: publicSession(updated as unknown as SessionDoc, p.role), autoRejected });
  } catch (e) {
    return apiError(e);
  }
}
