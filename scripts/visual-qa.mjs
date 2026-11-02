import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(repoRoot, "dist");
const artifactRoot = resolve(process.env.QA_ARTIFACT_DIR || join(repoRoot, "..", "..", "work", "visual-qa"));
const profileRoot = join(artifactRoot, `.chrome-profile-${process.pid}`);
const browserCandidates = [
  process.env.QA_BROWSER,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);

if (!browserPath) {
  console.error("Visual QA requires Chrome or Edge. Set QA_BROWSER to an installed Chromium executable.");
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
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
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

const geometryExpression = `(() => {
  const zoneSelectors = ['.mission','.meters','.journal','.player-loop','.vote-panel','.event-toast'];
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0.01;
  };
  const rectFor = (selector) => {
    const element = document.querySelector(selector);
    if (!visible(element)) return null;
    const rect = element.getBoundingClientRect();
    return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
  };
  const zones = zoneSelectors.map(rectFor).filter(Boolean);
  const intersections = [];
  for (let a = 0; a < zones.length; a++) for (let b = a + 1; b < zones.length; b++) {
    const first = zones[a], second = zones[b];
    const width = Math.min(first.right, second.right) - Math.max(first.x, second.x);
    const height = Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y);
    if (width > 1 && height > 1) intersections.push({ first: first.selector, second: second.selector, width, height });
  }
  const targetElement = document.querySelector('#sceneTarget');
  const targetRect = targetElement?.getBoundingClientRect();
  const target = targetRect && targetRect.width > 0 && targetRect.height > 0
    ? { name: targetElement.dataset.sceneTarget, x: targetRect.x, y: targetRect.y, width: targetRect.width, height: targetRect.height, right: targetRect.right, bottom: targetRect.bottom }
    : null;
  const targetIntersections = target ? zones.map(zone => {
    const width = Math.min(zone.right, target.right) - Math.max(zone.x, target.x);
    const height = Math.min(zone.bottom, target.bottom) - Math.max(zone.y, target.y);
    return width > 1 && height > 1 ? { zone: zone.selector, target: target.name, width, height } : null;
  }).filter(Boolean) : [];
  const actionable = [...document.querySelectorAll('button,input,select,textarea,a[href],[role="button"]')]
    .filter(visible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { name: (element.innerText || element.value || element.getAttribute('aria-label') || element.id || element.tagName).trim().slice(0,80), x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    });
  const hasScrollableAncestor = (element) => {
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) return true;
    }
    return false;
  };
  const offscreen = [...document.querySelectorAll('button,input,select,textarea,a[href],[role="button"]')]
    .filter(visible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { element, rect, name: (element.innerText || element.value || element.getAttribute('aria-label') || element.id || element.tagName).trim().slice(0,80) };
    })
    .filter(({ element, rect }) => rect.x < -1 || rect.right > innerWidth + 1 || ((rect.y < -1 || rect.bottom > innerHeight + 1) && !hasScrollableAncestor(element)))
    .map(({ name, rect }) => ({ name, x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }));
  const clipped = [...document.querySelectorAll('.mission,.meters,.journal,.player-loop,.vote-panel,.event-toast,.panel,.dash-title')]
    .filter(visible)
    .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
    .map((element) => ({ selector: element.id ? '#' + element.id : '.' + [...element.classList].join('.'), client: [element.clientWidth, element.clientHeight], scroll: [element.scrollWidth, element.scrollHeight] }));
  const mode = document.querySelector('#modeLabel')?.textContent?.trim() || '';
  return {
    viewport: [innerWidth, innerHeight],
    document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    verticalOverflow: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    zones, intersections, target, targetIntersections,
    hudCoverage: zones.reduce((sum, zone) => sum + zone.width * zone.height, 0) / Math.max(1, innerWidth * innerHeight),
    offscreen, clipped, mode,
    introVisible: visible(document.querySelector('#cinematicIntro')),
  };
})()`;

const readabilityExpression = `(() => {
  const outputScale = 0.5;
  const targets = [
    { name: 'objective', selector: '#objective', minimumCssPx: 18, minimumScaledPx: 9 },
    { name: 'next-step title', selector: '#nextStepTitle', minimumCssPx: 13, minimumScaledPx: 6.5 },
    { name: 'next-step detail', selector: '#nextStepDetail', minimumCssPx: 12, minimumScaledPx: 6 },
    { name: 'resource values', selector: '#healthValue,#dangerValue,#powerValue', minimumCssPx: 18, minimumScaledPx: 9 },
    { name: 'condition values', selector: '#conditionStrip b', minimumCssPx: 12, minimumScaledPx: 6 },
    { name: 'streamer actions', selector: '#actionTray button b', minimumCssPx: 12, minimumScaledPx: 6 },
    { name: 'vote labels', selector: '#voteOptions .vote-option b', minimumCssPx: 12, minimumScaledPx: 6 },
    { name: 'vote percentages', selector: '#voteOptions .vote-option > strong', minimumCssPx: 16, minimumScaledPx: 8 },
    { name: 'consequence detail', selector: '#eventToast span', minimumCssPx: 11, minimumScaledPx: 5.5 },
    { name: 'sound caption', selector: '#audioCaption span', minimumCssPx: 14, minimumScaledPx: 7, allowHidden: true },
  ];
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
  };
  const entries = [];
  const missing = [];
  for (const target of targets) {
    const elements = [...document.querySelectorAll(target.selector)];
    if (!elements.length) missing.push({ name: target.name, selector: target.selector });
    for (const [index, element] of elements.entries()) {
      const isVisible = visible(element);
      if (!isVisible && !target.allowHidden) continue;
      const style = getComputedStyle(element);
      const cssFontPx = Number.parseFloat(style.fontSize);
      const rect = element.getBoundingClientRect();
      const clipsX = /(hidden|clip|auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      const clipsY = /(hidden|clip|auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      const clipped = isVisible && (clipsX || clipsY);
      entries.push({
        name: target.name,
        index,
        selector: target.selector,
        text: (element.textContent || '').trim().slice(0, 100),
        visible: isVisible,
        cssFontPx,
        scaledFontPx: cssFontPx * outputScale,
        minimumCssPx: target.minimumCssPx,
        minimumScaledPx: target.minimumScaledPx,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        overflow: { x: style.overflowX, y: style.overflowY },
        client: { width: element.clientWidth, height: element.clientHeight },
        scroll: { width: element.scrollWidth, height: element.scrollHeight },
        clipped,
      });
    }
  }
  const failures = [
    ...missing.map(item => ({ ...item, reason: 'missing' })),
    ...entries.filter(entry => entry.cssFontPx < entry.minimumCssPx || entry.scaledFontPx < entry.minimumScaledPx || entry.clipped)
      .map(entry => ({ ...entry, reason: entry.clipped ? 'clipped' : 'too-small' })),
  ];
  return { outputScale, expectedOutput: [640, 360], entries, failures };
})()`;

const reducedMotionExpression = `(() => {
  const selectors = ['.rain','.far-fog','.mid-fog','.warden','.room-wipe'];
  const timings = selectors.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, missing: true };
    const style = getComputedStyle(element);
    return { selector, animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
  });
  return { mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches, timings };
})()`;

const reducedMotionCompleteProbes = [
  { beat: "seal-warden:complete", selector: ".containment-sigil", signature: "sealed-sigil" },
  { beat: "open-roof:complete", selector: ".roof-beacon", signature: "roof-dawn" },
  { beat: "open-ambulance:complete", selector: ".tunnel-gate", signature: "open-tunnel" },
];

const overlayExpression = `(() => {
  const alpha = (color) => {
    const match = color.match(/rgba?\\(([^)]+)\\)/);
    if (!match) return 1;
    const parts = match[1].split(',').map((part) => part.trim());
    return parts.length === 4 ? Number(parts[3]) : 1;
  };
  const html = getComputedStyle(document.documentElement).backgroundColor;
  const body = getComputedStyle(document.body).backgroundColor;
  const app = getComputedStyle(document.querySelector('#app')).backgroundColor;
  const overlay = getComputedStyle(document.querySelector('#overlay')).backgroundColor;
  return { colors: { html, body, app, overlay }, transparent: [html, body, app, overlay].every((color) => alpha(color) === 0) };
})()`;

function resultValue(evaluation) {
  return evaluation?.result?.value;
}

async function waitForExpression(expression, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const evaluation = await cdp.send("Runtime.evaluate", { expression: `Boolean(${expression})`, returnByValue: true });
    if (resultValue(evaluation)) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for page condition: ${expression}`);
}

async function navigateAndWait(url) {
  let lastError;
  const ready = `location.href === ${JSON.stringify(url)} && document.readyState === "complete" && document.querySelector("#app")`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const navigation = await cdp.send("Page.navigate", { url });
      if (navigation.errorText) throw new Error(navigation.errorText);
      await waitForExpression(ready);
      return;
    } catch (error) {
      lastError = error;
      await cdp.send("Page.stopLoading").catch(() => {});
      await delay(150);
    }
  }
  throw new Error(`Unable to load visual-QA fixture ${url}: ${lastError?.message || lastError}`);
}

function sanitizeName(name) {
  return name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function stopChildProcess(child) {
  if (!child) return;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    await Promise.race([new Promise(resolveExit => killer.once("exit", resolveExit)), delay(5000)]);
    return;
  }
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
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

const cameraScenarioMap = {
  intake: ["lobby-wide", "records-desk", "locker-close"],
  surgery: ["corridor-wide", "door-approach", "threshold"],
  theatre: ["theatre-wide", "lamp-array", "restraint-table"],
  generator: ["generator-wide", "breaker-close", "service-stairs"],
  stairwell: ["landing-wide", "roof-exit", "ambulance-tunnel"],
};

const cameraScenarios = Object.entries(cameraScenarioMap).flatMap(([room, nodes]) => nodes.map(camera => ({
  name: `camera-${room}-${camera}`,
  width: 1280,
  height: 720,
  path: `/?fixture=camera-node&room=${room}&camera=${camera}`,
  kind: "geometry",
  waitMs: 800,
  expectedMode: "REHEARSAL",
})));

const scenarios = [
  { name: "gameplay-1920x1080", width: 1920, height: 1080, path: "/?autostart=rehearsal", kind: "geometry", waitMs: 1300, expectedMode: "SIMULATED" },
  { name: "gameplay-1600x900", width: 1600, height: 900, path: "/?autostart=rehearsal", kind: "geometry", waitMs: 1300, expectedMode: "SIMULATED" },
  { name: "gameplay-1366x768", width: 1366, height: 768, path: "/?autostart=rehearsal", kind: "geometry", waitMs: 1300, expectedMode: "SIMULATED" },
  { name: "gameplay-1280x720", width: 1280, height: 720, path: "/?autostart=rehearsal", kind: "geometry", waitMs: 1300, expectedMode: "SIMULATED" },
  { name: "gameplay-twitch-player-50pct-640x360", width: 1280, height: 720, path: "/?autostart=rehearsal", kind: "geometry", waitMs: 1300, expectedMode: "SIMULATED", captureScale: 0.5, readabilityProbe: true },
  { name: "gameplay-compact-1280x720", width: 1280, height: 720, path: "/?autostart=rehearsal&hud=compact", kind: "geometry", waitMs: 1300, expectedMode: "SIMULATED" },
  { name: "gameplay-768x1024", width: 768, height: 1024, path: "/?autostart=rehearsal", kind: "geometry", waitMs: 1300, expectedMode: "SIMULATED" },
  { name: "gameplay-390x844", width: 390, height: 844, path: "/?autostart=rehearsal", kind: "geometry", waitMs: 1300, expectedMode: "SIMULATED" },
  { name: "warden-1280x720", width: 1280, height: 720, path: "/?fixture=warden-warning", kind: "geometry", waitMs: 4300, expectedMode: "REHEARSAL" },
  { name: "door-1280x720", width: 1280, height: 720, path: "/?fixture=surgery-door", kind: "geometry", waitMs: 1800, expectedMode: "REHEARSAL" },
  { name: "dashboard-1280x720", width: 1280, height: 720, path: "/?view=dashboard", kind: "geometry", waitMs: 1000, expectedMode: "SIMULATED" },
  { name: "dashboard-390x844", width: 390, height: 844, path: "/?view=dashboard", kind: "geometry", waitMs: 1000, expectedMode: "SIMULATED" },
  { name: "overlay-1920x1080", width: 1920, height: 1080, path: "/?view=overlay", kind: "overlay", waitMs: 1000, expectedMode: "SIMULATED" },
  { name: "overlay-1280x720", width: 1280, height: 720, path: "/?view=overlay", kind: "overlay", waitMs: 1000, expectedMode: "SIMULATED" },
  ...cameraScenarios,
];

let staticServer;
let browserProcess;
let cdp;
let exitCode = 0;

try {
  staticServer = await startStaticServer();
  const appPort = staticServer.address().port;
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

  const consoleErrors = [];
  cdp.on("Runtime.exceptionThrown", (params) => consoleErrors.push(params.exceptionDetails?.text || "Runtime exception"));
  cdp.on("Log.entryAdded", ({ entry }) => {
    if (["error", "warning"].includes(entry?.level)) consoleErrors.push(`${entry.level}: ${entry.text}`);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserPath,
    browserVersion: browserVersion.Browser,
    protocolVersion: browserVersion["Protocol-Version"],
    app: `http://127.0.0.1:${appPort}`,
    artifactRoot,
    scenarios: [],
    reducedMotion: null,
    summary: { passed: 0, failed: 0, failures: [] },
  };

  for (const scenario of scenarios) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: scenario.width,
      height: scenario.height,
      deviceScaleFactor: 1,
      mobile: scenario.width <= 768,
      screenWidth: scenario.width,
      screenHeight: scenario.height,
    });
    await cdp.send("Emulation.setEmulatedMedia", { media: "screen", features: [] });
    await navigateAndWait(`http://127.0.0.1:${appPort}${scenario.path}`);
    if (/autostart=|fixture=/.test(scenario.path)) {
      await waitForExpression(`document.querySelector("#cinematicIntro")?.classList.contains("dismissed") && getComputedStyle(document.querySelector("#cinematicIntro")).display === "none"`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, scenario.waitMs));
    if (scenario.readabilityProbe) {
      await cdp.send("Runtime.evaluate", {
        expression: `(() => { const caption = document.querySelector('#audioCaption'); const text = caption?.querySelector('span'); if (caption && text) { document.body.dataset.captionSize = 'medium'; text.textContent = '[RIGHT] Warden breathing behind you'; caption.hidden = false; } return true; })()`,
        returnByValue: true,
      });
    }
    const geometry = resultValue(await cdp.send("Runtime.evaluate", { expression: geometryExpression, returnByValue: true }));
    const readability = scenario.readabilityProbe
      ? resultValue(await cdp.send("Runtime.evaluate", { expression: readabilityExpression, returnByValue: true }))
      : null;
    const overlay = scenario.kind === "overlay"
      ? resultValue(await cdp.send("Runtime.evaluate", { expression: overlayExpression, returnByValue: true }))
      : null;
    const screenshotOptions = { format: "png", fromSurface: true, captureBeyondViewport: false };
    if (scenario.captureScale) screenshotOptions.clip = { x: 0, y: 0, width: scenario.width, height: scenario.height, scale: scenario.captureScale };
    const screenshot = await cdp.send("Page.captureScreenshot", screenshotOptions);
    const screenshotPath = join(artifactRoot, `${sanitizeName(scenario.name)}.png`);
    const screenshotBuffer = Buffer.from(screenshot.data, "base64");
    const capturedSize = screenshotBuffer.length >= 24 && screenshotBuffer.subarray(1, 4).toString("ascii") === "PNG"
      ? [screenshotBuffer.readUInt32BE(16), screenshotBuffer.readUInt32BE(20)]
      : null;
    writeFileSync(screenshotPath, screenshotBuffer);

    const failures = [];
    if (geometry.horizontalOverflow > 1) failures.push(`horizontal overflow ${geometry.horizontalOverflow}px`);
    if (geometry.intersections.length) failures.push(`${geometry.intersections.length} functional zone intersection(s)`);
    if (scenario.width >= 851 && geometry.targetIntersections.length) failures.push(`${geometry.targetIntersections.length} HUD region(s) obscure the active world target`);
    if (geometry.offscreen.length) failures.push(`${geometry.offscreen.length} visible control(s) outside viewport`);
    if (geometry.clipped.length) failures.push(`${geometry.clipped.length} clipped functional container(s)`);
    if (geometry.mode !== `MODE: ${scenario.expectedMode}`) failures.push(`expected MODE: ${scenario.expectedMode}, found ${geometry.mode || "no visible mode label"}`);
    if (/LIVE TWITCH/.test(geometry.mode)) failures.push(`unverified page claims LIVE TWITCH: ${geometry.mode}`);
    if (scenario.path.includes("autostart=") && geometry.introVisible) failures.push("autostart left the cinematic intro blocking gameplay");
    if (overlay && !overlay.transparent) failures.push(`overlay root is not fully transparent`);
    if (readability?.failures.length) {
      failures.push(`${readability.failures.length} half-scale critical-text failure(s): ${readability.failures.map(item => `${item.name}:${item.reason}`).join(", ")}`);
    }
    if (scenario.captureScale) {
      const expectedSize = [Math.round(scenario.width * scenario.captureScale), Math.round(scenario.height * scenario.captureScale)];
      if (!capturedSize || capturedSize[0] !== expectedSize[0] || capturedSize[1] !== expectedSize[1]) {
        failures.push(`expected scaled screenshot ${expectedSize.join("x")}, found ${capturedSize?.join("x") || "unknown"}`);
      }
    }

    const scenarioResult = { ...scenario, screenshotPath, capturedSize, geometry, readability, overlay, failures };
    report.scenarios.push(scenarioResult);
    if (failures.length) {
      report.summary.failed++;
      report.summary.failures.push({ scenario: scenario.name, failures });
    } else report.summary.passed++;
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${appPort}/?fixture=warden-warning` });
  await new Promise((resolveWait) => setTimeout(resolveWait, 900));
  const reducedMotion = resultValue(await cdp.send("Runtime.evaluate", { expression: reducedMotionExpression, returnByValue: true }));
  const reducedMotionCapture = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const reducedMotionScreenshotPath = join(artifactRoot, "prefers-reduced-motion-1280x720.png");
  writeFileSync(reducedMotionScreenshotPath, Buffer.from(reducedMotionCapture.data, "base64"));
  const trivialMotion = value => String(value).split(",").every(part => Number.parseFloat(part) <= 0.001);
  const completeStates = [];
  for (const probe of reducedMotionCompleteProbes) {
    const state = resultValue(await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const scene = document.querySelector('#scene');
        const element = document.querySelector(${JSON.stringify(probe.selector)});
        if (!scene || !element) return { missing: true };
        scene.dataset.sceneBeat = ${JSON.stringify(probe.beat)};
        void scene.offsetWidth;
        const style = getComputedStyle(element);
        const before = getComputedStyle(element, '::before');
        const rect = element.getBoundingClientRect();
        return {
          missing: false,
          sceneBeat: scene.dataset.sceneBeat,
          opacity: Number(style.opacity),
          rect: { width: rect.width, height: rect.height },
          animationDuration: style.animationDuration,
          transitionDuration: style.transitionDuration,
          scale: style.scale,
          rotate: style.rotate,
          filter: style.filter,
          clipPath: style.clipPath,
          beforeBackgroundColor: before.backgroundColor,
          beforeAnimationDuration: before.animationDuration,
        };
      })()`,
      returnByValue: true,
    }));
    await delay(50);
    const completeCapture = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    const completeScreenshotPath = join(artifactRoot, `prefers-reduced-motion-${sanitizeName(probe.beat)}-1280x720.png`);
    writeFileSync(completeScreenshotPath, Buffer.from(completeCapture.data, "base64"));
    const stationary = !state?.missing
      && trivialMotion(state.animationDuration)
      && trivialMotion(state.transitionDuration)
      && trivialMotion(state.beforeAnimationDuration);
    const visible = !state?.missing && state.opacity >= 0.99 && state.rect.width > 0 && state.rect.height > 0;
    const signatureMatches = probe.signature === "sealed-sigil"
      ? Number.parseFloat(state?.scale) === 1 && (state?.rotate === "none" || Math.abs(Number.parseFloat(state?.rotate)) < 0.01) && state?.filter === "none"
      : probe.signature === "roof-dawn"
        ? Math.abs(Number.parseFloat(state?.rotate) + 5) < 0.01 && /255\D+255\D+255/.test(state?.beforeBackgroundColor || "")
        : /48%/.test(state?.clipPath || "");
    completeStates.push({ ...probe, ...state, stationary, visible, signatureMatches, screenshotPath: completeScreenshotPath, pass: stationary && visible && signatureMatches && state?.sceneBeat === probe.beat });
  }
  await cdp.send("Runtime.evaluate", { expression: "delete document.querySelector('#scene')?.dataset.sceneBeat", returnByValue: true });
  const motionFailure = !reducedMotion.mediaMatches
    || reducedMotion.timings.some((item) => !item.missing && (!trivialMotion(item.animationDuration) || !trivialMotion(item.transitionDuration)))
    || completeStates.some(state => !state.pass);
  report.reducedMotion = { ...reducedMotion, completeStates, screenshotPath: reducedMotionScreenshotPath, pass: !motionFailure };
  if (motionFailure) {
    report.summary.failed++;
    const failures = [];
    if (!reducedMotion.mediaMatches) failures.push("reduced-motion media query did not match");
    if (reducedMotion.timings.some((item) => !item.missing && (!trivialMotion(item.animationDuration) || !trivialMotion(item.transitionDuration)))) failures.push("animated world layers retain non-trivial motion");
    for (const state of completeStates.filter(item => !item.pass)) failures.push(`${state.beat} missing its visible stationary final-state signature`);
    report.summary.failures.push({ scenario: "prefers-reduced-motion", failures });
  } else report.summary.passed++;

  report.consoleErrors = [...new Set(consoleErrors)];
  if (report.consoleErrors.length) {
    report.summary.failed++;
    report.summary.failures.push({ scenario: "browser-console", failures: report.consoleErrors });
  }

  const reportPath = join(artifactRoot, "visual-qa-report.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, artifactRoot, summary: report.summary }, null, 2));
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
