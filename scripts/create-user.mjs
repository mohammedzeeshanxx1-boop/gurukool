#!/usr/bin/env node
// Create a login for an EXISTING or new profile. The only way to create Admin accounts.
//   npm run create-user -- --role admin   --email admin@x.com   --password '...' --name "Admin"
//   npm run create-user -- --role student --email me@x.com      --password '...' --name "Me" --link demo-student
//   npm run create-user -- --role expert  --email mentor@x.com  --password '...' --link "Demo Backend Mentor"
//   npm run create-user -- --role recruiter --email r@x.com     --password '...' --link "Demo Recruiter (Tech Hiring)"
// --link: student key / mentor or recruiter name or id. Recruiters created here are pre-approved.
import fs from "fs";
import crypto from "crypto";
import mongoose from "mongoose";

const args = Object.fromEntries(process.argv.slice(2).join(" ").split(/\s--/).map((x) => x.replace(/^--/, "")).filter(Boolean)
  .map((x) => { const i = x.indexOf(" "); return i < 0 ? [x, ""] : [x.slice(0, i), x.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
for (const f of [".env.local", ".env"]) if (fs.existsSync(f))
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }

const role = { student: "student", expert: "mentor", mentor: "mentor", recruiter: "recruiter", admin: "admin" }[args.role];
const email = (args.email ?? "").toLowerCase();
if (!role || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || (args.password ?? "").length < 8) {
  console.error("Usage: --role student|expert|recruiter|admin --email <email> --password <min 8 chars> [--name <name>] [--link <profile>]");
  process.exit(1);
}
if (!process.env.MONGODB_URI) { console.error("MONGODB_URI is not set (.env.local)"); process.exit(1); }

const salt = crypto.randomBytes(16).toString("base64url");
const passwordHash = `scrypt$${salt}$${crypto.scryptSync(args.password, salt, 64).toString("base64url")}`;

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
if (await db.collection("users").findOne({ email })) { console.error(`An account for ${email} already exists.`); process.exit(1); }

const byNameOrId = async (coll, v) => (mongoose.isValidObjectId(v) ? db.collection(coll).findOne({ _id: new mongoose.Types.ObjectId(v) }) : null) ?? db.collection(coll).findOne({ name: v });
let profileId = "", name = args.name ?? "";
const _id = new mongoose.Types.ObjectId();
if (role === "student") {
  profileId = args.link || `u-${_id}`;
  const s = await db.collection("students").findOne({ key: profileId });
  if (args.link && !s) { console.error(`No student profile with key "${args.link}"`); process.exit(1); }
  name ||= s?.name ?? email;
  if (await db.collection("users").findOne({ role: "student", profileId })) { console.error("That student profile already has a login."); process.exit(1); }
} else if (role === "mentor" || role === "recruiter") {
  if (!args.link) { console.error(`--link is required for ${args.role} (use the register page to create new ones)`); process.exit(1); }
  const p = await byNameOrId(role === "mentor" ? "mentors" : "recruiters", args.link);
  if (!p) { console.error(`No ${args.role} profile matching "${args.link}"`); process.exit(1); }
  profileId = String(p._id); name ||= p.name;
} else name ||= "Administrator";

const now = new Date();
await db.collection("users").insertOne({ _id, email, passwordHash, role, name, profileId, approved: true, createdAt: now, updatedAt: now });
if (role === "mentor") await db.collection("mentors").updateOne({ _id: new mongoose.Types.ObjectId(profileId) }, { $set: { verified: true } });
console.log(`Created ${args.role} login ${email}${profileId ? ` → profile ${profileId}` : ""}`);
await mongoose.disconnect();
