// GURUKOOL TRAIN — LMS models. Trainers are existing Mentor profiles (no duplicate identities).
// Students are identified by the existing Student.key.
import mongoose, { Schema, models, model } from "mongoose";

export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export const TRAIN_CATEGORIES = [
  "Backend Development", "Frontend Development", "Full Stack Development", "AI/ML",
  "Cloud Computing", "Cybersecurity", "DSA and Interview Preparation",
] as const;

const LessonSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 140 },
    explanation: { type: String, required: true, maxlength: 6000 },
    objectives: { type: [String], default: [] },
    durationMinutes: { type: Number, required: true, min: 5, max: 600 },
  },
  { _id: true }
);

const ModuleSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 140 },
    summary: { type: String, default: "", maxlength: 1000 },
    lessons: { type: [LessonSchema], default: [] },
  },
  { _id: true }
);

const TrainingCourseSchema = new Schema(
  {
    seedKey: { type: String, unique: true, sparse: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, maxlength: 3000 },
    trainerId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
    category: { type: String, enum: TRAIN_CATEGORIES, required: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    durationWeeks: { type: Number, required: true, min: 1, max: 52 },
    skillTags: { type: [String], default: [] },
    modules: { type: [ModuleSchema], default: [] },
    published: { type: Boolean, default: false, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const TrainingEnrollmentSchema = new Schema(
  {
    studentId: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "TrainingCourse", required: true, index: true },
    completedLessonIds: { type: [String], default: [] },
    showInPortfolio: { type: Boolean, default: false }, // student-controlled GROW visibility
    enrolledAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
TrainingEnrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true }); // no duplicate enrollment

const TrainingAssignmentSchema = new Schema(
  {
    seedKey: { type: String, unique: true, sparse: true },
    courseId: { type: Schema.Types.ObjectId, ref: "TrainingCourse", required: true, index: true },
    moduleId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 140 },
    description: { type: String, required: true, maxlength: 2000 },
    instructions: { type: String, default: "", maxlength: 4000 },
    skillTags: { type: [String], default: [] },
    dueAt: { type: Date, required: true },
    maxMarks: { type: Number, required: true, min: 1, max: 1000 },
  },
  { timestamps: true }
);

const TrainingSubmissionSchema = new Schema(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: "TrainingAssignment", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "TrainingCourse", required: true, index: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, default: "" },
    submissionText: { type: String, default: "", maxlength: 8000 },
    repositoryUrl: { type: String, default: "" },
    projectUrl: { type: String, default: "" },
    status: { type: String, enum: ["SUBMITTED", "REVIEWED"], default: "SUBMITTED", index: true },
    score: { type: Number, default: null },
    feedback: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Mentor", default: null },
    reviewedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
TrainingSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true }); // one submission per student; resubmit = update

const TrainingSessionSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "TrainingCourse", required: true, index: true },
    trainerId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
    title: { type: String, required: true, maxlength: 140 },
    agenda: { type: String, default: "", maxlength: 1000 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    meetingUrl: { type: String, default: "" }, // never invented; the shared collaboration link is used instead
    status: { type: String, enum: ["SCHEDULED", "CANCELLED", "COMPLETED"], default: "SCHEDULED" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
TrainingSessionSchema.index({ trainerId: 1, startAt: 1 }, { unique: true, partialFilterExpression: { status: "SCHEDULED" } });

export const TrainingCourse = models.TrainingCourse || model("TrainingCourse", TrainingCourseSchema);
export const TrainingEnrollment = models.TrainingEnrollment || model("TrainingEnrollment", TrainingEnrollmentSchema);
export const TrainingAssignment = models.TrainingAssignment || model("TrainingAssignment", TrainingAssignmentSchema);
export const TrainingSubmission = models.TrainingSubmission || model("TrainingSubmission", TrainingSubmissionSchema);
export const TrainingSession = models.TrainingSession || model("TrainingSession", TrainingSessionSchema);

export type LessonT = { _id: mongoose.Types.ObjectId; title: string; explanation: string; objectives: string[]; durationMinutes: number };
export type ModuleT = { _id: mongoose.Types.ObjectId; title: string; summary: string; lessons: LessonT[] };
export type CourseT = {
  _id: mongoose.Types.ObjectId; title: string; description: string; trainerId: mongoose.Types.ObjectId; category: string;
  difficulty: string; durationWeeks: number; skillTags: string[]; modules: ModuleT[]; published: boolean; isDemo: boolean;
};
