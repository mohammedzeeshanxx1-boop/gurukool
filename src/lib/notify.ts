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
/** Mongo filter for mentors students may discover and book: admin-verified (plus demo profiles if enabled). */
export const discoverableMentor = () => (showDemoData() ? { $or: [{ verified: true }, { isDemo: true }] } : { verified: true });
