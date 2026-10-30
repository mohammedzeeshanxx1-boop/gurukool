// Signed session token (HMAC-SHA256), shared by route handlers and middleware (Node.js runtime).
import crypto from "crypto";

export type Role = "student" | "mentor" | "recruiter" | "admin";
export type SessionPayload = { uid: string; role: Role; id: string; exp: number };
export const SESSION_COOKIE = "gk_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  // Stable fallback derived from the (secret) DB URI so all server workers agree.
  return crypto.createHash("sha256").update(`gurukool-session|${process.env.MONGODB_URI ?? "dev"}`).digest("hex");
}
const sign = (p: string) => crypto.createHmac("sha256", secret()).update(p).digest("base64url");

export function encodeSession(p: Omit<SessionPayload, "exp">) {
  const payload = Buffer.from(JSON.stringify({ ...p, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (!["student", "mentor", "recruiter", "admin"].includes(p.role) || typeof p.id !== "string" || typeof p.uid !== "string") return null;
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}

// ---- Route access rules (used by middleware and the sidebar) ----
export const PORTALS = { student: "student", recruiter: "recruiter", expert: "mentor", admin: "admin" } as const;
export type Portal = keyof typeof PORTALS;
export const PORTAL_OF: Record<Role, Portal> = { student: "student", recruiter: "recruiter", mentor: "expert", admin: "admin" };
export const HOME: Record<Role, string> = { student: "/", mentor: "/connect/mentor", recruiter: "/grow/recruiter", admin: "/admin" };

/** Roles allowed on a page path, or null for public pages. */
export function allowedRoles(path: string): Role[] | null {
  if (path === "/welcome" || /^\/(student|recruiter|expert|admin)\/(login|register)\/?$/.test(path)) return null;
  if (path.startsWith("/connect/mentor") && !path.startsWith("/connect/mentors")) return ["mentor"];
  if (path.startsWith("/grow/recruiter")) return ["recruiter"];
  if (path.startsWith("/admin")) return ["admin"];
  if (path.startsWith("/connect") || path.startsWith("/train")) return ["student", "mentor"];
  return ["student"]; // "/", /learn, /build, /compete, /grow
}

export function portalFor(path: string): Portal {
  const r = allowedRoles(path);
  return r && r.length === 1 ? PORTAL_OF[r[0]] : "student";
}
