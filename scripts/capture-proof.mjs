import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = resolve(process.env.CAPTURE_PROOF_DIR || join(repoRoot, "..", "..", "work", "capture-proof"));
const profileRoot = join(artifactRoot, `.chrome-profile-${process.pid}`);
const stepDelayMs = Math.max(350, Number(process.env.CAPTURE_STEP_MS || 1150));
const sceneHoldMs = Math.max(0, Number(process.env.CAPTURE_SCENE_HOLD_MS || 24000));
const minimumCaptureMs = Math.max(60000, Number(process.env.CAPTURE_MINIMUM_MS || 300000));
const finalHoldMs = Math.max(1500, Number(process.env.CAPTURE_FINAL_HOLD_MS || 3200));
const operatorTimeoutMs = Math.max(30000, Number(process.env.CAPTURE_OPERATOR_TIMEOUT_MS || 300000));
const browserCandidates = [
  process.env.CAPTURE_BROWSER,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);

if (!browserPath) {
  console.error("Proof capture requires Chrome or Edge. Set CAPTURE_BROWSER to an installed Chromium executable.");
  process.exit(2);
}

mkdirSync(artifactRoot, { recursive: true });
mkdirSync(profileRoot, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const baseName = `nightshift-rehearsal-proof-${stamp}`;
const videoPath = join(artifactRoot, `${baseName}.webm`);
const manifestPath = join(artifactRoot, `${baseName}.json`);
const openingScreenshotPath = join(artifactRoot, `${baseName}-opening.png`);
const endingScreenshotPath = join(artifactRoot, `${baseName}-ending.png`);
const bindingName = "nightshiftProofChunk";

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

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "no response"}`);
}

async function waitForJson(url, timeoutMs = 15000) {
  const response = await waitForHttp(url, timeoutMs);
  return response.json();
}

async function waitForPageTarget(debugPort, appOrigin, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`, 1000);
      const target = targets.find(candidate => candidate.type === "page" && candidate.url.startsWith(appOrigin));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {}
    await delay(100);
  }
  throw new Error("Chrome opened, but the NightShift page target did not become available.");
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
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await Promise.race([new Promise(resolveExit => killer.once("exit", resolveExit)), delay(5000)]);
    return;
  }
  const exited = new Promise(resolveExit => child.once("exit", resolveExit));
  child.kill();
  if (await Promise.race([exited.then(() => true), delay(3000).then(() => false)])) return;
  child.kill("SIGKILL");
  await Promise.race([exited, delay(3000)]);
}

async function removeProfileWithRetries() {
  const safeProfile = resolve(profileRoot);
  const finalSegment = safeProfile.split(sep).at(-1) || "";
  if (!safeProfile.startsWith(`${artifactRoot}${sep}`) || !finalSegment.startsWith(".chrome-profile-")) {
    throw new Error(`Refusing to remove unexpected browser profile path: ${safeProfile}`);
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

function sourceCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function sourceWorktree() {
  const result = spawnSync("git", ["status", "--short"], { cwd: repoRoot, encoding: "utf8", windowsHide: true });
  const entries = result.status === 0 ? result.stdout.trim().split(/\r?\n/).filter(Boolean) : [];
  return { dirty: entries.length > 0, entries };
}

function recorderInjection() {
  return `(() => {
    if (window.__nightshiftProof) return { installed: true, reused: true };
    const send = payload => window[${JSON.stringify(bindingName)}](JSON.stringify(payload));
    const state = {
      status: "waiting-for-operator",
      startedAt: null,
      stoppedAt: null,
      bytes: 0,
      sequence: 0,
      mimeType: null,
      audioTrackCount: 0,
      videoTrackCount: 0,
      recorder: null,
      stream: null,
      queue: Promise.resolve(),
      captions: [],
      stop() {
        if (state.recorder?.state === "recording") {
          state.status = "stopping";
          state.recorder.stop();
          return true;
        }
        return false;
      }
    };
    window.__nightshiftProof = state;

    const style = document.createElement("style");
    style.textContent = \`
      #proofRecorderPrompt{position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;background:rgba(1,4,5,.94);font-family:system-ui,sans-serif;color:#eef8f4}
      #proofRecorderPrompt .proof-card{width:min(680px,90vw);padding:30px;border:1px solid #f4c477;background:#071012;box-shadow:0 24px 90px #000}
      #proofRecorderPrompt h1{margin:0 0 12px;font-size:26px;color:#f4c477}
      #proofRecorderPrompt p{line-height:1.55;color:#c5d5d1}
      #proofRecorderPrompt button{display:block;width:100%;margin-top:20px;padding:16px;border:0;background:#72e5d5;color:#03100e;font-weight:800;font-size:16px;cursor:pointer}
      #proofRecorderPrompt small{display:block;margin-top:14px;color:#f0959a}
      #proofRecorderWatermark{position:fixed;z-index:2147483646;right:4px;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;padding:8px 6px;border:1px solid rgba(244,196,119,.82);background:rgba(4,9,10,.86);color:#f4c477;font:700 9px ui-monospace,monospace;letter-spacing:.08em;pointer-events:none}
    \`;
    document.head.append(style);

    const watermark = document.createElement("div");
    watermark.id = "proofRecorderWatermark";
    watermark.textContent = "REHEARSAL PROOF · SIMULATED INPUT · NOT LIVE TWITCH";
    watermark.hidden = true;
    document.body.append(watermark);

    const prompt = document.createElement("section");
    prompt.id = "proofRecorderPrompt";
    prompt.innerHTML = \`<div class="proof-card"><h1>NightShift rehearsal proof recorder</h1><p>This records a <b>simulated rehearsal</b>, not real Twitch activity. Click below, choose <b>This Tab</b>, and keep <b>Share tab audio</b> enabled. The five-act run begins only after the browser confirms capture.</p><button type="button">Share this tab + audio and start</button><small>Canceling the picker produces a truthful failed manifest; it never fabricates evidence.</small></div>\`;
    document.body.append(prompt);

    const caption = document.querySelector("#audioCaption span");
    if (caption) {
      const rememberCaption = () => {
        const text = caption.textContent?.trim();
        if (text && state.captions.at(-1)?.text !== text) state.captions.push({ at: Date.now(), text });
      };
      new MutationObserver(rememberCaption).observe(caption, { childList: true, characterData: true, subtree: true });
    }

    const toBase64 = bytes => {
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return btoa(binary);
    };

    prompt.querySelector("button").addEventListener("click", async () => {
      const button = prompt.querySelector("button");
      button.disabled = true;
      button.textContent = "Waiting for browser share confirmation…";
      try {
        if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) throw new Error("This browser does not expose getDisplayMedia and MediaRecorder.");
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30, max: 30 } },
          audio: true,
          preferCurrentTab: true,
          selfBrowserSurface: "include",
          surfaceSwitching: "exclude"
        });
        const mimeType = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm"
        ].find(type => MediaRecorder.isTypeSupported(type)) || "";
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 3500000, audioBitsPerSecond: 128000 } : undefined);
        state.stream = stream;
        state.recorder = recorder;
        state.mimeType = recorder.mimeType || mimeType || "video/webm";
        state.audioTrackCount = stream.getAudioTracks().length;
        state.videoTrackCount = stream.getVideoTracks().length;
        recorder.addEventListener("dataavailable", event => {
          if (!event.data?.size) return;
          state.queue = state.queue.then(async () => {
            const bytes = new Uint8Array(await event.data.arrayBuffer());
            state.bytes += bytes.length;
            send({ kind: "chunk", sequence: state.sequence++, data: toBase64(bytes) });
          });
        });
        recorder.addEventListener("error", event => {
          state.status = "error";
          send({ kind: "error", message: event.error?.message || "MediaRecorder error" });
        });
        recorder.addEventListener("stop", async () => {
          await state.queue;
          state.status = "complete";
          state.stoppedAt = Date.now();
          send({
            kind: "done",
            mimeType: state.mimeType,
            audioTrackCount: state.audioTrackCount,
            videoTrackCount: state.videoTrackCount,
            bytes: state.bytes,
            durationMs: state.startedAt ? state.stoppedAt - state.startedAt : 0,
            captions: state.captions
          });
          for (const track of stream.getTracks()) track.stop();
        });
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (recorder.state === "recording") recorder.stop();
        });
        recorder.start(1000);
        state.status = "recording";
        state.startedAt = Date.now();
        prompt.hidden = true;
        watermark.hidden = false;
        send({
          kind: "started",
          mimeType: state.mimeType,
          audioTrackCount: state.audioTrackCount,
          videoTrackCount: state.videoTrackCount,
          displaySurface: stream.getVideoTracks()[0]?.getSettings?.().displaySurface || null
        });
      } catch (error) {
        state.status = "error";
        button.disabled = false;
        button.textContent = "Try sharing this tab again";
        send({ kind: "error", message: error?.message || String(error) });
      }
    });
    return { installed: true, reused: false };
  })()`;
}

if (process.argv.includes("--validate")) {
  // Compile the browser-side recorder payload without executing it. This catches
  // quoting/template regressions in addition to Node's ordinary syntax check.
  new Function(`return ${recorderInjection()};`);
  console.log("capture-proof validation passed (Node and recorder payload syntax)");
  process.exit(0);
}

let serverProcess;
let browserProcess;
let cdp;
let writeStream;
let writeStreamFinished;
let captureStartedAt;
let captureFinishedAt;
let recorderMetadata = null;
let automationResult = null;
let failure = null;
let bytesWritten = 0;
let chunkCount = 0;
let expectedSequence = 0;
let videoHash = createHash("sha256");
const milestones = [];
const consoleErrors = [];
const bindingErrors = [];

let resolveRecorderStarted;
let rejectRecorderStarted;
const recorderStarted = new Promise((resolveStart, rejectStart) => {
  resolveRecorderStarted = resolveStart;
  rejectRecorderStarted = rejectStart;
});
recorderStarted.catch(() => {});
let resolveRecorderDone;
let rejectRecorderDone;
const recorderDone = new Promise((resolveDone, rejectDone) => {
  resolveRecorderDone = resolveDone;
  rejectRecorderDone = rejectDone;
});
recorderDone.catch(() => {});

function mark(label, detail = {}) {
  const entry = {
    label,
    atMs: captureStartedAt ? Date.now() - captureStartedAt : null,
    ...detail,
  };
  milestones.push(entry);
  console.log(`[proof ${entry.atMs ?? "--"}ms] ${label}`);
  return entry;
}

try {
  const appPort = await freePort();
  const debugPort = await freePort();
  const appOrigin = `http://127.0.0.1:${appPort}`;
  const appUrl = `${appOrigin}/?proof=rehearsal`;

  serverProcess = spawn(process.execPath, [join(repoRoot, "scripts", "serve.mjs"), "--port", String(appPort)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let serverErrorText = "";
  serverProcess.stderr.on("data", chunk => { serverErrorText += String(chunk); });
  serverProcess.once("exit", code => {
    if (code && !failure) failure = new Error(`Local server exited with ${code}: ${serverErrorText.trim()}`);
  });
  await waitForHttp(appUrl);

  browserProcess = spawn(browserPath, [
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1280,800",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileRoot}`,
    "--new-window",
    appUrl,
  ], { stdio: "ignore", windowsHide: false });

  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const target = await waitForPageTarget(debugPort, appOrigin);
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Runtime.addBinding", { name: bindingName });

  cdp.on("Runtime.exceptionThrown", params => {
    consoleErrors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "Runtime exception");
  });
  cdp.on("Log.entryAdded", ({ entry }) => {
    if (["error", "warning"].includes(entry?.level)) consoleErrors.push(`${entry.level}: ${entry.text}`);
  });

  writeStream = createWriteStream(videoPath, { flags: "wx" });
  writeStreamFinished = new Promise((resolveFinish, rejectFinish) => {
    writeStream.once("finish", resolveFinish);
    writeStream.once("error", rejectFinish);
  });
  writeStreamFinished.catch(() => {});

  cdp.on("Runtime.bindingCalled", ({ name, payload }) => {
    if (name !== bindingName) return;
    try {
      const message = JSON.parse(payload);
      if (message.kind === "chunk") {
        if (message.sequence !== expectedSequence) bindingErrors.push(`Expected chunk ${expectedSequence}, received ${message.sequence}`);
        expectedSequence = message.sequence + 1;
        const buffer = Buffer.from(message.data, "base64");
        bytesWritten += buffer.length;
        chunkCount++;
        videoHash.update(buffer);
        writeStream.write(buffer);
      } else if (message.kind === "started") {
        captureStartedAt = Date.now();
        recorderMetadata = { ...message };
        resolveRecorderStarted(message);
      } else if (message.kind === "done") {
        captureFinishedAt = Date.now();
        recorderMetadata = { ...recorderMetadata, ...message };
        resolveRecorderDone(message);
      } else if (message.kind === "error") {
        const error = new Error(`Recorder: ${message.message}`);
        rejectRecorderStarted(error);
        rejectRecorderDone(error);
      }
    } catch (error) {
      bindingErrors.push(error.message);
    }
  });

  function resultValue(evaluation) {
    return evaluation?.result?.value;
  }

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
      await delay(75);
    }
    throw new Error(`Timed out waiting for browser condition: ${expression}${lastError ? ` (${lastError.message})` : ""}`);
  }

  async function click(selector) {
    const result = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return { ok: false, reason: "missing" };
      if (element.disabled) return { ok: false, reason: "disabled", text: element.textContent?.trim() };
      element.scrollIntoView({ block: "center", inline: "center" });
      element.click();
      return { ok: true, text: element.textContent?.trim() };
    })()`);
    assert(result?.ok, `Could not click ${selector}: ${result?.reason || "unknown"} ${result?.text || ""}`);
    return result;
  }

  async function pacedClick(selector, label, waitMs = stepDelayMs) {
    await click(selector);
    mark(label);
    await delay(waitMs);
  }

  async function selectCamera(node) {
    const selector = `[data-camera-node="${node}"]`;
    await waitFor(`document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`);
    await pacedClick(selector, `camera:${node}`, Math.max(stepDelayMs, 1150));
    await waitFor(`document.querySelector('#scene')?.dataset.cameraMoving === 'false'`);
    if (sceneHoldMs) {
      mark(`camera-hold:${node}`, { durationMs: sceneHoldMs });
      await delay(sceneHoldMs);
    }
  }

  async function castVisibleRehearsalVotes(command, desiredAccepted = 3) {
    await pacedClick('[data-view-target="dashboard"]', `dashboard:open for ${command}`, 500);
    let accepted = 0;
    let attempts = 0;
    while (accepted < desiredAccepted && attempts < 30) {
      attempts++;
      const result = await evaluate(`(() => {
        const input = document.querySelector('#chatCommand');
        const before = Number.parseInt(document.querySelector('#viewerCount')?.textContent || '0', 10) || 0;
        input.value = ${JSON.stringify(command)};
        document.querySelector('#sendChat').click();
        const after = Number.parseInt(document.querySelector('#viewerCount')?.textContent || '0', 10) || 0;
        return {
          before,
          after,
          toast: document.querySelector('#eventToast b')?.textContent,
          source: document.querySelector('#voteSource')?.textContent
        };
      })()`);
      assert(/REHEARSAL VOTE|SIMULATED INPUT/.test(result.source || ""), `Vote provenance was not rehearsal-labelled: ${result.source || "missing"}`);
      if (result.after > result.before) accepted++;
      await delay(80);
    }
    assert(accepted >= 1, `No visible rehearsal vote for ${command} was accepted.`);
    mark(`rehearsal-vote:${command}`, { accepted, attempts });
    await pacedClick('[data-view-target="gameplay"]', `gameplay:return from ${command}`, 500);
    return { command, accepted, attempts };
  }

  async function enterNextRoom(expectedRoom) {
    await pacedClick("#gameplayAdvance", `advance:${expectedRoom}`, 2900);
    await waitFor(`document.querySelector('#dashRoom')?.textContent === ${JSON.stringify(expectedRoom)}`, 6000);
    mark(`room:${expectedRoom}`);
  }

  async function screenshot(path) {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    writeFileSync(path, Buffer.from(shot.data, "base64"));
  }

  await waitFor("document.readyState === 'complete' && document.querySelector('#enterWard')");
  const installed = await evaluate(recorderInjection());
  assert(installed?.installed, "Recorder controls were not installed.");

  console.log("\nChrome is ready for a truthful rehearsal capture.");
  console.log("1. Click ‘Share this tab + audio and start’ in the NightShift tab.");
  console.log("2. In Chrome’s picker choose This Tab / the NightShift tab.");
  console.log("3. Keep Share tab audio enabled, then click Share.\n");

  const startTimeout = delay(operatorTimeoutMs).then(() => {
    throw new Error(`Operator did not start tab capture within ${operatorTimeoutMs}ms.`);
  });
  const started = await Promise.race([recorderStarted, startTimeout]);
  mark("capture:started", {
    audioTrackCount: started.audioTrackCount,
    videoTrackCount: started.videoTrackCount,
    displaySurface: started.displaySurface,
  });
  assert(started.videoTrackCount > 0, "The selected capture contains no video track.");

  await pacedClick("#enterWard", "episode:start", 1800);
  await waitFor(`document.querySelector('#dashStatus')?.textContent === 'VOTING'`);
  const provenance = await evaluate(`({
    mode: document.querySelector('#modeLabel')?.textContent,
    voteSource: document.querySelector('#voteSource')?.textContent,
    watermark: document.querySelector('#proofRecorderWatermark')?.textContent
  })`);
  assert(!/LIVE TWITCH/i.test(`${provenance.mode} ${provenance.voteSource}`), `Unexpected live-Twitch claim in rehearsal: ${JSON.stringify(provenance)}`);
  assert(/SIMULATED|REHEARSAL/i.test(`${provenance.mode} ${provenance.voteSource}`), `Rehearsal provenance missing: ${JSON.stringify(provenance)}`);
  await screenshot(openingScreenshotPath);

  const vote1 = await castVisibleRehearsalVotes("!records");
  await selectCamera("records-desk");
  await pacedClick('[data-action="search-desk"]', "act1:search-desk");
  await selectCamera("locker-close");
  await pacedClick('[data-action="open-locker"]', "act1:open-locker");
  await pacedClick('[data-action="reconstruct-file"]', "act1:reconstruct-file");
  await enterNextRoom("Ward 06");

  const vote2 = await castVisibleRehearsalVotes("!restore");
  await selectCamera("door-approach");
  await pacedClick('[data-action="inspect-gurney"]', "act2:inspect-gurney");
  await pacedClick('[data-action="listen-intercom"]', "act2:listen-intercom");
  await pacedClick('[data-action="hide-curtain"]', "act2:hide-curtain");
  const corridorVoteOpen = await evaluate(`document.querySelector('#dashStatus')?.textContent === 'VOTING'`);
  if (corridorVoteOpen) await pacedClick("#gameplayAdvance", "act2:resolve-corridor-vote", 900);
  await waitFor(`!document.querySelector('[data-action="force-door"]')?.classList.contains('locked')`);
  await selectCamera("threshold");
  await pacedClick('[data-action="force-door"]', "act2:force-door", 1900);
  await enterNextRoom("Operating Theatre");

  const vote3 = await castVisibleRehearsalVotes("!tape");
  await selectCamera("lamp-array");
  await pacedClick('[data-action="align-lamps"]', "act3:align-lamps");
  await pacedClick('[data-action="play-tape"]', "act3:play-tape");
  await selectCamera("restraint-table");
  await pacedClick('[data-action="counter-warden"]', "act3:counter-warden", 2100);
  await enterNextRoom("Generator Room");

  const vote4 = await castVisibleRehearsalVotes("!charge");
  await selectCamera("breaker-close");
  await pacedClick('[data-action="breaker-2"]', "act4:breaker-2");
  await pacedClick('[data-action="breaker-1"]', "act4:breaker-1");
  await pacedClick('[data-action="breaker-3"]', "act4:breaker-3");
  await pacedClick('[data-action="reroute-power"]', "act4:reroute-power");
  await enterNextRoom("Stairwell / Exits");

  const vote5 = await castVisibleRehearsalVotes("!roof");
  await selectCamera("ambulance-tunnel");
  await selectCamera("roof-exit");
  await pacedClick('[data-action="seal-warden"]', "act5:seal-warden", 1800);
  await pacedClick("#gameplayAdvance", "act5:resolve-final-vote", 900);
  await waitFor(`!document.querySelector('[data-action="open-roof"]')?.classList.contains('locked')`);
  await pacedClick('[data-action="open-roof"]', "act5:open-roof", 1800);
  await waitFor(`document.querySelector('#ending')?.classList.contains('show')`);

  automationResult = await evaluate(`(() => ({
    ending: document.querySelector('#endingTitle')?.textContent?.trim(),
    summary: document.querySelector('#endingSummary')?.textContent?.trim(),
    recap: [...document.querySelectorAll('#endingRecap span')].map(span => span.textContent.replace(/\\s+/g, ' ').trim()),
    finalVoteSource: document.querySelector('#voteSource')?.textContent?.trim(),
    captions: window.__nightshiftProof?.captions || [],
    recorderStatus: window.__nightshiftProof?.status
  }))()`);
  assert(automationResult.ending === "MARA WALKS INTO DAWN", `Expected MARA WALKS INTO DAWN, reached ${automationResult.ending || "no ending"}.`);
  assert(automationResult.recap.some(value => /FALLBACKS.*0/i.test(value)), "The recorded run used a director fallback.");
  assert(automationResult.recap.some(value => /WARDEN.*BOUND/i.test(value)), "The recorded ending did not bind the Warden.");
  mark("ending:MARA WALKS INTO DAWN", { recap: automationResult.recap });
  await screenshot(endingScreenshotPath);
  const remainingMinimumMs = Math.max(0, minimumCaptureMs - (Date.now() - captureStartedAt));
  const endingHoldMs = Math.max(finalHoldMs, remainingMinimumMs);
  mark("ending-hold", { durationMs: endingHoldMs, minimumCaptureMs });
  await delay(endingHoldMs);

  const stopRequested = await evaluate(`window.__nightshiftProof?.stop()`);
  assert(stopRequested, "The proof recorder was not in a stoppable recording state.");
  await Promise.race([
    recorderDone,
    delay(30000).then(() => { throw new Error("Timed out finalizing MediaRecorder output."); }),
  ]);
  writeStream.end();
  await writeStreamFinished;
  mark("capture:finalized", { bytesWritten, chunkCount });

  const voteEvidence = [vote1, vote2, vote3, vote4, vote5];
  automationResult.voteEvidence = voteEvidence;
} catch (error) {
  failure = error;
  console.error(`Proof capture failed: ${error.stack || error.message}`);
  try {
    if (cdp) await cdp.send("Runtime.evaluate", { expression: "window.__nightshiftProof?.stop?.()", awaitPromise: true, userGesture: true });
    if (captureStartedAt && !captureFinishedAt) {
      await Promise.race([recorderDone.catch(() => {}), delay(5000)]);
    }
  } catch {}
  if (writeStream && !writeStream.closed) writeStream.end();
  try { await writeStreamFinished; } catch {}
} finally {
  const videoExists = existsSync(videoPath);
  const videoSize = videoExists ? statSync(videoPath).size : 0;
  const audioPresent = Number(recorderMetadata?.audioTrackCount || 0) > 0;
  const expectedEnding = automationResult?.ending === "MARA WALKS INTO DAWN";
  const zeroFallbacks = Boolean(automationResult?.recap?.some(value => /FALLBACKS.*0/i.test(value)));
  const hasCaptions = Number(automationResult?.captions?.length || recorderMetadata?.captions?.length || 0) > 0;
  const worktree = sourceWorktree();
  const complete = !failure && videoSize > 0 && audioPresent && expectedEnding && zeroFallbacks && hasCaptions && bindingErrors.length === 0 && !worktree.dirty;
  const sha256 = videoSize > 0 ? videoHash.digest("hex") : null;
  const manifest = {
    schemaVersion: 1,
    title: "NightShift Live five-act rehearsal capture",
    status: complete ? "COMPLETE_REHEARSAL_PROOF" : "INCOMPLETE_OR_FAILED_REHEARSAL_PROOF",
    provenance: {
      mode: "REHEARSAL_SIMULATED_INPUT",
      liveTwitch: false,
      nativeObs: false,
      unfamiliarHumanPlaytest: false,
      statement: "This artifact records a local simulated rehearsal. It is not evidence of real Twitch activity, native OBS behavior, or an unfamiliar human playtest.",
    },
    source: {
      commit: sourceCommit(),
      worktree,
      capturedAt: new Date().toISOString(),
      browserPath,
      stepDelayMs,
      sceneHoldMs,
      minimumCaptureMs,
      finalHoldMs,
    },
    recording: {
      path: videoExists ? videoPath : null,
      bytes: videoSize,
      sha256,
      chunkCount,
      startedAt: captureStartedAt ? new Date(captureStartedAt).toISOString() : null,
      finishedAt: captureFinishedAt ? new Date(captureFinishedAt).toISOString() : null,
      durationMs: recorderMetadata?.durationMs || (captureStartedAt && captureFinishedAt ? captureFinishedAt - captureStartedAt : null),
      mimeType: recorderMetadata?.mimeType || null,
      audioTrackCount: recorderMetadata?.audioTrackCount ?? null,
      videoTrackCount: recorderMetadata?.videoTrackCount ?? null,
      displaySurface: recorderMetadata?.displaySurface ?? null,
    },
    screenshots: {
      opening: existsSync(openingScreenshotPath) ? openingScreenshotPath : null,
      ending: existsSync(endingScreenshotPath) ? endingScreenshotPath : null,
    },
    automation: automationResult,
    milestones,
    consoleErrors,
    bindingErrors,
    failure: failure ? { name: failure.name, message: failure.message, stack: failure.stack } : null,
    acceptance: {
      uninterruptedVideoBytes: videoSize > 0,
      tabAudioTrackPresent: audioPresent,
      captionEventsObserved: hasCaptions,
      earnedHumaneEnding: expectedEnding,
      zeroDirectorFallbacks: zeroFallbacks,
      cleanCommittedSource: !worktree.dirty,
      rehearsalProvenanceOnly: true,
    },
    doesNotProve: [
      "real Twitch OAuth or EventSub interoperability",
      "a separate viewer account",
      "native OBS Browser Source alpha or audio routing",
      "unfamiliar-human discoverability or pacing",
      "NVDA screen-reader output",
    ],
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nManifest: ${manifestPath}`);
  if (videoExists) console.log(`Video:    ${videoPath}`);
  console.log(`Status:   ${manifest.status}`);

  cdp?.close();
  await stopChildProcess(browserProcess);
  await stopChildProcess(serverProcess);
  try { await removeProfileWithRetries(); }
  catch (error) { console.error(error.message); }
  if (!complete) process.exitCode = 1;
}
