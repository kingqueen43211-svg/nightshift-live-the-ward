import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(repoRoot, "dist");
const artifactRoot = resolve(process.env.QA_A11Y_ARTIFACT_DIR || join(repoRoot, "..", "..", "work", "accessibility-browser-smoke"));
const profileRoot = join(artifactRoot, `.chrome-profile-${process.pid}`);
const reportPath = join(artifactRoot, "accessibility-browser-smoke-report.json");
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

const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

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

mkdirSync(artifactRoot, { recursive: true });
mkdirSync(profileRoot, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  browser: browserPath || null,
  browserVersion: null,
  app: null,
  methodology: {
    input: "Chromium CDP key events only for audited operation; no DOM click() calls",
    zoom: "640x360 CSS-pixel layout viewport at deviceScaleFactor 2, equivalent to 200% reflow of a 1280x720 canvas",
    contrast: "Computed foreground colors composited over computed solid background-color layers; image/gradient pixels remain a manual review gap",
  },
  checks: [],
  summary: { passed: 0, failed: 0 },
  consoleErrors: [],
};

let staticServer;
let browserProcess;
let cdp;
let appOrigin;
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
  if (!browserPath) throw new Error("Accessibility browser smoke requires Chrome or Edge. Set QA_BROWSER to an installed Chromium executable.");

  staticServer = await startStaticServer();
  appOrigin = `http://127.0.0.1:${staticServer.address().port}`;
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
  await cdp.send("Accessibility.enable");

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

  async function setViewport(width, height, deviceScaleFactor = 1) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor,
      mobile: false,
      screenWidth: width * deviceScaleFactor,
      screenHeight: height * deviceScaleFactor,
    });
    await cdp.send("Emulation.setEmulatedMedia", { media: "screen", features: [] });
  }

  async function navigate(path, readyExpression = `document.readyState === "complete" && document.querySelector("#app")`) {
    await cdp.send("Page.navigate", { url: `${appOrigin}${path}` });
    await waitFor(readyExpression);
    await delay(100);
  }

  const keyCodes = { Tab: 9, Enter: 13, Space: 32, Escape: 27, KeyP: 80 };
  async function press(code, { shift = false } = {}) {
    const key = code === "Space" ? " " : code === "KeyP" ? "p" : code;
    const modifiers = shift ? 8 : 0;
    const windowsVirtualKeyCode = keyCodes[code];
    const text = code === "Enter" ? "\r" : ["Space", "KeyP"].includes(code) ? key : undefined;
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      modifiers,
      windowsVirtualKeyCode,
      nativeVirtualKeyCode: windowsVirtualKeyCode,
      ...(text === undefined ? {} : { text, unmodifiedText: text })
    });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode });
    await delay(35);
  }

  async function activeInfo() {
    return evaluate(`(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const signature = element.id ? "#" + element.id
        : element.dataset.viewTarget ? '[data-view-target="' + element.dataset.viewTarget + '"]'
        : element.dataset.cameraNode ? '[data-camera-node="' + element.dataset.cameraNode + '"]'
        : element.dataset.action ? '[data-action="' + element.dataset.action + '"]'
        : element.dataset.trigger ? '[data-trigger="' + element.dataset.trigger + '"]'
        : element.tagName.toLowerCase() + ":" + (element.textContent || element.value || element.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 60);
      const hitX = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
      const hitY = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(hitX, hitY);
      return {
        signature,
        tag: element.tagName,
        label: (element.getAttribute("aria-label") || element.textContent || element.value || "").trim().replace(/\\s+/g, " ").slice(0, 100),
        focusVisible: element.matches(":focus-visible"),
        outline: { style: style.outlineStyle, width: parseFloat(style.outlineWidth) || 0, color: style.outlineColor },
        boxShadow: style.boxShadow,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        viewport: [innerWidth, innerHeight],
        unobscured: Boolean(hit && (hit === element || element.contains(hit) || hit.contains(element))),
      };
    })()`);
  }

  async function expectedTabOrder(anchorSelector = null) {
    return evaluate(`(() => {
      const signature = element => element.id ? "#" + element.id
        : element.dataset.viewTarget ? '[data-view-target="' + element.dataset.viewTarget + '"]'
        : element.dataset.cameraNode ? '[data-camera-node="' + element.dataset.cameraNode + '"]'
        : element.dataset.action ? '[data-action="' + element.dataset.action + '"]'
        : element.dataset.trigger ? '[data-trigger="' + element.dataset.trigger + '"]'
        : element.tagName.toLowerCase() + ":" + (element.textContent || element.value || element.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 60);
      const all = [...document.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.disabled && !element.closest("[inert]") && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
      const anchor = ${anchorSelector ? `document.querySelector(${JSON.stringify(anchorSelector)})` : "null"};
      if (!anchor) return all.map(signature);
      const after = all.filter(element => anchor.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
      const before = all.filter(element => !after.includes(element));
      return [...after, ...before].map(signature);
    })()`);
  }

  async function tabThrough(anchorSelector = null, { requireViewport = false } = {}) {
    const expected = await expectedTabOrder(anchorSelector);
    assert(expected.length > 0, "No tabbable controls were found");
    const actual = [];
    for (let index = 0; index < expected.length; index++) {
      await press("Tab");
      let info = await activeInfo();
      // Headless Chromium exposes BODY for one key step when focus wraps from
      // the last control to the first; real browser UI consumes that step.
      if (info.tag === "BODY" && expected[index] !== info.signature) {
        await press("Tab");
        info = await activeInfo();
      }
      actual.push(info);
      assert(info.signature === expected[index], `Tab order diverged at ${index + 1}: expected ${expected[index]}, found ${info.signature}`);
      assert(info.focusVisible, `${info.signature} did not match :focus-visible after keyboard traversal`);
      assert(info.outline.width >= 2 && info.outline.style !== "none", `${info.signature} focus outline is only ${info.outline.width}px/${info.outline.style}`);
      if (requireViewport) {
        const rect = info.rect;
        assert(rect.left >= -1 && rect.right <= info.viewport[0] + 1 && rect.top >= -1 && rect.bottom <= info.viewport[1] + 1,
          `${info.signature} stayed outside the viewport after keyboard focus: ${JSON.stringify(rect)}`);
        assert(info.unobscured, `${info.signature} is obscured at its center after keyboard focus`);
      }
    }
    return { count: actual.length, order: actual.map(item => item.signature), minimumOutlinePx: Math.min(...actual.map(item => item.outline.width)) };
  }

  async function focusUntil(selector, limit = 80) {
    for (let index = 0; index < limit; index++) {
      if (await evaluate(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`)) return activeInfo();
      await press("Tab");
    }
    throw new Error(`Keyboard traversal did not reach ${selector} within ${limit} Tab presses`);
  }

  async function capture(name) {
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    const screenshotPath = join(artifactRoot, name);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    return screenshotPath;
  }

  async function reflowSnapshot(rootSelector) {
    return evaluate(`(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const visible = element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > .01;
      };
      const selectors = [".mission", ".meters", ".player-loop", ".vote-panel", ".journal"];
      const zones = selectors.map(selector => {
        const element = root.querySelector(selector);
        if (!element || !visible(element)) return null;
        const rect = element.getBoundingClientRect();
        return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      }).filter(Boolean);
      const intersections = [];
      for (let a = 0; a < zones.length; a++) for (let b = a + 1; b < zones.length; b++) {
        const width = Math.min(zones[a].right, zones[b].right) - Math.max(zones[a].left, zones[b].left);
        const height = Math.min(zones[a].bottom, zones[b].bottom) - Math.max(zones[a].top, zones[b].top);
        if (width > 1 && height > 1) intersections.push({ first: zones[a].selector, second: zones[b].selector, width, height });
      }
      const controls = [...root.querySelectorAll("button,input,select,textarea,a[href]")].filter(visible);
      const horizontalClipping = controls.map(element => {
        const rect = element.getBoundingClientRect();
        return { name: element.id || element.dataset.action || element.dataset.cameraNode || element.textContent.trim().slice(0, 50), left: rect.left, right: rect.right };
      }).filter(item => item.left < -1 || item.right > innerWidth + 1);
      const scrollables = [root, ...root.querySelectorAll("*")].filter(element => {
        const style = getComputedStyle(element);
        return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      }).map(element => ({ selector: element.id ? "#" + element.id : "." + [...element.classList].join("."), clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      return {
        viewport: [innerWidth, innerHeight],
        devicePixelRatio,
        document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
        root: [root.scrollWidth, root.scrollHeight],
        zones,
        intersections,
        horizontalClipping,
        scrollables,
        visibleControls: controls.length,
      };
    })()`);
  }

  async function contrastAudit(selectors) {
    return evaluate(`(() => {
      const selectors = ${JSON.stringify(selectors)};
      const parse = value => {
        const match = String(value).match(/rgba?\\(([^)]+)\\)/i);
        if (!match) return null;
        const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
      };
      const over = (foreground, background) => {
        const alpha = foreground[3] + background[3] * (1 - foreground[3]);
        if (!alpha) return [0, 0, 0, 0];
        return [0, 1, 2].map(index => (foreground[index] * foreground[3] + background[index] * background[3] * (1 - foreground[3])) / alpha).concat(alpha);
      };
      const luminance = color => {
        const linear = color.slice(0, 3).map(channel => {
          const value = channel / 255;
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        });
        return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
      };
      const ratio = (first, second) => {
        const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
        return (values[0] + .05) / (values[1] + .05);
      };
      const visible = element => element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden";
      return selectors.map(selector => {
        const element = [...document.querySelectorAll(selector)].find(visible);
        if (!element) return { selector, missing: true };
        const chain = [];
        for (let node = element; node; node = node.parentElement) chain.unshift(node);
        let background = [0, 0, 0, 1];
        const backgroundImages = [];
        for (const node of chain) {
          const style = getComputedStyle(node);
          const layer = parse(style.backgroundColor);
          if (layer) background = over(layer, background);
          if (style.backgroundImage && style.backgroundImage !== "none") backgroundImages.push(style.backgroundImage.slice(0, 90));
        }
        const style = getComputedStyle(element);
        const foreground = over(parse(style.color), background);
        const fontSize = parseFloat(style.fontSize);
        const fontWeight = Number(style.fontWeight) || 400;
        const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const minimum = large ? 3 : 4.5;
        const contrast = ratio(foreground, background);
        return {
          selector,
          text: (element.textContent || element.value || "").trim().replace(/\\s+/g, " ").slice(0, 80),
          foreground: foreground.slice(0, 3).map(Math.round),
          background: background.slice(0, 3).map(Math.round),
          fontSize,
          fontWeight,
          minimum,
          ratio: Math.round(contrast * 100) / 100,
          pass: contrast + .001 >= minimum,
          backgroundImageLayers: backgroundImages.length,
        };
      });
    })()`);
  }

  await setViewport(1280, 720, 1);

  await check("intro dialog traps focus and starts entirely by keyboard", async () => {
    await navigate("/", `document.readyState === "complete" && document.activeElement === document.querySelector("#enterWard")`);
    const initial = await evaluate(`({ headerInert: document.querySelector("#appHeader").inert, mainInert: document.querySelector("#appMain").inert, dialog: document.querySelector("#cinematicIntro").getAttribute("role") })`);
    assert(initial.headerInert && initial.mainInert && initial.dialog === "dialog", "Intro did not isolate the application as a modal dialog");
    await press("Tab");
    assert((await activeInfo()).signature === "#enterWard", "Forward Tab escaped the intro dialog");
    await press("Tab", { shift: true });
    assert((await activeInfo()).signature === "#enterWard", "Reverse Tab escaped the intro dialog");
    await press("Enter");
    await waitFor(`document.querySelector("#cinematicIntro").classList.contains("dismissed") && document.activeElement === document.querySelector("#objective")`);
    return { ...initial, postStartFocus: (await activeInfo()).signature };
  });

  await check("gameplay Tab order is DOM-logical with a strong visible indicator", async () => {
    await navigate("/?autostart=rehearsal", `document.readyState === "complete" && document.querySelector("[data-action]") && document.activeElement === document.querySelector("#objective")`);
    const traversal = await tabThrough("#objective");
    assert(traversal.order.some(item => item.startsWith("[data-camera-node=")), "Camera controls were absent from keyboard order");
    assert(traversal.order.some(item => item.startsWith("[data-action=")), "Streamer actions were absent from keyboard order");
    assert(traversal.order.includes('[data-view-target="dashboard"]'), "Control-room navigation was absent from keyboard order");
    return traversal;
  });

  await check("Space activates a gameplay action without pointer input", async () => {
    await navigate("/?autostart=rehearsal", `document.readyState === "complete" && document.querySelector('[data-action="search-desk"]') && document.activeElement === document.querySelector("#objective")`);
    await focusUntil('[data-action="search-desk"]');
    await press("Space");
    await waitFor(`document.querySelector('[data-action="search-desk"]')?.classList.contains("completed")`);
    return evaluate(`({ completed: document.querySelector('[data-action="search-desk"]').classList.contains("completed"), progress: document.querySelector("#objectiveProgressTrack").getAttribute("aria-valuenow"), focus: document.activeElement.dataset.action })`);
  });

  await check("pause shortcut is keyboard-operable and preserves focus", async () => {
    await navigate("/?autostart=rehearsal", `document.readyState === "complete" && document.activeElement === document.querySelector("#objective")`);
    await press("KeyP");
    await waitFor(`/resume/i.test(document.querySelector("#gameplayPause").getAttribute("aria-label"))`);
    const paused = await evaluate(`({ label: document.querySelector("#gameplayPause").getAttribute("aria-label"), focus: document.activeElement.id })`);
    await press("Escape");
    await waitFor(`/pause/i.test(document.querySelector("#gameplayPause").getAttribute("aria-label"))`);
    const resumed = await evaluate(`({ label: document.querySelector("#gameplayPause").getAttribute("aria-label"), focus: document.activeElement.id })`);
    assert(paused.focus === "objective" && resumed.focus === "objective", "Pause or resume displaced keyboard focus");
    return { paused, resumed };
  });

  await check("control room is reachable and traversable using only Tab and Enter", async () => {
    await navigate("/?autostart=rehearsal", `document.readyState === "complete" && document.activeElement === document.querySelector("#objective")`);
    await focusUntil('[data-view-target="dashboard"]');
    await press("Enter");
    await waitFor(`document.querySelector("#app").dataset.view === "dashboard" && document.activeElement === document.querySelector("#dashboard h1")`);
    const traversal = await tabThrough("#dashboard h1");
    for (const required of ["#startShow", "#clientId", "#chatCommand", "#motionToggle", "#contrastToggle", "#audioVolume", "#advanceRoom"]) {
      assert(traversal.order.includes(required), `${required} was absent from the control-room Tab order`);
    }
    return traversal;
  });

  await check("Chromium accessibility tree has no unnamed focusable control", async () => {
    await navigate("/?view=dashboard");
    const tree = await cdp.send("Accessibility.getFullAXTree");
    const focusable = tree.nodes.filter(node => !node.ignored && node.properties?.some(property => property.name === "focusable" && property.value?.value === true));
    const unnamed = focusable.filter(node => !String(node.name?.value || "").trim()).map(node => node.role?.value || "unknown");
    assert(focusable.length >= 20, `Expected at least 20 focusable AX nodes, found ${focusable.length}`);
    assert(unnamed.length === 0, `Unnamed focusable AX nodes: ${unnamed.join(", ")}`);
    return { focusableNodes: focusable.length, unnamedFocusableNodes: unnamed.length, roles: [...new Set(focusable.map(node => node.role?.value))] };
  });

  const dashboardContrastSelectors = [
    ".brand small", ".nav:not(.active)", "#dashboard .panel p", "#dashboard .panel label",
    "#dashboard .fine", "#dashboard .panel button:not(.primary):not(.danger-btn)",
    "#dashboard .danger-btn", "#dashboard .primary", ".state-strip span", ".state-strip b",
    ".feed-item em", ".feed-item span", ".toggles label", "#clientId", "#chatCommand",
  ];

  await check("computed normal and high-contrast UI color pairs meet WCAG text ratios", async () => {
    await navigate("/?view=dashboard");
    const normal = await contrastAudit(dashboardContrastSelectors);
    const missing = normal.filter(item => item.missing);
    const failures = normal.filter(item => !item.missing && !item.pass);
    assert(missing.length === 0, `Missing contrast samples: ${missing.map(item => item.selector).join(", ")}`);
    assert(failures.length === 0, `Normal contrast failures: ${failures.map(item => `${item.selector} ${item.ratio}:1`).join(", ")}`);
    await focusUntil("#contrastToggle");
    await press("Space");
    await waitFor(`document.body.classList.contains("high-contrast")`);
    const highContrast = await contrastAudit(dashboardContrastSelectors);
    const highFailures = highContrast.filter(item => !item.missing && !item.pass);
    assert(highFailures.length === 0, `High-contrast failures: ${highFailures.map(item => `${item.selector} ${item.ratio}:1`).join(", ")}`);
    return {
      normal: { samples: normal.length, minimumRatio: Math.min(...normal.map(item => item.ratio)), results: normal },
      highContrast: { samples: highContrast.length, minimumRatio: Math.min(...highContrast.map(item => item.ratio)), results: highContrast },
    };
  });

  await setViewport(640, 360, 2);

  await check("200% zoom-equivalent intro reflows and remains keyboard reachable", async () => {
    await navigate("/", `document.readyState === "complete" && document.activeElement === document.querySelector("#enterWard")`);
    const info = await activeInfo();
    const layout = await evaluate(`(() => { const intro = document.querySelector("#cinematicIntro"); const button = document.querySelector("#enterWard").getBoundingClientRect(); return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, documentWidth: document.documentElement.scrollWidth, intro: [intro.clientHeight, intro.scrollHeight, getComputedStyle(intro).overflowY], button: { left: button.left, top: button.top, right: button.right, bottom: button.bottom } }; })()`);
    assert(layout.viewport[0] === 640 && layout.viewport[1] === 360 && layout.dpr === 2, `Unexpected zoom proxy metrics: ${JSON.stringify(layout)}`);
    assert(layout.documentWidth <= 641, `Intro has horizontal overflow at 200%: ${layout.documentWidth - 640}px`);
    assert(info.rect.left >= -1 && info.rect.right <= 641 && info.rect.top >= -1 && info.rect.bottom <= 361, `Focused Enter control is clipped at 200%: ${JSON.stringify(info.rect)}`);
    await press("Enter");
    await waitFor(`document.querySelector("#cinematicIntro").classList.contains("dismissed") && document.activeElement === document.querySelector("#objective")`);
    return layout;
  });

  await check("200% zoom-equivalent gameplay becomes one-dimensional scrollable reflow", async () => {
    await navigate("/?autostart=rehearsal", `document.readyState === "complete" && document.querySelector("[data-action]") && document.activeElement === document.querySelector("#objective")`);
    const layout = await reflowSnapshot("#gameplay");
    assert(layout.document[0] <= 641 && layout.root[0] <= 641, `Gameplay has horizontal overflow at 200%: document/root ${layout.document[0]}/${layout.root[0]}`);
    assert(layout.zones.length === 5, `Reflow hides a functional gameplay region: ${layout.zones.map(item => item.selector).join(", ")}`);
    assert(layout.intersections.length === 0, `Reflow regions overlap: ${JSON.stringify(layout.intersections)}`);
    assert(layout.horizontalClipping.length === 0, `Reflow controls clip horizontally: ${JSON.stringify(layout.horizontalClipping)}`);
    assert(layout.scrollables.some(item => item.scrollHeight > item.clientHeight), "Gameplay did not provide a vertical scroll region at 200%");
    const traversal = await tabThrough("#objective", { requireViewport: true });
    const screenshotPath = await capture("gameplay-200pct-640x360.png");
    return { layout, traversal, screenshotPath };
  });

  await check("200% zoom-equivalent control room preserves every keyboard control", async () => {
    await navigate("/?view=dashboard");
    await focusUntil("#startShow");
    await press("Enter");
    await waitFor(`document.querySelector("#app").dataset.view === "gameplay" && document.activeElement === document.querySelector("#objective")`);
    await focusUntil('[data-view-target="dashboard"]');
    await press("Enter");
    await waitFor(`document.querySelector("#app").dataset.view === "dashboard" && document.activeElement === document.querySelector("#dashboard h1")`);
    const layout = await reflowSnapshot("#dashboard");
    assert(layout.document[0] <= 641 && layout.root[0] <= 641, `Control room has horizontal overflow at 200%: document/root ${layout.document[0]}/${layout.root[0]}`);
    assert(layout.horizontalClipping.length === 0, `Control-room controls clip horizontally: ${JSON.stringify(layout.horizontalClipping)}`);
    assert(layout.scrollables.some(item => item.scrollHeight > item.clientHeight), "Control room did not retain vertical scrolling at 200%");
    const traversal = await tabThrough("#dashboard h1", { requireViewport: true });
    for (const required of ['[data-view-target="gameplay"]', '[data-view-target="dashboard"]', "#startShow", "#clientId", "#chatCommand", "#contrastToggle", "#advanceRoom"]) {
      assert(traversal.order.includes(required), `${required} was lost from 200% keyboard traversal: ${traversal.order.join(" → ")}`);
    }
    const screenshotPath = await capture("dashboard-200pct-640x360.png");
    return { layout, traversal, screenshotPath };
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
