import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = resolve(process.env.QA_RELAY_ARTIFACT_DIR || join(repoRoot, "..", "..", "work", "relay-browser-smoke"));
const browserCandidates = [
  process.env.QA_BROWSER,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);

if (!browserPath) {
  console.error("Relay browser smoke requires Chrome or Edge. Set QA_BROWSER to an installed Chromium executable.");
  process.exit(2);
}

mkdirSync(artifactRoot, { recursive: true });

function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
      const response = await fetch(url);
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

async function waitForCondition(predicate, description, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`);
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
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolveExit => child.once("exit", resolveExit));
  child.kill();
  if (await Promise.race([exited.then(() => true), delay(3000).then(() => false)])) return;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    await Promise.race([new Promise(resolveExit => killer.once("exit", resolveExit)), delay(3000)]);
  } else child.kill("SIGKILL");
}

async function removeProfile(profileRoot) {
  const safeRoot = resolve(profileRoot);
  const expectedPrefix = `${artifactRoot}${sep}`;
  if (!safeRoot.startsWith(expectedPrefix) || !basename(safeRoot).startsWith(".chrome-profile-")) {
    throw new Error(`Refusing to remove unexpected profile path: ${safeRoot}`);
  }
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      rmSync(safeRoot, { recursive: true, force: true });
      if (!existsSync(safeRoot)) return;
    } catch {}
    await delay(120);
  }
  throw new Error(`Unable to remove temporary browser profile: ${safeRoot}`);
}

function resultValue(evaluation) {
  if (evaluation?.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text || "Browser evaluation failed");
  }
  return evaluation?.result?.value;
}

async function launchBrowser(label, appOrigin) {
  const debugPort = await freePort();
  const profileRoot = join(artifactRoot, `.chrome-profile-${label}-${process.pid}-${Date.now()}`);
  mkdirSync(profileRoot, { recursive: true });
  const child = spawn(browserPath, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--hide-scrollbars",
    "--window-size=1280,720",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileRoot}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  const browserVersion = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Unable to create ${label} browser target: ${targetResponse.status}`);
  const target = await targetResponse.json();
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 720,
  });

  const session = {
    label,
    appOrigin,
    process: child,
    profileRoot,
    browserVersion: browserVersion.Browser,
    cdp,
    consoleErrors: [],
    consoleWarnings: [],
    ignoredConsoleEntries: [],
    relayRequests: [],
    relayResponses: [],
    controllerMessages: [],
    faviconRequestIds: new Set(),
  };

  cdp.on("Runtime.exceptionThrown", params => {
    session.consoleErrors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "Runtime exception");
  });
  cdp.on("Runtime.consoleAPICalled", params => {
    if (!["error", "warning"].includes(params.type)) return;
    const text = (params.args || []).map(arg => arg.value ?? arg.description ?? "").join(" ");
    (params.type === "error" ? session.consoleErrors : session.consoleWarnings).push(text || `console.${params.type}`);
  });
  cdp.on("Log.entryAdded", ({ entry }) => {
    const detail = entry?.url ? `${entry.text} (${entry.url})` : entry?.text;
    if (entry?.url?.endsWith("/favicon.ico") || session.faviconRequestIds.has(entry?.networkRequestId)) {
      session.ignoredConsoleEntries.push(detail);
      return;
    }
    if (entry?.level === "error") session.consoleErrors.push(detail);
    if (entry?.level === "warning") session.consoleWarnings.push(detail);
  });
  cdp.on("Network.requestWillBeSent", params => {
    const url = params.request?.url || "";
    if (url.endsWith("/favicon.ico")) session.faviconRequestIds.add(params.requestId);
    if (!url.includes("/__nightshift/")) return;
    const request = { requestId: params.requestId, url, method: params.request.method, postData: params.request.postData || null };
    session.relayRequests.push(request);
    if (url.endsWith("/__nightshift/state") && request.method === "POST" && request.postData) {
      try { session.controllerMessages.push(JSON.parse(request.postData)); }
      catch {}
    }
  });
  cdp.on("Network.responseReceived", params => {
    const url = params.response?.url || "";
    if (url.includes("/__nightshift/")) session.relayResponses.push({ requestId: params.requestId, url, status: params.response.status, mimeType: params.response.mimeType });
  });

  return session;
}

async function evaluate(session, expression) {
  return resultValue(await session.cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  }));
}

async function navigate(session, path) {
  await session.cdp.send("Page.navigate", { url: `${session.appOrigin}${path}` });
  await waitForCondition(
    () => evaluate(session, `document.readyState === "complete" && Boolean(document.querySelector("#app"))`),
    `${session.label} app load`,
  );
}

async function capture(session, filename) {
  const shot = await session.cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const target = join(artifactRoot, filename);
  writeFileSync(target, Buffer.from(shot.data, "base64"));
  return target;
}

const relayObserverScript = `(() => {
  const NativeEventSource = globalThis.EventSource;
  globalThis.__nightshiftRelayMessages = [];
  globalThis.EventSource = class ObservedEventSource extends NativeEventSource {
    addEventListener(type, listener, options) {
      if (type !== "message" || typeof listener !== "function") return super.addEventListener(type, listener, options);
      const wrapped = function(event) {
        globalThis.__nightshiftRelayMessages.push(event.data);
        if (globalThis.__nightshiftRelayMessages.length > 200) globalThis.__nightshiftRelayMessages.shift();
        return listener.call(this, event);
      };
      return super.addEventListener(type, wrapped, options);
    }
  };
})()`;

const domSnapshotExpression = `(() => ({
  session: document.querySelector("#sessionId")?.textContent?.trim() || "",
  room: document.querySelector("#dashRoom")?.textContent?.trim() || "",
  status: document.querySelector("#dashStatus")?.textContent?.trim() || "",
  mode: document.querySelector("#modeLabel")?.textContent?.trim() || "",
  voteCount: document.querySelector("#viewerCount")?.textContent?.trim() || "",
  source: document.querySelector("#voteSource")?.textContent?.trim() || "",
  recent: document.querySelector("#overlayRecent")?.textContent?.trim() || "",
  options: [...document.querySelectorAll("#voteOptions .vote-option")].map(option => ({
    label: option.querySelector("b")?.textContent?.trim() || "",
    command: option.querySelector("small")?.textContent?.trim() || "",
    percent: option.querySelector("strong")?.textContent?.trim() || "",
  })),
  passiveClass: document.body.classList.contains("passive-mirror"),
  inert: document.querySelector("#app")?.inert === true,
  relayMessages: globalThis.__nightshiftRelayMessages?.length || 0,
}))()`;

function voteTotal(message) {
  return Object.values(message?.state?.votes || {}).reduce((sum, count) => sum + Number(count || 0), 0);
}

function sameVotes(first, second) {
  return JSON.stringify(first?.state?.votes || {}) === JSON.stringify(second?.state?.votes || {});
}

let serverProcess;
let controller;
let mirror;
let exitCode = 0;
const serverStdout = [];
const serverStderr = [];
const report = {
  generatedAt: new Date().toISOString(),
  browser: browserPath,
  artifactRoot,
  assertions: [],
  failures: [],
  evidence: {},
};

function record(name, pass, detail) {
  report.assertions.push({ name, pass, detail });
  if (!pass) report.failures.push({ name, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${detail}`);
  assert(pass, `${name}: ${detail}`);
}

try {
  const appPort = await freePort();
  const appOrigin = `http://127.0.0.1:${appPort}`;
  serverProcess = spawn(process.execPath, ["scripts/serve.mjs", "--port", String(appPort)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess.stdout.on("data", chunk => serverStdout.push(String(chunk)));
  serverProcess.stderr.on("data", chunk => serverStderr.push(String(chunk)));
  await waitForHttp(`${appOrigin}/`);

  controller = await launchBrowser("controller", appOrigin);
  mirror = await launchBrowser("mirror", appOrigin);
  record("separate browser processes", controller.process.pid !== mirror.process.pid, `controller PID ${controller.process.pid}; mirror PID ${mirror.process.pid}`);
  record("separate browser profiles", controller.profileRoot !== mirror.profileRoot, `${controller.profileRoot} != ${mirror.profileRoot}`);

  await mirror.cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: relayObserverScript });
  await navigate(mirror, "/?role=mirror&relay=local");
  await navigate(controller, "/?relay=local&autostart=rehearsal");

  await waitForCondition(() => controller.controllerMessages.length > 0, "controller relay publication");
  await waitForCondition(
    () => evaluate(mirror, `(globalThis.__nightshiftRelayMessages?.length || 0) > 0`),
    "mirror SSE delivery",
  );

  const initialControllerMessage = controller.controllerMessages.at(-1);
  await waitForCondition(
    () => evaluate(mirror, `globalThis.__nightshiftRelayMessages.some(raw => {
      try { const message = JSON.parse(raw); return message.state?.sessionId === ${JSON.stringify(initialControllerMessage.state.sessionId)}; }
      catch { return false; }
    })`),
    "matching controller session over SSE",
  );
  const initialMirrorDom = await evaluate(mirror, domSnapshotExpression);
  record("mirror is explicitly passive", initialMirrorDom.passiveClass && initialMirrorDom.inert, JSON.stringify({ passiveClass: initialMirrorDom.passiveClass, inert: initialMirrorDom.inert }));
  record(
    "SSE endpoint connected",
    mirror.relayResponses.some(response => response.url.endsWith("/__nightshift/events") && response.status === 200),
    JSON.stringify(mirror.relayResponses),
  );
  record(
    "controller publishes accepted state",
    controller.relayResponses.some(response => response.url.endsWith("/__nightshift/state") && response.status === 204),
    JSON.stringify(controller.relayResponses),
  );

  const beforeVote = voteTotal(controller.controllerMessages.at(-1));
  await evaluate(controller, `(() => {
    const input = document.querySelector("#chatCommand");
    input.value = "!records";
    document.querySelector("#sendChat").click();
    return true;
  })()`);
  const voteMessage = await waitForCondition(
    () => controller.controllerMessages.findLast(message => message.state?.roomIndex === 0 && voteTotal(message) > beforeVote),
    "controller vote publication",
  );
  const mirrorVoteRaw = await waitForCondition(
    () => evaluate(mirror, `globalThis.__nightshiftRelayMessages.findLast(raw => {
      try {
        const message = JSON.parse(raw);
        return message.state?.sessionId === ${JSON.stringify(voteMessage.state.sessionId)}
          && message.state?.roomIndex === 0
          && JSON.stringify(message.state?.votes) === ${JSON.stringify(JSON.stringify(voteMessage.state.votes))};
      } catch { return false; }
    }) || null`),
    "matching vote state over SSE",
  );
  const mirrorVoteMessage = JSON.parse(mirrorVoteRaw);
  record("session crosses process boundary", mirrorVoteMessage.state.sessionId === voteMessage.state.sessionId, voteMessage.state.sessionId);
  record("vote state crosses process boundary", sameVotes(mirrorVoteMessage, voteMessage), JSON.stringify(voteMessage.state.votes));
  const mirrorVoteDom = await evaluate(mirror, domSnapshotExpression);
  record("mirror renders relayed vote", Number.parseInt(mirrorVoteDom.voteCount, 10) === voteTotal(voteMessage), JSON.stringify(mirrorVoteDom));
  const syncedScreenshot = await capture(mirror, "mirror-synced-vote-1280x720.png");

  await evaluate(controller, `document.querySelector("#advanceRoom").click()`);
  const roomMessage = await waitForCondition(
    () => controller.controllerMessages.findLast(message => message.state?.sessionId === voteMessage.state.sessionId && message.state?.roomIndex === 1),
    "controller room transition publication",
    12000,
  );
  const mirrorRoomRaw = await waitForCondition(
    () => evaluate(mirror, `globalThis.__nightshiftRelayMessages.findLast(raw => {
      try {
        const message = JSON.parse(raw);
        return message.state?.sessionId === ${JSON.stringify(roomMessage.state.sessionId)} && message.state?.roomIndex === 1;
      } catch { return false; }
    }) || null`),
    "matching room state over SSE",
    12000,
  );
  const mirrorRoomMessage = JSON.parse(mirrorRoomRaw);
  record("room state crosses process boundary", mirrorRoomMessage.state.roomIndex === roomMessage.state.roomIndex, `roomIndex ${roomMessage.state.roomIndex}`);
  await waitForCondition(() => evaluate(mirror, `document.querySelector("#dashRoom")?.textContent?.trim() === "Ward 06"`), "mirror Ward 06 render");
  const beforePassive = await evaluate(mirror, domSnapshotExpression);
  const relayCountBeforePassive = beforePassive.relayMessages;

  controller.cdp.close();
  await stopChildProcess(controller.process);
  controller.process = null;
  await evaluate(mirror, `(() => {
    globalThis.__nightshiftOriginalDateNow = Date.now;
    const future = Date.now() + 60000;
    Date.now = () => future;
    return true;
  })()`);
  await delay(1600);
  const afterPassive = await evaluate(mirror, domSnapshotExpression);
  record("mirror does not publish", !mirror.relayRequests.some(request => request.url.endsWith("/__nightshift/state") && request.method === "POST"), JSON.stringify(mirror.relayRequests));
  record("mirror does not resolve an expired vote", afterPassive.status === "VOTING", `status stayed ${afterPassive.status}; source ${afterPassive.source}`);
  record(
    "mirror state stays immutable without controller input",
    afterPassive.session === beforePassive.session
      && afterPassive.room === beforePassive.room
      && afterPassive.voteCount === beforePassive.voteCount
      && afterPassive.recent === beforePassive.recent
      && JSON.stringify(afterPassive.options) === JSON.stringify(beforePassive.options),
    JSON.stringify({ before: beforePassive, after: afterPassive }),
  );
  record("no phantom relay messages after controller exit", afterPassive.relayMessages === relayCountBeforePassive, `${relayCountBeforePassive} -> ${afterPassive.relayMessages}`);

  const passiveScreenshot = await capture(mirror, "mirror-passive-expired-vote-1280x720.png");
  const allConsoleErrors = [...controller.consoleErrors, ...mirror.consoleErrors];
  const allConsoleWarnings = [...controller.consoleWarnings, ...mirror.consoleWarnings];
  record("no browser console errors", allConsoleErrors.length === 0, JSON.stringify(allConsoleErrors));
  record("no browser console warnings", allConsoleWarnings.length === 0, JSON.stringify(allConsoleWarnings));
  record("relay server stayed healthy", serverProcess.exitCode === null && serverStderr.join("").trim() === "", serverStderr.join("").trim() || "server running without stderr");

  report.evidence = {
    appOrigin,
    controller: {
      pid: controller.process?.pid || null,
      profileRoot: controller.profileRoot,
      browserVersion: controller.browserVersion,
      relayPosts: controller.relayRequests.filter(request => request.url.endsWith("/__nightshift/state")).length,
      consoleErrors: controller.consoleErrors,
      consoleWarnings: controller.consoleWarnings,
      ignoredConsoleEntries: controller.ignoredConsoleEntries,
    },
    mirror: {
      pid: mirror.process.pid,
      profileRoot: mirror.profileRoot,
      browserVersion: mirror.browserVersion,
      relayPosts: mirror.relayRequests.filter(request => request.url.endsWith("/__nightshift/state")).length,
      relayMessages: afterPassive.relayMessages,
      consoleErrors: mirror.consoleErrors,
      consoleWarnings: mirror.consoleWarnings,
      ignoredConsoleEntries: mirror.ignoredConsoleEntries,
    },
    synchronizedState: {
      sessionId: roomMessage.state.sessionId,
      roomIndex: roomMessage.state.roomIndex,
      votes: roomMessage.state.votes,
    },
    screenshots: [syncedScreenshot, passiveScreenshot],
    serverStdout: serverStdout.join("").trim(),
  };
} catch (error) {
  exitCode = 1;
  report.failures.push({ name: "harness", detail: error?.stack || String(error) });
  console.error(error?.stack || error);
} finally {
  mirror?.cdp?.close();
  controller?.cdp?.close();
  await stopChildProcess(mirror?.process);
  await stopChildProcess(controller?.process);
  await stopChildProcess(serverProcess);
  for (const profile of [controller?.profileRoot, mirror?.profileRoot].filter(Boolean)) {
    try { await removeProfile(profile); }
    catch (error) {
      exitCode = 1;
      report.failures.push({ name: "profile cleanup", detail: error.message });
    }
  }
  report.summary = {
    passed: report.assertions.filter(item => item.pass).length,
    failed: report.failures.length,
  };
  const reportPath = join(artifactRoot, "relay-browser-smoke-report.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, artifactRoot, summary: report.summary }, null, 2));
}

process.exit(exitCode);
