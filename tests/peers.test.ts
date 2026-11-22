import { describe, expect, it } from "vitest";
import { canJoin, connTransition, connView, newRoomCode, nextStatus, overlaps, pairKey, peerMatch, validatePeerRequest } from "@/lib/peers";

const NOW = new Date("2026-11-22T06:00:00Z");
const inMin = (m: number) => new Date(NOW.getTime() + m * 60000).toISOString();
const base = { peerKey: "u-abc", topic: "DSA practice", message: "", startAt: inMin(120), durationMinutes: 60 };

describe("peer request validation", () => {
  it("accepts a valid request", () => expect(validatePeerRequest(base, NOW)).toMatchObject({ ok: true }));
  it.each([
    [{ peerKey: "" }, /Pick a student/],
    [{ topic: "ab" }, /at least 3/],
    [{ durationMinutes: 20 }, /Duration/],
    [{ startAt: "nope" }, /date and time/],
    [{ startAt: inMin(5) }, /15 minutes/],
    [{ startAt: inMin(61 * 24 * 60) }, /60 days/],
    [{ message: "x".repeat(501) }, /too long/],
  ])("rejects %j", (patch, msg) => {
    const r = validatePeerRequest({ ...base, ...patch }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });
  it("rejects a missing body", () => expect(validatePeerRequest(null, NOW).ok).toBe(false));
});

describe("status transitions", () => {
  it("only the invited student can accept or decline", () => {
    expect(nextStatus("PENDING", "accept", true)).toMatchObject({ ok: false, code: 403 });
    expect(nextStatus("PENDING", "accept", false)).toEqual({ ok: true, status: "ACCEPTED" });
    expect(nextStatus("PENDING", "decline", false)).toEqual({ ok: true, status: "DECLINED" });
  });
  it("can't respond twice", () => expect(nextStatus("ACCEPTED", "accept", false)).toMatchObject({ ok: false, code: 409 }));
  it("either student can cancel a pending or accepted session", () => {
    expect(nextStatus("PENDING", "cancel", true)).toEqual({ ok: true, status: "CANCELLED" });
    expect(nextStatus("ACCEPTED", "cancel", false)).toEqual({ ok: true, status: "CANCELLED" });
  });
  it("can't cancel a finished request", () => expect(nextStatus("DECLINED", "cancel", true)).toMatchObject({ ok: false, code: 409 }));
});

describe("helpers", () => {
  it("detects overlapping sessions", () => {
    const a = new Date(inMin(60));
    expect(overlaps(a, 60, new Date(inMin(90)), 30)).toBe(true);
    expect(overlaps(a, 60, new Date(inMin(120)), 30)).toBe(false); // back-to-back is fine
  });
  it("room codes are random and URL-safe", () => {
    const a = newRoomCode(), b = newRoomCode();
    expect(a).toMatch(/^study-[a-z0-9]{10}$/);
    expect(a).not.toBe(b);
  });
  it("join window opens 10 minutes early and closes at the end", () => {
    const start = new Date(inMin(5));
    expect(canJoin("ACCEPTED", start, 30, NOW)).toBe(true);
    expect(canJoin("ACCEPTED", new Date(inMin(15)), 30, NOW)).toBe(false);
    expect(canJoin("PENDING", start, 30, NOW)).toBe(false);
  });
  it("ranks peers by shared goal, skills, interests and college", () => {
    const m = peerMatch(
      { careerGoal: "Full Stack Developer", skills: ["React", "SQL"], interests: ["AI"], college: "SVIT" },
      { careerGoal: "Full Stack Developer", skills: ["react", "Go"], interests: ["ai"], college: "svit" },
    );
    expect(m.score).toBe(6);
    expect(m.reasons).toEqual(["Same goal: Full Stack Developer", "Shared skills: react", "Shared interests: ai", "Same college"]);
    expect(peerMatch({}, { careerGoal: "X" })).toEqual({ score: 0, reasons: [] });
  });
});


describe("connections", () => {
  it("pair key is the same whoever asks", () => expect(pairKey("u-b", "u-a")).toBe(pairKey("u-a", "u-b")));
  it("shows each side the right status", () => {
    const pending = { status: "PENDING" as const, requesterKey: "u-a" };
    expect(connView(pending, "u-a")).toBe("sent");
    expect(connView(pending, "u-b")).toBe("received");
    expect(connView({ status: "ACCEPTED", requesterKey: "u-a" }, "u-b")).toBe("connected");
    expect(connView(null, "u-a")).toBe("none");
  });
  it("never reveals a decline to the sender", () => {
    const declined = { status: "DECLINED" as const, requesterKey: "u-a" };
    expect(connView(declined, "u-a")).toBe("sent");
    expect(connView(declined, "u-b")).toBe("none");
  });
  it("only the invited student accepts or declines", () => {
    expect(connTransition("PENDING", "accept", true)).toMatchObject({ ok: false, code: 403 });
    expect(connTransition("PENDING", "accept", false)).toEqual({ ok: true, to: "ACCEPTED" });
    expect(connTransition("PENDING", "decline", false)).toEqual({ ok: true, to: "DECLINED" });
    expect(connTransition("ACCEPTED", "accept", false)).toMatchObject({ ok: false, code: 409 });
  });
  it("only the sender withdraws; either side removes a connection", () => {
    expect(connTransition("PENDING", "withdraw", false)).toMatchObject({ ok: false, code: 403 });
    expect(connTransition("PENDING", "withdraw", true)).toEqual({ ok: true, to: "delete" });
    expect(connTransition("ACCEPTED", "remove", false)).toEqual({ ok: true, to: "delete" });
    expect(connTransition("PENDING", "remove", true)).toMatchObject({ ok: false, code: 409 });
  });
  it("session type defaults to study and rejects unknown types", () => {
    const ok = validatePeerRequest(base, NOW);
    expect(ok.ok && ok.value.kind).toBe("study");
    expect(validatePeerRequest({ ...base, kind: "explain" }, NOW)).toMatchObject({ ok: true });
    expect(validatePeerRequest({ ...base, kind: "party" }, NOW)).toMatchObject({ ok: false });
  });
});
