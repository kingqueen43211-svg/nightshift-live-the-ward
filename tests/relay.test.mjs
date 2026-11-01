import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import test from "node:test";
import { createState, publicState } from "../dist/engine.mjs";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(origin) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try { if ((await fetch(origin, { method: "HEAD" })).ok) return; }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("relay server did not start");
}

test("local server relays sanitized state over same-origin SSE", { timeout: 10000 }, async t => {
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const child = spawn(process.execPath, ["scripts/serve.mjs", "--port", String(port)], { stdio: "ignore", windowsHide: true });
  t.after(() => child.kill());
  await waitForServer(origin);

  const indexHead = await fetch(origin, { method: "HEAD" });
  assert.equal(indexHead.status, 200);
  assert.equal(indexHead.headers.get("cache-control"), "no-cache");
  assert.match(indexHead.headers.get("content-security-policy") || "", /connect-src 'self'.*api\.twitch\.tv/);
  const moduleHead = await fetch(`${origin}/app.mjs`, { method: "HEAD" });
  assert.match(moduleHead.headers.get("content-type") || "", /text\/javascript/);
  assert.match(moduleHead.headers.get("cache-control") || "", /must-revalidate/);
  assert.equal((await fetch(`${origin}/missing-release-file`)).status, 404);

  const abort = new AbortController();
  t.after(() => abort.abort());
  const events = await fetch(`${origin}/__nightshift/events`, { signal: abort.signal });
  assert.equal(events.status, 200);
  assert.match(events.headers.get("content-type") || "", /text\/event-stream/);

  const forbidden = await fetch(`${origin}/__nightshift/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({ type: "state", state: {} })
  });
  assert.equal(forbidden.status, 403);

  const malformed = await fetch(`${origin}/__nightshift/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ type: "state", state: { sessionId: "incomplete" } })
  });
  assert.equal(malformed.status, 400);

  const marker = `relay-${Date.now()}`;
  const state = publicState(createState());
  state.sessionId = marker;
  const accepted = await fetch(`${origin}/__nightshift/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ type: "state", state })
  });
  assert.equal(accepted.status, 204);

  const reader = events.body.getReader();
  const decoder = new TextDecoder();
  let received = "";
  const deadline = Date.now() + 3000;
  while (!received.includes(marker) && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    received += decoder.decode(value, { stream: true });
  }
  assert.match(received, new RegExp(marker));
  await reader.cancel();
});
