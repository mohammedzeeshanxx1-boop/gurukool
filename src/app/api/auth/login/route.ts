import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { apiError, badRequest } from "@/lib/api";
import { setPersona } from "@/lib/persona";
import { verifyPassword } from "@/lib/password";
import { HOME, PORTALS, type Portal } from "@/lib/session-token";
import { User, type UserT } from "@/models/user";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { student: "Student", mentor: "Expert / Mentor", recruiter: "Recruiter", admin: "Admin" };

// POST {portal, email, password} — verifies credentials AND that the account's role matches the portal.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => null);
    const portal = b?.portal as Portal;
    if (!b || !(portal in PORTALS)) return badRequest("Unknown sign-in portal");
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!email || !password) return badRequest("Enter your email and password");
    await connectDB();
    const u = await User.findOne({ email }).lean<UserT>();
    // Same message for unknown email and wrong password (no account enumeration).
    if (!u || !verifyPassword(password, u.passwordHash))
      return NextResponse.json({ error: "Invalid email or password.", code: "INVALID_CREDENTIALS" }, { status: 401 });
    const role = PORTALS[portal];
    if (u.role !== role)
      return NextResponse.json({ error: `This is a ${LABEL[u.role]} account. Please use the ${LABEL[u.role]} sign-in.`, code: "WRONG_PORTAL" }, { status: 403 });
    await setPersona({ role: u.role, id: u.role === "admin" ? String(u._id) : u.profileId, uid: String(u._id) });
    return NextResponse.json({ redirect: HOME[u.role], approved: u.approved });
  } catch (e) {
    return apiError(e);
  }
}
