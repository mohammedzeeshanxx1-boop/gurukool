import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Mentor, MentorSession, type MentorT } from "@/models/connect";
import { apiError, badRequest, notFound } from "@/lib/api";
import { parseMentorInput, publicMentor } from "@/lib/mentors";
import { ForbiddenError, getPersona } from "@/lib/persona";
import { upcomingSlots } from "@/lib/slots";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound("Mentor not found");
    await connectDB();
    await ensureSeed();
    const m = (await Mentor.findById(id).lean()) as MentorT | null;
    const persona = await getPersona();
    const isOwner = persona.role === "mentor" && persona.id === id;
    if (!m || (m.profileStatus !== "active" && !isOwner)) return notFound("Mentor not found");

    // Hide slots already taken by an accepted booking.
    const slots = upcomingSlots(m.availability);
    const taken = await MentorSession.find({
      mentorId: id, status: { $in: ["ACCEPTED", "COMPLETED"] },
      requestedStartAt: { $in: slots.map((s) => new Date(s.startAt)) },
    }).select("requestedStartAt").lean<{ requestedStartAt: Date }[]>();
    const takenSet = new Set(taken.map((t) => t.requestedStartAt.toISOString()));

    let myRequests: string[] = [];
    if (persona.role === "student") {
      const mine = await MentorSession.find({ mentorId: id, studentId: persona.id, status: { $in: ["PENDING", "ACCEPTED"] } })
        .select("requestedStartAt").lean<{ requestedStartAt: Date }[]>();
      myRequests = mine.map((x) => x.requestedStartAt.toISOString());
    }
    return NextResponse.json({
      mentor: publicMentor(m),
      slots: slots.filter((s) => !takenSet.has(s.startAt)),
      myRequests,
      isOwner,
      timezone: "Asia/Kolkata",
    });
  } catch (e) {
    return apiError(e);
  }
}

// PATCH — only the mentor persona that owns this profile may edit it.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound("Mentor not found");
    const persona = await getPersona();
    if (persona.role !== "mentor" || persona.id !== id) throw new ForbiddenError("Only this mentor can edit their profile.");
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");
    const { data, error } = parseMentorInput(body, true);
    if (error) return badRequest(error);
    await connectDB();
    const m = (await Mentor.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean()) as MentorT | null;
    if (!m) return notFound("Mentor not found");
    return NextResponse.json({ mentor: publicMentor(m) });
  } catch (e) {
    return apiError(e);
  }
}
