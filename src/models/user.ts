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
    active: { type: Boolean, default: true },   // admin can suspend; checked on every authenticated request
  },
  { timestamps: true }
);

export const User = models.User || model("User", UserSchema);
export type UserT = { _id: unknown; email: string; passwordHash: string; role: "student" | "mentor" | "recruiter" | "admin"; name: string; profileId: string; approved: boolean; active?: boolean };

/** Keep the display name identical on the account and its profile record (DB is the single source of truth). */
export async function syncProfileName(role: string, profileId: string, name: string) {
  const { Student } = await import("./index");
  const { Mentor, Recruiter } = await import("./connect");
  if (role === "student") await Student.updateOne({ key: profileId }, { $set: { name } });
  if (role === "mentor" && profileId) await Mentor.updateOne({ _id: profileId }, { $set: { name } });
  if (role === "recruiter" && profileId) await Recruiter.updateOne({ _id: profileId }, { $set: { name } });
}
