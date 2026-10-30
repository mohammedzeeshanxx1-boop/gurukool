import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { apiError } from "@/lib/api";
import { ForbiddenError, getPersona } from "@/lib/persona";
import { User } from "@/models/user";

export const dynamic = "force-dynamic";

// GET — the signed-in account (shape kept for existing UI components). Role switching is no longer possible.
export async function GET() {
  try {
    const persona = await getPersona();
    await connectDB();
    const u = await User.findById(persona.uid).select("name").lean<{ name: string }>();
    const current = { role: persona.role, id: persona.id, label: u?.name ?? "Account", sub: persona.role };
    return NextResponse.json({ persona: { role: persona.role, id: persona.id }, current, options: [], demoEnabled: false });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST() {
  return apiError(new ForbiddenError("Role switching is disabled. Sign in through the correct portal."));
}
