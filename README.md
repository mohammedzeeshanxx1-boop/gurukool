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
| `NEXT_PUBLIC_CONNECT_URL` | Connect button | a Meet/Discord/community link (rebuild after changing) |

In MongoDB Atlas → Network Access, allow your IP (or `0.0.0.0/0` for the demo).
The Dashboard's **System status** card shows live MongoDB / AI / Connect status.

## Demo flow

1. **Dashboard** → "Fill demo student" → **Save profile** (written to MongoDB).
2. **Learn → 1. Skill Gap Analyzer** → existing / missing skills, priorities, readiness %, AI explanation.
3. **Learn → 2. AI Assessment** → 5 MCQs (AI-generated; built-in question bank if AI is off, clearly labeled). Answers are scored on the server (correct answers never reach the browser) and saved.
4. **Learn → 3. Roadmap** → stages built from goal + missing skills + weak quiz topics, with checkboxes (persisted) and **Learn on YouTube** search links.
5. **Build** → write JS in Monaco, **Run** in the sandbox, ask the **AI Coding Mentor** (gets your code + console output).

## Security notes

- AI key and DB URI are only read in server route handlers (`src/lib/ai.ts` is `server-only`).
- Code execution never touches the server: it runs in a Web Worker inside a `sandbox="allow-scripts"` iframe (opaque origin, no cookies/DOM/storage of the app), with CSP `connect-src 'none'` and a 5-second kill timer. If the sandbox can't start, the UI says "Execution unavailable" instead of pretending.
- Compete listings are labeled **demo data**; no live events or registration links.

## Structure

```
src/app/            pages: / learn build connect compete grow
src/app/api/        student, status, chat, learn/{skill-gap, assessment, roadmap}
src/lib/            db.ts, ai.ts, careers.ts (skill map + YouTube URLs), questionBank.ts
src/models/         Student, Assessment, Roadmap schemas
src/components/     Sidebar, shared UI, sandboxRunner
```
