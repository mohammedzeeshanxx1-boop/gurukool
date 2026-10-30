import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { apiError } from "@/lib/api";
import { getPersona } from "@/lib/persona";
import { User, syncProfileName } from "@/models/user";
import { badRequest } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const p = await getPersona();
    await connectDB();
    const u = await User.findById(p.uid).select("email name role approved active createdAt").lean<{ email: string; name: string; role: string; approved: boolean; active?: boolean; createdAt: Date }>();
    if (!u) return NextResponse.json({ error: "Account not found", code: "UNAUTHORIZED" }, { status: 401 });
    return NextResponse.json({ user: { email: u.email, name: u.name, role: u.role, approved: u.approved, active: u.active !== false, createdAt: u.createdAt } });
  } catch (e) {
    return apiError(e);
  }
}

// PATCH {name?, currentPassword?, newPassword?} — Account Settings. Name changes sync to the profile record.
export async function PATCH(req: Request) {
  try {
    const p = await getPersona();
    const b = await req.json().catch(() => null);
    if (!b) return badRequest("Invalid request");
    const u = await User.findById(p.uid).select("passwordHash role profileId").lean<{ passwordHash: string; role: string; profileId: string }>();
    if (!u) return NextResponse.json({ error: "Account not found", code: "UNAUTHORIZED" }, { status: 401 });
    const set: Record<string, string> = {};
    if (b.name !== undefined) {
      const name = String(b.name).trim().slice(0, 100);
      if (name.length < 2) return badRequest("Enter your name");
      set.name = name;
    }
    if (b.newPassword !== undefined) {
      if (!verifyPassword(String(b.currentPassword ?? ""), u.passwordHash)) return badRequest("Current password is incorrect");
      if (String(b.newPassword).length < 8) return badRequest("New password must be at least 8 characters");
      set.passwordHash = hashPassword(String(b.newPassword));
    }
    if (!Object.keys(set).length) return badRequest("Nothing to update");
    await User.updateOne({ _id: p.uid }, { $set: set });
    if (set.name) await syncProfileName(u.role, u.profileId, set.name);
    return NextResponse.json({ ok: true, name: set.name });
  } catch (e) {
    return apiError(e);
  }
}
