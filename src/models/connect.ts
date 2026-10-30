import mongoose, { Schema, models, model } from "mongoose";

export const WEEKEND_DAYS = ["Saturday", "Sunday"] as const;
export const DOMAINS = [
  "Backend Development",
  "Frontend Development",
  "Full Stack Development",
  "AI/ML",
  "Cloud Computing",
  "Cybersecurity",
  "DSA and Interview Preparation",
] as const;
export const SESSION_FORMATS = ["1:1 Mentorship", "Weekend Masterclass", "Mock Interview", "Project Review"] as const;
export const SESSION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

const SlotSchema = new Schema(
  {
    day: { type: String, enum: WEEKEND_DAYS, required: true },
    start: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // "HH:MM" Asia/Kolkata
    end: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

const MentorSchema = new Schema(
  {
    seedKey: { type: String, unique: true, sparse: true }, // only for seeded demo profiles
    name: { type: String, required: true, trim: true, maxlength: 100 },
    headline: { type: String, required: true, trim: true, maxlength: 160 },
    designation: { type: String, required: true, trim: true, maxlength: 100 },
    organization: { type: String, required: true, trim: true, maxlength: 120 },
    yearsOfExperience: { type: Number, required: true, min: 0, max: 50 },
    bio: { type: String, default: "", maxlength: 1500 },
    expertise: { type: [String], default: [] },
    teachingTopics: { type: [String], default: [] },
    domains: { type: [String], enum: DOMAINS, default: [] },
    sessionFormats: { type: [String], enum: SESSION_FORMATS, default: ["1:1 Mentorship"] },
    sessionDescription: { type: String, default: "", maxlength: 1000 },
    availability: { type: [SlotSchema], default: [] },
    profileStatus: { type: String, enum: ["active", "draft"], default: "active", index: true },
    isDemo: { type: Boolean, default: false },
    verified: { type: Boolean, default: false, index: true }, // set when an admin approves the expert account
  },
  { timestamps: true }
);

const MentorSessionSchema = new Schema(
  {
    studentId: { type: String, required: true, index: true }, // Student.key
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
    mentorName: { type: String, required: true },
    topic: { type: String, required: true },
    requestedStartAt: { type: Date, required: true },
    requestedEndAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    message: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: SESSION_STATUSES, default: "PENDING", index: true },
    statusNote: { type: String, default: "" },
    meetingUrl: { type: String, default: "" }, // never invented; only set from a real integration
    // Atomic conflict-prevention keys (unique partial indexes below):
    // activeKey: one live (PENDING/ACCEPTED) request per student+mentor+slot → no duplicates.
    // slotLock: one ACCEPTED/COMPLETED booking per mentor+slot → no double-booking.
    activeKey: { type: String },
    slotLock: { type: String },
  },
  { timestamps: true }
);
MentorSessionSchema.index({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $type: "string" } } });
MentorSessionSchema.index({ slotLock: 1 }, { unique: true, partialFilterExpression: { slotLock: { $type: "string" } } });

const RecruiterSchema = new Schema(
  {
    seedKey: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    organization: { type: String, required: true },
    designation: { type: String, required: true },
    email: { type: String, default: "" },
    isDemo: { type: Boolean, default: true },
    shortlist: { type: [Schema.Types.ObjectId], ref: "Student", default: [] },
  },
  { timestamps: true }
);

const RecruiterInterestSchema = new Schema(
  {
    recruiterId: { type: Schema.Types.ObjectId, ref: "Recruiter", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    type: { type: String, enum: ["INTEREST", "INVITE"], default: "INTEREST" },
    opportunityTitle: { type: String, default: "", maxlength: 120 },
    message: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN"], default: "PENDING" },
    pendingKey: { type: String }, // one open request per recruiter+student
  },
  { timestamps: true }
);
RecruiterInterestSchema.index({ pendingKey: 1 }, { unique: true, partialFilterExpression: { pendingKey: { $type: "string" } } });

export const Mentor = models.Mentor || model("Mentor", MentorSchema);
export const MentorSession = models.MentorSession || model("MentorSession", MentorSessionSchema);
export const Recruiter = models.Recruiter || model("Recruiter", RecruiterSchema);
export const RecruiterInterest = models.RecruiterInterest || model("RecruiterInterest", RecruiterInterestSchema);

export type MentorT = {
  _id: mongoose.Types.ObjectId; name: string; headline: string; designation: string; organization: string;
  yearsOfExperience: number; bio: string; expertise: string[]; teachingTopics: string[]; domains: string[];
  sessionFormats: string[]; sessionDescription: string; availability: { day: string; start: string; end: string }[];
  profileStatus: string; isDemo: boolean;
};
