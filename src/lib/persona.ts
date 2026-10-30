// Acting user for API routes, from the signed httpOnly session cookie set at sign-in.
// Role comes from the verified session (never from the request body or the portal clicked).
import "server-only";
import { cookies } from "next/headers";
import { decodeSession, encodeSession, SESSION_COOKIE, SESSION_TTL_S, type Role } from "./session-token";

export type Persona = { role: Role; id: string; uid: string };

export class ForbiddenError extends Error {
  constructor(msg = "You don't have access to this.") { super(msg); }
}
export class UnauthorizedError extends Error {
  constructor(msg = "Please sign in.") { super(msg); }
}

/** Demo persona switching has been replaced by real sign-in. */
export const demoPersonasEnabled = () => false;

export async function getPersona(): Promise<Persona> {
  const s = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) throw new UnauthorizedError();
  const { connectDB } = await import("./db");
  const { User } = await import("@/models/user");
  await connectDB();
  const u = await User.findById(s.uid).select("role active").lean<{ role: Role; active?: boolean }>();
  if (!u || u.role !== s.role) throw new UnauthorizedError("Your session is no longer valid. Please sign in again.");
  if (u.active === false) throw new ForbiddenError("This account has been suspended. Contact the GURUKOOL admin.");
  return { role: s.role, id: s.id, uid: s.uid };
}

export async function setPersona(p: Persona) {
  (await cookies()).set(SESSION_COOKIE, encodeSession({ uid: p.uid, role: p.role, id: p.id }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_S,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requireRole<R extends Role>(role: R): Promise<Persona & { role: R }> {
  const p = await getPersona();
  if (p.role !== role) throw new ForbiddenError(`This is only available to ${role === "mentor" ? "expert" : role} accounts.`);
  if (role === "recruiter") {
    // Recruiter-only data requires admin approval (checked live, so approval/revocation applies immediately).
    const { connectDB } = await import("./db");
    const { User } = await import("@/models/user");
    await connectDB();
    const u = await User.findById(p.uid).select("approved").lean<{ approved: boolean }>();
    if (!u?.approved) throw new ForbiddenError("Your recruiter account is awaiting admin approval.");
  }
  return p as Persona & { role: R };
}
