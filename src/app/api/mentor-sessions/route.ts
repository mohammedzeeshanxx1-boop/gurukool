import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Mentor, MentorSession, type MentorT } from "@/models/connect";
import { Student } from "@/models";
import { apiError, badRequest, conflict, isDupKey, notFound } from "@/lib/api";
import { ForbiddenError, getPersona, requireRole } from "@/lib/persona";
import { DURATIONS, upcomingSlots } from "@/lib/slots";
import { publicSession, type SessionDoc } from "@/lib/sessions";
import { User } from "@/models/user";

export const dynamic = "force-dynamic";

// GET — students see their own bookings; mentors see bookings addressed to them. Recruiters: none.
export async function GET() {
  try {
    const p = await getPersona();
    if (p.role === "recruiter" || p.role === "admin") throw new ForbiddenError("Only students and mentors can view mentorship bookings.");
    await connectDB();
    await ensureSeed();
    const filter = p.role === "student" ? { studentId: p.id } : { mentorId: p.id };
    const list = (await MentorSession.find(filter).sort({ requestedStartAt: 1 }).lean()) as unknown as SessionDoc[];
    return NextResponse.json({ role: p.role, sessions: list.map((s) => publicSession(s, p.role as "student" | "mentor")) });
  } catch (e) {
    return apiError(e);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST — student requests a weekend session.
export async function POST(req: Request) {
  try {
    const p = await requireRole("student");
    const b = await req.json().catch(() => null);
    if (!b) return badRequest("Invalid JSON body");
    // Identity comes from the signed-in account, not the request body.
    await connectDB();
    const account = await User.findById(p.uid).select("name email").lean<{ name: string; email: string }>();
    const studentName = (account?.name ?? "").slice(0, 100);
    const studentEmail = (account?.email ?? "").slice(0, 120);
    const topic = String(b.topic ?? "").trim();
    const message = String(b.message ?? "").trim();
    const durationMinutes = Number(b.durationMinutes);
    const startAt = new Date(String(b.startAt ?? ""));

    if (!studentName) return badRequest("Your name is required");
    if (!EMAIL.test(studentEmail)) return badRequest("A valid email is required");
    if (!mongoose.isValidObjectId(b.mentorId)) return badRequest("Pick a mentor");
    if (!topic) return badRequest("Pick a topic");
    if (message.length < 10) return badRequest("Describe what you want to learn (at least 10 characters)");
    if (message.length > 1000) return badRequest("Message is too long (max 1000 characters)");
    if (!DURATIONS.includes(durationMinutes)) return badRequest(`Duration must be one of ${DURATIONS.join(", ")} minutes`);
    if (Number.isNaN(startAt.getTime())) return badRequest("Pick a date and time");
    if (startAt.getTime() <= Date.now()) return badRequest("The session must be in the future");

    await connectDB();
    await ensureSeed();
    const student = await Student.findOne({ key: p.id }).lean();
    if (!student) return badRequest("Save your student profile on the Dashboard first.");
    const mentor = (await Mentor.findById(b.mentorId).lean()) as MentorT | null;
    if (!mentor || mentor.profileStatus !== "active") return notFound("Mentor not found");
    if (!mentor.teachingTopics.includes(topic)) return badRequest("This mentor doesn't offer that topic");

    // Must be one of the mentor's real configured slots, and the duration must fit inside it.
    const slot = upcomingSlots(mentor.availability).find((s) => s.startAt === startAt.toISOString());
    if (!slot) return badRequest("That time isn't one of this mentor's available slots (slots are in IST, at least 2 hours ahead).");
    if (durationMinutes > slot.slotMinutes) return badRequest(`This slot is ${slot.slotMinutes} minutes; choose a shorter duration`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60000);

    const startIso = startAt.toISOString();
    if (await MentorSession.exists({ slotLock: `${mentor._id}|${startIso}` }))
      return conflict("This slot has already been booked by another student. Please pick another slot.");
    // Student can't hold two live requests that overlap in time (with any mentor).
    const clash = await MentorSession.findOne({
      studentId: p.id, status: { $in: ["PENDING", "ACCEPTED"] },
      requestedStartAt: { $lt: endAt }, requestedEndAt: { $gt: startAt },
    }).lean<{ mentorName: string; mentorId: unknown }>();
    if (clash)
      return conflict(String(clash.mentorId) === String(mentor._id)
        ? "You already have a request for this slot with this mentor."
        : `You already have a session request at this time (with ${clash.mentorName}).`);

    try {
      const s = await MentorSession.create({
        studentId: p.id, studentName, studentEmail, mentorId: mentor._id, mentorName: mentor.name, topic,
        requestedStartAt: startAt, requestedEndAt: endAt, durationMinutes, message, status: "PENDING",
        activeKey: `${p.id}|${mentor._id}|${startIso}`,
      });
      return NextResponse.json({ session: publicSession(s.toObject() as SessionDoc, "student") }, { status: 201 });
    } catch (e) {
      if (isDupKey(e)) return conflict("You already have a request for this slot with this mentor.");
      throw e;
    }
  } catch (e) {
    return apiError(e);
  }
}
