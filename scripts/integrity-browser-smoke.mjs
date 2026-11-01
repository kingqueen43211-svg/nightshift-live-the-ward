import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(repoRoot, "dist");
const artifactRoot = resolve(process.env.QA_INTEGRITY_ARTIFACT_DIR || join(repoRoot, "..", "..", "work", "integrity-browser-smoke"));
const profileRoot = join(artifactRoot, `.chrome-profile-${process.pid}`);
const reportPath = join(artifactRoot, "integrity-browser-smoke-report.json");
const browserCandidates = [
  process.env.QA_BROWSER,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function startStaticServer() {
  return new Promise((resolveServer, reject) => {
    const server = createServer((request, response) => {
      try {
        const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
        if (requestUrl.pathname === "/favicon.ico") {
          response.writeHead(204);
          response.end();
          return;
        }
        const relative = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
        const absolute = resolve(distRoot, `.${relative}`);
        if (!absolute.startsWith(`${distRoot}${sep}`) || !existsSync(absolute)) {
          response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          response.end("Not found");
          return;
        }
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": contentTypes[extname(absolute).toLowerCase()] || "application/octet-stream",
        });
        response.end(readFileSync(absolute));
      } catch (error) {
        response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        response.end(String(error));
      }
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

async function waitForJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError || "no response"}`);
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolveExit => child.once("exit", resolveExit));
  child.kill();
  await Promise.race([exited, delay(3000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exited, delay(3000)]);
  }
}

async function removeProfileWithRetries() {
  const expectedPrefix = `${artifactRoot}${sep}`;
  if (!profileRoot.startsWith(expectedPrefix)) throw new Error(`Refusing to remove unexpected profile path: ${profileRoot}`);
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      rmSync(profileRoot, { recursive: true, force: true });
      if (!existsSync(profileRoot)) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Unable to remove temporary browser profile: ${profileRoot}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, reject) => {
      this.pending.set(id, { resolve: resolveCall, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, callback) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(callback);
  }

  close() {
    this.socket?.close();
  }
}

mkdirSync(artifactRoot, { recursive: true });
mkdirSync(profileRoot, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  browser: browserPath || null,
  browserVersion: null,
  app: null,
  checks: [],
  summary: { passed: 0, failed: 0 },
  consoleErrors: [],
};

let staticServer;
let browserProcess;
let cdp;
let exitCode = 0;

async function check(name, callback) {
  const startedAt = Date.now();
  try {
    const details = await callback();
    report.checks.push({ name, pass: true, durationMs: Date.now() - startedAt, details });
    report.summary.passed++;
  } catch (error) {
    report.checks.push({ name, pass: false, durationMs: Date.now() - startedAt, error: error.message });
    report.summary.failed++;
  }
}

try {
  if (!browserPath) throw new Error("Integrity browser smoke requires Chrome or Edge. Set QA_BROWSER to an installed Chromium executable.");

  staticServer = await startStaticServer();
  const appOrigin = `http://127.0.0.1:${staticServer.address().port}`;
  report.app = appOrigin;
  const debugPort = await freePort();
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileRoot}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  const browserVersion = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  report.browserVersion = browserVersion.Browser;
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Unable to create browser target: ${targetResponse.status}`);
  const target = await targetResponse.json();

  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");

  const consoleErrors = [];
  cdp.on("Runtime.exceptionThrown", params => consoleErrors.push(params.exceptionDetails?.text || "Runtime exception"));
  cdp.on("Log.entryAdded", ({ entry }) => {
    if (["error", "warning"].includes(entry?.level)) consoleErrors.push(`${entry.level}: ${entry.text}`);
  });

  async function evaluate(expression) {
    const evaluation = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (evaluation.exceptionDetails) {
      throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text || "Browser evaluation failed");
    }
    return evaluation.result?.value;
  }

  async function waitFor(expression, timeoutMs = 12000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await delay(50);
    }
    throw new Error(`Timed out waiting for browser condition: ${expression}`);
  }

  await cdp.send("Page.navigate", { url: `${appOrigin}/?autostart=rehearsal` });
  await waitFor(`document.readyState === "complete" && document.querySelector("#cinematicIntro")?.classList.contains("dismissed")`);
  await delay(100);

  await check("rehearsal labels expose simulated input and truthful activity", async () => {
    const initial = await evaluate(`({
      count: document.querySelector("#viewerCount")?.textContent,
      source: document.querySelector("#voteSource")?.textContent,
      mode: document.querySelector("#modeLabel")?.textContent
    })`);
    assert(/^\d+ VOTES?$/.test(initial.count), `Vote activity label is malformed: ${initial.count}`);
    assert(!initial.count.includes("1,847"), `Fabricated viewer count is still visible: ${initial.count}`);
    assert(initial.source === "REHEARSAL VOTE · SIMULATED INPUT", `Rehearsal source is not explicit: ${initial.source}`);
    assert(initial.mode === "MODE: SIMULATED", `Rehearsal mode is not explicit: ${initial.mode}`);
    return initial;
  });

  await check("transient Twitch phases cannot enable simulated audience input", async () => {
    const modes = await evaluate(`(async () => {
      const runtime = await import("./runtime-mode.mjs");
      return ["AUTHORIZING", "CONNECTING", "RECONNECTING", "AUTH_EXPIRED", "ERROR"].map(phase => {
        const mode = runtime.modeForTwitchStatus({ phase, connected: false }, "LIVE TWITCH");
        return { phase, mode, simulation: runtime.simulatedAudienceEnabled(mode) };
      });
    })()`);
    assert(!modes.some(item => item.simulation), `Transient Twitch mode enabled simulation: ${JSON.stringify(modes)}`);
    return { modes };
  });

  await check("hide-names removes private identities from the OBS transport", async () => {
    const privacy = await evaluate(`(async () => {
      window.__integrityMessages = [];
      window.__integrityChannel = new BroadcastChannel("nightshift-live");
      window.__integrityChannel.onmessage = event => {
        if (event.data?.type === "state") window.__integrityMessages.push(event.data.state);
      };
      const names = document.querySelector("#namesToggle");
      if (!names.checked) names.click();
      document.querySelector('[data-view-target="dashboard"]').click();
      document.querySelector("#chatCommand").value = "!records";
      document.querySelector("#sendChat").click();
      await new Promise(resolveWait => setTimeout(resolveWait, 150));
      const payload = window.__integrityMessages.at(-1);
      return { payload, serialized: JSON.stringify(payload), toast: document.querySelector("#eventToast span")?.textContent };
    })()`);
    const demoNames = ["voidbunny", "mothsignal", "hexkitten", "ghostbyte", "neonwraith", "pixelpaladin"];
    assert(privacy.payload, "Controller did not publish a public state payload");
    assert(!demoNames.some(name => privacy.serialized.includes(name)), `Private viewer name escaped public state: ${privacy.serialized}`);
    assert(Object.keys(privacy.payload.voters || {}).length === 0, "Public payload retained the voter identity map");
    assert(Object.keys(privacy.payload.members || {}).length === 0, "Public payload retained the faction identity map");
    assert((privacy.payload.seenEventIds || []).length === 0, "Public payload retained EventSub identifiers");
    assert(privacy.payload.campaign?.checkpoint === null, "Public payload retained the recursive checkpoint");
    return { seededEvent: privacy.toast, privateFieldsRemoved: true };
  });

  await check("OBS overlay is passive and does not echo controller broadcasts", async () => {
    const passive = await evaluate(`(async () => {
      window.__integrityMessages.length = 0;
      const iframe = document.createElement("iframe");
      iframe.src = "/?view=overlay";
      document.body.appendChild(iframe);
      await new Promise(resolveLoad => iframe.addEventListener("load", resolveLoad, { once: true }));
      const overlayWindow = iframe.contentWindow;
      const originalPostMessage = overlayWindow.BroadcastChannel.prototype.postMessage;
      overlayWindow.__integrityPostCount = 0;
      overlayWindow.BroadcastChannel.prototype.postMessage = function (...args) {
        overlayWindow.__integrityPostCount++;
        return originalPostMessage.apply(this, args);
      };
      await new Promise(resolveWait => setTimeout(resolveWait, 2600));
      return {
        messages: window.__integrityMessages.length,
        overlayPosts: overlayWindow.__integrityPostCount,
        view: iframe.contentDocument.querySelector("#app")?.dataset.view,
        introHidden: getComputedStyle(iframe.contentDocument.querySelector("#cinematicIntro")).display === "none",
        overlayVisible: getComputedStyle(iframe.contentDocument.querySelector("#overlay")).display !== "none"
      };
    })()`);
    assert(passive.view === "overlay", `Overlay view did not initialize: ${JSON.stringify(passive)}`);
    assert(passive.introHidden && passive.overlayVisible, `Overlay presentation is obstructed: ${JSON.stringify(passive)}`);
    assert(passive.messages >= 1, "Controller did not send state while the overlay was listening");
    assert(passive.overlayPosts === 0, `Overlay echoed ${passive.overlayPosts} controller broadcast(s)`);
    return passive;
  });

  report.consoleErrors = [...new Set(consoleErrors)];
  await check("browser console remains clean", async () => {
    assert(report.consoleErrors.length === 0, report.consoleErrors.join(" | "));
    return { warningsAndErrors: 0 };
  });

  exitCode = report.summary.failed ? 1 : 0;
} catch (error) {
  report.harnessError = error?.stack || String(error);
  exitCode = 2;
} finally {
  if (cdp) {
    try { await cdp.send("Browser.close"); } catch {}
    cdp.close();
  }
  if (staticServer) await new Promise(resolveClose => staticServer.close(resolveClose));
  await stopChildProcess(browserProcess);
  try {
    await removeProfileWithRetries();
  } catch (error) {
    report.cleanupError = error.message;
    exitCode = 2;
  }
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, summary: report.summary, exitCode, failures: report.checks.filter(result => !result.pass), harnessError: report.harnessError, cleanupError: report.cleanupError }, null, 2));
}

process.exit(exitCode);
