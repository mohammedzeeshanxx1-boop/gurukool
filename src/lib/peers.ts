// Student-to-student (peer) study sessions: pure rules shared by the API and unit tests.
import crypto from "node:crypto";

export const PEER_DURATIONS = [30, 45, 60, 90];
export const PEER_LEAD_MS = 15 * 60 * 1000;            // book at least 15 minutes ahead
export const PEER_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // and at most 60 days ahead
export const JOIN_EARLY_MS = 10 * 60 * 1000;           // room opens 10 minutes before start

export type PeerStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
export type PeerAction = "accept" | "decline" | "cancel";

export type PeerRequest = { peerKey: string; topic: string; message: string; startAt: Date; durationMinutes: number };

/** Validate a booking request body. Returns the cleaned request or an error message. */
export function validatePeerRequest(b: unknown, now = new Date()): { ok: true; value: PeerRequest } | { ok: false; error: string } {
  const o = (b ?? {}) as Record<string, unknown>;
  const peerKey = String(o.peerKey ?? "").trim();
  const topic = String(o.topic ?? "").trim();
  const message = String(o.message ?? "").trim();
  const durationMinutes = Number(o.durationMinutes);
  const startAt = new Date(String(o.startAt ?? ""));
  if (!peerKey || peerKey.length > 100) return { ok: false, error: "Pick a student" };
  if (topic.length < 3) return { ok: false, error: "Add a topic (at least 3 characters)" };
  if (topic.length > 120) return { ok: false, error: "Topic is too long (max 120 characters)" };
  if (message.length > 500) return { ok: false, error: "Message is too long (max 500 characters)" };
  if (!PEER_DURATIONS.includes(durationMinutes)) return { ok: false, error: `Duration must be one of ${PEER_DURATIONS.join(", ")} minutes` };
  if (Number.isNaN(startAt.getTime())) return { ok: false, error: "Pick a date and time" };
  if (startAt.getTime() < now.getTime() + PEER_LEAD_MS) return { ok: false, error: "Pick a time at least 15 minutes from now" };
  if (startAt.getTime() > now.getTime() + PEER_WINDOW_MS) return { ok: false, error: "Pick a time within the next 60 days" };
  return { ok: true, value: { peerKey, topic, message, startAt, durationMinutes } };
}

/** Who may move a session to which state. */
export function nextStatus(status: PeerStatus, action: PeerAction, isRequester: boolean): { ok: true; status: PeerStatus } | { ok: false; error: string; code: 403 | 409 } {
  if (action === "accept" || action === "decline") {
    if (isRequester) return { ok: false, error: "Only the invited student can respond to this request", code: 403 };
    if (status !== "PENDING") return { ok: false, error: `This request is already ${status.toLowerCase()}`, code: 409 };
    return { ok: true, status: action === "accept" ? "ACCEPTED" : "DECLINED" };
  }
  if (status !== "PENDING" && status !== "ACCEPTED") return { ok: false, error: `This session is already ${status.toLowerCase()}`, code: 409 };
  return { ok: true, status: "CANCELLED" };
}

export const overlaps = (aStart: Date, aMin: number, bStart: Date, bMin: number) =>
  aStart.getTime() < bStart.getTime() + bMin * 60000 && bStart.getTime() < aStart.getTime() + aMin * 60000;

/** Unguessable meeting room code for an accepted session. */
export const newRoomCode = () => "study-" + crypto.randomBytes(8).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10).padEnd(10, "0");

type Profile = { skills?: string[]; interests?: string[]; careerGoal?: string; college?: string };
const norm = (xs: string[] | undefined) => new Set((xs ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean));

/** How well another student matches me, with human-readable reasons. */
export function peerMatch(me: Profile, other: Profile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (me.careerGoal && me.careerGoal === other.careerGoal) { score += 3; reasons.push(`Same goal: ${other.careerGoal}`); }
  const mine = norm(me.skills);
  const sharedSkills = (other.skills ?? []).filter((s) => mine.has(s.trim().toLowerCase()));
  if (sharedSkills.length) { score += sharedSkills.length; reasons.push(`Shared skills: ${sharedSkills.slice(0, 3).join(", ")}`); }
  const myInt = norm(me.interests);
  const sharedInt = (other.interests ?? []).filter((s) => myInt.has(s.trim().toLowerCase()));
  if (sharedInt.length) { score += sharedInt.length; reasons.push(`Shared interests: ${sharedInt.slice(0, 3).join(", ")}`); }
  if (me.college && other.college && me.college.trim().toLowerCase() === other.college.trim().toLowerCase()) { score += 1; reasons.push("Same college"); }
  return { score, reasons };
}

/** Whether the meeting room can be joined right now. */
export const canJoin = (status: PeerStatus, startAt: Date, durationMinutes: number, now = new Date()) =>
  status === "ACCEPTED" && now.getTime() >= startAt.getTime() - JOIN_EARLY_MS && now.getTime() <= startAt.getTime() + durationMinutes * 60000;
