import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(repoRoot, "dist");
const assetsRoot = join(distRoot, "assets");
const archivedSourceRoot = join(repoRoot, "art-source");
const sourceRoot = existsSync(archivedSourceRoot) ? archivedSourceRoot : assetsRoot;
const workRoot = resolve(repoRoot, "..", "..", "work", "image-optimization");
const profileRoot = join(workRoot, `.chrome-profile-${process.pid}`);
const shouldWrite = process.argv.includes("--write");
const thresholdBytes = Number(process.env.IMAGE_OPTIMIZE_THRESHOLD || 1_000_000);
const matchPattern = process.env.IMAGE_OPTIMIZE_MATCH || "";
const opaqueQuality = Number(process.env.IMAGE_WEBP_QUALITY || .94);
const alphaQuality = Number(process.env.IMAGE_WEBP_ALPHA_QUALITY || 1);
const browserCandidates = [
  process.env.QA_BROWSER,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);

if (!browserPath) {
  console.error("Image optimization requires Chrome or Edge. Set QA_BROWSER to an installed Chromium executable.");
  process.exit(2);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
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
        if (requestUrl.pathname === "/__optimizer__") {
          response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
          response.end("<!doctype html><meta charset=utf-8><title>Image optimizer</title>");
          return;
        }
        const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
        const servingSource = relativePath.startsWith("source/");
        const servingTarget = relativePath.startsWith("target/");
        const root = servingSource ? sourceRoot : servingTarget ? assetsRoot : distRoot;
        const stripped = servingSource ? relativePath.slice(7) : servingTarget ? relativePath.slice(7) : relativePath;
        const absolute = resolve(root, stripped);
        if (!absolute.startsWith(`${root}${sep}`) || !existsSync(absolute)) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
        const contentType = {
          ".png": "image/png",
          ".webp": "image/webp"
        }[extname(absolute).toLowerCase()] || "application/octet-stream";
        response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
        response.end(readFileSync(absolute));
      } catch (error) {
        response.writeHead(500);
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
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError || "no response"}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
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

  close() {
    this.socket?.close();
  }
}

function expressionForEncode(url) {
  return `(async () => {
    const image = new Image();
    image.src = ${JSON.stringify(url)};
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasTransparency = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) { hasTransparency = true; break; }
    }
    const selectedQuality = hasTransparency ? ${alphaQuality} : ${opaqueQuality};
    const encoded = canvas.toDataURL("image/webp", selectedQuality);
    return {
      encoded,
      width: canvas.width,
      height: canvas.height,
      hasTransparency,
      quality: selectedQuality,
      outputMime: encoded.slice(5, encoded.indexOf(";"))
    };
  })()`;
}

function expressionForCompare(sourceUrl, targetUrl) {
  return `(async () => {
    const load = async url => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      return { image, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const source = await load(${JSON.stringify(sourceUrl)});
    const target = await load(${JSON.stringify(targetUrl)});
    if (source.image.naturalWidth !== target.image.naturalWidth || source.image.naturalHeight !== target.image.naturalHeight) {
      return { dimensionMatch: false };
    }
    let squaredError = 0;
    let samples = 0;
    let alphaError = 0;
    let sourceTransparent = false;
    let targetTransparent = false;
    for (let index = 0; index < source.data.length; index += 4) {
      const sourceAlpha = source.data[index + 3];
      const targetAlpha = target.data[index + 3];
      if (sourceAlpha < 255) sourceTransparent = true;
      if (targetAlpha < 255) targetTransparent = true;
      alphaError += Math.abs(sourceAlpha - targetAlpha);
      if (sourceAlpha === 0 && targetAlpha === 0) continue;
      for (let channel = 0; channel < 3; channel++) {
        const sourceVisible = source.data[index + channel] * sourceAlpha / 255;
        const targetVisible = target.data[index + channel] * targetAlpha / 255;
        const difference = sourceVisible - targetVisible;
        squaredError += difference * difference;
        samples++;
      }
    }
    const mse = samples ? squaredError / samples : 0;
    return {
      dimensionMatch: true,
      width: source.image.naturalWidth,
      height: source.image.naturalHeight,
      sourceTransparent,
      targetTransparent,
      alphaMae: alphaError / (source.data.length / 4),
      psnr: mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse)
    };
  })()`;
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed");
  return response.result?.value;
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise(resolveExit => {
    child.once("exit", resolveExit);
    setTimeout(resolveExit, 3000);
  });
}

async function removeProfileWithRetries() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(profileRoot, { recursive: true, force: true });
      if (!existsSync(profileRoot)) return;
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  console.warn(`Unable to remove temporary browser profile: ${profileRoot}`);
}

const targets = walk(sourceRoot)
  .filter(file => extname(file).toLowerCase() === ".png" && statSync(file).size >= thresholdBytes)
  .filter(file => !matchPattern || relative(sourceRoot, file).split(sep).join("/").includes(matchPattern))
  .filter(file => !file.endsWith(`${sep}the-surgeon.png`))
  .sort((left, right) => statSync(right).size - statSync(left).size);

if (!targets.length) {
  console.log(JSON.stringify({ message: "No PNGs exceed the optimization threshold.", thresholdBytes }, null, 2));
  process.exit(0);
}

mkdirSync(workRoot, { recursive: true });
mkdirSync(profileRoot, { recursive: true });

let staticServer;
let browserProcess;
let cdp;
let exitCode = 0;

try {
  staticServer = await startStaticServer();
  const staticPort = staticServer.address().port;
  const debugPort = await freePort();
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileRoot}`,
    "about:blank"
  ], { stdio: "ignore" });

  const tabs = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
  const page = tabs.find(tab => tab.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("Chromium did not expose a page target");
  cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${staticPort}/__optimizer__` });
  for (let attempt = 0; attempt < 50; attempt++) {
    const locationResult = await cdp.send("Runtime.evaluate", { expression: "location.pathname", returnByValue: true });
    if (locationResult.result?.value === "/__optimizer__") break;
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }

  const results = [];
  for (const sourcePath of targets) {
    const sourceRelative = relative(sourceRoot, sourcePath).split(sep).join("/");
    const publicRelative = sourceRoot === archivedSourceRoot && sourceRelative.startsWith("base/") ? sourceRelative.slice(5) : sourceRelative;
    const targetRelative = publicRelative.replace(/\.png$/i, ".webp");
    const targetPath = join(assetsRoot, ...targetRelative.split("/"));
    const sourceUrl = `http://127.0.0.1:${staticPort}/source/${sourceRelative}`;
    const targetUrl = `http://127.0.0.1:${staticPort}/target/${targetRelative}?v=${Date.now()}`;
    const encoded = await evaluate(cdp, expressionForEncode(sourceUrl));
    if (encoded.outputMime !== "image/webp") throw new Error(`Chromium did not encode WebP for ${sourceRelative}`);
    const buffer = Buffer.from(encoded.encoded.slice(encoded.encoded.indexOf(",") + 1), "base64");
    if (shouldWrite) {
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, buffer);
    }

    let comparison = null;
    if (shouldWrite) comparison = await evaluate(cdp, expressionForCompare(sourceUrl, targetUrl));
    const sourceBytes = statSync(sourcePath).size;
    results.push({
      source: relative(repoRoot, sourcePath).split(sep).join("/"),
      target: relative(repoRoot, targetPath).split(sep).join("/"),
      width: encoded.width,
      height: encoded.height,
      sourceBytes,
      targetBytes: buffer.length,
      savedBytes: sourceBytes - buffer.length,
      reductionPercent: Number(((sourceBytes - buffer.length) / sourceBytes * 100).toFixed(1)),
      sourceTransparent: encoded.hasTransparency,
      quality: encoded.quality,
      comparison
    });
  }

  const summary = {
    mode: shouldWrite ? "write-and-verify" : "preview",
    opaqueQuality,
    alphaQuality,
    thresholdBytes,
    files: results.length,
    sourceBytes: results.reduce((sum, result) => sum + result.sourceBytes, 0),
    targetBytes: results.reduce((sum, result) => sum + result.targetBytes, 0),
    savedBytes: results.reduce((sum, result) => sum + result.savedBytes, 0)
  };
  summary.reductionPercent = Number((summary.savedBytes / summary.sourceBytes * 100).toFixed(1));
  const report = { generatedAt: new Date().toISOString(), summary, results };
  const reportPath = join(workRoot, "image-optimization-report.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, ...summary, results }, null, 2));

  const verificationFailure = shouldWrite && results.some(result =>
    !result.comparison?.dimensionMatch ||
    result.comparison.sourceTransparent !== result.comparison.targetTransparent ||
    result.comparison.alphaMae > .05 ||
    result.comparison.psnr < 35
  );
  if (verificationFailure) {
    console.error("One or more optimized assets failed the dimension, alpha, or PSNR quality gate.");
    exitCode = 1;
  }
} catch (error) {
  console.error(error?.stack || error);
  exitCode = 2;
} finally {
  cdp?.close();
  staticServer?.close();
  await stopChildProcess(browserProcess);
  await removeProfileWithRetries();
}

process.exit(exitCode);
