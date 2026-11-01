const API = "https://api.twitch.tv/helix";
const AUTH = "https://id.twitch.tv/oauth2";

export class TwitchBridge extends EventTarget {
  constructor(storage = window.localStorage) {
    super();
    this.storage = storage;
    this.socket = null;
    this.identity = null;
    this.clientId = storage.getItem("nightshift.clientId") || "";
    this.token = storage.getItem("nightshift.token") || "";
  }

  captureTokenFromHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const token = params.get("access_token");
    if (token) {
      this.token = token;
      this.storage.setItem("nightshift.token", token);
      history.replaceState({}, document.title, `${location.pathname}${location.search}`);
    }
    return Boolean(token);
  }

  login(clientId) {
    if (!clientId) throw new Error("Enter a Twitch Client ID first.");
    this.clientId = clientId.trim();
    this.storage.setItem("nightshift.clientId", this.clientId);
    const query = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${location.origin}${location.pathname}`,
      response_type: "token",
      scope: "user:read:chat moderator:read:followers channel:read:subscriptions bits:read",
      state: crypto.randomUUID()
    });
    location.assign(`${AUTH}/authorize?${query}`);
  }

  async request(path, init = {}) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Client-Id": this.clientId,
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {})
      }
    });
    if (!response.ok) throw new Error(`Twitch ${response.status}: ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  }

  async validate() {
    if (!this.token || !this.clientId) return null;
    const response = await fetch(`${AUTH}/validate`, { headers: { Authorization: `OAuth ${this.token}` } });
    if (!response.ok) throw new Error("Your Twitch session expired. Connect again.");
    const validation = await response.json();
    const users = await this.request(`/users?id=${encodeURIComponent(validation.user_id)}`);
    this.identity = users.data[0];
    return this.identity;
  }

  async subscribe(sessionId, type, version, condition) {
    return this.request("/eventsub/subscriptions", {
      method: "POST",
      body: JSON.stringify({ type, version, condition, transport: { method: "websocket", session_id: sessionId } })
    });
  }

  async connect() {
    const identity = await this.validate();
    if (!identity) throw new Error("Connect Twitch first.");
    return new Promise((resolve, reject) => {
      const socket = new WebSocket("wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30");
      this.socket = socket;
      let settled = false;
      socket.onerror = () => { if (!settled) reject(new Error("Twitch WebSocket could not connect.")); };
      socket.onmessage = async ({ data }) => {
        const packet = JSON.parse(data);
        const kind = packet.metadata?.message_type;
        if (kind === "session_welcome") {
          try {
            const sessionId = packet.payload.session.id;
            const common = { broadcaster_user_id: identity.id };
            await this.subscribe(sessionId, "channel.chat.message", "1", { ...common, user_id: identity.id });
            await Promise.allSettled([
              this.subscribe(sessionId, "channel.follow", "2", { ...common, moderator_user_id: identity.id }),
              this.subscribe(sessionId, "channel.subscribe", "1", common),
              this.subscribe(sessionId, "channel.cheer", "1", common),
              this.subscribe(sessionId, "channel.raid", "1", { to_broadcaster_user_id: identity.id })
            ]);
            settled = true;
            this.emit("status", { connected: true, identity });
            resolve(identity);
          } catch (error) { reject(error); }
        }
        if (kind === "notification") this.route(packet.payload);
        if (kind === "session_reconnect") this.reconnect(packet.payload.session.reconnect_url);
        if (kind === "revocation") this.emit("status", { connected: false, message: packet.payload.subscription.status });
      };
      socket.onclose = () => this.emit("status", { connected: false, message: "Disconnected" });
    });
  }

  reconnect(url) {
    if (!url) return;
    const old = this.socket;
    const replacement = new WebSocket(url);
    replacement.onmessage = old.onmessage;
    replacement.onopen = () => old?.close();
    this.socket = replacement;
  }

  route(payload) {
    const type = payload.subscription.type;
    const event = payload.event;
    if (type === "channel.chat.message") {
      this.emit("chat", { viewer: event.chatter_user_name, message: event.message.text, id: event.message_id });
      return;
    }
    const map = { "channel.follow": "follow", "channel.subscribe": "subscribe", "channel.cheer": "cheer", "channel.raid": "raid" };
    this.emit("event", { type: map[type] || type, actor: event.user_name || event.from_broadcaster_user_name, bits: event.bits, viewers: event.viewers });
  }

  emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail })); }
  disconnect() { this.socket?.close(); this.socket = null; }
  clear() { this.disconnect(); this.storage.removeItem("nightshift.token"); this.token = ""; this.identity = null; }
}
