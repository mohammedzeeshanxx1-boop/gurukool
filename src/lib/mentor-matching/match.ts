// Loose, explainable term matching shared by mentor search/filters and the Mentor Match Engine.
const SYNONYMS: Record<string, string[]> = {
  "node.js": ["node", "nodejs", "express", "backend"], "rest apis": ["api", "apis", "rest"],
  "data structures & algorithms": ["dsa", "algorithms", "data structures", "interview"],
  "machine learning": ["ml", "ai"], "deep learning": ["neural", "pytorch"], "deployment & cloud": ["cloud", "docker", "deploy"],
  "authentication & security": ["security", "auth", "jwt"], react: ["frontend", "reactjs"], sql: ["database", "postgres", "mysql"],
  mongodb: ["mongo", "database", "nosql"], "system design": ["architecture", "scalability"],
};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Does `target` (e.g. "Node.js Fundamentals") relate to any mentor term? Returns the matching mentor term. */
export function matchTerm(target: string, mentorTerms: string[]): string | null {
  const t = norm(target);
  const hits = (keys: string[]) =>
    mentorTerms.find((term) => {
      const m = norm(term);
      return m.length >= 2 && keys.some((k) => k.length >= 2 && (m === k || (k.length >= 3 && m.includes(k)) || (m.length >= 3 && k.includes(m))));
    }) ?? null;
  // Direct matches beat synonym matches (e.g. "Node.js Fundamentals" → "Node.js", not "Express.js"),
  // which beat shared-keyword matches (e.g. "Backend APIs" → "Backend Development").
  return hits([t]) ?? hits(Object.entries(SYNONYMS).filter(([k]) => t.includes(k)).flatMap(([, v]) => v)) ?? keywordHit(t, mentorTerms);
}

const GENERIC = new Set(["development", "developer", "fundamentals", "basics", "introduction", "intro", "advanced", "learning",
  "engineering", "engineer", "project", "projects", "capstone", "preparation", "with", "and", "for", "the", "from", "your", "building"]);
const words = (s: string) => norm(s).split(/[^a-z0-9.+#]+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
function keywordHit(target: string, mentorTerms: string[]) {
  const tw = new Set(words(target));
  if (!tw.size) return null;
  return mentorTerms.find((term) => words(term).some((w) => tw.has(w))) ?? null;
}
