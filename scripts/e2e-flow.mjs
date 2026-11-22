#!/usr/bin/env node
// Real multi-account end-to-end test against a RUNNING server + MongoDB.
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run test:flow       (BASE defaults to http://localhost:3000)
// Creates isolated accounts e2e-<time>-{student,peer,expert,recruiter}@test.local, runs the cross-portal flows,
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
  const admin = client(), stu = client(), stu2 = client(), exp = client(), rec = client(), pw = "TestPass123!";
  const E = (r) => `e2e-${T}-${r}@test.local`;
  console.log(`GURUKOOL multi-account e2e → ${BASE}\n\nAccounts & portals`);
  check("admin signs in via Admin portal", (await admin("POST", "/api/auth/login", { portal: "admin", email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).status === 200);
  check("student registers", (await stu("POST", "/api/auth/register", { portal: "student", name: "E2E Student", email: E("student"), password: pw })).status === 201);
  check("second student registers", (await stu2("POST", "/api/auth/register", { portal: "student", name: "E2E Peer", email: E("peer"), password: pw })).status === 201);
  check("expert registers", (await exp("POST", "/api/auth/register", { portal: "expert", name: "E2E Expert", email: E("expert"), password: pw, organization: "E2E Org", designation: "Engineer" })).status === 201);
  check("recruiter registers", (await rec("POST", "/api/auth/register", { portal: "recruiter", name: "E2E Recruiter", email: E("recruiter"), password: pw, organization: "E2E Co", designation: "Recruiter" })).status === 201);
  check("duplicate email rejected", (await client()("POST", "/api/auth/register", { portal: "student", name: "Dup", email: E("student"), password: pw })).status === 409);
  check("student can't sign in via Recruiter portal", (await client()("POST", "/api/auth/login", { portal: "recruiter", email: E("student"), password: pw })).status === 403);
  check("wrong password rejected", (await client()("POST", "/api/auth/login", { portal: "student", email: E("student"), password: "nope12345" })).status === 401);
  {
    const r = await fetch(BASE + "/api/auth/logout", { method: "POST", headers: { Origin: "https://evil.example" } });
    check("cross-origin POST blocked (CSRF)", r.status === 403);
  }
  check("student blocked from admin API", (await stu("GET", "/api/admin/users")).status === 403);

  console.log("\nProfiles & approval");
  const sp = await stu("PUT", "/api/student", { name: "E2E Student Renamed", college: "Test College", branch: "CSE", semester: 5, careerGoal: "Backend Developer", skills: "JavaScript", interests: "Web Development" });
  check("student profile saved with account email", sp.status === 200 && sp.data.student?.email === E("student"));
  check("name synced to account", (await stu("GET", "/api/auth/me")).data.user?.name === "E2E Student Renamed");
  check("unapproved recruiter blocked from student data", (await rec("GET", "/api/recruiters/students")).status === 403);
  const users = (await admin("GET", "/api/admin/users")).data.users ?? [];
  const uE = users.find((u) => u.email === E("expert")), uR = users.find((u) => u.email === E("recruiter")), uS = users.find((u) => u.email === E("student")), uP = users.find((u) => u.email === E("peer"));
  check("Admin sees all three new accounts with real names", Boolean(uE && uR && uS) && uS.name === "E2E Student Renamed");
  check("admin approves expert", (await admin("PATCH", "/api/admin/users", { id: uE?.id, approved: true })).status === 200);
  check("admin approves recruiter", (await admin("PATCH", "/api/admin/users", { id: uR?.id, approved: true })).status === 200);
  console.log("\nCONNECT (student ↔ student study sessions)");
  await stu2("PUT", "/api/student", { name: "E2E Peer", college: "Test College", branch: "CSE", semester: 5, careerGoal: "Backend Developer", skills: "JavaScript, SQL", interests: "Web Development" });
  const peers = (await stu("GET", "/api/peers?q=E2E Peer")).data.peers ?? [];
  const peer = peers.find((p) => p.name === "E2E Peer");
  check("student finds the other student (no email exposed)", Boolean(peer) && !("email" in peer));
  check("match reasons shown", peer?.reasons?.some((r) => /Same goal/.test(r)));
  const startAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const ps = await stu("POST", "/api/peer-sessions", { peerKey: peer?.id, topic: "SQL joins practice", message: "E2E test session", startAt, durationMinutes: 60 });
  check("session requested (PENDING)", ps.status === 201 && ps.data.session?.status === "PENDING", JSON.stringify(ps.data));
  check("no room code before acceptance", ps.data.session?.roomCode === null);
  check("duplicate request rejected", (await stu("POST", "/api/peer-sessions", { peerKey: peer?.id, topic: "Another", startAt, durationMinutes: 30 })).status === 409);
  check("peer notified", (await stu2("GET", "/api/notifications")).data.items?.some((n) => /wants to study with you/.test(n.title)));
  check("requester can't accept own request", (await stu("PATCH", `/api/peer-sessions/${ps.data.session?.id}`, { action: "accept" })).status === 403);
  check("outsider can't see the session", (await exp("PATCH", `/api/peer-sessions/${ps.data.session?.id}`, { action: "cancel" })).status === 403);
  const acc = await stu2("PATCH", `/api/peer-sessions/${ps.data.session?.id}`, { action: "accept" });
  check("peer accepts and gets a room", acc.data.session?.status === "ACCEPTED" && /^study-/.test(acc.data.session?.roomCode ?? ""));
  const mineP = (await stu("GET", "/api/peer-sessions")).data.sessions?.find((x) => x.id === ps.data.session?.id);
  check("requester sees ACCEPTED with the same room", mineP?.status === "ACCEPTED" && mineP?.roomCode === acc.data.session?.roomCode);
  check("requester notified of acceptance", (await stu("GET", "/api/notifications")).data.items?.some((n) => /accepted your study session/.test(n.title)));
  await stu2("PUT", "/api/student", { name: "E2E Peer", college: "Test College", branch: "CSE", semester: 5, careerGoal: "Backend Developer", skills: "JavaScript, SQL", interests: "Web Development", peerDiscoverable: false });
  check("hidden student no longer listed", !((await stu("GET", "/api/peers?q=E2E Peer")).data.peers ?? []).some((p) => p.name === "E2E Peer"));

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
  await stu("PATCH", `/api/peer-sessions/${ps.data.session?.id}`, { action: "cancel" });
  for (const u of [uS, uP, uE, uR]) if (u) await admin("PATCH", "/api/admin/users", { id: u.id, active: false });
  check("suspended account is locked out", (await stu("GET", "/api/student")).status === 403);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(`\n✗ ${e.message}\n${passed} passed, ${failed + 1} failed`); process.exit(1); });
