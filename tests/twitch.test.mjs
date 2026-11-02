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
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

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

  let connectCalls = 0;
  const connected = Promise.resolve({ id: "broadcaster" });
  bridge.connect = () => { connectCalls++; return connected; };
  store.setItem("nightshift.oauthState", "resume");
  location.hash = "#access_token=resumed&state=resume";
  assert.equal(bridge.resumeOAuthCallback(), connected);
  assert.equal(connectCalls, 1);
  location.hash = "";
  assert.equal(bridge.resumeOAuthCallback(), null);
  assert.equal(connectCalls, 1);
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

test("the default browser fetch is bound to its global receiver", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function (url) {
    assert.equal(this, globalThis);
    if (url.endsWith("/validate")) return Promise.resolve(response(200, { user_id: "broadcaster" }));
    if (url.includes("/users?")) return Promise.resolve(response(200, { data: [{ id: "broadcaster", display_name: "Host" }] }));
    throw new Error(`Unexpected request ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const bridge = new TwitchBridge(storage({ "nightshift.clientId": "client", "nightshift.token": "token" }));
  const identity = await bridge.validate();
  assert.equal(identity.id, "broadcaster");
});

test("authenticated Helix failures clear persisted bearer credentials", async () => {
  const store = storage({ "nightshift.clientId": "client", "nightshift.token": "stale" });
  const bridge = new TwitchBridge(store, { fetch: async () => response(401, "invalid bearer"), now: () => 2.5 });
  await assert.rejects(() => bridge.request("/users"), /401/);
  assert.equal(bridge.token, "");
  assert.equal(bridge.identity, null);
  assert.equal(store.getItem("nightshift.token"), null);
  assert.equal(bridge.phase, TWITCH_PHASE.AUTH_EXPIRED);
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

test("critical EventSub subscription failure closes the failed socket and watchdog", async () => {
  FakeSocket.instances = [];
  const store = storage({ "nightshift.clientId": "client", "nightshift.token": "token" });
  const cleared = [];
  const fakeFetch = async (url) => {
    if (url.endsWith("/validate")) return response(200, { user_id: "broadcaster" });
    if (url.includes("/users?")) return response(200, { data: [{ id: "broadcaster" }] });
    if (url.endsWith("/eventsub/subscriptions")) return response(403, "critical scope missing");
    throw new Error(`Unexpected request ${url}`);
  };
  const bridge = new TwitchBridge(store, { fetch: fakeFetch, WebSocket: FakeSocket, setTimeout: () => 19, clearTimeout: id => cleared.push(id), now: () => 3.5 });
  const connected = bridge.connect();
  await waitTurn();
  const failed = FakeSocket.instances[0];
  await failed.receive(welcome("critical-failure"));
  await assert.rejects(() => connected, /403/);
  assert.equal(failed.closed, true);
  assert.equal(bridge.socket, null);
  assert.equal(bridge.keepaliveTimer, null);
  assert.deepEqual(bridge.activeSubscriptions, []);
  assert.equal(cleared.includes(19), true);
});

test("fresh EventSub sessions replace subscription metadata instead of accumulating", async () => {
  FakeSocket.instances = [];
  const fakeFetch = async url => url.endsWith("/eventsub/subscriptions") ? response(202, { data: [{ status: "enabled" }] }) : response(200, {});
  const bridge = new TwitchBridge(storage({ "nightshift.clientId": "client", "nightshift.token": "token" }), { fetch: fakeFetch, WebSocket: FakeSocket, setTimeout: () => 1, clearTimeout: () => {}, now: () => 3.75 });
  bridge.identity = { id: "host" };
  const first = bridge.openSocket("wss://first.example/ws");
  await first.receive(welcome("first"));
  assert.equal(bridge.activeSubscriptions.length, 5);
  const second = bridge.openSocket("wss://second.example/ws");
  await second.receive(welcome("second"));
  assert.equal(bridge.activeSubscriptions.length, 5);
  assert.equal(new Set(bridge.activeSubscriptions.map(item => item.type)).size, 5);
  bridge.disconnect();
});

test("clear during validation cancels stale work before it can open a socket", async () => {
  FakeSocket.instances = [];
  const validation = deferred();
  const store = storage({ "nightshift.clientId": "client", "nightshift.token": "token" });
  const bridge = new TwitchBridge(store, {
    fetch: async url => {
      if (url.endsWith("/validate")) return validation.promise;
      throw new Error(`Stale validation unexpectedly continued to ${url}`);
    },
    WebSocket: FakeSocket,
    now: () => 3.8
  });
  const statuses = [];
  bridge.addEventListener("status", event => statuses.push(event.detail));
  const connecting = bridge.connect();
  await waitTurn();
  bridge.clear();
  validation.resolve(response(200, { user_id: "broadcaster" }));
  assert.equal(await connecting, null);
  assert.equal(FakeSocket.instances.length, 0);
  assert.equal(bridge.phase, TWITCH_PHASE.DISCONNECTED);
  assert.equal(bridge.token, "");
  assert.equal(statuses.some(status => status.phase === TWITCH_PHASE.LIVE), false);
});

test("disconnect during subscription creation cannot be reversed by a stale welcome", async () => {
  FakeSocket.instances = [];
  const criticalSubscription = deferred();
  const store = storage({ "nightshift.clientId": "client", "nightshift.token": "token" });
  const fakeFetch = async url => {
    if (url.endsWith("/validate")) return response(200, { user_id: "broadcaster" });
    if (url.includes("/users?")) return response(200, { data: [{ id: "broadcaster" }] });
    if (url.endsWith("/eventsub/subscriptions")) return criticalSubscription.promise;
    throw new Error(`Unexpected request ${url}`);
  };
  const bridge = new TwitchBridge(store, { fetch: fakeFetch, WebSocket: FakeSocket, setTimeout: () => 1, clearTimeout: () => {}, now: () => 3.9 });
  const statuses = [];
  bridge.addEventListener("status", event => statuses.push(event.detail));
  const connecting = bridge.connect();
  await waitTurn();
  const socket = FakeSocket.instances[0];
  const receivingWelcome = socket.receive(welcome("slow-subscription"));
  await waitTurn();
  bridge.disconnect();
  criticalSubscription.resolve(response(202, { data: [{ status: "enabled" }] }));
  await receivingWelcome;
  assert.equal(await connecting, null);
  assert.equal(socket.closed, true);
  assert.equal(bridge.socket, null);
  assert.equal(bridge.phase, TWITCH_PHASE.DISCONNECTED);
  assert.deepEqual(bridge.activeSubscriptions, []);
  assert.equal(statuses.some(status => status.phase === TWITCH_PHASE.LIVE), false);
});

test("optional EventSub revocation stays live and reports degraded capability", async () => {
  FakeSocket.instances = [];
  const bridge = new TwitchBridge(storage({ "nightshift.clientId": "client", "nightshift.token": "token" }), {
    fetch: async url => url.endsWith("/eventsub/subscriptions") ? response(202, { data: [{ status: "enabled" }] }) : response(200, {}),
    WebSocket: FakeSocket,
    setTimeout: () => 1,
    clearTimeout: () => {},
    now: () => 3.95
  });
  bridge.identity = { id: "host" };
  const statuses = [];
  bridge.addEventListener("status", event => statuses.push(event.detail));
  const socket = bridge.openSocket("wss://events.example/ws");
  await socket.receive(welcome("optional-revocation"));
  await socket.receive({
    metadata: { message_type: "revocation" },
    payload: { subscription: { type: "channel.follow", status: "authorization_revoked" } }
  });
  const latest = statuses.at(-1);
  assert.equal(bridge.phase, TWITCH_PHASE.LIVE);
  assert.equal(socket.closed, false);
  assert.equal(latest.connected, true);
  assert.equal(latest.degraded, true);
  assert.equal(latest.unavailable.includes("channel.follow"), true);
  assert.equal(bridge.activeSubscriptions.some(subscription => subscription.type === "channel.follow"), false);
  bridge.disconnect();
});

test("critical chat revocation is fatal and closes the EventSub session", async () => {
  FakeSocket.instances = [];
  const bridge = new TwitchBridge(storage({ "nightshift.clientId": "client", "nightshift.token": "token" }), {
    fetch: async url => url.endsWith("/eventsub/subscriptions") ? response(202, { data: [{ status: "enabled" }] }) : response(200, {}),
    WebSocket: FakeSocket,
    setTimeout: () => 1,
    clearTimeout: () => {},
    now: () => 3.97
  });
  bridge.identity = { id: "host" };
  const statuses = [];
  bridge.addEventListener("status", event => statuses.push(event.detail));
  const socket = bridge.openSocket("wss://events.example/ws");
  await socket.receive(welcome("critical-revocation"));
  await socket.receive({
    metadata: { message_type: "revocation" },
    payload: { subscription: { type: "channel.chat.message", status: "authorization_revoked" } }
  });
  const latest = statuses.at(-1);
  assert.equal(socket.closed, true);
  assert.equal(bridge.socket, null);
  assert.equal(bridge.phase, TWITCH_PHASE.ERROR);
  assert.equal(latest.connected, false);
  assert.equal(latest.subscriptionType, "channel.chat.message");
  assert.deepEqual(bridge.activeSubscriptions, []);
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
