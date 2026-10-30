import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { apiError, badRequest, conflict, isDupKey } from "@/lib/api";
import { setPersona } from "@/lib/persona";
import { hashPassword } from "@/lib/password";
import { HOME } from "@/lib/session-token";
import { User } from "@/models/user";
import { Mentor, Recruiter } from "@/models/connect";

export const dynamic = "force-dynamic";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST {portal: student|expert|recruiter, name, email, password, organization?, designation?}
// Admin accounts can never be created here. Recruiters start unapproved.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => null);
    const portal = b?.portal;
    if (portal !== "student" && portal !== "expert" && portal !== "recruiter")
      return NextResponse.json({ error: "Registration isn't available for this portal.", code: "FORBIDDEN" }, { status: 403 });
    const name = String(b.name ?? "").trim().slice(0, 100);
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (name.length < 2) return badRequest("Enter your name");
    if (!EMAIL.test(email)) return badRequest("Enter a valid email");
    if (password.length < 8) return badRequest("Password must be at least 8 characters");
    const organization = String(b.organization ?? "").trim().slice(0, 120);
    const designation = String(b.designation ?? "").trim().slice(0, 100);
    if (portal === "recruiter" && (!organization || !designation)) return badRequest("Enter your organization and designation");
    await connectDB();
    if (await User.exists({ email })) return conflict("An account with this email already exists. Please sign in.");

    const uid = new mongoose.Types.ObjectId();
    let profileId = "";
    let role: "student" | "mentor" | "recruiter" = "student";
    if (portal === "student") profileId = `u-${uid}`; // Student profile is created when they save it on the Dashboard
    if (portal === "expert") {
      role = "mentor";
      const m = await Mentor.create({
        name, headline: "Industry expert", designation: designation || "Expert", organization: organization || "Not specified",
        yearsOfExperience: 0, expertise: ["Not specified"], teachingTopics: ["Not specified"], profileStatus: "draft", isDemo: false,
      });
      profileId = String(m._id);
    }
    if (portal === "recruiter") {
      role = "recruiter";
      const r = await Recruiter.create({ name, organization, designation, email, isDemo: false });
      profileId = String(r._id);
    }
    try {
      await User.create({ _id: uid, email, passwordHash: hashPassword(password), role, name, profileId, approved: role === "student" });
    } catch (e) {
      if (isDupKey(e)) return conflict("An account with this email already exists. Please sign in.");
      throw e;
    }
    await setPersona({ role, id: profileId, uid: String(uid) });
    return NextResponse.json({ redirect: HOME[role], approved: role === "student" }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
