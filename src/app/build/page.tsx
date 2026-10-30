"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { runInSandbox, type LogLine } from "@/components/sandboxRunner";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400"><Spinner /> Loading editor…</div>,
});

const STARTER = `// GURUKOOL Build — JavaScript workspace
// Click "Run" to execute in an isolated sandbox. Ask the AI mentor for help →

function fibonacci(n) {
  const seq = [0, 1];
  for (let i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
  return seq.slice(0, n);
}

console.log("First 10 Fibonacci numbers:", fibonacci(10));

const students = [{ name: "Aarav", score: 82 }, { name: "Diya", score: 91 }];
const topper = students.reduce((a, b) => (a.score > b.score ? a : b));
console.log(\`Topper: \${topper.name}\`);
`;

type Msg = { role: "user" | "assistant"; content: string };
const LOG_CLS: Record<LogLine["type"], string> = {
  log: "text-slate-100", info: "text-sky-300", warn: "text-amber-300", error: "text-red-400", system: "text-slate-500",
};

export default function BuildPage() {
  const [code, setCode] = useState(STARTER);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatErr, setChatErr] = useState<ApiErr | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  async function run() {
    setRunning(true);
    const start = performance.now();
    const out: LogLine[] = [{ type: "system", text: "▶ Running in isolated sandbox…" }];
    setLogs([...out]);
    const r = await runInSandbox(code, (l) => { out.push(l); setLogs([...out]); });
    if (r.unavailable) {
      setUnavailable(true);
      out.push({ type: "error", text: "Execution unavailable: this browser could not start the isolated sandbox. Code was NOT run." });
    } else {
      out.push({ type: "system", text: `${r.ok ? "✓ Finished" : "✗ Stopped with errors"} in ${Math.round(performance.now() - start)} ms` });
    }
    setLogs([...out]);
    setRunning(false);
  }

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const history = messages;
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next); setQ(""); setBusy(true); setChatErr(null);
    try {
      const output = logs.filter((l) => l.type !== "system").map((l) => `[${l.type}] ${l.text}`).join("\n");
      const d = await api<{ reply: string }>("/api/chat", { method: "POST", body: JSON.stringify({ question, code, output, history }) });
      setMessages([...next, { role: "assistant", content: d.reply }]);
    } catch (e) {
      setChatErr(toErr(e));
      setMessages(history);
      setQ(question);
    } finally {
      setBusy(false);
      setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Build" subtitle="Write JavaScript, run it safely in a sandbox, and get help from the AI coding mentor." />
      {unavailable && <div className="mb-4"><Alert kind="warn">Secure execution is unavailable in this browser. Try a recent Chrome, Edge or Firefox.</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <span className="text-sm font-medium text-slate-600">main.js · JavaScript</span>
              <div className="flex gap-2">
                <button className="btn-ghost px-3 py-1.5" onClick={() => setLogs([])}>Clear</button>
                <button className="btn-primary px-4 py-1.5" onClick={run} disabled={running}>{running ? <Spinner /> : "▶"} Run</button>
              </div>
            </div>
            <div className="h-[420px]">
              <Monaco
                height="100%"
                defaultLanguage="javascript"
                value={code}
                onChange={(v) => setCode(v ?? "")}
                options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }}
              />
            </div>
          </div>
          <div className="card bg-slate-900 p-0">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-xs text-slate-400">
              <span>OUTPUT CONSOLE</span><span>Sandboxed · no network · 5s limit</span>
            </div>
            <pre className="h-48 overflow-auto p-4 font-mono text-sm">
              {logs.length === 0 ? <span className="text-slate-500">Output will appear here.</span> :
                logs.map((l, i) => <div key={i} className={`whitespace-pre-wrap ${LOG_CLS[l.type]}`}>{l.text}</div>)}
            </pre>
          </div>
        </div>

        <div className="card flex h-[700px] flex-col xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="h2">AI Coding Mentor</h2>
            {messages.length > 0 && <button className="text-xs text-slate-500 hover:underline" onClick={() => setMessages([])}>Clear chat</button>}
          </div>
          <div className="flex-1 space-y-3 overflow-auto pr-1">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Your current code and console output are sent along with each question.</p>
                {["Explain this code", "Why am I getting this error?", "Give me a hint to optimize it", "What is a closure in JavaScript?"].map((s) => (
                  <button key={s} className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-blue-300 hover:bg-blue-50" onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-blue-600 text-white" : "mr-4 border border-slate-200 bg-slate-50"}`}>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            ))}
            {busy && <div className="text-sm text-slate-500"><Spinner /> Thinking…</div>}
            <div ref={chatEnd} />
          </div>
          <div className="mt-3"><ErrorAlert err={chatErr} /></div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input className="input" placeholder="Ask about your code…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn-primary" disabled={busy || !q.trim()}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
