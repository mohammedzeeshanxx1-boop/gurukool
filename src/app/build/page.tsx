"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Alert, ErrorAlert, PageHeader, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { runInSandbox, type LogLine } from "@/components/sandboxRunner";
import type { Monaco as MonacoT } from "@monaco-editor/react";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400"><Spinner /> Loading editor…</div>,
});

type Lang = "javascript" | "typescript" | "python" | "cpp" | "c" | "java";
const LANGS: Record<Lang, { label: string; file: string; runnable: boolean }> = {
  javascript: { label: "JavaScript", file: "main.js", runnable: true },
  typescript: { label: "TypeScript", file: "main.ts", runnable: true },
  python: { label: "Python 3", file: "main.py", runnable: true },
  cpp: { label: "C++", file: "main.cpp", runnable: false },
  c: { label: "C", file: "main.c", runnable: false },
  java: { label: "Java", file: "Main.java", runnable: false },
};
const STARTERS: Record<Lang, string> = {
  javascript: `// GURUKOOL Build — JavaScript workspace
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
`,
  typescript: `// GURUKOOL Build — TypeScript (compiled in your browser, then run in the sandbox)
type Student = { name: string; score: number };

const students: Student[] = [{ name: "Aarav", score: 82 }, { name: "Diya", score: 91 }];
const average = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log("Average score:", average(students.map((s) => s.score)));
`,
  python: `# GURUKOOL Build — Python 3 (runs in your browser via Pyodide)
def fibonacci(n):
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

print("First 10 Fibonacci numbers:", fibonacci(10))
scores = {"Aarav": 82, "Diya": 91}
print("Topper:", max(scores, key=scores.get))
`,
  cpp: `// GURUKOOL Build — C++ (editing + AI help; execution needs a server-side runner)
#include <iostream>
using namespace std;

int main() {
    cout << "Hello from GURUKOOL!" << endl;
    return 0;
}
`,
  c: `// GURUKOOL Build — C (editing + AI help; execution needs a server-side runner)
#include <stdio.h>

int main(void) {
    printf("Hello from GURUKOOL!\\n");
    return 0;
}
`,
  java: `// GURUKOOL Build — Java (editing + AI help; execution needs a server-side runner)
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from GURUKOOL!");
    }
}
`,
};

type Msg = { role: "user" | "assistant"; content: string };
const LOG_CLS: Record<LogLine["type"], string> = {
  log: "text-slate-100", info: "text-sky-300", warn: "text-amber-300", error: "text-red-400", system: "text-slate-500",
};

export default function BuildPage() {
  const [lang, setLang] = useState<Lang>("javascript");
  const [codes, setCodes] = useState<Record<Lang, string>>(STARTERS); // each language keeps its own code
  const code = codes[lang];
  const setCode = (v: string) => setCodes((c) => ({ ...c, [lang]: v }));
  const monacoRef = useRef<MonacoT | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatErr, setChatErr] = useState<ApiErr | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  /** Compile TypeScript with Monaco's built-in TS worker; returns JS plus any diagnostics. */
  async function compileTs(out: LogLine[]): Promise<string | null> {
    const m = monacoRef.current;
    if (!m) { out.push({ type: "error", text: "Editor is still loading; try again." }); return null; }
    const uri = m.Uri.parse(`file:///${LANGS.typescript.file}`);
    const getWorker = await m.languages.typescript.getTypeScriptWorker();
    const client = await getWorker(uri);
    const diags = [...(await client.getSyntacticDiagnostics(uri.toString())), ...(await client.getSemanticDiagnostics(uri.toString()))];
    for (const d of diags.slice(0, 8)) {
      const msg = typeof d.messageText === "string" ? d.messageText : d.messageText.messageText;
      out.push({ type: "warn", text: `TypeScript: ${msg}` });
    }
    const emitted = await client.getEmitOutput(uri.toString());
    return emitted.outputFiles[0]?.text ?? null;
  }

  async function run() {
    const L = LANGS[lang];
    setRunning(true);
    const start = performance.now();
    const out: LogLine[] = [{ type: "system", text: `▶ Running ${L.label} in isolated sandbox…` }];
    setLogs([...out]);
    if (!L.runnable) {
      out.push({ type: "error", text: `${L.label} execution isn't available yet: it needs a secure server-side compiler, which this deployment doesn't have. Your code was NOT run. You can still edit it and ask the AI mentor about it.` });
      setLogs([...out]); setRunning(false); return;
    }
    let source = code;
    if (lang === "typescript") {
      const js = await compileTs(out);
      setLogs([...out]);
      if (js === null) { setRunning(false); return; }
      source = js;
    }
    const r = await runInSandbox(source, (l) => { out.push(l); setLogs([...out]); }, lang === "python" ? 60000 : 5000, lang === "python" ? "python" : "javascript");
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
      const d = await api<{ reply: string }>("/api/chat", { method: "POST", body: JSON.stringify({ question, code, output, history, language: LANGS[lang].label }) });
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
              <div className="flex items-center gap-2">
                <select className="input w-36 py-1.5 text-sm" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
                  {(Object.keys(LANGS) as Lang[]).map((l) => <option key={l} value={l}>{LANGS[l].label}{LANGS[l].runnable ? "" : " (edit only)"}</option>)}
                </select>
                <span className="hidden text-sm text-slate-500 sm:inline">{LANGS[lang].file}</span>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost px-3 py-1.5" onClick={() => setLogs([])}>Clear</button>
                <button className="btn-primary px-4 py-1.5" onClick={run} disabled={running}>{running ? <Spinner /> : "▶"} Run</button>
              </div>
            </div>
            <div className="h-[420px]">
              <Monaco
                height="100%"
                path={`file:///${LANGS[lang].file}`}
                language={lang}
                value={code}
                onChange={(v) => setCode(v ?? "")}
                onMount={(_editor, m) => {
                  monacoRef.current = m;
                  m.languages.typescript.typescriptDefaults.setCompilerOptions({
                    target: m.languages.typescript.ScriptTarget.ES2020, module: m.languages.typescript.ModuleKind.None, strict: true, noEmitOnError: false,
                  });
                }}
                options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }}
              />
            </div>
          </div>
          <div className="card bg-slate-900 p-0">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-xs text-slate-400">
              <span>OUTPUT CONSOLE</span><span>Sandboxed · {lang === "python" ? "Pyodide from CDN · 60s limit" : "no network · 5s limit"}</span>
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
