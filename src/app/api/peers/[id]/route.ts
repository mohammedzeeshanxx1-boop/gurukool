// GET /api/peers/:id — a student's full profile as another student sees it.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Assessment, Roadmap, Student } from "@/models";
import { TrainingCourse, TrainingEnrollment } from "@/models/train";
import { PeerConnection, type PeerConnectionDoc } from "@/models/peer";
import { requireRole } from "@/lib/persona";
import { apiError, notFound } from "@/lib/api";
import { connView, pairKey, peerMatch } from "@/lib/peers";
import { cardsFor, connectedKeys, suspendedKeys } from "@/lib/peer-network";
import { showDemoData } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Full = {
  key: string; name: string; headline?: string; about?: string; college: string; branch: string; semester: number; careerGoal: string;
  skills: string[]; interests: string[]; projects?: string[]; portfolioLinks?: { github?: string; linkedin?: string; portfolio?: string };
  peerDiscoverable?: boolean; isDemo?: boolean; createdAt?: Date;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireRole("student");
    const { id } = await params;
    const key = decodeURIComponent(id).slice(0, 100);
    await connectDB();
    const [s, mine, conn, suspended] = await Promise.all([
      Student.findOne({ key }).lean<Full>(),
      Student.findOne({ key: me.id }).select("skills interests careerGoal college").lean<Full>(),
      PeerConnection.findOne({ pairKey: pairKey(me.id, key) }).lean<PeerConnectionDoc>(),
      suspendedKeys(),
    ]);
    const isMe = key === me.id;
    const status = connView(conn, me.id);
    // Visible if it's me, we're connected, or the student is discoverable (and not suspended / hidden demo data).
    const visible = s && !suspended.includes(key) && (isMe || status === "connected" || (s.peerDiscoverable !== false && (!s.isDemo || showDemoData())));
    if (!s || !visible) return notFound("This profile isn't available");

    const [theirs, mineConn] = await Promise.all([connectedKeys(key), connectedKeys(me.id)]);
    const mutualKeys = theirs.filter((k) => mineConn.includes(k));
    const mutualCards = await cardsFor(mutualKeys.slice(0, 6));

    // Learning activity is shared with connections only.
    let activity = null;
    if (isMe || status === "connected") {
      const [roadmap, quizzes, enrolls] = await Promise.all([
        Roadmap.findOne({ studentKey: key }).sort({ createdAt: -1 }).select("careerGoal stages.completed stages.topic").lean<{ careerGoal: string; stages: { completed: boolean; topic: string }[] }>(),
        Assessment.countDocuments({ studentKey: key, submittedAt: { $ne: null } }),
        TrainingEnrollment.find({ studentId: key }).select("courseId").lean<{ courseId: unknown }[]>(),
      ]);
      const courses = await TrainingCourse.find({ _id: { $in: enrolls.map((e) => e.courseId) }, published: true }).select("title").lean<{ title: string }[]>();
      activity = {
        roadmap: roadmap ? { goal: roadmap.careerGoal, done: roadmap.stages.filter((x) => x.completed).length, total: roadmap.stages.length, current: roadmap.stages.find((x) => !x.completed)?.topic ?? null } : null,
        quizzesTaken: quizzes,
        courses: courses.map((c) => c.title).slice(0, 8),
      };
    }

    return NextResponse.json({
      profile: {
        id: s.key, name: s.name, headline: s.headline ?? "", about: s.about ?? "", college: s.college, branch: s.branch, semester: s.semester,
        careerGoal: s.careerGoal, skills: s.skills ?? [], interests: s.interests ?? [], projects: s.projects ?? [],
        links: { github: s.portfolioLinks?.github ?? "", linkedin: s.portfolioLinks?.linkedin ?? "", portfolio: s.portfolioLinks?.portfolio ?? "" },
        joinedAt: s.createdAt ?? null,
      },
      isMe,
      connection: { status: isMe ? "none" : status, id: conn ? String(conn._id) : null, message: status === "received" ? conn?.message ?? "" : "" },
      connectionsCount: theirs.length,
      mutual: { count: mutualKeys.length, people: mutualKeys.slice(0, 6).map((k) => mutualCards.get(k)).filter(Boolean).map((c) => ({ id: c!.id, name: c!.name })) },
      match: isMe || !mine ? { score: 0, reasons: [] } : peerMatch(mine, s),
      activity,
    });
  } catch (e) {
    return apiError(e);
  }
}
