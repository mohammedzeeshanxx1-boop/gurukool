# GURUKOOL — Learn. Build. Connect. Compete. Grow.

AI-powered engineering education platform (hackathon MVP).
Next.js 15 (App Router) · TypeScript · Tailwind · MongoDB Atlas + Mongoose · any OpenAI-compatible AI API · Monaco Editor.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

Checks: `npm run typecheck` and `npm run build`.

## Environment variables

| Variable | Required for | Example |
|---|---|---|
| `MONGODB_URI` | Profile, assessments, roadmap (everything in Learn) | `mongodb+srv://user:pass@cluster0.x.mongodb.net/gurukool` |
| `AI_API_KEY` | AI explanations, AI questions, AI roadmap, coding chatbot | your provider key |
| `AI_MODEL` | same | `gpt-4o-mini`, `llama-3.3-70b-versatile`, … |
| `AI_BASE_URL` | same | `https://api.openai.com/v1`, `https://api.groq.com/openai/v1`, `https://openrouter.ai/api/v1` |
| `NEXT_PUBLIC_CONNECT_URL` | "Join Mentorship Session" button | a Meet/Discord/community link (rebuild after changing) |
| `DEMO_PERSONA_SECRET` | optional: signs demo persona cookies (≥16 chars). If unset, a random per-process secret is used and personas reset on restart | any long random string |
| `GURUKOOL_DEMO_PERSONAS` | optional: set to `false` to disable persona switching outside the demo | `false` |

In MongoDB Atlas → Network Access, allow your IP (or `0.0.0.0/0` for the demo).
The Dashboard's **System status** card shows live MongoDB / AI / Connect status.

## Demo flow

1. **Dashboard** → "Fill demo student" → **Save profile** (written to MongoDB).
2. **Learn → 1. Skill Gap Analyzer** → existing / missing skills, priorities, readiness %, AI explanation.
3. **Learn → 2. AI Assessment** → 5 MCQs (AI-generated; built-in question bank if AI is off, clearly labeled). Answers are scored on the server (correct answers never reach the browser) and saved.
4. **Learn → 3. Roadmap** → stages built from goal + missing skills + weak quiz topics, with checkboxes (persisted) and **Learn on YouTube** search links.
5. **Build** → write JS in Monaco, **Run** in the sandbox, ask the **AI Coding Mentor** (gets your code + console output).

## CONNECT 2.0: Mentorship & Industry Network

**Skill gap → mentor recommendation → weekend booking → mentor acceptance → live collaboration.**

| Piece | Where |
|---|---|
| Find Mentors (recommended + search/filter by expertise, domain, day, session type) | `/connect?tab=find` |
| Mentor profile + booking form (topic, real IST slot, duration, message) | `/connect/mentors/[id]` |
| My Sessions (status, cancel, **Join Mentorship Session** when ACCEPTED) | `/connect?tab=sessions` |
| Industry Network (professional directory) | `/connect?tab=network` |
| Mentor Dashboard (profile, availability, pending / upcoming / completed) | `/connect/mentor` |
| "Learn from an Industry Expert" (recommendations inside LEARN) | `/learn` |
| Recruiter Connect for students (opt-in, portfolio links, accept/decline requests) | `/grow` |
| Recruiter Dashboard (opted-in students, skill/goal filters, express interest / invite) | `/grow/recruiter` |

**Booking rules (server-side).** Slots come only from the mentor's saved Saturday/Sunday availability in **Asia/Kolkata**, at least 2 h ahead, within 4 weeks; stored as UTC. Duration must fit the slot. Transitions: mentor `PENDING→ACCEPTED|REJECTED`, `ACCEPTED→COMPLETED` (after start) `|CANCELLED`; student `PENDING|ACCEPTED→CANCELLED`. Each change is an atomic conditional update. Unique partial indexes give database-level protection: `activeKey` (no duplicate live request per student+mentor+slot) and `slotLock` (no double-booked accepted slot). Accepting a slot closes other pending requests for it with a clear note.

**Recommendations** are deterministic and explainable (not ML): weak quiz topic +5, incomplete roadmap stage +3, missing skill +2, career-goal domain +2, interest +1. Every card shows the reasons.

**Video.** "Join Mentorship Session" opens `NEXT_PUBLIC_CONNECT_URL` (the shared collaboration space). No per-session rooms or meeting IDs are created or claimed. If the URL is missing, the UI says video collaboration is not configured.

**Demo data.** Seeded mentors, recruiters and two students are fictional and labelled "Demo · fictional" / "Demonstration Company". Nothing claims verification, ratings, real employers or real job openings. Self-created mentor profiles show "Not verified".

### Personas and security limitations

There is no real authentication in this MVP. **Demo personas** (Student / Mentor / Recruiter) are switched from the sidebar and clearly labelled as a simulation. The server determines the acting persona from an **HMAC-signed, httpOnly cookie**, never from a role or user id in the request body, and every API enforces role + ownership (mentors act only on their own bookings/profile; recruiters see only opted-in students, without email or assessment data). But **anyone can switch personas**, so this is not production authorization. Set `GURUKOOL_DEMO_PERSONAS=false` outside the demo, and replace personas with real auth (e.g. NextAuth) before handling real users.

### Test CONNECT end-to-end

With `npm run dev` running against MongoDB:

```bash
npm run test:connect
```

It exercises discovery filters, availability validation, booking validation, duplicate and double-booking protection, accept/reject/cancel rules, cross-mentor authorization, recommendations and the recruiter flow. It creates a mentor named "E2E Test Mentor (automated test)" (left as a hidden draft) and leaves a few CANCELLED/REJECTED "E2E Test Topic" entries in the demo student's history.

### 5-minute demo walkthrough

1. Dashboard → career goal **Backend Developer** (skills without Node.js) → Save.
2. Learn → Analyze skills → Generate & submit assessment → Generate roadmap.
3. Scroll to **Learn from an Industry Expert**: Demo Backend Mentor is recommended with the reason. Click **Find an Industry Mentor**.
4. Connect → open the mentor → pick a topic, a Saturday/Sunday slot, write a message → **Request Session** → My Sessions shows **PENDING**.
5. Sidebar persona → **Demo Backend Mentor** → Mentor Dashboard → **Accept**.
6. Persona → back to the student → My Sessions shows **ACCEPTED** → **Join Mentorship Session**.
7. Grow → turn on **Allow recruiters to discover my profile**. Persona → a demo recruiter → Recruiter Dashboard → **Express Interest**. Persona → student → Grow → Accept/Decline.

## Security notes

- AI key and DB URI are only read in server route handlers (`src/lib/ai.ts` is `server-only`).
- Code execution never touches the server: it runs in a Web Worker inside a `sandbox="allow-scripts"` iframe (opaque origin, no cookies/DOM/storage of the app), with CSP `connect-src 'none'` and a 5-second kill timer. If the sandbox can't start, the UI says "Execution unavailable" instead of pretending.
- Compete shows **live** open/upcoming hackathons from Devpost's free public JSON endpoint (no API key), fetched server-side and cached 15 min. Each card links to the real Devpost page.

## Structure

```
src/app/            pages: / learn build connect (+ mentor, mentors/[id]) compete grow (+ recruiter)
src/app/api/        student (+ visibility), status, chat, learn/*, compete/hackathons, persona,
                    mentors (+ [id], recommendations), mentor-sessions (+ [id]),
                    recruiters/students, recruiter-interests (+ [id])
src/lib/            db, ai, careers, questionBank, persona, slots, mentors, recommend, sessions, seed
src/models/         index.ts (Student, Assessment, Roadmap), connect.ts (Mentor, MentorSession, Recruiter, RecruiterInterest)
src/components/     Sidebar, PersonaSwitcher, connect, MentorRecommendations, RecruiterPanel, ui, sandboxRunner
scripts/            e2e-connect.mjs (end-to-end CONNECT test against a running server)
```
