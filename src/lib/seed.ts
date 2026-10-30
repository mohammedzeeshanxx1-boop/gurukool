// Idempotent seed of clearly FICTIONAL demo profiles (mentors, recruiters, students).
// No real people, employers or job openings. Upserts by seedKey/key, so real data is never touched.
import "server-only";
import { connectDB } from "./db";
import { Mentor, MentorSession, Recruiter, RecruiterInterest } from "@/models/connect";
import { Student } from "@/models";

const DEMO_ORG = "Demonstration Profile";

const MENTORS = [
  {
    seedKey: "demo-backend", name: "Demo Backend Mentor", designation: "Senior Backend Engineer", organization: DEMO_ORG,
    headline: "Senior Backend Engineer · Node.js, APIs & system design", yearsOfExperience: 5,
    bio: "Fictional demonstration profile. Represents a backend engineer who builds REST APIs and data-heavy services with Node.js and MongoDB, and helps students prepare for backend interviews.",
    expertise: ["Node.js", "Express.js", "MongoDB", "REST APIs", "System Design"],
    teachingTopics: ["Backend Development", "API Development", "Database Design", "Interview Preparation", "Node.js Fundamentals"],
    domains: ["Backend Development", "Full Stack Development", "DSA and Interview Preparation"],
    sessionFormats: ["1:1 Mentorship", "Weekend Masterclass", "Mock Interview"],
    sessionDescription: "Hands-on weekend sessions: we build or review a real API together and you leave with next steps.",
    availability: [
      { day: "Saturday", start: "10:00", end: "11:00" }, { day: "Saturday", start: "14:00", end: "15:00" },
      { day: "Sunday", start: "11:00", end: "12:00" }, { day: "Sunday", start: "16:00", end: "17:00" },
    ],
  },
  {
    seedKey: "demo-frontend", name: "Demo Frontend Mentor", designation: "Frontend Engineer", organization: DEMO_ORG,
    headline: "Frontend Engineer · React, Next.js & accessible UI", yearsOfExperience: 4,
    bio: "Fictional demonstration profile. Represents a frontend engineer focused on React, TypeScript and building accessible, responsive interfaces.",
    expertise: ["React", "Next.js", "TypeScript", "Tailwind CSS", "Web Accessibility"],
    teachingTopics: ["Frontend Development", "React Fundamentals", "TypeScript for React", "Responsive Design"],
    domains: ["Frontend Development", "Full Stack Development"],
    sessionFormats: ["1:1 Mentorship", "Project Review"],
    sessionDescription: "Bring a component or project; we review it together and refactor live.",
    availability: [{ day: "Saturday", start: "11:00", end: "12:00" }, { day: "Sunday", start: "10:00", end: "11:00" }],
  },
  {
    seedKey: "demo-aiml", name: "Demo AI/ML Mentor", designation: "Machine Learning Engineer", organization: DEMO_ORG,
    headline: "ML Engineer · Python, deep learning & LLM apps", yearsOfExperience: 6,
    bio: "Fictional demonstration profile. Represents an ML engineer who trains models in PyTorch and builds LLM-powered applications.",
    expertise: ["Python", "Machine Learning", "Deep Learning", "PyTorch", "NumPy & Pandas", "LLMs & Prompt Engineering"],
    teachingTopics: ["AI/ML Foundations", "Machine Learning Projects", "Deep Learning", "Building LLM Apps"],
    domains: ["AI/ML"],
    sessionFormats: ["Weekend Masterclass", "1:1 Mentorship"],
    sessionDescription: "Notebook-first sessions: from a dataset to a trained, evaluated model.",
    availability: [{ day: "Saturday", start: "16:00", end: "17:30" }, { day: "Sunday", start: "14:00", end: "15:00" }],
  },
  {
    seedKey: "demo-cloud", name: "Demo Cloud Mentor", designation: "DevOps Engineer", organization: DEMO_ORG,
    headline: "DevOps Engineer · Docker, CI/CD & cloud deployment", yearsOfExperience: 7,
    bio: "Fictional demonstration profile. Represents a DevOps engineer who containerises and deploys applications to the cloud.",
    expertise: ["Docker", "Deployment & Cloud", "CI/CD", "Kubernetes", "Linux"],
    teachingTopics: ["Cloud Computing", "Docker Basics", "Deploying Web Apps", "MLOps"],
    domains: ["Cloud Computing", "Backend Development"],
    sessionFormats: ["Weekend Masterclass", "1:1 Mentorship"],
    sessionDescription: "We deploy your project end-to-end during the session.",
    availability: [{ day: "Sunday", start: "09:00", end: "10:00" }],
  },
  {
    seedKey: "demo-security", name: "Demo Security Mentor", designation: "Application Security Engineer", organization: DEMO_ORG,
    headline: "AppSec Engineer · secure auth & web security", yearsOfExperience: 5,
    bio: "Fictional demonstration profile. Represents a security engineer who reviews authentication flows and teaches secure coding.",
    expertise: ["Cybersecurity", "Authentication & Security", "OWASP Top 10", "JWT"],
    teachingTopics: ["Web Security Basics", "Secure Authentication", "Cybersecurity Careers"],
    domains: ["Cybersecurity", "Backend Development"],
    sessionFormats: ["1:1 Mentorship", "Project Review"],
    sessionDescription: "Security review of your project's login and API endpoints.",
    availability: [{ day: "Saturday", start: "18:00", end: "19:00" }],
  },
  {
    seedKey: "demo-dsa", name: "Demo DSA Mentor", designation: "Software Engineer", organization: DEMO_ORG,
    headline: "Software Engineer · DSA & placement interview prep", yearsOfExperience: 3,
    bio: "Fictional demonstration profile. Represents an engineer who coaches students on data structures, algorithms and coding interviews.",
    expertise: ["Data Structures & Algorithms", "JavaScript", "Python", "SQL"],
    teachingTopics: ["DSA Problem Solving", "Interview Preparation", "Mock Coding Interviews"],
    domains: ["DSA and Interview Preparation"],
    sessionFormats: ["Mock Interview", "1:1 Mentorship"],
    sessionDescription: "Timed problem solving with feedback on approach and communication.",
    availability: [{ day: "Saturday", start: "09:00", end: "10:00" }, { day: "Sunday", start: "18:00", end: "19:00" }],
  },
];

const RECRUITERS = [
  { seedKey: "demo-recruiter-1", name: "Demo Recruiter (Tech Hiring)", organization: "Demonstration Company A", designation: "Campus Recruiter", email: "" },
  { seedKey: "demo-recruiter-2", name: "Demo Recruiter (AI Startup)", organization: "Demonstration Company B", designation: "Talent Partner", email: "" },
];

const DEMO_STUDENTS = [
  {
    key: "demo-seed-student-1", name: "Demo Student Riya (fictional)", college: "Demonstration Institute of Technology",
    branch: "Information Science", semester: 6, careerGoal: "Frontend Developer",
    skills: ["HTML", "CSS", "JavaScript", "React", "Git"], interests: ["Web Development", "Design"],
    projects: ["Portfolio site — Next.js + Tailwind (demo project)"], portfolioLinks: { github: "", linkedin: "", portfolio: "" },
  },
  {
    key: "demo-seed-student-2", name: "Demo Student Karan (fictional)", college: "Demonstration Institute of Technology",
    branch: "Artificial Intelligence & Data Science", semester: 7, careerGoal: "AI/ML Engineer",
    skills: ["Python", "NumPy & Pandas", "Machine Learning", "Git"], interests: ["AI"],
    projects: ["Crop disease classifier — PyTorch CNN (demo project)"], portfolioLinks: { github: "", linkedin: "", portfolio: "" },
  },
];

const g = globalThis as unknown as { _gkSeeded?: Promise<void> };

export function ensureSeed() {
  if (process.env.GURUKOOL_SHOW_DEMO_DATA !== "true") return Promise.resolve();
  g._gkSeeded ??= (async () => {
    await connectDB();
    await Promise.all([MentorSession.init(), RecruiterInterest.init(), Mentor.init(), Recruiter.init()]);
    for (const m of MENTORS)
      await Mentor.updateOne({ seedKey: m.seedKey }, { $setOnInsert: { ...m, isDemo: true, profileStatus: "active" } }, { upsert: true });
    for (const r of RECRUITERS)
      await Recruiter.updateOne({ seedKey: r.seedKey }, { $setOnInsert: { ...r, isDemo: true } }, { upsert: true });
    for (const s of DEMO_STUDENTS)
      await Student.updateOne({ key: s.key }, { $setOnInsert: { ...s, email: "", isDemo: true, recruiterDiscoverable: true } }, { upsert: true });
  })().catch((e) => {
    g._gkSeeded = undefined; // retry next request
    throw e;
  });
  return g._gkSeeded;
}
