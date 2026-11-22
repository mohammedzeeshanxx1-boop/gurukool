import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

// Single demo student (no auth): identified by a fixed key.
export const DEMO_KEY = "demo-student";

const StudentSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: DEMO_KEY },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    college: { type: String, required: true },
    branch: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 10 },
    skills: { type: [String], default: [] },
    careerGoal: { type: String, required: true },
    interests: { type: [String], default: [] },
    headline: { type: String, default: "", maxlength: 120 }, // e.g. "3rd-year CSE · building with React"
    about: { type: String, default: "", maxlength: 1000 },
    // CONNECT 2.0 extensions — private by default; recruiters only see opted-in students.
    recruiterDiscoverable: { type: Boolean, default: false, index: true },
    // Other signed-in students can find this profile in Connect (name, college, branch, skills, goal; never email).
    peerDiscoverable: { type: Boolean, default: true, index: true },
    portfolioLinks: {
      github: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      portfolio: { type: String, default: "" },
    },
    projects: { type: [String], default: [] },
    mentorshipInterests: { type: [String], default: [] },
    isDemo: { type: Boolean, default: false }, // seeded fictional students for recruiter demo
  },
  { timestamps: true }
);

const QuestionSchema = new Schema(
  {
    question: String,
    options: [String],
    answerIndex: Number,
    explanation: String,
    topic: String,
  },
  { _id: false }
);

const AssessmentSchema = new Schema(
  {
    studentKey: { type: String, default: DEMO_KEY, index: true },
    careerGoal: String,
    source: { type: String, enum: ["ai", "question-bank"], required: true },
    questions: [QuestionSchema],
    answers: { type: [Number], default: [] },
    score: { type: Number, default: null },
    total: Number,
    weakTopics: { type: [String], default: [] },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const StageSchema = new Schema(
  {
    topic: String,
    description: String,
    duration: String,
    youtubeUrl: String,
    reason: { type: String, default: "" },
    prerequisites: { type: [String], default: [] },
    completed: { type: Boolean, default: false },
  },
  { _id: true }
);

const RoadmapSchema = new Schema(
  {
    studentKey: { type: String, default: DEMO_KEY, index: true },
    careerGoal: String,
    source: { type: String, enum: ["ai", "rules"], required: true },
    basedOn: { missingSkills: [String], weakTopics: [String], mastery: [{ _id: false, skill: String, mean: Number, status: String }] },
    stages: [StageSchema],
  },
  { timestamps: true }
);

export type StudentDoc = InferSchemaType<typeof StudentSchema>;

export const Student = (models.Student as mongoose.Model<StudentDoc>) || model("Student", StudentSchema);
export const Assessment = models.Assessment || model("Assessment", AssessmentSchema);
export const Roadmap = models.Roadmap || model("Roadmap", RoadmapSchema);
