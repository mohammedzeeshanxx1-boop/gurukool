import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { apiError } from "@/lib/api";
import { getPersona } from "@/lib/persona";
import { User } from "@/models/user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const p = await getPersona();
    await connectDB();
    const u = await User.findById(p.uid).select("email name role approved").lean<{ email: string; name: string; role: string; approved: boolean }>();
    if (!u) return NextResponse.json({ error: "Account not found", code: "UNAUTHORIZED" }, { status: 401 });
    return NextResponse.json({ user: { email: u.email, name: u.name, role: u.role, approved: u.approved } });
  } catch (e) {
    return apiError(e);
  }
}
