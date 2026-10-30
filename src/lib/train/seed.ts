// Demo seed for GURUKOOL TRAIN: one complete sample course, clearly labelled demonstration content.
// The trainer is the existing fictional "Demo Backend Mentor" profile (no new identity is created).
import "server-only";
import { ensureSeed } from "../seed";
import { upcomingSlots } from "../slots";
import { Mentor } from "@/models/connect";
import { TrainingAssignment, TrainingCourse, TrainingSession } from "@/models/train";

const L = (title: string, durationMinutes: number, objectives: string[], explanation: string) => ({ title, durationMinutes, objectives, explanation });

const MODULES = [
  {
    title: "Module 1: JavaScript Fundamentals",
    summary: "The language features every Node.js developer uses daily.",
    lessons: [
      L("Variables, types and functions", 30, ["Choose between let and const", "Explain primitive vs reference types", "Write arrow functions"],
        "Use const by default and let only when a value must be reassigned; avoid var because it is function-scoped and hoisted. JavaScript has primitives (string, number, boolean, null, undefined, bigint, symbol) that are copied by value, and objects/arrays/functions that are passed by reference, so mutating an object inside a function changes the caller's object too.\n\nFunctions are values: you can store them in variables, pass them as arguments and return them. Arrow functions (const add = (a, b) => a + b) are concise and do not have their own `this`, which makes them ideal for callbacks."),
      L("Arrays, objects and destructuring", 35, ["Transform data with map, filter and reduce", "Destructure objects and arrays", "Use the spread operator safely"],
        "Most backend code transforms data. map() returns a new array of the same length, filter() keeps items matching a condition, and reduce() folds an array into one value. These do not mutate the original array.\n\nDestructuring pulls values out concisely: const { name, email } = user; const [first, ...rest] = items. The spread operator copies: const updated = { ...user, active: true } creates a new object instead of mutating user, which avoids subtle bugs when the same object is shared."),
    ],
  },
  {
    title: "Module 2: Node.js Basics",
    summary: "How Node.js runs JavaScript on the server and handles I/O.",
    lessons: [
      L("The event loop and asynchronous code", 40, ["Describe the event loop", "Convert callbacks to async/await", "Handle errors in async code"],
        "Node.js runs your JavaScript on a single thread. Slow work such as file or network I/O is handed to the system, and when it completes a callback is queued; the event loop runs queued callbacks when the call stack is empty. This is why a CPU-heavy loop blocks every request, while waiting on a database does not.\n\nPromises represent a future value. async/await lets you write asynchronous code that reads top-to-bottom: const user = await db.find(id). Always wrap awaited calls in try/catch (or let a central error handler catch them), otherwise a rejected promise can crash the process."),
      L("Modules, npm and the file system", 30, ["Import and export modules", "Manage dependencies with npm", "Read files with fs/promises"],
        "Split code into modules with export / import (ES modules) or module.exports / require (CommonJS). package.json lists dependencies; npm install adds them and package-lock.json pins exact versions so every machine installs the same tree.\n\nUse fs/promises for non-blocking file access: const text = await readFile('data.json', 'utf8'). Keep secrets such as database URLs in environment variables (process.env), never in source code."),
    ],
  },
  {
    title: "Module 3: Express.js and REST APIs",
    summary: "Design and build HTTP APIs with Express.",
    lessons: [
      L("REST design and HTTP status codes", 35, ["Model resources as URLs", "Pick the right HTTP method", "Return meaningful status codes"],
        "REST APIs expose resources: GET /api/tasks lists tasks, POST /api/tasks creates one, GET /api/tasks/:id reads one, PATCH updates part of it and DELETE removes it. Use nouns in URLs and let the HTTP method express the action.\n\nStatus codes tell clients what happened: 200 OK, 201 Created, 400 Bad Request for invalid input, 401/403 for authentication/authorization problems, 404 Not Found, 409 Conflict for duplicates, and 500 for unexpected server errors. Return a consistent JSON error shape such as { error: 'message' }."),
      L("Express routes, middleware and validation", 45, ["Create routes with express.Router", "Write middleware", "Validate request bodies"],
        "An Express app is a chain of middleware: functions (req, res, next) that run in order. express.json() parses JSON bodies; your own middleware can log requests or check authentication and call next() to continue.\n\nNever trust client input. Validate required fields, types and lengths before touching the database, and respond with 400 and a clear message when validation fails. Put an error-handling middleware (err, req, res, next) last so unexpected errors become a clean 500 response instead of a crash."),
    ],
  },
  {
    title: "Module 4: MongoDB Integration",
    summary: "Persist data with MongoDB and Mongoose.",
    lessons: [
      L("Documents, schemas and Mongoose models", 40, ["Design a document schema", "Define a Mongoose model", "Add validation rules"],
        "MongoDB stores JSON-like documents in collections. Mongoose adds schemas on top: const Task = model('Task', new Schema({ title: { type: String, required: true }, done: { type: Boolean, default: false } }, { timestamps: true })).\n\nModel your data around how it is read. Embed data that is always loaded together (a task's checklist), and reference by id data that is shared or grows without bound (a user's tasks). Schema validation (required, min, max, enum) is your last line of defence after request validation."),
      L("Queries, indexes and connections", 35, ["Write find/update queries", "Create indexes for common queries", "Reuse a single connection"],
        "Common operations: Task.find({ done: false }).sort({ createdAt: -1 }), Task.findById(id), Task.findByIdAndUpdate(id, { $set: { done: true } }, { new: true }). Use operators like $set and $addToSet instead of read-modify-write to avoid race conditions.\n\nIndexes make queries fast and can enforce rules: a unique index on email prevents duplicate accounts at the database level. Connect once when the app starts (or cache the connection in serverless environments) rather than on every request."),
    ],
  },
  {
    title: "Module 5: Backend Project",
    summary: "Combine everything into a deployable REST API.",
    lessons: [
      L("Planning the project API", 30, ["Write an API contract", "Plan the data model", "Define acceptance criteria"],
        "Build a Task Manager API. Before coding, write the contract: endpoints, request bodies, responses and status codes. Sketch the Mongoose models and the indexes you need. Decide acceptance criteria, for example: creating a task without a title returns 400, and listing tasks supports ?done=true filtering.\n\nA written contract keeps you focused and makes the trainer review faster."),
      L("Building, testing and documenting", 60, ["Implement endpoints incrementally", "Test with curl or a REST client", "Document setup in a README"],
        "Implement one endpoint at a time and test it immediately with curl or a REST client, including failure cases. Keep configuration in environment variables and commit a .env.example, never real secrets.\n\nFinish with a README: what the project does, how to install and run it, the environment variables required, and example requests. Push to GitHub with small, descriptive commits; reviewers read commit history too."),
    ],
  },
];

const ASSIGNMENTS = [
  { m: 0, key: "a1", title: "Data transformation drill", maxMarks: 10, days: 7, skillTags: ["JavaScript"],
    description: "Use map, filter and reduce to analyse a list of orders.",
    instructions: "Given an array of orders { id, customer, amount, status }, write functions that (1) return the total amount of 'paid' orders, (2) return customer names with more than one order, and (3) return a new array with a 10% discount applied without mutating the input. Submit your code as text or a GitHub link. You can practise in the BUILD editor first." },
  { m: 1, key: "a2", title: "Async file reader", maxMarks: 10, days: 10, skillTags: ["Node.js"],
    description: "Read and summarise a JSON file using async/await.",
    instructions: "Write a Node.js script that reads tasks.json with fs/promises, prints how many tasks are done vs pending, and handles a missing file with a friendly error message instead of crashing. Submit a GitHub link or paste the code." },
  { m: 2, key: "a3", title: "Tasks REST API with Express", maxMarks: 20, days: 14, skillTags: ["Express.js", "REST APIs"],
    description: "Build CRUD endpoints for tasks with validation and correct status codes.",
    instructions: "Implement GET/POST /api/tasks and GET/PATCH/DELETE /api/tasks/:id (in-memory storage is fine). Validate that title is a non-empty string (400 otherwise), return 201 on create and 404 for unknown ids. Submit a GitHub repository link." },
  { m: 3, key: "a4", title: "Persist tasks in MongoDB", maxMarks: 20, days: 21, skillTags: ["MongoDB"],
    description: "Replace in-memory storage with a Mongoose model.",
    instructions: "Add a Task model with timestamps, connect using an environment variable, add an index that supports listing a user's tasks by date, and keep all previous validation. Submit a GitHub repository link and explain your schema choices in the text field." },
  { m: 4, key: "a5", title: "Capstone: Task Manager API", maxMarks: 40, days: 30, skillTags: ["Node.js", "Express.js", "MongoDB", "REST APIs"],
    description: "Deliver a documented, tested REST API.",
    instructions: "Submit the GitHub repository and (optionally) a deployed URL. The README must include setup steps, environment variables and example requests. The trainer will review structure, validation, error handling and documentation." },
];

const g = globalThis as unknown as { _gkTrainSeeded?: Promise<void> };

export function ensureTrainSeed() {
  if (process.env.GURUKOOL_SHOW_DEMO_DATA !== "true") return Promise.resolve();
  g._gkTrainSeeded ??= (async () => {
    await ensureSeed(); // creates the fictional demo mentors (our trainers)
    await Promise.all([TrainingCourse.init(), TrainingAssignment.init(), TrainingSession.init()]);
    const trainer = await Mentor.findOne({ seedKey: "demo-backend" }).select("_id").lean<{ _id: unknown }>();
    if (!trainer) return;
    await TrainingCourse.updateOne(
      { seedKey: "demo-backend-bootcamp" },
      { $setOnInsert: {
        title: "Backend Development Bootcamp",
        description: "A practical, project-based path from JavaScript fundamentals to a deployable Node.js + Express + MongoDB REST API. Demonstration course content for the GURUKOOL TRAIN demo.",
        trainerId: trainer._id, category: "Backend Development", difficulty: "Beginner", durationWeeks: 5,
        skillTags: ["JavaScript", "Node.js", "Express.js", "REST APIs", "MongoDB", "Backend Development"],
        modules: MODULES, published: true, isDemo: true,
      } },
      { upsert: true }
    );
    const course = await TrainingCourse.findOne({ seedKey: "demo-backend-bootcamp" }).lean<{ _id: unknown; modules: { _id: unknown }[] }>();
    if (!course) return;
    const now = Date.now();
    for (const a of ASSIGNMENTS) {
      await TrainingAssignment.updateOne(
        { seedKey: `bootcamp-${a.key}` },
        { $setOnInsert: {
          courseId: course._id, moduleId: String(course.modules[a.m]._id), title: a.title, description: a.description,
          instructions: a.instructions, skillTags: a.skillTags, maxMarks: a.maxMarks, dueAt: new Date(now + a.days * 86400000),
        } },
        { upsert: true }
      );
    }
    // Keep one upcoming demo live class on the next weekend (Asia/Kolkata), unless one is already scheduled.
    const hasUpcoming = await TrainingSession.exists({ courseId: course._id, status: "SCHEDULED", startAt: { $gt: new Date() } });
    if (!hasUpcoming) {
      const slot = upcomingSlots([{ day: "Saturday", start: "11:30", end: "13:00" }])[0];
      if (slot)
        await TrainingSession.create({
          courseId: course._id, trainerId: trainer._id, title: "Live class: Building your first Express API",
          agenda: "Walk through Module 3, live-code CRUD routes, Q&A on assignments. (Demo session)",
          startAt: new Date(slot.startAt), endAt: new Date(slot.endAt), status: "SCHEDULED", isDemo: true,
        }).catch(() => {}); // unique (trainer, start) — ignore if another process created it
    }
  })().catch((e) => {
    g._gkTrainSeeded = undefined;
    throw e;
  });
  return g._gkTrainSeeded;
}
