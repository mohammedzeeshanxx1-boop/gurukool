#!/usr/bin/env node
// Real multi-account end-to-end test against a RUNNING server + MongoDB.
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run test:flow       (BASE defaults to http://localhost:3000)
// Creates isolated accounts e2e-<time>-{student,expert,recruiter}@test.local, runs the cross-portal flows,
// then suspends those test accounts (records are kept, nothing is deleted).
const BASE = process.env.BASE ?? "http://localhost:3000";
const T = Date.now();
let passed = 0, failed = 0;
const check = (n, ok, d = "") => { ok ? passed++ : failed++; console.log(`  ${ok ? "✓" : "✗"} ${n}${ok ? "" : " " + d}`); };

function client() {
  let cookie = "";
  return async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    const sc = r.headers.get("set-cookie");
    if (sc?.startsWith("gk_session=")) cookie = sc.split(";")[0];
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
}
function nextWeekendIST() { // YYYY-MM-DD of the Saturday at least 2 days ahead
  const ist = new Date(Date.now() + 330 * 60000);
  for (let i = 2; i < 10; i++) { const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + i)); if (d.getUTCDay() === 6) return d; }
}

async function main() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (create one with npm run create-user -- --role admin ...)");
  const admin = client(), stu = client(), exp = client(), rec = client(), pw = "TestPass123!";
  const E = (r) => `e2e-${T}-${r}@test.local`;
  console.log(`GURUKOOL multi-account e2e → ${BASE}\n\nAccounts & portals`);
  check("admin signs in via Admin portal", (await admin("POST", "/api/auth/login", { portal: "admin", email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).status === 200);
  check("student registers", (await stu("POST", "/api/auth/register", { portal: "student", name: "E2E Student", email: E("student"), password: pw })).status === 201);
  check("expert registers", (await exp("POST", "/api/auth/register", { portal: "expert", name: "E2E Expert", email: E("expert"), password: pw, organization: "E2E Org", designation: "Engineer" })).status === 201);
  check("recruiter registers", (await rec("POST", "/api/auth/register", { portal: "recruiter", name: "E2E Recruiter", email: E("recruiter"), password: pw, organization: "E2E Co", designation: "Recruiter" })).status === 201);
  check("duplicate email rejected", (await client()("POST", "/api/auth/register", { portal: "student", name: "Dup", email: E("student"), password: pw })).status === 409);
  check("student can't sign in via Recruiter portal", (await client()("POST", "/api/auth/login", { portal: "recruiter", email: E("student"), password: pw })).status === 403);
  check("wrong password rejected", (await client()("POST", "/api/auth/login", { portal: "student", email: E("student"), password: "nope12345" })).status === 401);
  check("student blocked from admin API", (await stu("GET", "/api/admin/users")).status === 403);

  console.log("\nProfiles & approval");
  const sp = await stu("PUT", "/api/student", { name: "E2E Student Renamed", college: "Test College", branch: "CSE", semester: 5, careerGoal: "Backend Developer", skills: "JavaScript", interests: "Web Development" });
  check("student profile saved with account email", sp.status === 200 && sp.data.student?.email === E("student"));
  check("name synced to account", (await stu("GET", "/api/auth/me")).data.user?.name === "E2E Student Renamed");
  const meE = await exp("GET", "/api/persona");
  const mentorId = meE.data.persona?.id;
  const ep = await exp("PATCH", `/api/mentors/${mentorId}`, { name: "E2E Expert", headline: "Backend mentor", expertise: ["Node.js"], teachingTopics: ["Backend Development"], domains: ["Backend Development"], profileStatus: "active", availability: [{ day: "Saturday", start: "06:00", end: "07:00" }] });
  check("expert profile + weekend availability saved", ep.status === 200);
  check("unapproved expert NOT discoverable", !(await stu("GET", "/api/mentors?q=Node.js")).data.mentors?.some((m) => m.id === mentorId));
  check("unapproved recruiter blocked from student data", (await rec("GET", "/api/recruiters/students")).status === 403);
  const users = (await admin("GET", "/api/admin/users")).data.users ?? [];
  const uE = users.find((u) => u.email === E("expert")), uR = users.find((u) => u.email === E("recruiter")), uS = users.find((u) => u.email === E("student"));
  check("Admin sees all three new accounts with real names", Boolean(uE && uR && uS) && uS.name === "E2E Student Renamed");
  check("admin approves expert", (await admin("PATCH", "/api/admin/users", { id: uE?.id, approved: true })).status === 200);
  check("admin approves recruiter", (await admin("PATCH", "/api/admin/users", { id: uR?.id, approved: true })).status === 200);
  check("approved expert now discoverable", (await stu("GET", "/api/mentors?q=Node.js")).data.mentors?.some((m) => m.id === mentorId));

  console.log("\nMentorship booking lifecycle (two accounts)");
  const det = await stu("GET", `/api/mentors/${mentorId}`);
  const slot = det.data.slots?.[0];
  check("student sees the expert's real slots", Boolean(slot));
  const bk = await stu("POST", "/api/mentor-sessions", { mentorId, topic: "Backend Development", startAt: slot?.startAt, durationMinutes: 60, message: "E2E test: help with Node.js APIs" });
  check("booking created (PENDING)", bk.status === 201 && bk.data.session?.status === "PENDING", JSON.stringify(bk.data));
  check("duplicate booking rejected", (await stu("POST", "/api/mentor-sessions", { mentorId, topic: "Backend Development", startAt: slot?.startAt, durationMinutes: 30, message: "E2E duplicate attempt" })).status === 409);
  const inbox = await exp("GET", "/api/mentor-sessions");
  check("expert sees the pending request with student name", inbox.data.sessions?.some((s) => s.id === bk.data.session?.id && s.status === "PENDING" && s.studentName === "E2E Student Renamed"));
  check("expert got an in-app notification", (await exp("GET", "/api/notifications")).data.items?.some((n) => /New session request/.test(n.title)));
  check("student can't accept own booking", (await stu("PATCH", `/api/mentor-sessions/${bk.data.session?.id}`, { status: "ACCEPTED" })).status === 403);
  check("expert accepts", (await exp("PATCH", `/api/mentor-sessions/${bk.data.session?.id}`, { status: "ACCEPTED" })).data.session?.status === "ACCEPTED");
  const mine = await stu("GET", "/api/mentor-sessions");
  check("student sees ACCEPTED (persisted)", mine.data.sessions?.some((s) => s.id === bk.data.session?.id && s.status === "ACCEPTED"));
  check("student notified of acceptance", (await stu("GET", "/api/notifications")).data.items?.some((n) => /accepted/i.test(n.title)));
  check("TRAIN schedule shows the accepted mentorship (student)", (await stu("GET", "/api/train/me")).data.mentorshipSessions?.some((m) => m.id === bk.data.session?.id));
  check("TRAIN trainer schedule shows it (expert)", (await exp("GET", "/api/train/trainer")).data.mentorshipSessions?.some((m) => m.id === bk.data.session?.id));
  check("expert profile shows admin-verified", (await stu("GET", `/api/mentors/${mentorId}`)).data.mentor?.verified === true);
  const relog = client();
  await relog("POST", "/api/auth/login", { portal: "student", email: E("student"), password: pw });
  check("booking still there after signing in again", (await relog("GET", "/api/mentor-sessions")).data.sessions?.some((s) => s.id === bk.data.session?.id && s.status === "ACCEPTED"));

  console.log("\nTRAIN (expert course → student)");
  const c = await exp("POST", "/api/train/courses", { title: "E2E Test Course", description: "Automated end-to-end test course content.", category: "Backend Development", difficulty: "Beginner", durationWeeks: 1, skillTags: ["Node.js"] });
  const cid = c.data.course?.id;
  const mod = await exp("POST", `/api/train/courses/${cid}/content`, { type: "module", title: "Module 1" });
  await exp("POST", `/api/train/courses/${cid}/content`, { type: "lesson", moduleId: mod.data.id, title: "Lesson 1", explanation: "A lesson used by the automated test.", durationMinutes: 10 });
  const sat = nextWeekendIST();
  const asg = await exp("POST", `/api/train/courses/${cid}/content`, { type: "assignment", moduleId: mod.data.id, title: "Task 1", description: "Submit a repository link.", dueDate: sat.toISOString().slice(0, 10), maxMarks: 10 });
  check("approved expert publishes course", (await exp("PATCH", `/api/train/courses/${cid}`, { published: true })).status === 200);
  check("student sees it and enrolls", (await stu("POST", `/api/train/courses/${cid}/enroll`)).status === 201);
  check("expert notified of enrollment", (await exp("GET", "/api/notifications")).data.items?.some((n) => /enrollment/i.test(n.title)));
  const sub = await stu("POST", "/api/train/submissions", { assignmentId: asg.data.id, repositoryUrl: "https://github.com/example/e2e" });
  check("student submits assignment", sub.status === 201);
  const rv = await exp("PATCH", `/api/train/submissions/${sub.data.submission?.id}`, { score: 8, feedback: "Good work from the e2e test." });
  check("expert reviews it", rv.status === 200);
  const cd = await stu("GET", `/api/train/courses/${cid}`);
  check("student sees marks + feedback", cd.data.assignments?.[0]?.mySubmission?.score === 8);

  console.log("\nRecruiter");
  await stu("PATCH", "/api/student/visibility", { recruiterDiscoverable: true });
  const found = (await rec("GET", "/api/recruiters/students")).data.students?.find((s) => s.name === "E2E Student Renamed");
  check("approved recruiter finds opted-in student (no email exposed)", Boolean(found) && !("email" in found));
  check("shortlist persists", (await rec("POST", "/api/recruiters/shortlist", { studentId: found?.id, shortlisted: true })).status === 200 && (await rec("GET", "/api/recruiters/students")).data.students?.find((s) => s.id === found?.id)?.shortlisted === true);
  check("interest request sent", (await rec("POST", "/api/recruiter-interests", { studentId: found?.id, message: "E2E test interest request." })).status === 201);
  check("student notified + sees request", (await stu("GET", "/api/recruiter-interests")).data.interests?.length >= 1 && (await stu("GET", "/api/notifications")).data.items?.some((n) => /recruiter/i.test(n.title)));

  console.log("\nCleanup (suspend test accounts; nothing deleted)");
  await exp("PATCH", `/api/train/courses/${cid}`, { published: false });
  await exp("PATCH", `/api/mentor-sessions/${bk.data.session?.id}`, { status: "CANCELLED" });
  for (const u of [uS, uE, uR]) if (u) await admin("PATCH", "/api/admin/users", { id: u.id, active: false });
  check("suspended account is locked out", (await stu("GET", "/api/student")).status === 403);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(`\n✗ ${e.message}\n${passed} passed, ${failed + 1} failed`); process.exit(1); });
