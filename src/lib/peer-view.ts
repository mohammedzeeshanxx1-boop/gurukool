import "server-only";
import type { PeerSessionDoc } from "@/models/peer";
import { canJoin, type PeerStatus } from "@/lib/peers";
import { fmtDateTimeIST } from "@/lib/slots";

/** What a participant sees about a peer session. */
export function publicPeerSession(s: PeerSessionDoc, myKey: string) {
  const sent = s.requesterKey === myKey;
  const startAt = new Date(s.startAt);
  return {
    id: String(s._id),
    direction: sent ? "sent" : "received",
    with: { id: sent ? s.peerKey : s.requesterKey, name: sent ? s.peerName : s.requesterName },
    kind: (s.kind ?? "study") as "study" | "explain",
    topic: s.topic,
    message: s.message,
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + s.durationMinutes * 60000).toISOString(),
    when: fmtDateTimeIST(startAt),
    durationMinutes: s.durationMinutes,
    status: s.status,
    // The room code is only revealed to the two participants once the session is accepted.
    roomCode: s.status === "ACCEPTED" ? s.roomCode : null,
    canJoin: canJoin(s.status as PeerStatus, startAt, s.durationMinutes),
  };
}

