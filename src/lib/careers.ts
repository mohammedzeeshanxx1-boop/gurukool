export const CAREER_GOALS = [
  "Backend Developer",
  "Frontend Developer",
  "Full Stack Developer",
  "AI/ML Engineer",
] as const;
export type CareerGoal = (typeof CAREER_GOALS)[number];

type Req = { skill: string; priority: 1 | 2 | 3; aliases?: string[] }; // 1 = must-have first

export const CAREER_REQUIREMENTS: Record<CareerGoal, Req[]> = {
  "Backend Developer": [
    { skill: "JavaScript", priority: 1, aliases: ["js"] },
    { skill: "Node.js", priority: 1, aliases: ["node", "nodejs"] },
    { skill: "SQL", priority: 1, aliases: ["mysql", "postgresql", "postgres"] },
    { skill: "Data Structures & Algorithms", priority: 1, aliases: ["dsa", "data structures", "algorithms"] },
    { skill: "REST APIs", priority: 1, aliases: ["rest", "api", "apis"] },
    { skill: "Git", priority: 2, aliases: ["github"] },
    { skill: "MongoDB", priority: 2, aliases: ["mongo", "nosql"] },
    { skill: "Authentication & Security", priority: 2, aliases: ["auth", "jwt", "security"] },
    { skill: "Docker", priority: 3 },
    { skill: "System Design", priority: 3 },
  ],
  "Frontend Developer": [
    { skill: "HTML", priority: 1, aliases: ["html5"] },
    { skill: "CSS", priority: 1, aliases: ["css3"] },
    { skill: "JavaScript", priority: 1, aliases: ["js"] },
    { skill: "React", priority: 1, aliases: ["reactjs", "react.js"] },
    { skill: "Git", priority: 2, aliases: ["github"] },
    { skill: "TypeScript", priority: 2, aliases: ["ts"] },
    { skill: "Tailwind CSS", priority: 2, aliases: ["tailwind"] },
    { skill: "Responsive Design", priority: 2 },
    { skill: "Web Accessibility", priority: 3, aliases: ["accessibility", "a11y"] },
    { skill: "Next.js", priority: 3, aliases: ["next", "nextjs"] },
  ],
  "Full Stack Developer": [
    { skill: "HTML", priority: 1, aliases: ["html5"] },
    { skill: "CSS", priority: 1, aliases: ["css3"] },
    { skill: "JavaScript", priority: 1, aliases: ["js"] },
    { skill: "React", priority: 1, aliases: ["reactjs", "react.js"] },
    { skill: "Node.js", priority: 1, aliases: ["node", "nodejs"] },
    { skill: "REST APIs", priority: 2, aliases: ["rest", "api", "apis"] },
    { skill: "MongoDB", priority: 2, aliases: ["mongo"] },
    { skill: "SQL", priority: 2, aliases: ["mysql", "postgresql", "postgres"] },
    { skill: "Git", priority: 2, aliases: ["github"] },
    { skill: "TypeScript", priority: 3, aliases: ["ts"] },
    { skill: "Deployment & Cloud", priority: 3, aliases: ["aws", "vercel", "cloud", "deployment"] },
  ],
  "AI/ML Engineer": [
    { skill: "Python", priority: 1, aliases: ["py"] },
    { skill: "Linear Algebra & Statistics", priority: 1, aliases: ["math", "statistics", "linear algebra", "probability"] },
    { skill: "NumPy & Pandas", priority: 1, aliases: ["numpy", "pandas"] },
    { skill: "Machine Learning", priority: 1, aliases: ["ml", "scikit-learn", "sklearn"] },
    { skill: "Deep Learning", priority: 2, aliases: ["dl", "neural networks"] },
    { skill: "PyTorch", priority: 2, aliases: ["torch", "tensorflow", "keras"] },
    { skill: "Data Visualization", priority: 2, aliases: ["matplotlib", "seaborn"] },
    { skill: "Git", priority: 2, aliases: ["github"] },
    { skill: "LLMs & Prompt Engineering", priority: 3, aliases: ["llm", "genai", "nlp", "prompt engineering"] },
    { skill: "MLOps", priority: 3, aliases: ["model deployment"] },
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

export function isCareerGoal(x: unknown): x is CareerGoal {
  return typeof x === "string" && (CAREER_GOALS as readonly string[]).includes(x);
}

export function analyzeSkillGap(studentSkills: string[], goal: CareerGoal) {
  const have = new Set(studentSkills.map(norm));
  const reqs = CAREER_REQUIREMENTS[goal];
  const existing: string[] = [];
  const missing: { skill: string; priority: number }[] = [];
  for (const r of reqs) {
    const names = [r.skill, ...(r.aliases ?? [])].map(norm);
    if (names.some((n) => have.has(n))) existing.push(r.skill);
    else missing.push({ skill: r.skill, priority: r.priority });
  }
  missing.sort((a, b) => a.priority - b.priority);
  const readiness = Math.round((existing.length / reqs.length) * 100);
  return {
    goal,
    required: reqs.map((r) => r.skill),
    existing,
    missing: missing.map((m) => m.skill),
    priorities: missing.map((m) => ({
      skill: m.skill,
      level: m.priority === 1 ? "High" : m.priority === 2 ? "Medium" : "Low",
    })),
    readiness,
  };
}

export function youtubeSearchUrl(topic: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic} tutorial for beginners`)}`;
}
