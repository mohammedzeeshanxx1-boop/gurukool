#!/usr/bin/env node
// End-to-end test of CONNECT 2.0 against a RUNNING GURUKOOL server backed by MongoDB.
//   npm run dev            (in one terminal)
//   npm run test:connect   (in another)   — or: BASE=http://localhost:3000 node scripts/e2e-connect.mjs
// Uses its own cookie jar (does not change your browser persona).
// It creates a mentor named "E2E Test Mentor (automated test)" with early-morning slots, books/accepts/
// rejects/cancels sessions with it, then sets that mentor to draft (hidden). The student's "My Sessions"
// will keep a few CANCELLED/REJECTED entries for topic "E2E Test Topic".
const BASE = process.env.BASE ?? "http://localhost:3000";
let cookie = "";
let passed = 0, failed = 0;

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get("set-cookie");
  if (set?.startsWith("gk_persona=")) cookie = set.split(";")[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${detail}`); }
}
const as = async (role, id) => {
  const r = await call("POST", "/api/persona", { role, id });
  if (r.status !== 200) throw new Error(`Persona switch failed: ${JSON.stringify(r.data)}`);
};

async function main() {
  console.log(`GURUKOOL CONNECT 2.0 e2e → ${BASE}\n`);
  const status = await call("GET", "/api/status");
  if (!status.data?.db?.connected) throw new Error(`MongoDB not connected: ${JSON.stringify(status.data?.db)}`);
  const me = await call("GET", "/api/student");
  if (!me.data?.student) throw new Error("Save the student profile on the Dashboard first.");
  const persona = await call("GET", "/api/persona");
  const opt = (role, label) => persona.data.options.find((o) => o.role === role && (!label || o.label.includes(label)));
  const studentId = opt("student").id;

  console.log("Discovery & filters");
  await as("student", studentId);
  const all = await call("GET", "/api/mentors");
  check("mentors list loads with demo profiles", all.status === 200 && all.data.mentors.filter((m) => m.isDemo).length >= 6);
  check("no profile claims to be verified", all.data.mentors.every((m) => m.verified === false));
  const ai = await call("GET", "/api/mentors?domain=AI%2FML");
  check("domain filter (AI/ML) only returns AI/ML mentors", ai.data.mentors.length > 0 && ai.data.mentors.every((m) => m.domains.includes("AI/ML")));
  const node = await call("GET", "/api/mentors?q=Node.js");
  check("expertise search finds the backend mentor", node.data.mentors.some((m) => m.name === "Demo Backend Mentor"));
  const sun = await call("GET", "/api/mentors?day=Sunday&format=Mock%20Interview");
  check("day + session-type filters combine", sun.data.mentors.every((m) => m.availability.some((a) => a.day === "Sunday") && m.sessionFormats.includes("Mock Interview")));

  console.log("\nMentor profile & availability");
  const created = await call("POST", "/api/mentors", {
    name: "E2E Test Mentor (automated test)", headline: "Automated test profile", designation: "Tester", organization: "E2E",
    yearsOfExperience: 2, expertise: ["Testing"], teachingTopics: ["E2E Test Topic"], domains: ["Backend Development"],
    availability: [{ day: "Saturday", start: "06:00", end: "07:00" }, { day: "Sunday", start: "06:00", end: "06:45" }],
  });
  check("mentor profile created", created.status === 201, JSON.stringify(created.data));
  const mentorId = created.data.mentor?.id;
  const bad = await call("PATCH", `/api/mentors/${mentorId}`, { availability: [{ day: "Monday", start: "10:00", end: "11:00" }] });
  check("weekday slot rejected (weekends only)", bad.status === 400);
  const overlap = await call("PATCH", `/api/mentors/${mentorId}`, { availability: [{ day: "Saturday", start: "06:00", end: "07:00" }, { day: "Saturday", start: "06:30", end: "07:30" }] });
  check("overlapping slots rejected", overlap.status === 400);
  const good = await call("PATCH", `/api/mentors/${mentorId}`, { availability: [{ day: "Saturday", start: "06:00", end: "07:00" }, { day: "Sunday", start: "06:00", end: "06:45" }] });
  check("availability saved", good.status === 200 && good.data.mentor.availability.length === 2);

  console.log("\nBooking (student)");
  await as("student", studentId);
  const detail = await call("GET", `/api/mentors/${mentorId}`);
  const slots = detail.data.slots ?? [];
  check("mentor's real slots are offered (IST, future)", slots.length >= 2 && new Date(slots[0].startAt) > new Date());
  const base = { mentorId, studentName: me.data.student.name, studentEmail: me.data.student.email || "student@example.com", topic: "E2E Test Topic", message: "Automated e2e booking test message." };
  const notSlot = await call("POST", "/api/mentor-sessions", { ...base, durationMinutes: 60, startAt: new Date(new Date(slots[0].startAt).getTime() + 15 * 60000).toISOString() });
  check("time outside mentor availability rejected", notSlot.status === 400);
  const wrongTopic = await call("POST", "/api/mentor-sessions", { ...base, topic: "Something else", durationMinutes: 60, startAt: slots[0].startAt });
  check("topic not offered rejected", wrongTopic.status === 400);
  const sunSlot = slots.find((s) => s.slotMinutes === 45);
  const tooLong = await call("POST", "/api/mentor-sessions", { ...base, durationMinutes: 60, startAt: sunSlot.startAt });
  check("duration longer than slot rejected", tooLong.status === 400);
  const A = await call("POST", "/api/mentor-sessions", { ...base, durationMinutes: 60, startAt: slots[0].startAt });
  check("booking request saved as PENDING", A.status === 201 && A.data.session.status === "PENDING", JSON.stringify(A.data));
  const dup = await call("POST", "/api/mentor-sessions", { ...base, durationMinutes: 30, startAt: slots[0].startAt });
  check("duplicate request for same slot blocked (409)", dup.status === 409);
  const mine = await call("GET", "/api/mentor-sessions");
  check("booking appears in My Sessions", mine.data.sessions.some((s) => s.id === A.data.session.id && s.status === "PENDING"));
  const selfAccept = await call("PATCH", `/api/mentor-sessions/${A.data.session.id}`, { status: "ACCEPTED" });
  check("student cannot accept own booking (403)", selfAccept.status === 403);

  console.log("\nMentor actions");
  await as("mentor", opt("mentor", "Demo Backend Mentor").id);
  const other = await call("PATCH", `/api/mentor-sessions/${A.data.session.id}`, { status: "ACCEPTED" });
  check("a different mentor cannot accept it (404)", other.status === 404);
  const editOther = await call("PATCH", `/api/mentors/${mentorId}`, { name: "hijack" });
  check("a different mentor cannot edit the profile (403)", editOther.status === 403);
  await as("mentor", mentorId);
  const incoming = await call("GET", "/api/mentor-sessions");
  check("mentor sees the pending request", incoming.data.sessions.some((s) => s.id === A.data.session.id && s.status === "PENDING"));
  const acc = await call("PATCH", `/api/mentor-sessions/${A.data.session.id}`, { status: "ACCEPTED" });
  check("mentor accepts → ACCEPTED", acc.status === 200 && acc.data.session.status === "ACCEPTED", JSON.stringify(acc.data));
  const again = await call("PATCH", `/api/mentor-sessions/${A.data.session.id}`, { status: "ACCEPTED" });
  check("accepting twice is refused (409)", again.status === 409);
  const early = await call("PATCH", `/api/mentor-sessions/${A.data.session.id}`, { status: "COMPLETED" });
  check("cannot mark a future session completed (409)", early.status === 409);

  console.log("\nStudent sees result; slot is locked");
  await as("student", studentId);
  const after = await call("GET", "/api/mentor-sessions");
  check("student now sees ACCEPTED", after.data.sessions.some((s) => s.id === A.data.session.id && s.status === "ACCEPTED"));
  const d2 = await call("GET", `/api/mentors/${mentorId}`);
  check("accepted slot no longer offered", !d2.data.slots.some((s) => s.startAt === slots[0].startAt));
  const taken = await call("POST", "/api/mentor-sessions", { ...base, durationMinutes: 60, startAt: slots[0].startAt });
  check("booking an accepted slot is blocked (409)", taken.status === 409);

  console.log("\nReject flow");
  const B = await call("POST", "/api/mentor-sessions", { ...base, durationMinutes: 30, startAt: slots[1].startAt });
  check("second request saved", B.status === 201, JSON.stringify(B.data));
  await as("mentor", mentorId);
  const rej = await call("PATCH", `/api/mentor-sessions/${B.data.session.id}`, { status: "REJECTED", note: "Automated test rejection" });
  check("mentor rejects → REJECTED", rej.status === 200 && rej.data.session.status === "REJECTED");
  await as("student", studentId);
  const afterRej = await call("GET", "/api/mentor-sessions");
  const rb = afterRej.data.sessions.find((s) => s.id === B.data.session.id);
  check("student sees REJECTED with note (not confirmed)", rb?.status === "REJECTED" && rb.statusNote.includes("Automated"));
  const cancelRej = await call("PATCH", `/api/mentor-sessions/${B.data.session.id}`, { status: "CANCELLED" });
  check("rejected booking can't be cancelled (409)", cancelRej.status === 409);

  console.log("\nRecommendations");
  const recs = await call("GET", "/api/mentors/recommendations?limit=3");
  check("recommendations endpoint responds", recs.status === 200 && Array.isArray(recs.data.recommendations));
  if (recs.data.recommendations?.[0]) console.log(`    top: ${recs.data.recommendations[0].mentor.name} — ${recs.data.recommendations[0].reasons[0]}`);

  console.log("\nRecruiter portal");
  await as("recruiter", opt("recruiter").id);
  const studs = await call("GET", "/api/recruiters/students");
  check("recruiter sees opted-in students", studs.status === 200 && studs.data.students.length >= 2);
  check("no emails exposed to recruiters", studs.data.students.every((s) => !("email" in s) && !("studentEmail" in s)));
  const visible = await call("GET", `/api/recruiters/students?goal=${encodeURIComponent("AI/ML Engineer")}`);
  check("career-goal filter works", visible.data.students.every((s) => s.careerGoal === "AI/ML Engineer"));
  const demoStudent = studs.data.students.find((s) => s.isDemo);
  const int = await call("POST", "/api/recruiter-interests", { studentId: demoStudent.id, type: "INTEREST", message: "Automated e2e interest test." });
  check("interest request saved", int.status === 201 || int.status === 409, JSON.stringify(int.data));
  const int2 = await call("POST", "/api/recruiter-interests", { studentId: demoStudent.id, type: "INTEREST", message: "Automated e2e interest test." });
  check("duplicate open request blocked (409)", int2.status === 409);
  const sent = await call("GET", "/api/recruiter-interests");
  const mineInt = sent.data.interests.find((i) => i.studentName === demoStudent.name && i.status === "PENDING");
  const wd = await call("PATCH", `/api/recruiter-interests/${mineInt?.id}`, { status: "WITHDRAWN" });
  check("recruiter can withdraw own request", wd.status === 200);

  console.log("\nCleanup");
  await as("mentor", mentorId);
  const cancel = await call("PATCH", `/api/mentor-sessions/${A.data.session.id}`, { status: "CANCELLED", note: "Automated test cleanup" });
  check("mentor cancels accepted test session (slot released)", cancel.status === 200);
  const hide = await call("PATCH", `/api/mentors/${mentorId}`, { profileStatus: "draft" });
  check("test mentor hidden (draft)", hide.status === 200);
  await as("student", studentId);
  const d3 = await call("GET", "/api/mentors?q=E2E");
  check("draft mentor no longer listed", !d3.data.mentors.some((m) => m.id === mentorId));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(`\n✗ ${e.message}\n${passed} passed, ${failed + 1} failed`); process.exit(1); });
