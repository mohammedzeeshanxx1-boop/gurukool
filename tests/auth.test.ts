import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import { allowedRoles, decodeSession, encodeSession } from "@/lib/session-token";

beforeAll(() => { process.env.AUTH_SECRET = "test-secret-0123456789"; });

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", () => {
    const h = hashPassword("correct horse");
    expect(h).toMatch(/^scrypt\$/);
    expect(verifyPassword("correct horse", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
  it("salts every hash", () => expect(hashPassword("x")).not.toBe(hashPassword("x")));
  it("rejects malformed stored values", () => expect(verifyPassword("x", "md5$abc")).toBe(false));
});

describe("session tokens", () => {
  it("round-trips a signed payload", () => {
    const t = encodeSession({ uid: "u1", role: "mentor", id: "m1" });
    expect(decodeSession(t)).toMatchObject({ uid: "u1", role: "mentor", id: "m1" });
  });
  it("rejects tampered payloads (privilege escalation)", () => {
    const [, sig] = encodeSession({ uid: "u1", role: "student", id: "s1" }).split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "u1", role: "admin", id: "s1", exp: 9e9 })).toString("base64url");
    expect(decodeSession(`${forged}.${sig}`)).toBeNull();
  });
  it("rejects garbage", () => {
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("abc")).toBeNull();
  });
});

describe("route access rules", () => {
  it("guards portals by role", () => {
    expect(allowedRoles("/welcome")).toBeNull();
    expect(allowedRoles("/admin/users")).toEqual(["admin"]);
    expect(allowedRoles("/connect")).toEqual(["student"]); // Connect is student-to-student
    expect(allowedRoles("/connect/meeting")).toEqual(["student"]);
    expect(allowedRoles("/train")).toEqual(["student", "mentor"]);
    expect(allowedRoles("/profile")).toEqual(["student"]);
    expect(allowedRoles("/learn")).toEqual(["student"]);
  });
});
