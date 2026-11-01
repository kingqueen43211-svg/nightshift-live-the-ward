import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../dist");
const DEFAULT_PORT = 4173;
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
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' https://api.twitch.tv https://id.twitch.tv wss://eventsub.wss.twitch.tv; frame-ancestors 'self'; form-action 'self'",
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
  if (target.includes(`${sep}assets${sep}`)) return "public, max-age=86400";
  if ([".css", ".js", ".mjs"].includes(extension)) return "public, max-age=300, must-revalidate";
  return "no-cache";
}

function respondText(response, status, body) {
  response.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

const server = createServer(async (request, response) => {
  if (!request.url || !["GET", "HEAD"].includes(request.method || "")) {
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
  console.log(`NightShift Live ready at http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
