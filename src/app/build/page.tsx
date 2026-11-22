"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Alert, ErrorAlert, Spinner, api, toErr, type ApiErr } from "@/components/ui";
import { runInSandbox, type LogLine } from "@/components/sandboxRunner";
import type { Monaco as MonacoT } from "@monaco-editor/react";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center gap-2 text-sm text-white/50"><Spinner /> Loading editor…</div>,
});

type Lang = "javascript" | "typescript" | "python" | "cpp" | "c" | "java";
const LANGS: Record<Lang, { label: string; file: string; runnable: boolean; icon: string }> = {
  javascript: { label: "JavaScript", file: "main.js", runnable: true, icon: "JS" },
  typescript: { label: "TypeScript", file: "main.ts", runnable: true, icon: "TS" },
  python:     { label: "Python 3",   file: "main.py", runnable: true, icon: "PY" },
  cpp:        { label: "C++",        file: "main.cpp", runnable: false, icon: "C++" },
  c:          { label: "C",          file: "main.c",   runnable: false, icon: "C" },
  java:       { label: "Java",       file: "Main.java", runnable: false, icon: "JV" },
};
const STARTERS: Record<Lang, string> = {
  javascript: `// CodeLab — JavaScript
// Hit Run to execute in a secure sandbox

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
  typescript: `// CodeLab — TypeScript
type Student = { name: string; score: number };

const students: Student[] = [
  { name: "Aarav", score: 82 },
  { name: "Diya", score: 91 },
];

const average = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / xs.length;

console.log("Average score:", average(students.map((s) => s.score)));
`,
  python: `# CodeLab — Python 3 (runs via Pyodide in your browser)

def fibonacci(n):
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

print("First 10 Fibonacci numbers:", fibonacci(10))

scores = {"Aarav": 82, "Diya": 91}
print("Topper:", max(scores, key=scores.get))
`,
  cpp: `// CodeLab — C++ (edit + AI help; run needs server compiler)
#include <iostream>
using namespace std;

int main() {
    cout << "Hello from GURUKOOL!" << endl;
    return 0;
}
`,
  c: `// CodeLab — C (edit + AI help; run needs server compiler)
#include <stdio.h>

int main(void) {
    printf("Hello from GURUKOOL!\\n");
    return 0;
}
`,
  java: `// CodeLab — Java (edit + AI help; run needs server compiler)
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from GURUKOOL!");
    }
}
`,
};

const QUICK_ASK = ["Explain this code", "Why am I getting this error?", "How can I optimise this?"];

/* Editor theme matching the landing page's navy code card */
const NAVY = "#2c303b";
function defineTheme(m: MonacoT) {
  m.editor.defineTheme("udaan-navy", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "c9ccd4" },
      { token: "comment", foreground: "8b90a0", fontStyle: "italic" },
      { token: "keyword", foreground: "f29a6b" },
      { token: "string", foreground: "e6c07b" },
      { token: "number", foreground: "8fd3ff" },
      { token: "type", foreground: "8fd3ff" },
      { token: "delimiter", foreground: "9aa0ad" },
    ],
    colors: {
      "editor.background": NAVY,
      "editor.foreground": "#c9ccd4",
      "editorLineNumber.foreground": "#5f6573",
      "editorLineNumber.activeForeground": "#c9ccd4",
      "editor.lineHighlightBackground": "#333845",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#4a5163",
      "editorCursor.foreground": "#D9541E",
      "editorIndentGuide.background1": "#383d4a",
      "editorWidget.background": "#23262f",
      "editorHoverWidget.background": "#23262f",
      "editorHoverWidget.border": "#3a3f4c",
      "editorSuggestWidget.background": "#23262f",
      "editorSuggestWidget.border": "#3a3f4c",
      "editorSuggestWidget.selectedBackground": "#3a3f4c",
      ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`editorBracketHighlight.foreground${n}`, "#9aa0ad"])),
      "editorBracketMatch.background": "#ffffff14",
      "editorBracketMatch.border": "#00000000",
      "scrollbarSlider.background": "#ffffff1a",
      "scrollbarSlider.hoverBackground": "#ffffff2a",
    },
  });
}

type Msg = { role: "user" | "assistant"; content: string };
const LOG_CLS: Record<LogLine["type"], string> = {
  log: "text-[#16181d]", info: "text-[#1570ef]", warn: "text-[#a85a0c]",
  error: "text-[#b4232f]", system: "text-[#8a909c]",
};

export default function BuildPage() {
  const [lang, setLang] = useState<Lang>("javascript");
  const [codes, setCodes] = useState<Record<Lang, string>>(STARTERS);
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

  async function compileTs(out: LogLine[]): Promise<string | null> {
    const m = monacoRef.current;
    if (!m) { out.push({ type: "error", text: "Editor still loading, try again." }); return null; }
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
    const out: LogLine[] = [{ type: "system", text: `Running ${L.label}…` }];
    setLogs([...out]);
    if (!L.runnable) {
      out.push({ type: "error", text: `${L.label} execution needs a server-side compiler — not available yet. You can still write and ask the AI about it.` });
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
      out.push({ type: "error", text: "Sandbox unavailable in this browser. Try Chrome, Edge or Firefox." });
    } else {
      out.push({ type: "system", text: `${r.ok ? "✓ Done" : "✗ Error"} · ${Math.round(performance.now() - start)} ms` });
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

  const L = LANGS[lang];
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 md:h-[calc(100vh-3.5rem)]">

      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Write · run · ask</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-[#16181d]">CodeLab</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <label className="sr-only" htmlFor="cl-lang">Language</label>
          <select id="cl-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}
            className="input w-auto cursor-pointer py-2.5 pr-9 font-display font-semibold">
            {(Object.keys(LANGS) as Lang[]).map((l) => (
              <option key={l} value={l}>{LANGS[l].label}{LANGS[l].runnable ? "" : " (edit only)"}</option>
            ))}
          </select>
          <button onClick={() => { setCodes((c) => ({ ...c, [lang]: STARTERS[lang] })); setLogs([]); }} className="btn-ghost">Reset</button>
          <button onClick={run} disabled={running} className="btn-primary px-6">
            {running ? <Spinner /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>}
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {unavailable && <Alert kind="warn">Secure sandbox not available in this browser. Try Chrome, Edge or Firefox.</Alert>}

      {/* Workspace */}
      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1fr_380px]">

        {/* Editor + output: navy code card with attached white panel, like the landing page */}
        <div className="flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e3e5e9] shadow-sm lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between px-5 py-3.5" style={{ background: NAVY }}>
            <div className="flex items-center gap-2">
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}
            </div>
            <span className="font-mono text-xs text-white/50">{L.file}</span>
          </div>
          <div className="min-h-0 flex-1" style={{ background: NAVY }}>
            <Monaco
              height="100%"
              path={`file:///${L.file}`}
              language={lang}
              value={code}
              theme="udaan-navy"
              loading={<div className="flex items-center gap-2 text-sm text-white/50"><Spinner /> Loading editor…</div>}
              beforeMount={defineTheme}
              onChange={(v) => setCode(v ?? "")}
              onMount={(_editor, m) => {
                monacoRef.current = m;
                m.languages.typescript.typescriptDefaults.setCompilerOptions({
                  target: m.languages.typescript.ScriptTarget.ES2020,
                  module: m.languages.typescript.ModuleKind.None,
                  strict: true, noEmitOnError: false,
                });
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 15,
                lineHeight: 26,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontLigatures: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                lineNumbers: "on",
                lineNumbersMinChars: 3,
                lineDecorationsWidth: 16,
                glyphMargin: false,
                folding: false,
                renderLineHighlight: "line",
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                guides: { indentation: false, bracketPairs: false },
                bracketPairColorization: { enabled: false },
                matchBrackets: "near",
                cursorBlinking: "smooth",
                smoothScrolling: true,
                padding: { top: 16, bottom: 16 },
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
              }}
            />
          </div>

          {/* Output */}
          <div className="flex h-48 shrink-0 flex-col bg-white">
            <div className="flex items-center justify-between border-b border-[#e3e5e9] px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-[#D9541E]" : logs.some((l) => l.type === "error") ? "bg-[#d62f45]" : "bg-emerald-500"}`} />
                <span className="font-display text-[15px] font-bold text-[#16181d]">Output</span>
                <span className="text-xs text-[#8a909c]">{!L.runnable ? "edit only" : lang === "python" ? "runs in your browser · 60s limit" : "sandboxed · 5s limit"}</span>
              </div>
              {logs.length > 0 && <button onClick={() => setLogs([])} className="text-[13px] font-medium text-[#5f6573] hover:text-[#16181d]">Clear</button>}
            </div>
            <pre className="flex-1 overflow-auto px-5 py-3 font-mono text-[13px] leading-relaxed">
              {logs.length === 0
                ? <span className="text-[#8a909c]">Press Run to see output here.</span>
                : logs.map((l, i) => <div key={i} className={`whitespace-pre-wrap ${LOG_CLS[l.type]}`}>{l.text}</div>)}
            </pre>
          </div>
        </div>

        {/* URBro */}
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[#e3e5e9] bg-white shadow-sm lg:min-h-0">
          <div className="flex items-center justify-between border-b border-[#e3e5e9] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D9541E] text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
              </span>
              <div>
                <p className="font-display text-[17px] font-bold leading-tight text-[#16181d]">URBro</p>
                <p className="text-xs text-[#5f6573]">AI mentor · sees your code &amp; output</p>
              </div>
            </div>
            {messages.length > 0 && <button onClick={() => setMessages([])} className="text-[13px] font-medium text-[#5f6573] hover:text-[#16181d]">Clear</button>}
          </div>

          <div className="flex-1 space-y-4 overflow-auto px-5 py-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col justify-end">
                <p className="font-display text-xl font-bold leading-snug text-[#16181d]">Stuck? Ask me about your code.</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5f6573]">I read what&rsquo;s in the editor and the latest output, so you don&rsquo;t need to paste anything.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {QUICK_ASK.map((s) => (
                    <button key={s} onClick={() => ask(s)}
                      className="rounded-full bg-[#f0f1f3] px-3.5 py-2 text-[13px] font-medium text-[#2c303b] transition-colors hover:bg-[#fbe9e1] hover:text-[#D9541E]">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user" ? "rounded-br-md bg-[#2c303b] text-white" : "rounded-bl-md bg-[#f0f1f3] text-[#16181d]"}`}>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-[#f0f1f3] px-4 py-3.5">
                  {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8a909c]" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>

          {chatErr && <div className="px-5 pb-3"><ErrorAlert err={chatErr} /></div>}

          <form className="border-t border-[#e3e5e9] p-4" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <div className="flex items-center gap-2 rounded-full border-[1.5px] border-[#d5d8de] bg-white py-1.5 pl-5 pr-1.5 transition-[border-color,box-shadow] focus-within:border-[#D9541E] focus-within:shadow-[0_0_0_3px_rgba(217,84,30,0.12)]">
              <input className="min-w-0 flex-1 bg-transparent text-sm text-[#16181d] outline-none placeholder:text-[#8a909c]"
                placeholder="Ask URBro anything…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask URBro" />
              <button aria-label="Send" disabled={busy || !q.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D9541E] text-white transition-colors hover:bg-[#bf4518] disabled:opacity-30">
                {busy ? <Spinner /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
