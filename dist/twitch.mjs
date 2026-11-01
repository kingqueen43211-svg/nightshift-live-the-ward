const API = "https://api.twitch.tv/helix";
const AUTH = "https://id.twitch.tv/oauth2";
const EVENTSUB = "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";
const TOKEN_KEY = "nightshift.token";
const CLIENT_KEY = "nightshift.clientId";
const OAUTH_STATE_KEY = "nightshift.oauthState";

function cancelledConnectionError() {
  const error = new Error("Twitch connection attempt was cancelled.");
  error.name = "AbortError";
  return error;
}

function isCancellation(error) {
  return error?.name === "AbortError";
}

export const TWITCH_PHASE = Object.freeze({
  DISCONNECTED: "DISCONNECTED",
  AUTHORIZING: "AUTHORIZING",
  CONNECTING: "CONNECTING",
  LIVE: "LIVE_TWITCH",
  RECONNECTING: "RECONNECTING",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  ERROR: "ERROR"
});

function defaultStorage() {
  if (globalThis.localStorage) return globalThis.localStorage;
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

export class TwitchBridge extends EventTarget {
  constructor(storage = defaultStorage(), deps = {}) {
    super();
    this.storage = storage;
    this.fetch = deps.fetch || globalThis.fetch;
    this.WebSocket = deps.WebSocket || globalThis.WebSocket;
    this.location = deps.location || globalThis.location;
    this.history = deps.history || globalThis.history;
    this.document = deps.document || globalThis.document;
    this.crypto = deps.crypto || globalThis.crypto;
    this.setTimeout = deps.setTimeout || globalThis.setTimeout;
    this.clearTimeout = deps.clearTimeout || globalThis.clearTimeout;
    this.now = deps.now || Date.now;
    this.socket = null;
    this.previousSocket = null;
    this.identity = null;
    this.clientId = storage.getItem(CLIENT_KEY) || "";
    this.token = storage.getItem(TOKEN_KEY) || "";
    this.phase = TWITCH_PHASE.DISCONNECTED;
    this.manualDisconnect = false;
    this.keepaliveTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.keepaliveSeconds = 30;
    this.seenMessageIds = new Set();
    this.seenMessageOrder = [];
    this.activeSubscriptions = [];
    this.unavailableSubscriptions = new Set();
    this.connectPromise = null;
    this.pendingConnection = null;
    this.connectionGeneration = 0;
  }

  status(phase, message, extra = {}) {
    this.phase = phase;
    const connected = phase === TWITCH_PHASE.LIVE;
    this.emit("status", { phase, connected, message, identity: this.identity, at: this.now(), ...extra });
  }

  isCurrentConnection(generation) {
    return generation === this.connectionGeneration && !this.manualDisconnect;
  }

  scrubHash() {
    if (!this.location || !this.history) return;
    this.history.replaceState({}, this.document?.title || "", `${this.location.pathname}${this.location.search}`);
  }

  captureTokenFromHash() {
    if (!this.location?.hash) return false;
    const params = new URLSearchParams(this.location.hash.replace(/^#/, ""));
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) {
      this.scrubHash();
      this.status(TWITCH_PHASE.ERROR, `Twitch authorization failed: ${oauthError}`);
      return false;
    }
    const token = params.get("access_token");
    if (!token) return false;
    const expectedState = this.storage.getItem(OAUTH_STATE_KEY);
    const returnedState = params.get("state");
    if (!expectedState || !returnedState || returnedState !== expectedState) {
      this.scrubHash();
      this.storage.removeItem(OAUTH_STATE_KEY);
      this.status(TWITCH_PHASE.ERROR, "Twitch authorization state did not match. Connect again.");
      return false;
    }
    this.token = token;
    this.storage.setItem(TOKEN_KEY, token);
    this.storage.removeItem(OAUTH_STATE_KEY);
    this.scrubHash();
    return true;
  }

  login(clientId) {
    if (!clientId) throw new Error("Enter a Twitch Client ID first.");
    if (!this.crypto?.randomUUID || !this.location?.assign) throw new Error("Secure Twitch authorization is unavailable in this browser.");
    this.clientId = clientId.trim();
    this.storage.setItem(CLIENT_KEY, this.clientId);
    const state = this.crypto.randomUUID();
    this.storage.setItem(OAUTH_STATE_KEY, state);
    const query = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${this.location.origin}${this.location.pathname}`,
      response_type: "token",
      scope: "user:read:chat moderator:read:followers channel:read:subscriptions bits:read",
      state
    });
    this.status(TWITCH_PHASE.AUTHORIZING, "Opening Twitch authorization…");
    this.location.assign(`${AUTH}/authorize?${query}`);
  }

  async request(path, init = {}, { optionalForbidden = false, generation = null } = {}) {
    if (!this.fetch) throw new Error("Network requests are unavailable.");
    const response = await this.fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Client-Id": this.clientId,
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {})
      }
    });
    if (generation !== null && !this.isCurrentConnection(generation)) throw cancelledConnectionError();
    if (!response.ok) {
      const body = await response.text();
      if (generation !== null && !this.isCurrentConnection(generation)) throw cancelledConnectionError();
      if (response.status === 401 || (response.status === 403 && !optionalForbidden)) {
        this.storage.removeItem(TOKEN_KEY);
        this.token = "";
        this.identity = null;
        this.status(TWITCH_PHASE.AUTH_EXPIRED, "Twitch authorization expired or lacks a required scope. Reconnect Twitch.", { status: response.status });
      }
      throw new Error(`Twitch ${response.status}: ${body}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async validate(generation = null) {
    if (!this.token || !this.clientId) return null;
    const response = await this.fetch(`${AUTH}/validate`, { headers: { Authorization: `OAuth ${this.token}` } });
    if (generation !== null && !this.isCurrentConnection(generation)) throw cancelledConnectionError();
    if (!response.ok) {
      this.storage.removeItem(TOKEN_KEY);
      this.token = "";
      this.identity = null;
      this.status(TWITCH_PHASE.AUTH_EXPIRED, "Your Twitch session expired. Connect again.", { status: response.status });
      throw new Error("Your Twitch session expired. Connect again.");
    }
    const validation = await response.json();
    if (generation !== null && !this.isCurrentConnection(generation)) throw cancelledConnectionError();
    const users = await this.request(`/users?id=${encodeURIComponent(validation.user_id)}`, {}, { generation });
    if (generation !== null && !this.isCurrentConnection(generation)) throw cancelledConnectionError();
    this.identity = users.data?.[0] || null;
    if (!this.identity) throw new Error("Twitch identity could not be loaded.");
    return this.identity;
  }

  async subscribe(sessionId, type, version, condition, optional = false, generation = this.connectionGeneration) {
    const result = await this.request("/eventsub/subscriptions", {
      method: "POST",
      body: JSON.stringify({ type, version, condition, transport: { method: "websocket", session_id: sessionId } })
    }, { optionalForbidden: optional, generation });
    if (!this.isCurrentConnection(generation)) throw cancelledConnectionError();
    const subscription = { type, status: "enabled" };
    const existing = this.activeSubscriptions.findIndex(item => item.type === type);
    if (existing >= 0) this.activeSubscriptions[existing] = subscription;
    else this.activeSubscriptions.push(subscription);
    this.unavailableSubscriptions.delete(type);
    return result;
  }

  rememberMessage(id) {
    if (!id) return true;
    if (this.seenMessageIds.has(id)) return false;
    this.seenMessageIds.add(id);
    this.seenMessageOrder.push(id);
    if (this.seenMessageOrder.length > 500) {
      const oldest = this.seenMessageOrder.shift();
      this.seenMessageIds.delete(oldest);
    }
    return true;
  }

  resetKeepalive(seconds = this.keepaliveSeconds) {
    this.keepaliveSeconds = Math.max(10, Number(seconds) || 30);
    if (this.keepaliveTimer) this.clearTimeout(this.keepaliveTimer);
    this.keepaliveTimer = this.setTimeout(() => {
      if (this.manualDisconnect) return;
      this.status(TWITCH_PHASE.RECONNECTING, "Twitch keepalive timed out. Reconnecting…");
      this.socket?.close();
    }, (this.keepaliveSeconds + 8) * 1000);
  }

  async createSubscriptions(sessionId, generation = this.connectionGeneration) {
    if (!this.isCurrentConnection(generation)) throw cancelledConnectionError();
    const common = { broadcaster_user_id: this.identity.id };
    await this.subscribe(sessionId, "channel.chat.message", "1", { ...common, user_id: this.identity.id }, false, generation);
    const optional = [
      ["channel.follow", "2", { ...common, moderator_user_id: this.identity.id }],
      ["channel.subscribe", "1", common],
      ["channel.cheer", "1", common],
      ["channel.raid", "1", { to_broadcaster_user_id: this.identity.id }]
    ];
    const results = await Promise.allSettled(optional.map(args => this.subscribe(sessionId, ...args, true, generation)));
    if (!this.isCurrentConnection(generation)) throw cancelledConnectionError();
    if (this.phase === TWITCH_PHASE.AUTH_EXPIRED || !this.token || !this.identity) {
      throw new Error("Twitch authorization expired while subscriptions were being created.");
    }
    const unavailable = results.flatMap((result, index) => result.status === "rejected" ? [optional[index][0]] : []);
    for (const type of unavailable) this.unavailableSubscriptions.add(type);
    return unavailable;
  }

  connect() {
    if (this.connectPromise) return this.connectPromise;
    if (this.phase === TWITCH_PHASE.LIVE && this.socket) return Promise.resolve(this.identity);
    this.manualDisconnect = false;
    const generation = ++this.connectionGeneration;
    const attempt = (async () => {
      try {
        const identity = await this.validate(generation);
        if (!this.isCurrentConnection(generation)) return null;
        if (!identity) throw new Error("Connect Twitch first.");
        if (!this.WebSocket) throw new Error("Twitch WebSocket is unavailable.");
        this.status(TWITCH_PHASE.CONNECTING, "Connecting to Twitch EventSub…");
        return await new Promise((resolve, reject) => {
          if (!this.isCurrentConnection(generation)) {
            resolve(null);
            return;
          }
          const settle = (method, value) => {
            if (this.pendingConnection?.generation === generation) this.pendingConnection = null;
            method(value);
          };
          const context = {
            initial: true,
            generation,
            resolve: value => settle(resolve, value),
            reject: error => settle(reject, error)
          };
          this.pendingConnection = context;
          this.openSocket(EVENTSUB, context);
        });
      } catch (error) {
        if (isCancellation(error) || !this.isCurrentConnection(generation)) return null;
        throw error;
      }
    })();
    const tracked = attempt.finally(() => {
      if (this.connectPromise === tracked) this.connectPromise = null;
      if (this.pendingConnection?.generation === generation) this.pendingConnection = null;
    });
    this.connectPromise = tracked;
    return tracked;
  }

  openSocket(url, context = {}) {
    const generation = context.generation ?? this.connectionGeneration;
    const socket = new this.WebSocket(url);
    const previous = context.previous || null;
    let welcomed = false;
    if (!previous) this.socket = socket;
    socket.onerror = () => {
      if (!this.isCurrentConnection(generation)) return;
      if (!welcomed && context.reject) context.reject(new Error("Twitch WebSocket could not connect."));
      this.status(TWITCH_PHASE.ERROR, "Twitch EventSub connection failed.");
    };
    socket.onmessage = async ({ data }) => {
      if (!this.isCurrentConnection(generation)) {
        socket.close();
        return;
      }
      let packet;
      try { packet = JSON.parse(data); }
      catch { this.status(TWITCH_PHASE.ERROR, "Twitch sent an unreadable EventSub message."); return; }
      const kind = packet.metadata?.message_type;
      this.resetKeepalive(packet.payload?.session?.keepalive_timeout_seconds);
      if (kind === "session_welcome") {
        welcomed = true;
        const sessionId = packet.payload.session.id;
        try {
          let unavailable = [];
          if (!context.resuming) {
            this.activeSubscriptions = [];
            this.unavailableSubscriptions.clear();
            unavailable = await this.createSubscriptions(sessionId, generation);
          }
          if (!this.isCurrentConnection(generation)) {
            socket.close();
            context.resolve?.(null);
            return;
          }
          this.previousSocket = null;
          this.socket = socket;
          previous?.close();
          this.reconnectAttempts = 0;
          this.status(TWITCH_PHASE.LIVE, unavailable.length ? `Live chat connected. Optional events unavailable: ${unavailable.join(", ")}.` : "Connected: LIVE TWITCH", { subscriptions: [...this.activeSubscriptions], unavailable });
          context.resolve?.(this.identity);
        } catch (error) {
          if (isCancellation(error) || !this.isCurrentConnection(generation)) {
            if (this.socket === socket) this.socket = null;
            socket.close();
            context.resolve?.(null);
            return;
          }
          if (this.keepaliveTimer) this.clearTimeout(this.keepaliveTimer);
          this.keepaliveTimer = null;
          this.activeSubscriptions = [];
          this.unavailableSubscriptions.clear();
          if (this.socket === socket) this.socket = null;
          socket.close();
          if (this.phase !== TWITCH_PHASE.AUTH_EXPIRED) this.status(TWITCH_PHASE.ERROR, error.message);
          context.reject?.(error);
        }
        return;
      }
      if (kind === "notification") {
        const id = packet.metadata?.message_id;
        if (this.rememberMessage(id)) this.route(packet.payload, id);
        return;
      }
      if (kind === "session_reconnect") {
        this.reconnect(packet.payload?.session?.reconnect_url);
        return;
      }
      if (kind === "revocation") {
        const type = packet.payload?.subscription?.type || "unknown";
        const status = packet.payload?.subscription?.status || "revoked";
        this.activeSubscriptions = this.activeSubscriptions.filter(subscription => subscription.type !== type);
        this.unavailableSubscriptions.add(type);
        if (type === "channel.chat.message") {
          this.disconnect({ emitStatus: false });
          this.status(TWITCH_PHASE.ERROR, `Critical Twitch chat subscription revoked: ${status}. Reconnect Twitch.`, { subscriptionType: type, subscriptionStatus: status });
        } else {
          const unavailable = [...this.unavailableSubscriptions];
          this.status(TWITCH_PHASE.LIVE, `Live chat connected. Optional event unavailable: ${type} (${status}).`, {
            subscriptions: [...this.activeSubscriptions],
            unavailable,
            degraded: true,
            subscriptionType: type,
            subscriptionStatus: status
          });
        }
      }
    };
    socket.onclose = () => {
      if (socket !== this.socket || !this.isCurrentConnection(generation)) return;
      if (this.keepaliveTimer) this.clearTimeout(this.keepaliveTimer);
      this.keepaliveTimer = null;
      this.socket = null;
      this.status(TWITCH_PHASE.RECONNECTING, "Twitch disconnected. Reconnecting…");
      this.scheduleReconnect(generation);
    };
    return socket;
  }

  scheduleReconnect(generation = this.connectionGeneration) {
    if (!this.isCurrentConnection(generation) || this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.reconnectAttempts++, 5));
    this.reconnectTimer = this.setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.isCurrentConnection(generation)) return;
      try {
        await this.validate(generation);
        if (!this.isCurrentConnection(generation)) return;
        this.openSocket(EVENTSUB, { generation });
      } catch (error) {
        if (!isCancellation(error) && this.isCurrentConnection(generation) && this.phase !== TWITCH_PHASE.AUTH_EXPIRED) {
          this.status(TWITCH_PHASE.ERROR, `Reconnect failed: ${error.message}`);
          this.scheduleReconnect(generation);
        }
      }
    }, delay);
  }

  reconnect(url) {
    if (!url || !this.WebSocket || this.manualDisconnect) return false;
    const generation = this.connectionGeneration;
    this.status(TWITCH_PHASE.RECONNECTING, "Twitch requested a seamless reconnect…");
    const old = this.socket;
    this.previousSocket = old;
    this.openSocket(url, { resuming: true, previous: old, generation });
    return true;
  }

  route(payload, sourceEventId = null) {
    const type = payload?.subscription?.type;
    const event = payload?.event || {};
    if (type === "channel.chat.message") {
      this.emit("chat", { viewer: event.chatter_user_name, viewerId: event.chatter_user_id, message: event.message?.text || "", id: event.message_id || sourceEventId, sourceEventId, source: TWITCH_PHASE.LIVE });
      return;
    }
    const map = { "channel.follow": "follow", "channel.subscribe": "subscribe", "channel.cheer": "cheer", "channel.raid": "raid" };
    this.emit("event", { type: map[type] || type, actor: event.user_name || event.from_broadcaster_user_name, actorId: event.user_id || event.from_broadcaster_user_id, bits: event.bits, viewers: event.viewers, sourceEventId, source: TWITCH_PHASE.LIVE });
  }

  emit(name, detail) {
    const EventCtor = globalThis.CustomEvent || class extends Event { constructor(type, init) { super(type); this.detail = init.detail; } };
    this.dispatchEvent(new EventCtor(name, { detail }));
  }

  disconnect({ emitStatus = true } = {}) {
    this.manualDisconnect = true;
    this.connectionGeneration++;
    const pending = this.pendingConnection;
    this.pendingConnection = null;
    this.connectPromise = null;
    pending?.resolve?.(null);
    if (this.keepaliveTimer) this.clearTimeout(this.keepaliveTimer);
    if (this.reconnectTimer) this.clearTimeout(this.reconnectTimer);
    this.keepaliveTimer = null;
    this.reconnectTimer = null;
    const current = this.socket;
    this.socket = null;
    current?.close();
    this.previousSocket?.close();
    this.previousSocket = null;
    this.activeSubscriptions = [];
    this.unavailableSubscriptions.clear();
    if (emitStatus) this.status(TWITCH_PHASE.DISCONNECTED, "Disconnected from Twitch.");
  }

  clear() {
    this.disconnect();
    this.storage.removeItem(TOKEN_KEY);
    this.storage.removeItem(OAUTH_STATE_KEY);
    this.token = "";
    this.identity = null;
    this.activeSubscriptions = [];
    this.unavailableSubscriptions.clear();
    this.seenMessageIds.clear();
    this.seenMessageOrder = [];
  }
}
