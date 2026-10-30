// Isolated JavaScript / Python runner (TypeScript is transpiled to JS before it gets here).
// Code runs inside a Web Worker created INSIDE an iframe with sandbox="allow-scripts" (no allow-same-origin):
//  - opaque origin → no access to GURUKOOL's DOM, cookies, localStorage or same-origin APIs
//  - CSP connect-src 'none' → no network for JS; Python may only reach cdn.jsdelivr.net (to load Pyodide)
//  - separate worker thread + hard timeout → infinite loops are terminated
// Nothing is ever executed on the Next.js server.

export type LogLine = { type: "log" | "error" | "warn" | "info" | "system"; text: string };

export type RunLang = "javascript" | "python";
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const CDN = "https://cdn.jsdelivr.net";

const runnerHtml = (lang: RunLang) => `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:${lang === "python" ? " " + CDN : ""}; worker-src blob:; connect-src ${lang === "python" ? CDN : "'none'"}">
</head><body><script>
const WORKER_SRC = \`
  const fmt = (v) => { try { if (typeof v === 'string') return v; if (v instanceof Error) return v.name + ': ' + v.message;
    if (typeof v === 'function') return v.toString(); if (typeof v === 'undefined') return 'undefined';
    return JSON.stringify(v, (k, x) => typeof x === 'bigint' ? x.toString() + 'n' : x, 2) ?? String(v); } catch { return String(v); } };
  const send = (type, args) => postMessage({ kind: 'log', type, text: args.map(fmt).join(' ') });
  self.console = { log: (...a) => send('log', a), info: (...a) => send('info', a), warn: (...a) => send('warn', a),
    error: (...a) => send('error', a), debug: (...a) => send('log', a), table: (...a) => send('log', a) };
  const PYO = '${PYODIDE}';
  onmessage = async (e) => {
    const { code, lang } = e.data;
    try {
      if (lang === 'python') {
        if (!self.py) {
          postMessage({ kind: 'log', type: 'system', text: 'Loading Python (Pyodide)… first run takes a few seconds' });
          importScripts(PYO + 'pyodide.js');
          self.py = await loadPyodide({ indexURL: PYO });
          self.py.setStdout({ batched: (t) => send('log', [t]) });
          self.py.setStderr({ batched: (t) => send('error', [t]) });
        }
        await self.py.runPythonAsync(code);
        postMessage({ kind: 'done' });
        return;
      }
      self.fetch = undefined; self.XMLHttpRequest = undefined; self.importScripts = undefined; self.WebSocket = undefined;
      const fn = new (Object.getPrototypeOf(async function(){}).constructor)(code); await fn(); postMessage({ kind: 'done' }); }
    catch (err) {
      const text = lang === 'python' ? String((err && err.message) || err).trim().split('\\\\n').slice(-6).join('\\\\n')
        : (err && err.stack) ? String(err.stack).split('\\\\n').slice(0,4).join('\\\\n') : String(err);
      postMessage({ kind: 'log', type: 'error', text }); postMessage({ kind: 'done', failed: true }); }
  };
\`;
let worker = null, timer = null;
window.addEventListener('message', (e) => {
  if (e.source !== parent) return;
  const { code, timeoutMs, lang } = e.data || {};
  if (typeof code !== 'string') return;
  try {
    if (worker) worker.terminate();
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
  } catch (err) { parent.postMessage({ kind: 'unavailable', text: String(err) }, '*'); return; }
  worker.onmessage = (m) => { parent.postMessage(m.data, '*'); if (m.data.kind === 'done') { clearTimeout(timer); worker.terminate(); worker = null; } };
  worker.onerror = (ev) => { parent.postMessage({ kind: 'log', type: 'error', text: ev.message || 'Error' }, '*'); };
  timer = setTimeout(() => { if (worker) { worker.terminate(); worker = null; }
    parent.postMessage({ kind: 'log', type: 'error', text: 'Execution stopped: exceeded ' + timeoutMs/1000 + 's time limit (infinite loop?)' }, '*');
    parent.postMessage({ kind: 'done', failed: true }, '*'); }, timeoutMs);
  worker.postMessage({ code, lang });
});
parent.postMessage({ kind: 'ready' }, '*');
</script></body></html>`;

export function runInSandbox(code: string, onLog: (l: LogLine) => void, timeoutMs = 5000, lang: RunLang = "javascript"): Promise<{ ok: boolean; unavailable?: boolean }> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.display = "none";
    iframe.srcdoc = runnerHtml(lang);
    let finished = false;
    const finish = (r: { ok: boolean; unavailable?: boolean }) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onMsg);
      clearTimeout(guard);
      iframe.remove(); // tears down the iframe and its worker
      resolve(r);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return; // only trust our sandbox
      const d = e.data;
      if (d?.kind === "ready") iframe.contentWindow?.postMessage({ code, timeoutMs, lang }, "*");
      else if (d?.kind === "log") onLog({ type: d.type, text: String(d.text) });
      else if (d?.kind === "done") finish({ ok: !d.failed });
      else if (d?.kind === "unavailable") finish({ ok: false, unavailable: true });
    };
    // Outer guard in case the sandbox never responds (e.g. browser blocks sandboxed workers).
    const guard = setTimeout(() => finish({ ok: false, unavailable: true }), timeoutMs + 3000);
    window.addEventListener("message", onMsg);
    document.body.appendChild(iframe);
  });
}
