export const PORTAL_INFO = {
  student: { name: "Student", blurb: "Skill analysis, training, mentorship and your career portfolio.", canRegister: true },
  recruiter: { name: "Recruiter", blurb: "Discover opted-in student portfolios. New accounts need admin approval.", canRegister: true },
  expert: { name: "Expert / Mentor", blurb: "Run weekend sessions, training courses and evaluations.", canRegister: true },
  admin: { name: "Admin", blurb: "Platform administration. Accounts are issued by the GURUKOOL team.", canRegister: false },
} as const;
export type PortalKey = keyof typeof PORTAL_INFO;
