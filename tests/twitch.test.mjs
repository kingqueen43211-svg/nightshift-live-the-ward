import test from "node:test";
import assert from "node:assert/strict";
import { TwitchBridge, TWITCH_PHASE } from "../dist/twitch.mjs";

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    dump: () => Object.fromEntries(values)
  };
}

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => typeof body === "string" ? body : JSON.stringify(body)
  };
}

class FakeSocket {
  static instances = [];
  constructor(url) { this.url = url; this.closed = false; FakeSocket.instances.push(this); }
  receive(packet) { return this.onmessage?.({ data: JSON.stringify(packet) }); }
  close() { this.closed = true; this.onclose?.(); }
}

const waitTurn = () => new Promise(resolve => setImmediate(resolve));

function welcome(id = "session-1", keepalive = 30) {
  return { metadata: { message_type: "session_welcome" }, payload: { session: { id, keepalive_timeout_seconds: keepalive } } };
}

test("OAuth token capture requires the stored state and scrubs the fragment", () => {
  const store = storage({ "nightshift.oauthState": "expected" });
  const historyCalls = [];
  const location = { hash: "#access_token=secret&state=wrong", pathname: "/", search: "" };
  const bridge = new TwitchBridge(store, { location, history: { replaceState: (...args) => historyCalls.push(args) }, document: { title: "NightShift" }, now: () => 1 });
  const statuses = [];
  bridge.addEventListener("status", event => statuses.push(event.detail));
  assert.equal(bridge.captureTokenFromHash(), false);
  assert.equal(store.getItem("nightshift.token"), null);
  assert.equal(statuses.at(-1).phase, TWITCH_PHASE.ERROR);
  assert.equal(historyCalls.length, 1);

  store.setItem("nightshift.oauthState", "expected");
  location.hash = "#access_token=accepted&state=expected";
  assert.equal(bridge.captureTokenFromHash(), true);
  assert.equal(store.getItem("nightshift.token"), "accepted");
  assert.equal(store.getItem("nightshift.oauthState"), null);
});

test("expired validation clears the token and reports AUTH_EXPIRED", async () => {
  const store = storage({ "nightshift.clientId": "client", "nightshift.token": "expired" });
  const bridge = new TwitchBridge(store, { fetch: async () => response(401, "expired"), now: () => 2 });
  const statuses = [];
  bridge.addEventListener("status", event => statuses.push(event.detail));
  await assert.rejects(() => bridge.validate(), /expired/i);
  assert.equal(bridge.token, "");
  assert.equal(store.getItem("nightshift.token"), null);
  assert.equal(statuses.at(-1).phase, TWITCH_PHASE.AUTH_EXPIRED);
});

test("EventSub welcome connects critical chat and reports optional subscription failures", async () => {
  FakeSocket.instances = [];
  const store = storage({ "nightshift.clientId": "client", "nightshift.token": "token" });
  const subscriptionTypes = [];
  const fakeFetch = async (url, init = {}) => {
    if (url.endsWith("/validate")) return response(200, { user_id: "broadcaster" });
    if (url.includes("/users?")) return response(200, { data: [{ id: "broadcaster", display_name: "Host" }] });
    if (url.endsWith("/eventsub/subscriptions")) {
      const type = JSON.parse(init.body).type;
      subscriptionTypes.push(type);
      if (type === "channel.cheer") return response(403, "scope missing");
      return response(202, { data: [{ status: "enabled" }] });
    }
    throw new Error(`Unexpected request ${url}`);
  };
  const bridge = new TwitchBridge(store, { fetch: fakeFetch, WebSocket: FakeSocket, setTimeout: () => 1, clearTimeout: () => {}, now: () => 3 });
  const statuses = [];
  bridge.addEventListener("status", event => statuses.push(event.detail));
  const connected = bridge.connect();
  await waitTurn();
  assert.equal(FakeSocket.instances.length, 1);
  await FakeSocket.instances[0].receive(welcome());
  await connected;
  assert.equal(bridge.phase, TWITCH_PHASE.LIVE);
  assert.equal(subscriptionTypes[0], "channel.chat.message");
  assert.equal(statuses.at(-1).unavailable.includes("channel.cheer"), true);
  bridge.disconnect();
});

test("duplicate EventSub notification IDs emit a single chat event", () => {
  const bridge = new TwitchBridge(storage(), { now: () => 4 });
  const chats = [];
  bridge.addEventListener("chat", event => chats.push(event.detail));
  const payload = { subscription: { type: "channel.chat.message" }, event: { chatter_user_name: "viewer", chatter_user_id: "u1", message_id: "chat-1", message: { text: "!vote b" } } };
  if (bridge.rememberMessage("event-1")) bridge.route(payload, "event-1");
  if (bridge.rememberMessage("event-1")) bridge.route(payload, "event-1");
  assert.equal(chats.length, 1);
  assert.equal(chats[0].viewerId, "u1");
  assert.equal(chats[0].source, TWITCH_PHASE.LIVE);
});

test("seamless reconnect keeps the old socket until replacement welcome", async () => {
  FakeSocket.instances = [];
  const bridge = new TwitchBridge(storage(), { WebSocket: FakeSocket, setTimeout: () => 1, clearTimeout: () => {}, now: () => 5 });
  bridge.identity = { id: "host" };
  const old = new FakeSocket("old");
  bridge.socket = old;
  assert.equal(bridge.reconnect("wss://reconnect.example/ws"), true);
  const replacement = FakeSocket.instances.at(-1);
  assert.notEqual(replacement, old);
  assert.equal(old.closed, false);
  await replacement.receive(welcome("replacement"));
  assert.equal(old.closed, true);
  assert.equal(bridge.socket, replacement);
  assert.equal(bridge.phase, TWITCH_PHASE.LIVE);
  bridge.disconnect();
});

test("keepalive timeout transitions to reconnecting and closes the active socket", () => {
  let scheduled;
  const bridge = new TwitchBridge(storage(), {
    setTimeout: (fn, ms) => (scheduled = { fn, ms }),
    clearTimeout: () => {},
    now: () => 6
  });
  const socket = { closed: false, close() { this.closed = true; } };
  bridge.socket = socket;
  bridge.resetKeepalive(10);
  assert.equal(scheduled.ms, 18000);
  scheduled.fn();
  assert.equal(socket.closed, true);
  assert.equal(bridge.phase, TWITCH_PHASE.RECONNECTING);
});
