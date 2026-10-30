// DEMO PERSONAS — a simulation of Student / Mentor / Recruiter roles for the hackathon.
// This is NOT production authentication: anyone using the app can switch personas.
// What it does guarantee: the server decides the acting role from an HMAC-signed, httpOnly cookie,
// never from a role/user id sent in a request body, so APIs enforce ownership consistently.
// Disable switching in non-demo deployments with GURUKOOL_DEMO_PERSONAS=false.
import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { DEMO_KEY } from "@/models";

export type Persona =
  | { role: "student"; id: string }
  | { role: "mentor"; id: string }
  | { role: "recruiter"; id: string };

const COOKIE = "gk_persona";
const g = globalThis as unknown as { _gkSecret?: string };

function secret() {
  const s = process.env.DEMO_PERSONA_SECRET;
  if (s && s.length >= 16) return s;
  // Fallback: random per server process (personas reset on restart). Fine for local demo.
  g._gkSecret ??= crypto.randomBytes(32).toString("hex");
  return g._gkSecret;
}

export const demoPersonasEnabled = () => process.env.GURUKOOL_DEMO_PERSONAS !== "false";

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export function encodePersona(p: Persona) {
  const payload = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value: string | undefined): Persona | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if ((p.role === "student" || p.role === "mentor" || p.role === "recruiter") && typeof p.id === "string") return p;
  } catch {}
  return null;
}

/** Acting persona for this request. Defaults to the single demo student (original MVP behaviour). */
export async function getPersona(): Promise<Persona> {
  const jar = await cookies();
  return decode(jar.get(COOKIE)?.value) ?? { role: "student", id: DEMO_KEY };
}

export async function setPersona(p: Persona) {
  const jar = await cookies();
  jar.set(COOKIE, encodePersona(p), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
}

export class ForbiddenError extends Error {
  constructor(msg = "This action isn't allowed for the current persona.") {
    super(msg);
  }
}

export async function requireRole<R extends Persona["role"]>(role: R): Promise<Extract<Persona, { role: R }>> {
  const p = await getPersona();
  if (p.role !== role) throw new ForbiddenError(`Switch to a ${role} persona to do this.`);
  return p as Extract<Persona, { role: R }>;
}
