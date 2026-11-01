import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(repoRoot, "dist");
const artifactRoot = resolve(process.env.QA_GAMEPLAY_ARTIFACT_DIR || join(repoRoot, "..", "..", "work", "gameplay-smoke"));
const profileRoot = join(artifactRoot, `.chrome-profile-${process.pid}`);
const browserCandidates = [
  process.env.QA_BROWSER,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);

if (!browserPath) {
  console.error("Gameplay smoke QA requires Chrome or Edge. Set QA_BROWSER to an installed Chromium executable.");
  process.exit(2);
}

mkdirSync(artifactRoot, { recursive: true });
mkdirSync(profileRoot, { recursive: true });

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
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
          "content-type": contentTypes[extname(absolute).toLowerCase()] || "application/octet-stream",
          "cache-control": "no-store",
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resultValue(evaluation) {
  return evaluation?.result?.value;
}

async function stopChildProcess(child) {
  if (!child) return;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    await Promise.race([new Promise(resolveExit => killer.once("exit", resolveExit)), delay(5000)]);
    return;
  }
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolveExit => child.once("exit", resolveExit));
  child.kill();
  if (await Promise.race([exited.then(() => true), delay(3000).then(() => false)])) return;
  child.kill("SIGKILL");
  await Promise.race([exited, delay(3000)]);
}

async function removeProfileWithRetries() {
  const safeProfile = resolve(profileRoot);
  if (!safeProfile.startsWith(`${artifactRoot}${sep}`) || !safeProfile.split(sep).at(-1).startsWith(".chrome-profile-")) {
    throw new Error(`Refusing to remove unexpected profile path: ${safeProfile}`);
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      rmSync(safeProfile, { recursive: true, force: true });
      if (!existsSync(safeProfile)) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Unable to remove temporary browser profile: ${safeProfile}`);
}

let staticServer;
let browserProcess;
let cdp;
let appOrigin;
let exitCode = 0;

try {
  staticServer = await startStaticServer();
  const appPort = staticServer.address().port;
  appOrigin = `http://127.0.0.1:${appPort}`;
  const debugPort = await freePort();
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--hide-scrollbars",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileRoot}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  const browserVersion = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Unable to create browser target: ${targetResponse.status}`);
  const target = await targetResponse.json();
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 720,
  });

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
      const description = evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text || "Browser evaluation failed";
      throw new Error(description);
    }
    return resultValue(evaluation);
  }

  async function waitFor(expression, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        if (await evaluate(`Boolean(${expression})`)) return;
      } catch (error) {
        lastError = error;
      }
      await delay(50);
    }
    throw new Error(`Timed out waiting for browser condition: ${expression}${lastError ? ` (${lastError.message})` : ""}`);
  }

  async function navigate(path) {
    await cdp.send("Page.navigate", { url: `${appOrigin}${path}` });
    await waitFor(`document.readyState === "complete" && document.querySelector("#app")`);
    if (/autostart|fixture/.test(path)) await waitFor(`document.querySelector("[data-action]") && document.querySelector("#cinematicIntro").classList.contains("dismissed")`);
    await delay(80);
  }

  async function click(selector) {
    const result = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return { ok: false, reason: "missing" };
      if (element.disabled) return { ok: false, reason: "disabled" };
      element.click();
      return { ok: true };
    })()`);
    assert(result?.ok, `Unable to click ${selector}: ${result?.reason || "unknown error"}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserPath,
    browserVersion: browserVersion.Browser,
    protocolVersion: browserVersion["Protocol-Version"],
    app: appOrigin,
    checks: [],
    summary: { passed: 0, failed: 0 },
    consoleErrors: [],
  };

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

  await check("action focus survives timer renders", async () => {
    await navigate("/?autostart=rehearsal");
    const initial = await evaluate(`(() => {
      const button = document.querySelector('[data-action="search-desk"]');
      button.dataset.qaIdentity = "focus-probe";
      button.focus();
      return { focused: document.activeElement === button, label: button.textContent.trim() };
    })()`);
    assert(initial.focused, "Search action did not receive focus");
    await delay(2200);
    const after = await evaluate(`(() => {
      const button = document.querySelector('[data-action="search-desk"]');
      return {
        focused: document.activeElement === button,
        identity: button?.dataset.qaIdentity,
        connected: button?.isConnected,
        timer: document.querySelector('#timerValue')?.textContent
      };
    })()`);
    assert(after.focused, "Timer render replaced or displaced the focused action");
    assert(after.identity === "focus-probe" && after.connected, "Focused action DOM identity did not survive render ticks");
    return after;
  });

  await check("camera node changes composition and pressed state", async () => {
    await click('[data-camera-node="records-desk"]');
    await delay(650);
    const result = await evaluate(`(() => {
      const buttons = [...document.querySelectorAll('[data-camera-node]')];
      const active = buttons.filter(button => button.getAttribute('aria-pressed') === 'true');
      const plateStyle = getComputedStyle(document.querySelector('#plate'));
      return {
        sceneNode: document.querySelector('#scene')?.dataset.cameraNode,
        sceneIndex: document.querySelector('#scene')?.dataset.cameraIndex,
        activeNodes: active.map(button => button.dataset.cameraNode),
        cue: document.querySelector('#cameraCue')?.textContent,
        objectPosition: plateStyle.objectPosition,
        transform: plateStyle.transform
      };
    })()`);
    assert(result.sceneNode === "records-desk" && result.sceneIndex === "1", "Scene did not enter the records camera composition");
    assert(result.activeNodes.length === 1 && result.activeNodes[0] === "records-desk", "Camera rail does not expose one pressed node");
    assert(/intake record/i.test(result.cue), "Camera purpose cue did not update");
    assert(result.objectPosition !== "50% 50%", "Camera selection did not alter authored framing");
    return result;
  });

  await check("rejected action does not satisfy objective progress", async () => {
    const before = await evaluate(`({ progress: document.querySelector('#objectiveProgressTrack')?.getAttribute('aria-valuenow') })`);
    await click('[data-action="reconstruct-file"]');
    await delay(60);
    const rejected = await evaluate(`(() => {
      const action = document.querySelector('[data-action="reconstruct-file"]');
      return {
        progress: document.querySelector('#objectiveProgressTrack')?.getAttribute('aria-valuenow'),
        completed: action?.classList.contains('completed'),
        locked: action?.classList.contains('locked'),
        toast: document.querySelector('#eventToast b')?.textContent,
        feedback: document.querySelector('#actionFeedback')?.textContent
      };
    })()`);
    assert(before.progress === "0" && rejected.progress === "0", "Rejected reconstruction advanced objective progress");
    assert(!rejected.completed && rejected.locked, "Rejected reconstruction was marked complete or unlocked");
    assert(rejected.toast === "ACTION BLOCKED" && /missing|search/i.test(rejected.feedback), "Rejected action did not explain its prerequisite");

    await click('[data-action="search-desk"]');
    await delay(40);
    await click('[data-action="open-locker"]');
    await delay(40);
    const ready = await evaluate(`(() => {
      const action = document.querySelector('[data-action="reconstruct-file"]');
      return {
        progress: document.querySelector('#objectiveProgressTrack')?.getAttribute('aria-valuenow'),
        completed: action?.classList.contains('completed'),
        locked: action?.classList.contains('locked')
      };
    })()`);
    assert(ready.progress === "67" && !ready.completed && !ready.locked, "Prerequisite actions incorrectly completed reconstruction");
    await click('[data-action="reconstruct-file"]');
    await delay(40);
    const completed = await evaluate(`({
      progress: document.querySelector('#objectiveProgressTrack')?.getAttribute('aria-valuenow'),
      completed: document.querySelector('[data-action="reconstruct-file"]')?.classList.contains('completed')
    })`);
    assert(completed.progress === "100" && completed.completed, "Successful reconstruction did not complete the objective");
    return { rejected, ready, completed };
  });

  await check("inventory crafting, use, and checkpoint recovery are playable", async () => {
    await navigate("/?autostart=rehearsal");
    const setup = await evaluate(`(() => {
      document.querySelector('[data-action="open-locker"]').click();
      document.querySelector('[data-view-target="dashboard"]').click();
      const motion = document.querySelector('#motionToggle');
      if (!motion.checked) motion.click();
      const input = document.querySelector('#chatCommand');
      input.value = '!medkit';
      document.querySelector('#sendChat').click();
      document.querySelector('#advanceRoom').click();
      return { advancing: document.querySelector('#advanceRoom').disabled };
    })()`);
    assert(setup.advancing, "Room consequence did not enter its guarded advance state");
    await waitFor(`document.querySelector('#dashRoom')?.textContent === 'Ward 06'`, 5000);
    await click('[data-view-target="gameplay"]');
    const inventory = await evaluate(`(() => ({
      tags: [...document.querySelectorAll('#inventoryActions .item-tag')].map(tag => tag.textContent),
      craft: Boolean(document.querySelector('#inventoryActions [data-craft]'))
    }))()`);
    assert(inventory.tags.includes("Sedative ampoule") && inventory.tags.includes("Trauma kit") && inventory.craft, "Craftable inventory pair was not exposed in gameplay");

    await click('#inventoryActions [data-craft]');
    await delay(50);
    const crafted = await evaluate(`(() => ({
      tags: [...document.querySelectorAll('#inventoryActions .item-tag')].map(tag => tag.textContent),
      usable: Boolean(document.querySelector('#inventoryActions [data-use-item="Stabilized trauma kit"]')),
      toast: document.querySelector('#eventToast b')?.textContent
    }))()`);
    assert(crafted.tags.includes("Stabilized trauma kit") && crafted.usable && crafted.toast === "ITEM CRAFTED", "Craft action did not create the stabilized kit");

    await click('#inventoryActions [data-use-item="Stabilized trauma kit"]');
    await delay(50);
    const used = await evaluate(`(() => ({
      tags: [...document.querySelectorAll('#inventoryActions .item-tag')].map(tag => tag.textContent),
      toast: document.querySelector('#eventToast b')?.textContent
    }))()`);
    assert(!used.tags.includes("Stabilized trauma kit") && used.toast === "ITEM USED", "Use action did not consume the stabilized kit");

    await click('[data-action="inspect-gurney"]');
    await delay(40);
    const dirtyEvidence = await evaluate(`document.querySelector('#evidenceCount')?.textContent`);
    assert(/^1 evidence/.test(dirtyEvidence), "Surgery action did not create state to recover from");
    await click('[data-view-target="dashboard"]');
    await click('#restoreCheckpoint');
    await delay(60);
    const restored = await evaluate(`(() => ({
      room: document.querySelector('#dashRoom')?.textContent,
      evidence: document.querySelector('#dashEvidence')?.textContent,
      tags: [...document.querySelectorAll('#inventoryActions .item-tag')].map(tag => tag.textContent),
      toast: document.querySelector('#eventToast b')?.textContent
    }))()`);
    assert(restored.room === "Ward 06" && restored.evidence === "0", "Checkpoint did not restore the room-entry evidence state");
    assert(restored.tags.includes("Sedative ampoule") && restored.tags.includes("Trauma kit"), "Checkpoint did not restore the pre-craft inventory");
    assert(restored.toast === "CHECKPOINT RESTORED", "Checkpoint recovery did not provide production feedback");
    return { inventory, crafted, used, restored };
  });

  await check("zero-chat resolution is visibly labelled as a director fallback", async () => {
    await navigate("/?autostart=rehearsal");
    await evaluate(`(() => {
      document.querySelector('[data-view-target="dashboard"]').click();
      const motion = document.querySelector('#motionToggle');
      if (motion.checked) motion.click();
      document.querySelector('#advanceRoom').click();
    })()`);
    await delay(60);
    const result = await evaluate(`(() => ({
      gameplay: document.querySelector('#voteSource')?.textContent,
      overlay: document.querySelector('#overlaySource')?.textContent,
      activity: document.querySelector('#activityFeed')?.textContent
    }))()`);
    assert(result.gameplay === "DIRECTOR FALLBACK · NO CHAT VOTES", "Gameplay did not disclose the zero-chat fallback");
    assert(result.overlay === result.gameplay, "OBS overlay fallback provenance differs from gameplay");
    assert(/DIRECTOR/.test(result.activity), "Activity feed did not attribute fallback resolution to the director");
    return result;
  });

  await check("a complete fallback run renders a truthful ending recap", async () => {
    await navigate("/?autostart=rehearsal");
    await click('[data-view-target="dashboard"]');
    const motionEnabled = await evaluate(`(() => {
      const toggle = document.querySelector('#motionToggle');
      if (!toggle.checked) toggle.click();
      return toggle.checked;
    })()`);
    assert(motionEnabled, "Could not enable reduced motion for deterministic transition timing");

    const expectedRooms = ["Ward 06", "Operating Theatre", "Generator Room", "Stairwell / Exits"];
    for (const expectedRoom of expectedRooms) {
      await click('#advanceRoom');
      await waitFor(`document.querySelector('#dashRoom')?.textContent === ${JSON.stringify(expectedRoom)}`, 3000);
    }
    await click('[data-view-target="gameplay"]');
    await click('#advanceRoom');
    await waitFor(`document.querySelector('#ending')?.classList.contains('show')`, 3000);
    await delay(60);

    const result = await evaluate(`(() => ({
      title: document.querySelector('#endingTitle')?.textContent,
      summary: document.querySelector('#endingSummary')?.textContent,
      values: [...document.querySelectorAll('#endingRecap span')].map(span => span.textContent.replace(/\\s+/g, ' ').trim()),
      mechanics: document.querySelector('#endingRecap p')?.textContent,
      focused: document.activeElement === document.querySelector('#endingTitle'),
      backgroundInert: document.querySelector('.hud')?.inert === true
    }))()`);
    assert(result.title, "Ending title is empty");
    assert(/disclosed director fallbacks/i.test(result.summary), "Ending summary falsely credits an absent audience");
    assert(result.values.length === 6 && result.values.some(value => /ROUTE.*ROOF/i.test(value)) && result.values.some(value => /FALLBACKS.*5/i.test(value)), "Ending recap omitted route or fallback provenance");
    assert(result.focused && result.backgroundInert, "Ending dialog did not move focus and inert background gameplay");

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    const screenshotPath = join(artifactRoot, "ending-recap-1280x720.png");
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    return { ...result, screenshotPath };
  });

  report.consoleErrors = [...new Set(consoleErrors)];
  if (report.consoleErrors.length) {
    report.checks.push({ name: "browser console remains clean", pass: false, error: report.consoleErrors.join(" | ") });
    report.summary.failed++;
  } else {
    report.checks.push({ name: "browser console remains clean", pass: true, details: { warningsAndErrors: 0 } });
    report.summary.passed++;
  }

  const reportPath = join(artifactRoot, "gameplay-smoke-report.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, artifactRoot, summary: report.summary, failures: report.checks.filter(checkResult => !checkResult.pass) }, null, 2));
  exitCode = report.summary.failed ? 1 : 0;
} catch (error) {
  console.error(error?.stack || error);
  exitCode = 2;
} finally {
  try { await cdp?.send("Browser.close"); } catch {}
  cdp?.close();
  staticServer?.close();
  await stopChildProcess(browserProcess);
  try { await removeProfileWithRetries(); }
  catch (error) { console.error(error.message); exitCode = 2; }
}

process.exit(exitCode);
