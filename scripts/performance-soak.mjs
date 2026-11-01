import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = resolve(process.env.QA_PERF_ARTIFACT_DIR || join(repoRoot, "..", "..", "work", "performance-soak"));
const reportName = process.env.QA_PERF_REPORT_NAME || "performance-soak-report.json";
const reportPath = join(artifactRoot, reportName);
const profileRoot = join(artifactRoot, `.chrome-profile-${process.pid}-${Date.now()}`);
const measuredCycles = Number(process.env.QA_PERF_CYCLES || 8);
const warmupCycles = Number(process.env.QA_PERF_WARMUP_CYCLES || 1);
const sampleSettleMs = Number(process.env.QA_PERF_SAMPLE_SETTLE_MS || 4100);
const allowEagerColdStart = process.env.QA_PERF_ALLOW_EAGER_COLD_START === "1";
const browserCandidates = [
  process.env.QA_BROWSER,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);

if (!Number.isInteger(measuredCycles) || measuredCycles < 3) {
  console.error("QA_PERF_CYCLES must be an integer of at least 3.");
  process.exit(2);
}
if (!Number.isInteger(warmupCycles) || warmupCycles < 1) {
  console.error("QA_PERF_WARMUP_CYCLES must be an integer of at least 1.");
  process.exit(2);
}
if (!browserPath) {
  console.error("Performance soak requires Chrome or Edge. Set QA_BROWSER to an installed Chromium executable.");
  process.exit(2);
}

mkdirSync(artifactRoot, { recursive: true });
mkdirSync(profileRoot, { recursive: true });

function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createNetServer();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "no response"}`);
}

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "no response"}`);
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
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("CDP socket closed"));
      }
      this.pending.clear();
    });
    await new Promise((resolveOpen, rejectOpen) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", rejectOpen, { once: true });
    });
  }

  send(method, params = {}, timeoutMs = 20000) {
    const id = this.nextId++;
    return new Promise((resolveCall, rejectCall) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectCall(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
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
  if (!child) return true;
  if (child.exitCode !== null || child.signalCode !== null) return true;
  const exited = new Promise(resolveExit => child.once("exit", resolveExit));
  child.kill();
  if (await Promise.race([exited.then(() => true), delay(3000).then(() => false)])) return true;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    await Promise.race([new Promise(resolveExit => killer.once("exit", resolveExit)), delay(5000)]);
  } else child.kill("SIGKILL");
  await Promise.race([exited, delay(3000)]);
  return child.exitCode !== null || child.signalCode !== null;
}

async function removeProfileWithRetries() {
  const safeRoot = resolve(profileRoot);
  if (!safeRoot.startsWith(`${artifactRoot}${sep}`) || !basename(safeRoot).startsWith(".chrome-profile-")) {
    throw new Error(`Refusing to remove unexpected profile path: ${safeRoot}`);
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      rmSync(safeRoot, { recursive: true, force: true });
      if (!existsSync(safeRoot)) return true;
    } catch {}
    await delay(150);
  }
  return false;
}

function slope(values) {
  if (values.length < 2) return 0;
  const meanX = (values.length - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  return denominator ? numerator / denominator : 0;
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function bytesSummary(bytes) {
  return { bytes: Math.round(bytes), mebibytes: round(bytes / 1024 / 1024, 3) };
}

const report = {
  generatedAt: new Date().toISOString(),
  app: null,
  browser: { path: browserPath, version: null, protocolVersion: null },
  configuration: {
    warmupCycles,
    measuredCycles,
    relayEnabled: true,
    forcedGcBeforeSamples: true,
    sampleSettleMs,
    coldStartExceptionAllowed: allowEagerColdStart,
  },
  coldStart: null,
  warmup: [],
  cycles: [],
  samples: [],
  trends: null,
  network: { requests: 0, failed: [], httpErrors: [], relayPosts: 0 },
  console: { errors: [], warnings: [] },
  checks: [],
  cleanup: { browserExited: false, serverExited: false, profileRemoved: false },
  fatalError: null,
};

function check(name, pass, details = {}) {
  report.checks.push({ name, pass: Boolean(pass), details });
}

let browserProcess;
let serverProcess;
let pageCdp;
let browserCdp;
let appOrigin;
let networkPhase = "setup";
let lastNetworkAt = 0;
const requests = new Map();

try {
  const appPort = await freePort();
  appOrigin = `http://127.0.0.1:${appPort}`;
  report.app = appOrigin;
  serverProcess = spawn(process.execPath, [join(repoRoot, "scripts", "serve.mjs"), "--port", String(appPort)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  await waitForHttp(appOrigin);

  const debugPort = await freePort();
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--hide-scrollbars",
    "--window-size=1280,720",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileRoot}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  const browserVersion = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  report.browser.version = browserVersion.Browser;
  report.browser.protocolVersion = browserVersion["Protocol-Version"];
  browserCdp = new CdpClient(browserVersion.webSocketDebuggerUrl);
  await browserCdp.connect();

  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Unable to create browser target: ${targetResponse.status}`);
  const target = await targetResponse.json();
  pageCdp = new CdpClient(target.webSocketDebuggerUrl);
  await pageCdp.connect();
  await pageCdp.send("Page.enable");
  await pageCdp.send("Runtime.enable");
  await pageCdp.send("Log.enable");
  await pageCdp.send("Network.enable", { maxTotalBufferSize: 100 * 1024 * 1024 });
  await pageCdp.send("Performance.enable");
  await pageCdp.send("HeapProfiler.enable");
  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 720,
  });

  pageCdp.on("Runtime.exceptionThrown", params => {
    report.console.errors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "Runtime exception");
  });
  pageCdp.on("Runtime.consoleAPICalled", params => {
    if (!["error", "warning"].includes(params.type)) return;
    const text = (params.args || []).map(arg => arg.value ?? arg.description ?? "").join(" ") || `console.${params.type}`;
    report.console[params.type === "error" ? "errors" : "warnings"].push(text);
  });
  pageCdp.on("Log.entryAdded", ({ entry }) => {
    if (!entry || !["error", "warning"].includes(entry.level)) return;
    if (entry.url?.endsWith("/favicon.ico")) return;
    report.console[entry.level === "error" ? "errors" : "warnings"].push(entry.url ? `${entry.text} (${entry.url})` : entry.text);
  });
  pageCdp.on("Network.requestWillBeSent", params => {
    lastNetworkAt = Date.now();
    requests.set(params.requestId, {
      requestId: params.requestId,
      phase: networkPhase,
      url: params.request.url,
      method: params.request.method,
      resourceType: params.type,
      requestBytes: Number(params.request.headers?.["Content-Length"] || 0),
      startedAt: params.timestamp,
      status: null,
      mimeType: null,
      encodedDataLength: 0,
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      errorText: null,
    });
  });
  pageCdp.on("Network.responseReceived", params => {
    lastNetworkAt = Date.now();
    const request = requests.get(params.requestId);
    if (!request) return;
    request.status = params.response.status;
    request.mimeType = params.response.mimeType;
    request.fromDiskCache = Boolean(params.response.fromDiskCache);
    request.fromServiceWorker = Boolean(params.response.fromServiceWorker);
  });
  pageCdp.on("Network.loadingFinished", params => {
    lastNetworkAt = Date.now();
    const request = requests.get(params.requestId);
    if (request) request.encodedDataLength = params.encodedDataLength || 0;
  });
  pageCdp.on("Network.loadingFailed", params => {
    lastNetworkAt = Date.now();
    const request = requests.get(params.requestId);
    if (!request) return;
    request.failed = !params.canceled;
    request.errorText = params.errorText;
  });

  function resultValue(evaluation) {
    if (evaluation?.exceptionDetails) {
      throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text || "Browser evaluation failed");
    }
    return evaluation?.result?.value;
  }

  async function evaluate(expression) {
    return resultValue(await pageCdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    }));
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
      await delay(25);
    }
    throw new Error(`Timed out waiting for browser condition: ${expression}${lastError ? ` (${lastError.message})` : ""}`);
  }

  async function waitForNetworkIdle(quietMs = 350, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (lastNetworkAt && Date.now() - lastNetworkAt >= quietMs) return;
      await delay(25);
    }
    throw new Error(`Network did not become idle for ${quietMs}ms`);
  }

  async function click(selector) {
    const outcome = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return { ok: false, reason: "missing" };
      if (element.disabled) return { ok: false, reason: "disabled" };
      element.click();
      return { ok: true };
    })()`);
    if (!outcome?.ok) throw new Error(`Unable to click ${selector}: ${outcome?.reason || "unknown"}`);
  }

  function requestsForPhase(phase) {
    return [...requests.values()].filter(request => request.phase === phase);
  }

  function summarizeNetwork(phase) {
    const phaseRequests = requestsForPhase(phase);
    const transferred = phaseRequests.reduce((sum, request) => sum + request.encodedDataLength, 0);
    const relayPosts = phaseRequests.filter(request => request.method === "POST" && new URL(request.url).pathname === "/__nightshift/state");
    return {
      phase,
      requests: phaseRequests.length,
      transferred: bytesSummary(transferred),
      relayPosts: relayPosts.length,
      failed: phaseRequests.filter(request => request.failed).map(request => ({ url: request.url, error: request.errorText })),
      httpErrors: phaseRequests
        .filter(request => Number(request.status) >= 400 && new URL(request.url).pathname !== "/favicon.ico")
        .map(request => ({ url: request.url, status: request.status })),
    };
  }

  async function sample(label) {
    // Let the longest gameplay toast/caption timer and short Web Audio sources retire
    // before comparing like-for-like post-GC snapshots.
    await delay(sampleSettleMs);
    await pageCdp.send("HeapProfiler.collectGarbage", {}, 30000);
    await delay(60);
    const [heap, dom, performance, pageState] = await Promise.all([
      pageCdp.send("Runtime.getHeapUsage"),
      pageCdp.send("Memory.getDOMCounters"),
      pageCdp.send("Performance.getMetrics"),
      evaluate(`(() => ({
        view: document.querySelector('#app')?.dataset.view,
        room: document.querySelector('#dashRoom')?.textContent,
        status: document.querySelector('#dashStatus')?.textContent,
        endingOpen: document.querySelector('#ending')?.classList.contains('show'),
        attachedNodes: document.querySelectorAll('*').length,
        captionCount: window.__nightshiftSoak?.captions?.length || 0,
        latestCaption: window.__nightshiftSoak?.captions?.at(-1) || null,
        loadedImages: [...document.images].filter(image => image.currentSrc).map(image => new URL(image.currentSrc).pathname),
      }))()`),
    ]);
    const metrics = Object.fromEntries(performance.metrics.map(metric => [metric.name, metric.value]));
    let browserProcesses = [];
    let targets = [];
    try {
      const processResult = await browserCdp.send("SystemInfo.getProcessInfo");
      browserProcesses = (processResult.processInfo || []).map(process => ({ type: process.type, id: process.id, cpuTime: round(process.cpuTime || 0, 4) }));
      const targetResult = await browserCdp.send("Target.getTargets");
      targets = (targetResult.targetInfos || []).map(targetInfo => ({ type: targetInfo.type, url: targetInfo.url, attached: targetInfo.attached }));
    } catch (error) {
      browserProcesses = [{ unavailable: error.message }];
    }
    const result = {
      label,
      atMs: Date.now(),
      heap: {
        usedSize: heap.usedSize,
        totalSize: heap.totalSize,
        embedderHeapUsedSize: heap.embedderHeapUsedSize,
        backingStorageSize: heap.backingStorageSize,
      },
      dom: {
        documents: dom.documents,
        nodes: dom.nodes,
        jsEventListeners: dom.jsEventListeners,
      },
      performance: {
        JSHeapUsedSize: metrics.JSHeapUsedSize,
        JSHeapTotalSize: metrics.JSHeapTotalSize,
        Nodes: metrics.Nodes,
        LayoutCount: metrics.LayoutCount,
        RecalcStyleCount: metrics.RecalcStyleCount,
        TaskDuration: metrics.TaskDuration,
      },
      page: pageState,
      browserProcesses,
      targets,
    };
    report.samples.push(result);
    return result;
  }

  async function installCaptionProbe() {
    await evaluate(`(() => {
      const caption = document.querySelector('#audioCaption');
      window.__nightshiftSoak = { captions: [], installedAt: Date.now() };
      const record = () => {
        if (!caption || caption.hidden) return;
        const text = caption.querySelector('span')?.textContent?.trim();
        if (text && window.__nightshiftSoak.captions.at(-1)?.text !== text) {
          window.__nightshiftSoak.captions.push({ text, at: Date.now() });
        }
      };
      new MutationObserver(record).observe(caption, { attributes: true, childList: true, subtree: true, characterData: true });
      record();
      return true;
    })()`);
  }

  async function startEpisode() {
    const state = await evaluate(`({
      intro: !document.querySelector('#cinematicIntro').classList.contains('dismissed'),
      ending: document.querySelector('#ending').classList.contains('show')
    })`);
    if (state.ending) {
      await click("#restartEnding");
      await waitFor(`document.querySelector('#app')?.dataset.view === 'dashboard'`);
    }
    if (state.intro) await click("#enterWard");
    else await click("#startShow");
    await waitFor(`document.querySelector('#dashStatus')?.textContent === 'VOTING' && document.querySelector('[data-action]')`);
    await evaluate(`(() => {
      const motion = document.querySelector('#motionToggle');
      motion.checked = true;
      motion.dispatchEvent(new Event('change', { bubbles: true }));
      const mute = document.querySelector('#audioMuteToggle');
      mute.checked = true;
      mute.dispatchEvent(new Event('change', { bubbles: true }));
      mute.checked = false;
      mute.dispatchEvent(new Event('change', { bubbles: true }));
      const volume = document.querySelector('#audioVolume');
      volume.value = '64';
      volume.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
  }

  async function runCampaign(cycleLabel, cycleIndex) {
    const startedAt = Date.now();
    const captionStart = await evaluate(`window.__nightshiftSoak?.captions?.length || 0`);
    await startEpisode();
    const roomTrace = [];
    const voteByRoom = {
      "Reception / Triage": cycleIndex % 2 ? "!records" : "!noise",
      "Ward 06": cycleIndex % 3 ? "!restore" : "!dark",
      "Operating Theatre": cycleIndex % 3 === 1 ? "!release" : "!tape",
      "Generator Room": "!charge",
      "Stairwell / Exits": "!roof",
    };
    const events = ["follow", "subscribe", "cheer", "raid"];

    for (let roomIndex = 0; roomIndex < 5; roomIndex++) {
      const room = await evaluate(`document.querySelector('#dashRoom')?.textContent`);
      const cameras = await evaluate(`[...document.querySelectorAll('#cameraRail [data-camera-node]')].map(button => button.dataset.cameraNode)`);
      for (const camera of cameras) {
        await click(`#cameraRail [data-camera-node="${camera}"]`);
        await waitFor(`![...document.querySelectorAll('#cameraRail [data-camera-node]')].some(button => button.disabled)`, 3000);
      }

      let actions = await evaluate(`[...document.querySelectorAll('#actionTray [data-action]')].map(button => button.dataset.action)`);
      if (room === "Generator Room") actions = ["breaker-2", "breaker-1", "breaker-3", "reroute-power"];
      if (room === "Stairwell / Exits") actions = actions.filter(action => action === "seal-warden");
      for (const action of actions) {
        await click(`#actionTray [data-action="${action}"]`);
        await delay(8);
      }

      const command = voteByRoom[room];
      if (!command) throw new Error(`No soak vote configured for ${room}`);
      await evaluate(`(() => {
        const input = document.querySelector('#chatCommand');
        input.value = ${JSON.stringify(command)};
        document.querySelector('#sendChat').click();
        document.querySelector('[data-trigger="${events[(cycleIndex + roomIndex) % events.length]}"]').click();
        return true;
      })()`);
      const voteCount = await evaluate(`document.querySelector('#viewerCount')?.textContent`);
      roomTrace.push({ room, cameras, actions, command, voteCount });

      const currentRoom = room;
      await click("#advanceRoom");
      if (roomIndex === 4) {
        await waitFor(`document.querySelector('#dashStatus')?.textContent === "CONSEQUENCE"`, 5000);
        await click('[data-view-target="gameplay"]');
        await click('[data-action="open-roof"]');
        await waitFor(`document.querySelector('#ending')?.classList.contains('show')`, 5000);
      } else {
        await waitFor(`document.querySelector('#dashRoom')?.textContent !== ${JSON.stringify(currentRoom)} || document.querySelector('#dashStatus')?.textContent === "CONSEQUENCE"`, 5000);
        const needsRecoveryAdvance = await evaluate(`document.querySelector('#dashRoom')?.textContent === ${JSON.stringify(currentRoom)}`);
        if (needsRecoveryAdvance) await click("#advanceRoom");
        await waitFor(`document.querySelector('#dashRoom')?.textContent !== ${JSON.stringify(currentRoom)}`, 5000);
      }
    }

    await waitForNetworkIdle(180, 10000);
    const result = await evaluate(`(() => ({
      ending: document.querySelector('#endingTitle')?.textContent,
      recap: [...document.querySelectorAll('#endingRecap span')].map(span => span.textContent.replace(/\\s+/g, ' ').trim()),
      captionCount: window.__nightshiftSoak?.captions?.length || 0,
      latestCaption: window.__nightshiftSoak?.captions?.at(-1) || null,
      loadedImages: [...document.images].filter(image => image.currentSrc).map(image => new URL(image.currentSrc).pathname),
    }))()`);
    if (!result.ending) throw new Error(`${cycleLabel} did not produce an ending`);
    if (result.captionCount <= captionStart) throw new Error(`${cycleLabel} did not exercise audio captions`);
    return {
      label: cycleLabel,
      durationMs: Date.now() - startedAt,
      captionDelta: result.captionCount - captionStart,
      roomTrace,
      ending: result.ending,
      recap: result.recap,
      latestCaption: result.latestCaption,
      loadedImages: result.loadedImages,
    };
  }

  networkPhase = "cold-start";
  lastNetworkAt = Date.now();
  // A full verify run launches several Chromium processes before this soak.
  // Give the first renderer handshake room to recover from transient Windows
  // process-start contention without weakening any subsequent readiness gate.
  await pageCdp.send("Page.navigate", { url: `${appOrigin}/?relay=local` }, 45000);
  await waitFor(`document.readyState === 'complete' && document.querySelector('#app')`);
  await waitForNetworkIdle(500);
  await installCaptionProbe();

  const coldRequests = requestsForPhase("cold-start");
  const coldGetResources = coldRequests
    .filter(request => request.method === "GET" && request.status === 200)
    .map(request => ({
      path: new URL(request.url).pathname,
      resourceType: request.resourceType,
      bytes: Math.round(request.encodedDataLength),
      mimeType: request.mimeType,
      fromDiskCache: request.fromDiskCache,
    }));
  const hiddenV3 = coldGetResources.filter(resource => resource.path.startsWith("/assets/v3/"));
  const coldNetwork = summarizeNetwork("cold-start");
  report.coldStart = {
    ...coldNetwork,
    resources: coldGetResources,
    hiddenV3Resources: hiddenV3,
    hiddenV3Transferred: bytesSummary(hiddenV3.reduce((sum, resource) => sum + resource.bytes, 0)),
  };
  check(
    "cold start defers hidden V3 scene art",
    hiddenV3.length === 0 || allowEagerColdStart,
    { allowedForBaselineCapture: allowEagerColdStart, resources: hiddenV3, transferred: report.coldStart.hiddenV3Transferred },
  );

  for (let index = 0; index < warmupCycles; index++) {
    const phase = `warmup-${index + 1}`;
    networkPhase = phase;
    const campaign = await runCampaign(phase, index);
    report.warmup.push({ ...campaign, network: summarizeNetwork(phase) });
  }

  const baseline = await sample("baseline-after-warmup");
  for (let index = 0; index < measuredCycles; index++) {
    const phase = `cycle-${index + 1}`;
    networkPhase = phase;
    const campaign = await runCampaign(phase, warmupCycles + index);
    const cycleSample = await sample(`${phase}-post-gc`);
    report.cycles.push({ ...campaign, network: summarizeNetwork(phase), sampleLabel: cycleSample.label });
  }

  // Take one campaign-free sample after the final cycle. Chromium can briefly
  // retain detached render nodes during a collection boundary; a real replay
  // leak remains present after this second settle/GC window, while that
  // transient does not become a flaky release failure.
  await sample("final-stabilized-post-gc");

  const measuredSamples = report.samples.slice(1);
  const finalSample = measuredSamples.at(-1);
  const heapValues = measuredSamples.map(sampleResult => sampleResult.heap.usedSize);
  const nodeValues = measuredSamples.map(sampleResult => sampleResult.dom.nodes);
  const listenerValues = measuredSamples.map(sampleResult => sampleResult.dom.jsEventListeners);
  const documentValues = measuredSamples.map(sampleResult => sampleResult.dom.documents);
  const relayValues = report.cycles.map(cycle => cycle.network.relayPosts);
  report.trends = {
    postGcHeap: {
      baseline: bytesSummary(baseline.heap.usedSize),
      final: bytesSummary(finalSample.heap.usedSize),
      delta: bytesSummary(finalSample.heap.usedSize - baseline.heap.usedSize),
      slopeBytesPerCycle: round(slope(heapValues), 1),
      min: bytesSummary(Math.min(...heapValues)),
      max: bytesSummary(Math.max(...heapValues)),
    },
    domNodes: {
      baseline: baseline.dom.nodes,
      final: finalSample.dom.nodes,
      delta: finalSample.dom.nodes - baseline.dom.nodes,
      slopePerCycle: round(slope(nodeValues), 3),
      min: Math.min(...nodeValues),
      max: Math.max(...nodeValues),
    },
    jsEventListeners: {
      baseline: baseline.dom.jsEventListeners,
      final: finalSample.dom.jsEventListeners,
      delta: finalSample.dom.jsEventListeners - baseline.dom.jsEventListeners,
      slopePerCycle: round(slope(listenerValues), 3),
      min: Math.min(...listenerValues),
      max: Math.max(...listenerValues),
    },
    documents: {
      baseline: baseline.dom.documents,
      final: finalSample.dom.documents,
      delta: finalSample.dom.documents - baseline.dom.documents,
      slopePerCycle: round(slope(documentValues), 3),
      min: Math.min(...documentValues),
      max: Math.max(...documentValues),
    },
    relayPosts: {
      perCycle: relayValues,
      slopePerCycle: round(slope(relayValues), 3),
      min: Math.min(...relayValues),
      max: Math.max(...relayValues),
    },
  };

  const heapDelta = finalSample.heap.usedSize - baseline.heap.usedSize;
  const heapBudget = Math.max(8 * 1024 * 1024, baseline.heap.usedSize * .75);
  check("post-GC JavaScript heap remains bounded", heapDelta <= heapBudget && slope(heapValues) <= 1024 * 1024, {
    delta: bytesSummary(heapDelta),
    budget: bytesSummary(heapBudget),
    slopeBytesPerCycle: report.trends.postGcHeap.slopeBytesPerCycle,
  });
  check("DOM documents and nodes remain bounded", finalSample.dom.documents - baseline.dom.documents <= 1 && finalSample.dom.nodes - baseline.dom.nodes <= 120 && slope(nodeValues) <= 20, {
    documents: report.trends.documents,
    nodes: report.trends.domNodes,
  });
  check("JavaScript event listeners remain bounded", finalSample.dom.jsEventListeners - baseline.dom.jsEventListeners <= 60 && slope(listenerValues) <= 10, report.trends.jsEventListeners);
  check("relay request rate remains bounded", Math.max(...relayValues) <= 180 && slope(relayValues) <= 8, report.trends.relayPosts);
  check("campaign exercise covered camera, vote, transitions, and captions", report.cycles.every(cycle => cycle.roomTrace.length === 5 && cycle.roomTrace.every(room => room.cameras.length >= 3) && cycle.captionDelta > 0), {
    measuredCampaigns: report.cycles.length,
    rooms: report.cycles.reduce((sum, cycle) => sum + cycle.roomTrace.length, 0),
    captions: report.cycles.reduce((sum, cycle) => sum + cycle.captionDelta, 0),
  });

  const allRequests = [...requests.values()];
  report.network.requests = allRequests.length;
  report.network.relayPosts = allRequests.filter(request => request.method === "POST" && new URL(request.url).pathname === "/__nightshift/state").length;
  report.network.failed = allRequests.filter(request => request.failed).map(request => ({ phase: request.phase, url: request.url, error: request.errorText }));
  report.network.httpErrors = allRequests
    .filter(request => Number(request.status) >= 400 && new URL(request.url).pathname !== "/favicon.ico")
    .map(request => ({ phase: request.phase, url: request.url, status: request.status }));
  report.console.errors = [...new Set(report.console.errors.filter(Boolean))];
  report.console.warnings = [...new Set(report.console.warnings.filter(Boolean))];
  check("network completes without failures or HTTP errors", report.network.failed.length === 0 && report.network.httpErrors.length === 0, {
    failed: report.network.failed,
    httpErrors: report.network.httpErrors,
  });
  check("browser console remains clean", report.console.errors.length === 0 && report.console.warnings.length === 0, report.console);
} catch (error) {
  report.fatalError = error?.stack || String(error);
} finally {
  try { await pageCdp?.send("Browser.close", {}, 5000); } catch {}
  pageCdp?.close();
  browserCdp?.close();
  report.cleanup.browserExited = await stopChildProcess(browserProcess);
  report.cleanup.serverExited = await stopChildProcess(serverProcess);
  try { report.cleanup.profileRemoved = await removeProfileWithRetries(); }
  catch (error) {
    report.cleanup.profileRemoved = false;
    report.cleanup.profileError = error.message;
  }
  check("Chromium and local server processes exit", report.cleanup.browserExited && report.cleanup.serverExited, report.cleanup);
  check("temporary Chromium profile is removed", report.cleanup.profileRemoved && !existsSync(profileRoot), { profileRoot, exists: existsSync(profileRoot) });

  const passed = report.checks.filter(result => result.pass).length;
  const failed = report.checks.filter(result => !result.pass).length + (report.fatalError ? 1 : 0);
  report.summary = { passed, failed, total: passed + failed, durationMs: report.samples.length ? Date.now() - report.samples[0].atMs : null };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, summary: report.summary, trends: report.trends, cleanup: report.cleanup, fatalError: report.fatalError }, null, 2));
  process.exitCode = failed ? 1 : 0;
}
