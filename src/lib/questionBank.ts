// Static, human-written question bank used ONLY when the AI API is not configured
// or fails. The UI labels these as "Question bank" so they are never passed off as AI output.
import type { CareerGoal } from "./careers";

export type MCQ = { question: string; options: string[]; answerIndex: number; explanation: string; topic: string };

const js: MCQ[] = [
  { topic: "JavaScript", question: "What does `typeof null` return in JavaScript?", options: ["\"null\"", "\"object\"", "\"undefined\"", "\"number\""], answerIndex: 1, explanation: "A long-standing quirk of JavaScript: typeof null is \"object\"." },
  { topic: "JavaScript", question: "Which keyword declares a block-scoped variable that cannot be reassigned?", options: ["var", "let", "const", "static"], answerIndex: 2, explanation: "const creates a block-scoped binding that cannot be reassigned." },
];

const BANK: Record<CareerGoal, MCQ[]> = {
  "Backend Developer": [
    js[0],
    { topic: "REST APIs", question: "Which HTTP status code means a resource was successfully created?", options: ["200", "201", "204", "302"], answerIndex: 1, explanation: "201 Created is returned when a new resource is created." },
    { topic: "SQL", question: "Which SQL clause filters rows AFTER aggregation?", options: ["WHERE", "GROUP BY", "HAVING", "ORDER BY"], answerIndex: 2, explanation: "HAVING filters groups after GROUP BY aggregation; WHERE filters rows before." },
    { topic: "Data Structures & Algorithms", question: "Average time complexity of lookup in a hash map?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], answerIndex: 0, explanation: "Hash maps give O(1) average lookup; worst case can degrade to O(n)." },
    { topic: "Node.js", question: "What lets Node.js handle many concurrent I/O operations on one thread?", options: ["Multithreading per request", "The event loop with non-blocking I/O", "Green threads", "Process forking per request"], answerIndex: 1, explanation: "Node uses an event loop and non-blocking I/O (via libuv)." },
  ],
  "Frontend Developer": [
    js[1],
    { topic: "React", question: "Which hook runs side effects after render in React?", options: ["useState", "useMemo", "useEffect", "useRef"], answerIndex: 2, explanation: "useEffect runs after render and is used for side effects." },
    { topic: "CSS", question: "Which CSS property makes a flex container wrap its items onto new lines?", options: ["flex-flow: column", "flex-wrap: wrap", "align-items: wrap", "display: wrap"], answerIndex: 1, explanation: "flex-wrap: wrap allows items to wrap onto multiple lines." },
    { topic: "HTML", question: "Which element is most semantically correct for primary site navigation?", options: ["<div>", "<section>", "<nav>", "<header>"], answerIndex: 2, explanation: "<nav> marks a section of navigation links." },
    { topic: "Web Accessibility", question: "What is the purpose of an image's alt attribute?", options: ["Tooltip styling", "Text alternative for screen readers", "Lazy loading", "SEO keywords only"], answerIndex: 1, explanation: "alt provides a text alternative for assistive technology and when images fail to load." },
  ],
  "Full Stack Developer": [
    js[0],
    { topic: "React", question: "Why does React need a `key` prop on list items?", options: ["For CSS styling", "To identify items between renders", "To make items clickable", "It is required by HTML"], answerIndex: 1, explanation: "Keys let React match list items across renders efficiently and correctly." },
    { topic: "REST APIs", question: "Which HTTP method is idempotent and used to fully replace a resource?", options: ["POST", "PUT", "PATCH", "CONNECT"], answerIndex: 1, explanation: "PUT replaces the resource and is idempotent." },
    { topic: "MongoDB", question: "In MongoDB, what is a collection?", options: ["A single field", "A group of documents", "A database server", "A query result cursor"], answerIndex: 1, explanation: "A collection is a group of documents, similar to a table." },
    { topic: "Git", question: "Which command creates a new branch and switches to it?", options: ["git branch -d x", "git switch -c x", "git merge x", "git push x"], answerIndex: 1, explanation: "git switch -c x (or git checkout -b x) creates and switches to branch x." },
  ],
  "AI/ML Engineer": [
    { topic: "Machine Learning", question: "A model scores very high on training data but poorly on test data. This is:", options: ["Underfitting", "Overfitting", "Regularization", "Normalization"], answerIndex: 1, explanation: "Overfitting: the model memorized training data and fails to generalize." },
    { topic: "NumPy & Pandas", question: "What does `df.isnull().sum()` return in pandas?", options: ["Total rows", "Missing values per column", "Column data types", "Duplicated rows"], answerIndex: 1, explanation: "It counts missing (null) values in each column." },
    { topic: "Linear Algebra & Statistics", question: "Multiplying a (3×2) matrix by a (2×4) matrix gives what shape?", options: ["3×4", "2×2", "4×3", "Not defined"], answerIndex: 0, explanation: "(m×n)·(n×p) = (m×p), so 3×4." },
    { topic: "Deep Learning", question: "Which activation function outputs max(0, x)?", options: ["Sigmoid", "Tanh", "ReLU", "Softmax"], answerIndex: 2, explanation: "ReLU(x) = max(0, x)." },
    { topic: "Python", question: "What does `[x*x for x in range(3)]` evaluate to?", options: ["[1, 4, 9]", "[0, 1, 4]", "[0, 1, 2]", "[0, 2, 4]"], answerIndex: 1, explanation: "range(3) yields 0,1,2 so squares are [0,1,4]." },
  ],
};

export function bankQuestions(goal: CareerGoal): MCQ[] {
  return BANK[goal];
}
