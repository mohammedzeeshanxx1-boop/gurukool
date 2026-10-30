import "server-only";
import mongoose from "mongoose";
import { fmtDateTimeIST } from "./slots";

export type SessionDoc = {
  _id: mongoose.Types.ObjectId; studentId: string; studentName: string; studentEmail: string; mentorId: mongoose.Types.ObjectId;
  mentorName: string; topic: string; requestedStartAt: Date; requestedEndAt: Date; durationMinutes: number; message: string;
  status: string; statusNote: string; createdAt: Date; updatedAt: Date;
};

export function publicSession(s: SessionDoc, forRole: "student" | "mentor") {
  return {
    id: String(s._id), mentorId: String(s.mentorId), mentorName: s.mentorName,
    studentName: s.studentName, ...(forRole === "mentor" ? { studentEmail: s.studentEmail } : {}),
    topic: s.topic, startAt: s.requestedStartAt, endAt: s.requestedEndAt, when: fmtDateTimeIST(s.requestedStartAt),
    durationMinutes: s.durationMinutes, message: s.message, status: s.status, statusNote: s.statusNote,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
  };
}
