// Login credentials only. Profile data stays in the existing Student / Mentor / Recruiter collections
// (profileId = Student.key, Mentor._id or Recruiter._id). Admins are created via scripts/create-user.mjs only.
import { Schema, models, model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "mentor", "recruiter", "admin"], required: true },
    name: { type: String, required: true, maxlength: 100 },
    profileId: { type: String, default: "" },
    approved: { type: Boolean, default: true }, // recruiters start false until an admin approves
  },
  { timestamps: true }
);

export const User = models.User || model("User", UserSchema);
export type UserT = { _id: unknown; email: string; passwordHash: string; role: "student" | "mentor" | "recruiter" | "admin"; name: string; profileId: string; approved: boolean };
