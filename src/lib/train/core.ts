import "server-only";
import mongoose from "mongoose";
import { ForbiddenError, type Persona } from "../persona";
import { TrainingCourse, TrainingEnrollment, type CourseT } from "@/models/train";

export const IST_MS = 330 * 60000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "YYYY-MM-DD" + "HH:MM" in Asia/Kolkata → UTC Date (null if invalid). */
export function istToDate(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi) - IST_MS);
  const back = new Date(dt.getTime() + IST_MS);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null; // e.g. 31 Feb
  return dt;
}
export const istDayName = (d: Date) => DAYS[new Date(d.getTime() + IST_MS).getUTCDay()];

export function safeUrl(v: unknown): string | null {
  const s = String(v ?? "").trim().slice(0, 300);
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch { return null; }
}

export async function loadCourse(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return (await TrainingCourse.findById(id).lean()) as CourseT | null;
}

export const isTrainer = (p: Persona, c: CourseT) => p.role === "mentor" && p.id === String(c.trainerId);

export function assertTrainer(p: Persona, c: CourseT) {
  if (!isTrainer(p, c)) throw new ForbiddenError("Only this course's trainer can do that.");
}

export async function requireEnrollment(p: Persona, courseId: unknown) {
  if (p.role !== "student") throw new ForbiddenError("Switch to the student persona to do this.");
  const e = await TrainingEnrollment.findOne({ studentId: p.id, courseId }).lean<{ _id: unknown; completedLessonIds: string[] }>();
  if (!e) throw new ForbiddenError("Enroll in this course first.");
  return e;
}

export const lessonIds = (c: CourseT) => c.modules.flatMap((m) => m.lessons.map((l) => String(l._id)));

export function courseSummary(c: CourseT, trainer?: { name: string; designation: string; isDemo: boolean } | null) {
  return {
    id: String(c._id), title: c.title, description: c.description, category: c.category, difficulty: c.difficulty,
    durationWeeks: c.durationWeeks, skillTags: c.skillTags, published: c.published, isDemo: c.isDemo,
    moduleCount: c.modules.length, lessonCount: lessonIds(c).length,
    trainer: trainer ? { id: String(c.trainerId), name: trainer.name, designation: trainer.designation, isDemo: trainer.isDemo } : { id: String(c.trainerId), name: "Trainer", designation: "", isDemo: false },
  };
}

export function fmtIST(d: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(d)) + " IST";
}
