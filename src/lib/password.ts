import crypto from "crypto";

// scrypt with per-user salt: "scrypt$<salt>$<hash>"
export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString("base64url")}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const a = crypto.scryptSync(pw, salt, 64);
  const b = Buffer.from(hash, "base64url");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
