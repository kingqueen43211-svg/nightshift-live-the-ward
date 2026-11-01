import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidPublicState } from "../dist/public-state.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../dist");
const DEFAULT_PORT = 4173;
const MAX_RELAY_BYTES = 256 * 1024;
const MIME = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://api.twitch.tv https://id.twitch.tv wss://eventsub.wss.twitch.tv; frame-ancestors 'self'; form-action 'self'",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function readPort() {
  const index = process.argv.indexOf("--port");
  const raw = index >= 0 ? process.argv[index + 1] : process.env.PORT;
  const port = Number(raw || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return port;
}

function safeTarget(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relative = pathname.replace(/^\/+/, "") || "index.html";
  const target = resolve(ROOT, relative);
  return target === ROOT || target.startsWith(`${ROOT}${sep}`) ? target : null;
}

function cachePolicy(target) {
  const extension = extname(target).toLowerCase();
  if (extension === ".html") return "no-cache";
  if (target.includes(`${sep}assets${sep}`)) return "public, max-age=300, must-revalidate";
  if ([".css", ".js", ".mjs"].includes(extension)) return "public, max-age=300, must-revalidate";
  return "no-cache";
}

function respondText(response, status, body) {
  response.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

const relayClients = new Set();
let latestRelayMessage = null;

function relayHeaders(contentType) {
  return {
    ...SECURITY_HEADERS,
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  };
}

function isSameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  return Boolean(origin && host && origin === `http://${host}`);
}

function readRelayBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let bytes = 0;
    let tooLarge = false;
    request.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > MAX_RELAY_BYTES) tooLarge = true;
      else chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) rejectBody(Object.assign(new Error("State payload too large"), { status: 413 }));
      else resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", rejectBody);
  });
}

function broadcastRelay(serialized) {
  latestRelayMessage = serialized;
  for (const client of relayClients) {
    try { client.write(`data: ${serialized}\n\n`); }
    catch { relayClients.delete(client); }
  }
}

async function handleRelay(request, response, pathname) {
  if (pathname === "/__nightshift/events") {
    if (request.method !== "GET") { respondText(response, 405, "Method not allowed"); return true; }
    response.writeHead(200, {
      ...relayHeaders("text/event-stream; charset=utf-8"),
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.write("retry: 1500\n\n");
    if (latestRelayMessage) response.write(`data: ${latestRelayMessage}\n\n`);
    relayClients.add(response);
    request.on("close", () => relayClients.delete(response));
    return true;
  }
  if (pathname === "/__nightshift/state") {
    if (request.method !== "POST") { respondText(response, 405, "Method not allowed"); return true; }
    if (!isSameOrigin(request)) { respondText(response, 403, "Same-origin relay only"); return true; }
    if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      respondText(response, 415, "JSON required"); return true;
    }
    try {
      const message = JSON.parse(await readRelayBody(request));
      if (message?.type !== "state" || !isValidPublicState(message.state)) {
        respondText(response, 400, "Invalid state message"); return true;
      }
      broadcastRelay(JSON.stringify(message));
      response.writeHead(204, relayHeaders("text/plain; charset=utf-8"));
      response.end();
    } catch (error) {
      respondText(response, error.status || 400, error.message || "Invalid JSON");
    }
    return true;
  }
  return false;
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    respondText(response, 400, "Bad request");
    return;
  }

  let requestUrl;
  try { requestUrl = new URL(request.url, "http://localhost"); }
  catch { respondText(response, 400, "Bad request"); return; }

  if (await handleRelay(request, response, requestUrl.pathname)) return;

  if (!["GET", "HEAD"].includes(request.method || "")) {
    respondText(response, 405, "Method not allowed");
    return;
  }

  let target;
  try {
    target = safeTarget(request.url);
  } catch {
    respondText(response, 400, "Bad request");
    return;
  }
  if (!target) {
    respondText(response, 403, "Forbidden");
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("Not a file");
    const etag = `\"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}\"`;
    const headers = {
      ...SECURITY_HEADERS,
      "Cache-Control": cachePolicy(target),
      "Content-Length": info.size,
      "Content-Type": MIME.get(extname(target).toLowerCase()) || "application/octet-stream",
      ETag: etag,
    };
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, headers);
      response.end();
      return;
    }
    response.writeHead(200, headers);
    if (request.method === "HEAD") response.end();
    else createReadStream(target).pipe(response);
  } catch {
    respondText(response, 404, "Not found");
  }
});

const port = readPort();
server.listen(port, "127.0.0.1", () => {
  console.log(`NightShift Live ready at http://localhost:${port} (local OBS relay available)`);
});

const relayKeepalive = setInterval(() => {
  for (const client of relayClients) {
    try { client.write(": keepalive\n\n"); }
    catch { relayClients.delete(client); }
  }
}, 15000);
relayKeepalive.unref();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    clearInterval(relayKeepalive);
    for (const client of relayClients) client.end();
    server.close(() => process.exit(0));
  });
}
