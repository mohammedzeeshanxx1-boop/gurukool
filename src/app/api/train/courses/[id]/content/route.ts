import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { assertTrainer, istDayName, istToDate, loadCourse } from "@/lib/train/core";
import { apiError, badRequest, cleanList, conflict, isDupKey, notFound } from "@/lib/api";
import { getPersona } from "@/lib/persona";
import { TrainingAssignment, TrainingCourse, TrainingSession } from "@/models/train";

export const dynamic = "force-dynamic";

// POST {type: "module" | "lesson" | "assignment" | "session", ...} — trainer-only course building.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await connectDB();
    const c = await loadCourse(id);
    if (!c) return notFound("Course not found");
    const p = await getPersona();
    assertTrainer(p, c);
    const b = await req.json().catch(() => null);
    if (!b) return badRequest("Invalid JSON body");
    const str = (k: string, min: number, max: number, label: string) => {
      const v = String(b[k] ?? "").trim();
      if (v.length < min) throw badRequest(`${label} must be at least ${min} characters`);
      return v.slice(0, max);
    };
    const moduleExists = (mid: unknown) => c.modules.some((m) => String(m._id) === String(mid));

    try {
      switch (b.type) {
        case "module": {
          const mod = { _id: new mongoose.Types.ObjectId(), title: str("title", 3, 140, "Module title"), summary: String(b.summary ?? "").slice(0, 1000), lessons: [] };
          await TrainingCourse.updateOne({ _id: c._id }, { $push: { modules: mod } });
          return NextResponse.json({ id: String(mod._id) }, { status: 201 });
        }
        case "lesson": {
          if (!moduleExists(b.moduleId)) return badRequest("Pick a module of this course");
          const d = Number(b.durationMinutes);
          if (!Number.isInteger(d) || d < 5 || d > 600) return badRequest("Estimated duration must be 5–600 minutes");
          const lesson = {
            _id: new mongoose.Types.ObjectId(), title: str("title", 3, 140, "Lesson title"),
            explanation: str("explanation", 20, 6000, "Lesson explanation"), objectives: cleanList(b.objectives, 10, 200), durationMinutes: d,
          };
          await TrainingCourse.updateOne({ _id: c._id, "modules._id": b.moduleId }, { $push: { "modules.$.lessons": lesson } });
          return NextResponse.json({ id: String(lesson._id) }, { status: 201 });
        }
        case "assignment": {
          if (!moduleExists(b.moduleId)) return badRequest("Pick a module of this course");
          const due = istToDate(String(b.dueDate ?? ""), "23:59");
          if (!due || due.getTime() <= Date.now()) return badRequest("Due date must be a valid future date");
          const maxMarks = Number(b.maxMarks);
          if (!Number.isInteger(maxMarks) || maxMarks < 1 || maxMarks > 1000) return badRequest("Maximum marks must be 1–1000");
          const a = await TrainingAssignment.create({
            courseId: c._id, moduleId: String(b.moduleId), title: str("title", 3, 140, "Assignment title"),
            description: str("description", 10, 2000, "Description"), instructions: String(b.instructions ?? "").slice(0, 4000),
            skillTags: cleanList(b.skillTags), dueAt: due, maxMarks,
          });
          return NextResponse.json({ id: String(a._id) }, { status: 201 });
        }
        case "session": {
          const start = istToDate(String(b.date ?? ""), String(b.startTime ?? ""));
          if (!start) return badRequest("Enter a valid date and start time (IST)");
          if (!["Saturday", "Sunday"].includes(istDayName(start))) return badRequest("Live training sessions must be on a Saturday or Sunday (IST)");
          if (start.getTime() < Date.now() + 60 * 60000) return badRequest("Sessions must be scheduled at least 1 hour in advance");
          const dur = Number(b.durationMinutes);
          if (!Number.isInteger(dur) || dur < 30 || dur > 240) return badRequest("Duration must be 30–240 minutes");
          const end = new Date(start.getTime() + dur * 60000);
          const clash = await TrainingSession.findOne({ trainerId: p.id, status: "SCHEDULED", startAt: { $lt: end }, endAt: { $gt: start } }).lean();
          if (clash) return conflict("You already have a live session overlapping this time.");
          const s = await TrainingSession.create({
            courseId: c._id, trainerId: p.id, title: str("title", 3, 140, "Session topic"), agenda: String(b.agenda ?? "").slice(0, 1000),
            startAt: start, endAt: end, status: "SCHEDULED",
          });
          return NextResponse.json({ id: String(s._id) }, { status: 201 });
        }
        default:
          return badRequest("Unknown content type");
      }
    } catch (e) {
      if (e instanceof Response) return e; // validation response thrown by str()
      if (isDupKey(e)) return conflict("You already have a live session at this time.");
      throw e;
    }
  } catch (e) {
    return apiError(e);
  }
}
