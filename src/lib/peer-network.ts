import "server-only";
import { Student } from "@/models";
import { User } from "@/models/user";
import { PeerConnection, type PeerConnectionDoc } from "@/models/peer";
import { showDemoData } from "@/lib/notify";

export type Card = { id: string; name: string; headline: string; college: string; branch: string; semester: number; careerGoal: string; skills: string[]; interests: string[] };
export const CARD_FIELDS = "key name headline college branch semester careerGoal skills interests";
type Row = { key: string; name: string; headline?: string; college: string; branch: string; semester: number; careerGoal: string; skills: string[]; interests: string[] };
export const toCard = (r: Row): Card => ({ id: r.key, name: r.name, headline: r.headline ?? "", college: r.college, branch: r.branch, semester: r.semester, careerGoal: r.careerGoal, skills: (r.skills ?? []).slice(0, 12), interests: (r.interests ?? []).slice(0, 8) });

/** Profile keys of suspended student accounts (never shown). */
export async function suspendedKeys() {
  return (await User.find({ role: "student", active: false }).distinct("profileId")) as string[];
}

/** Base filter for students others may discover. */
export async function discoverableFilter(exclude: string[]) {
  return {
    key: { $nin: [...exclude, ...(await suspendedKeys())] },
    peerDiscoverable: { $ne: false },
    ...(showDemoData() ? {} : { isDemo: { $ne: true } }),
  };
}

/** All connection records involving a student. */
export async function myConnections(me: string) {
  return PeerConnection.find({ $or: [{ requesterKey: me }, { addresseeKey: me }] }).lean<PeerConnectionDoc[]>();
}
export const otherKey = (c: { requesterKey: string; addresseeKey: string }, me: string) => (c.requesterKey === me ? c.addresseeKey : c.requesterKey);

/** Keys of a student's accepted connections. */
export async function connectedKeys(key: string) {
  const list = await PeerConnection.find({ status: "ACCEPTED", $or: [{ requesterKey: key }, { addresseeKey: key }] }).select("requesterKey addresseeKey").lean<PeerConnectionDoc[]>();
  return list.map((c) => otherKey(c, key));
}

export async function cardsFor(keys: string[]) {
  const rows = await Student.find({ key: { $in: keys } }).select(CARD_FIELDS).lean<Row[]>();
  return new Map(rows.map((r) => [r.key, toCard(r)]));
}
