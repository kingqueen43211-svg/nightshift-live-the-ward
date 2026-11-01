import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DIST = resolve(ROOT, "dist");
const MIB = 1024 * 1024;
const failures = [];
const warnings = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : path;
  }));
  return nested.flat();
}

async function requireFile(path) {
  try {
    const info = await stat(resolve(ROOT, path));
    if (!info.isFile() || info.size === 0) throw new Error();
  } catch {
    failures.push(`Missing or empty required file: ${path}`);
  }
}

for (const path of [
  "dist/index.html",
  "dist/styles.css",
  "dist/app.mjs",
  "dist/audio.mjs",
  "dist/engine.mjs",
  "dist/public-state.mjs",
  "dist/runtime-mode.mjs",
  "dist/twitch.mjs",
  "dist/assets/fonts/space-grotesk-latin-variable.woff2",
  "dist/assets/fonts/dm-mono-latin-400.woff2",
  "dist/assets/fonts/dm-mono-latin-500.woff2",
  "dist/_headers",
  ".openai/hosting.json",
  "README.md",
  "docs/TWITCH_VERIFICATION.md",
]) await requireFile(path);

let files = [];
try {
  files = await walk(DIST);
} catch {
  failures.push("dist/ is missing or unreadable");
}

const sizes = await Promise.all(files.map(async path => ({ path, size: (await stat(path)).size })));
const total = sizes.reduce((sum, item) => sum + item.size, 0);
if (total > 40 * MIB) failures.push(`dist/ is ${(total / MIB).toFixed(1)} MiB; hard budget is 40 MiB`);

for (const item of sizes) {
  const name = relative(ROOT, item.path).replaceAll("\\", "/");
  if (item.size > 4 * MIB) failures.push(`${name} is ${(item.size / MIB).toFixed(1)} MiB; per-file hard budget is 4 MiB`);
  else if ([".png", ".jpg", ".jpeg"].includes(extname(item.path).toLowerCase()) && item.size > 2 * MIB) {
    warnings.push(`${name} is ${(item.size / MIB).toFixed(1)} MiB; create a visually verified WebP/AVIF derivative before final release`);
  }
}

const textFiles = files.filter(path => [".css", ".html", ".js", ".json", ".mjs"].includes(extname(path).toLowerCase()));
for (const path of textFiles) {
  const source = await readFile(path, "utf8");
  const name = relative(ROOT, path).replaceAll("\\", "/");
  if (/client_secret\s*[:=]\s*["'][^"']{8,}["']/i.test(source)) failures.push(`Possible client secret in ${name}`);
  if (/oauth:[a-z0-9]{20,}/i.test(source)) failures.push(`Possible OAuth token in ${name}`);
  if (/http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/i.test(source)) warnings.push(`Insecure external URL in ${name}`);
}

try {
  const status = await readFile(resolve(ROOT, "docs/TWITCH_VERIFICATION.md"), "utf8");
  if (!/UNVERIFIED/i.test(status)) failures.push("Twitch verification document must retain an explicit UNVERIFIED status until real evidence exists");
} catch {}

const largest = sizes.sort((a, b) => b.size - a.size).slice(0, 5);
console.log(`Release payload: ${(total / MIB).toFixed(1)} MiB across ${sizes.length} files`);
for (const item of largest) console.log(`  ${(item.size / MIB).toFixed(1).padStart(5)} MiB  ${relative(ROOT, item.path).replaceAll("\\", "/")}`);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const warning of warnings) console.log(`  WARN  ${warning}`);
}
if (failures.length) {
  console.error(`\nRelease audit failed (${failures.length}):`);
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\nRelease audit passed. Warnings remain quality work, not hidden failures.");
}
