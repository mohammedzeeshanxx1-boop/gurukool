// Best-effort in-app notifications: a failure here never breaks the main action.
import "server-only";
import { Notification } from "@/models/notification";
import { User } from "@/models/user";

type N = { title: string; body?: string; link?: string };

export async function notifyUser(userId: unknown, n: N) {
  try { await Notification.create({ userId, ...n }); } catch (e) { console.error("[notify]", e); }
}

/** Notify the account that owns a profile (student key, mentor id or recruiter id). */
export async function notifyProfile(role: "student" | "mentor" | "recruiter", profileId: string, n: N) {
  try {
    const u = await User.findOne({ role, profileId }).select("_id").lean<{ _id: unknown }>();
    if (u) await Notification.create({ userId: u._id, ...n });
  } catch (e) { console.error("[notify]", e); }
}

/** Demo/fictional seed data is hidden unless explicitly enabled for a demo. */
export const showDemoData = () => process.env.GURUKOOL_SHOW_DEMO_DATA === "true";
/**
 * Single source of truth for expert approval is User.approved (what the Admin portal shows/changes).
 * Mirror it onto Mentor.verified (repairs experts approved before the flag existed; hides suspended/revoked ones).
 */
export async function syncMentorVerification() {
  const { Mentor } = await import("@/models/connect");
  const ids = (await User.find({ role: "mentor", approved: true, active: { $ne: false } }).distinct("profileId")) as string[];
  const valid = ids.filter((x) => /^[a-f0-9]{24}$/i.test(x));
  await Mentor.updateMany({ _id: { $in: valid }, verified: { $ne: true } }, { $set: { verified: true } });
  await Mentor.updateMany({ _id: { $nin: valid }, verified: true, isDemo: { $ne: true } }, { $set: { verified: false } });
}

/** Mongo filter for mentors students may discover and book: admin-approved (plus demo profiles if enabled). */
export async function discoverableMentor() {
  await syncMentorVerification();
  return showDemoData() ? { $or: [{ verified: true }, { isDemo: true }] } : { verified: true };
}
