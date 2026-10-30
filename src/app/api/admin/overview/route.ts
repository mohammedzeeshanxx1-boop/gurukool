import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/persona";
import { fmtDateTimeIST } from "@/lib/slots";
import { User } from "@/models/user";
import { MentorSession, RecruiterInterest } from "@/models/connect";
import { TrainingCourse, TrainingEnrollment, TrainingSubmission } from "@/models/train";

export const dynamic = "force-dynamic";

// GET — platform statistics and recent records, all computed from MongoDB.
export async function GET() {
  try {
    await requireRole("admin");
    const count = (agg: { _id: string; n: number }[]) => Object.fromEntries(agg.map((x) => [x._id, x.n]));
    const [users, pendingApprovals, bookings, courses, enrollments, submissions, interests, recentBookings, courseList] = await Promise.all([
      User.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]),
      User.countDocuments({ role: { $in: ["mentor", "recruiter"] }, approved: false }),
      MentorSession.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      TrainingCourse.aggregate([{ $group: { _id: { $cond: ["$published", "published", "draft"] }, n: { $sum: 1 } } }]),
      TrainingEnrollment.countDocuments(),
      TrainingSubmission.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      RecruiterInterest.countDocuments(),
      MentorSession.find().sort({ createdAt: -1 }).limit(25).lean<{ _id: unknown; studentName: string; mentorName: string; topic: string; requestedStartAt: Date; status: string }[]>(),
      TrainingCourse.find().sort({ createdAt: -1 }).limit(50).select("title published isDemo trainerId createdAt").lean<{ _id: unknown; title: string; published: boolean; isDemo: boolean }[]>(),
    ]);
    const enrollByCourse = count(await TrainingEnrollment.aggregate([{ $group: { _id: { $toString: "$courseId" }, n: { $sum: 1 } } }]));
    return NextResponse.json({
      stats: { users: count(users), pendingApprovals, bookings: count(bookings), courses: count(courses), enrollments, submissions: count(submissions), recruiterRequests: interests },
      recentBookings: recentBookings.map((b) => ({ id: String(b._id), student: b.studentName, mentor: b.mentorName, topic: b.topic, when: fmtDateTimeIST(b.requestedStartAt), status: b.status })),
      courses: courseList.map((c) => ({ id: String(c._id), title: c.title, published: c.published, isDemo: c.isDemo, enrollments: enrollByCourse[String(c._id)] ?? 0 })),
    });
  } catch (e) {
    return apiError(e);
  }
}
