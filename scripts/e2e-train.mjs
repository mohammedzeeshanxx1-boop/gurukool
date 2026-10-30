#!/usr/bin/env node
// End-to-end test of GURUKOOL TRAIN against a RUNNING server backed by MongoDB.
//   npm run dev           (one terminal)
//   npm run test:train    (another)        — or BASE=http://localhost:3000 node scripts/e2e-train.mjs
// Uses its own cookie jar. It does NOT enroll in or submit to the demo "Backend Development Bootcamp",
// so your live demo stays clean. Instead it creates "E2E Test Trainer (automated test)" and an
// "E2E Test Course (automated test)", runs the full LMS flow, then unpublishes the course and hides
// the trainer. The demo student keeps one enrollment in that test course; unpublished courses are hidden from My Training.
const BASE = process.env.BASE ?? "http://localhost:3000";
let cookie = "", passed = 0, failed = 0;

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get("set-cookie");
  if (set?.startsWith("gk_persona=")) cookie = set.split(";")[0];
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const check = (name, ok, detail = "") => { ok ? passed++ : failed++; console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : " " + detail}`); };
const as = async (role, id) => { const r = await call("POST", "/api/persona", { role, id }); if (r.status !== 200) throw new Error(`persona switch failed ${JSON.stringify(r.data)}`); };

// Next Saturday (IST) at least 2 days ahead, as YYYY-MM-DD; and a Monday for negative tests.
function istDate(dayIdx, minDaysAhead) {
  const ist = new Date(Date.now() + 330 * 60000);
  for (let i = minDaysAhead; i < minDaysAhead + 8; i++) {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + i));
    if (d.getUTCDay() === dayIdx) return d.toISOString().slice(0, 10);
  }
}

async function main() {
  console.log(`GURUKOOL TRAIN e2e → ${BASE}\n`);
  const st = await call("GET", "/api/status");
  if (!st.data?.db?.connected) throw new Error(`MongoDB not connected: ${JSON.stringify(st.data?.db)}`);
  const me = await call("GET", "/api/student");
  if (!me.data?.student) throw new Error("Save the student profile on the Dashboard first.");
  const personas = (await call("GET", "/api/persona")).data.options;
  const studentId = personas.find((o) => o.role === "student").id;
  const demoTrainerId = personas.find((o) => o.role === "mentor" && o.label === "Demo Backend Mentor")?.id;

  console.log("Catalog & demo course (read-only)");
  await as("student", studentId);
  const cat = await call("GET", "/api/train/courses");
  const boot = cat.data.courses?.find((c) => c.title === "Backend Development Bootcamp");
  check("Backend Development Bootcamp is in the catalog", Boolean(boot));
  check("bootcamp: 5 modules, demo-labelled, fictional trainer", boot?.moduleCount === 5 && boot.isDemo && boot.trainer.isDemo);
  const f1 = await call("GET", "/api/train/courses?q=MongoDB");
  check("search by skill finds it", f1.data.courses.some((c) => c.id === boot?.id));
  const f2 = await call("GET", "/api/train/courses?difficulty=Advanced");
  check("difficulty filter excludes it", !f2.data.courses.some((c) => c.id === boot?.id));
  const bd = await call("GET", `/api/train/courses/${boot?.id}`);
  check("bootcamp has 10 lessons and 5 assignments", bd.data.course?.lessonCount === 10 && bd.data.assignments?.length === 5);
  check("bootcamp has an upcoming weekend live class", bd.data.sessions?.some((s) => !s.past && s.status === "SCHEDULED"));
  if (!bd.data.enrollment) check("lesson content is gated until enrollment", bd.data.course.modules[0].lessons[0].explanation === null);
  const rec = await call("GET", "/api/train/recommendations");
  check("training recommender responds", rec.status === 200 && Array.isArray(rec.data.recommendations));
  const top = rec.data.recommendations?.[0];
  if (top) {
    const c = top.components;
    check("score = 50/30/20 weighted sum; has explanation + enroll link",
      Math.abs(top.matchScore - Math.round(100 * (0.5 * c.weakSkills + 0.3 * c.roadmap + 0.2 * c.careerGoal))) <= 1 && top.explanation.startsWith("Recommended because") && top.enrollUrl.startsWith("/train/courses/"));
    check("evidence basis only when an assessment exists", (top.basis === "evidence") === (rec.data.basedOn.weakTopics.length > 0));
    console.log(`    top: ${top.course.title} (${top.matchScore}%, ${top.basis}): ${top.explanation}`);
  }

  console.log("\nTrainer builds a course");
  const tm = await call("POST", "/api/mentors", { name: "E2E Test Trainer (automated test)", headline: "Automated test", designation: "Tester", organization: "E2E", yearsOfExperience: 1, expertise: ["Testing"], teachingTopics: ["Testing"] });
  check("test trainer profile created (persona switched)", tm.status === 201);
  const trainerId = tm.data.mentor?.id;
  const cr = await call("POST", "/api/train/courses", { title: "E2E Test Course (automated test)", description: "Automated end-to-end test course for GURUKOOL TRAIN.", category: "Backend Development", difficulty: "Beginner", durationWeeks: 1, skillTags: ["Testing", "Node.js"] });
  check("course created as draft", cr.status === 201, JSON.stringify(cr.data));
  const cid = cr.data.course?.id;
  check("cannot publish without lessons", (await call("PATCH", `/api/train/courses/${cid}`, { published: true })).status === 400);
  const mod = await call("POST", `/api/train/courses/${cid}/content`, { type: "module", title: "Test Module", summary: "s" });
  check("module added", mod.status === 201);
  const les = await call("POST", `/api/train/courses/${cid}/content`, { type: "lesson", moduleId: mod.data.id, title: "Test Lesson", explanation: "This is a test lesson explanation text.", objectives: ["Objective A"], durationMinutes: 15 });
  check("lesson added", les.status === 201);
  const sat = istDate(6, 2), mon = istDate(1, 2);
  check("assignment with past due date rejected", (await call("POST", `/api/train/courses/${cid}/content`, { type: "assignment", moduleId: mod.data.id, title: "Old", description: "Past due test", dueDate: "2020-01-01", maxMarks: 10 })).status === 400);
  const asg = await call("POST", `/api/train/courses/${cid}/content`, { type: "assignment", moduleId: mod.data.id, title: "Test Assignment", description: "Submit a repository link.", dueDate: sat, maxMarks: 20, skillTags: "Testing" });
  check("assignment added", asg.status === 201, JSON.stringify(asg.data));
  check("weekday live session rejected", (await call("POST", `/api/train/courses/${cid}/content`, { type: "session", title: "Weekday", date: mon, startTime: "10:00", durationMinutes: 60 })).status === 400);
  const ses = await call("POST", `/api/train/courses/${cid}/content`, { type: "session", title: "E2E live class", date: sat, startTime: "07:15", durationMinutes: 60 });
  check("weekend live session scheduled (IST)", ses.status === 201, JSON.stringify(ses.data));
  check("overlapping session rejected", (await call("POST", `/api/train/courses/${cid}/content`, { type: "session", title: "Overlap", date: sat, startTime: "07:45", durationMinutes: 30 })).status === 409);
  check("course published", (await call("PATCH", `/api/train/courses/${cid}`, { published: true })).status === 200);

  if (demoTrainerId) {
    console.log("\nOther trainers are blocked");
    await as("mentor", demoTrainerId);
    check("another trainer can't edit the course (403)", (await call("PATCH", `/api/train/courses/${cid}`, { title: "Hijacked title" })).status === 403);
    check("another trainer can't add content (403)", (await call("POST", `/api/train/courses/${cid}/content`, { type: "module", title: "x" })).status === 403);
  }

  console.log("\nStudent learns");
  await as("student", studentId);
  check("enroll → 201", (await call("POST", `/api/train/courses/${cid}/enroll`)).status === 201);
  check("duplicate enrollment blocked (409)", (await call("POST", `/api/train/courses/${cid}/enroll`)).status === 409);
  const d1 = await call("GET", `/api/train/courses/${cid}`);
  check("enrollment persisted; lesson content now visible", Boolean(d1.data.enrollment) && typeof d1.data.course.modules[0].lessons[0].explanation === "string");
  check("invalid lesson id rejected", (await call("POST", "/api/train/progress", { courseId: cid, lessonId: "nope", completed: true })).status === 400);
  const pr = await call("POST", "/api/train/progress", { courseId: cid, lessonId: les.data.id, completed: true });
  check("lesson marked completed → 100% engagement", pr.status === 200 && pr.data.engagementPct === 100);
  const d2 = await call("GET", `/api/train/courses/${cid}`);
  check("lesson completion persisted", d2.data.progress.completedLessons === 1);
  check("empty submission rejected", (await call("POST", "/api/train/submissions", { assignmentId: asg.data.id })).status === 400);
  const sub = await call("POST", "/api/train/submissions", { assignmentId: asg.data.id, repositoryUrl: "github.com/example/e2e-test", submissionText: "Automated test submission." });
  check("assignment submitted", sub.status === 201, JSON.stringify(sub.data));
  const resub = await call("POST", "/api/train/submissions", { assignmentId: asg.data.id, repositoryUrl: "https://github.com/example/e2e-test-v2" });
  check("resubmission before review updates it", resub.status === 200 && resub.data.resubmitted === true);
  const my = await call("GET", "/api/train/me");
  const myE = my.data.enrollments?.find((e) => e.courseId === cid);
  check("My Training shows progress", myE?.engagementPct === 100 && myE.submitted === 1);
  check("My Training shows the upcoming live class", my.data.upcomingSessions?.some((s) => s.courseId === cid));

  if (demoTrainerId) {
    await as("mentor", demoTrainerId);
    const others = await call("GET", "/api/train/submissions");
    check("other trainer can't see this submission", !others.data.submissions?.some((s) => s.id === sub.data.submission?.id));
    check("other trainer can't review it (403)", (await call("PATCH", `/api/train/submissions/${sub.data.submission?.id}`, { score: 20, feedback: "hijack" })).status === 403);
  }

  console.log("\nTrainer evaluates");
  await as("mentor", trainerId);
  const dash = await call("GET", "/api/train/trainer");
  check("trainer sees the enrolled student and pending review", dash.data.students?.length >= 1 && dash.data.pendingReviews >= 1);
  check("marks above maximum rejected", (await call("PATCH", `/api/train/submissions/${sub.data.submission?.id}`, { score: 25, feedback: "Too many marks" })).status === 400);
  const rev = await call("PATCH", `/api/train/submissions/${sub.data.submission?.id}`, { score: 17, feedback: "Good structure; add input validation tests." });
  check("review saved (17/20)", rev.status === 200 && rev.data.status === "REVIEWED");

  console.log("\nStudent sees feedback");
  await as("student", studentId);
  check("reviewed submission can't be changed (409)", (await call("POST", "/api/train/submissions", { assignmentId: asg.data.id, submissionText: "late change attempt" })).status === 409);
  const d3 = await call("GET", `/api/train/courses/${cid}`);
  const ms = d3.data.assignments?.[0]?.mySubmission;
  check("feedback and marks visible to student", ms?.status === "REVIEWED" && ms.score === 17 && ms.feedback.includes("validation"));
  check("demonstrated (evaluated) progress = 85%", d3.data.progress?.demonstratedPct === 85);
  const tgl = await call("PATCH", `/api/train/enrollments/${d3.data.enrollment.id}`, { showInPortfolio: true });
  check("student controls GROW visibility", tgl.status === 200);
  await call("PATCH", `/api/train/enrollments/${d3.data.enrollment.id}`, { showInPortfolio: false });

  console.log("\nCleanup");
  await as("mentor", trainerId);
  check("session cancelled", (await call("PATCH", `/api/train/sessions/${ses.data.id}`, { status: "CANCELLED" })).status === 200);
  check("test course unpublished", (await call("PATCH", `/api/train/courses/${cid}`, { published: false })).status === 200);
  check("test trainer hidden", (await call("PATCH", `/api/mentors/${trainerId}`, { profileStatus: "draft" })).status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(`\n✗ ${e.message}\n${passed} passed, ${failed + 1} failed`); process.exit(1); });
