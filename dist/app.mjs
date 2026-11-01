import { OPTIONS, createState, castVote, startRound, resolveRound, nextRound, applyEvent } from "./engine.mjs";
import { TwitchBridge } from "./twitch.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const channel = "BroadcastChannel" in window ? new BroadcastChannel("nightshift-live") : null;
const twitch = new TwitchBridge();
let state = createState();
let demoTimer = null;
let consequenceTimer = null;
let toastTimer = null;
const names = ["voidbunny", "pixelpaladin", "mothsignal", "nightowl", "hexkitten", "ghostbyte", "wardrunner", "neonwraith"];

function switchView(view) {
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === view));
  $$(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === view));
  document.querySelector("#app").dataset.view = view;
  const url = new URL(location.href);
  view === "gameplay" ? url.searchParams.delete("view") : url.searchParams.set("view", view);
  history.replaceState({}, "", url);
}

function optionById(id) { return OPTIONS.find((option) => option.id === id); }
function totalVotes() { return state.activeOptions.reduce((sum, id) => sum + state.votes[id], 0); }
function percent(id) { const total = totalVotes(); return total ? Math.round((state.votes[id] / total) * 100) : 0; }

function renderOptions(container, overlay = false) {
  container.innerHTML = state.activeOptions.map((id, index) => {
    const option = optionById(id);
    const score = percent(id);
    if (overlay) return `<div class="overlay-option"><span>${option.command} · ${option.label}</span><b>${score}%</b></div>`;
    return `<div class="vote-option ${option.faction === "chaos" ? "chaos" : ""}" style="--score:${score}%"><span class="vote-key">0${index + 1}</span><span><b>${option.label}</b><small>${option.command}</small></span><strong class="vote-count">${score}%</strong></div>`;
  }).join("");
}

function renderFeed() {
  const items = state.recent.length ? state.recent : [
    { actor: "SYSTEM", text: "Ward signal acquired", type: "status" },
    { actor: "voidbunny", text: "Restore power", type: "vote" },
    { actor: "mothsignal", text: "Kill the lights", type: "vote" }
  ];
  $("#activityFeed").innerHTML = items.slice(0, 5).map((item) => `<div class="feed-item"><span>${item.type.toUpperCase()}</span><b>${escapeHtml(item.actor)}</b><em>${escapeHtml(item.text)}</em></div>`).join("");
  $("#overlayRecent").textContent = `${items[0].actor} · ${items[0].text}`.toUpperCase();
}

function render() {
  const remaining = Math.max(0, Math.ceil((state.roundEndsAt - Date.now()) / 1000));
  $("#timerValue").textContent = remaining.toString().padStart(2, "0");
  $("#overlayTimer").textContent = remaining.toString().padStart(2, "0");
  $("#roundTitle").textContent = `ROUND ${String(state.round).padStart(2, "0")} · ${state.phase === "consequence" ? "AUDIENCE DECISION" : "FATE VOTE"}`;
  $("#healthValue").textContent = state.health;
  $("#dangerValue").textContent = state.danger;
  $("#healthBar").style.width = `${state.health}%`;
  $("#dangerBar").style.width = `${state.danger}%`;
  $("#clueCount").textContent = `${state.clues} / 3`;
  $("#guardianScore").textContent = `${state.guardians}%`;
  $("#chaosScore").textContent = `${state.chaos}%`;
  $("#factionBar").style.width = `${state.guardians}%`;
  $("#overlayFactionBar").style.width = `${state.guardians}%`;
  $("#monster").style.setProperty("--monster", state.monster);
  $("#monster").classList.toggle("visible", state.monster > .35 && $("#scareToggle").checked);
  $(".blackout").style.opacity = state.consequence?.id === "dark" ? ".72" : "0";
  renderOptions($("#voteOptions"));
  renderOptions($("#overlayOptions"), true);
  renderFeed();
  channel?.postMessage({ type: "state", state });
}

function escapeHtml(value = "") { const node = document.createElement("span"); node.textContent = String(value); return node.innerHTML; }

function showEvent(title, detail, danger = false) {
  const toast = $("#eventToast");
  toast.querySelector("strong").textContent = title;
  toast.querySelector("span").textContent = detail;
  toast.style.borderColor = danger ? "var(--red)" : "var(--cyan)";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
  if (danger && $("#scareToggle").checked) document.body.animate([{ transform: "translate(0)" }, { transform: "translate(-7px,3px)" }, { transform: "translate(5px,-2px)" }, { transform: "translate(0)" }], { duration: 480 });
}

function begin() {
  clearInterval(demoTimer); clearTimeout(consequenceTimer);
  state = startRound({ ...createState(), phase: "voting" });
  $("#ending").classList.remove("show");
  switchView("gameplay");
  showEvent("THE WARD IS LISTENING", "Viewer commands are now live");
  if ($("#demoToggle").checked) startDemo();
  render();
}

function startDemo() {
  clearInterval(demoTimer);
  demoTimer = setInterval(() => {
    if (state.phase !== "voting") return;
    const option = state.activeOptions[Math.random() > .48 ? 0 : 1];
    const result = castVote(state, names[Math.floor(Math.random() * names.length)], optionById(option).command);
    state = result.state; render();
  }, 1100);
}

function tick() {
  if (state.phase === "briefing") return;
  const remaining = state.roundEndsAt - Date.now();
  if (state.phase === "voting" && remaining <= 0) {
    state = resolveRound(state);
    const event = state.consequence;
    showEvent(event.faction === "chaos" ? "A CURSE HAS BEEN CAST" : "GUARDIANS INTERVENED", event.effect, event.faction === "chaos");
    render();
    clearTimeout(consequenceTimer);
    consequenceTimer = setTimeout(() => { state = nextRound(state); if (state.phase === "ending") showEnding(); render(); }, 9000);
  }
  render();
}

function showEnding() {
  clearInterval(demoTimer);
  const ending = $("#ending");
  ending.querySelector("h2").textContent = state.escaped ? "THE WARD RELEASED YOU" : "THE AUDIENCE KEPT YOU";
  ending.querySelector("p").textContent = state.escaped ? "Three circuits restored. One impossible exit. Chat chose mercy—this time." : "Entity proximity reached critical. The stream continues from somewhere below Ward 06.";
  ending.classList.add("show");
}

function injectEvent(type, actor = "Twitch") {
  const payload = { type, actor, bits: 500, viewers: 847 };
  state = applyEvent(state, payload);
  const label = state.recent[0].text;
  showEvent(label, `${actor} altered the ward`, type === "raid" || type === "cheer");
  render();
}

function wireTwitch() {
  twitch.captureTokenFromHash();
  $("#clientId").value = twitch.clientId;
  twitch.addEventListener("chat", ({ detail }) => {
    const result = castVote(state, detail.viewer, detail.message);
    if (result.accepted) { state = result.state; render(); }
  });
  twitch.addEventListener("event", ({ detail }) => injectEvent(detail.type, detail.actor));
  twitch.addEventListener("status", ({ detail }) => {
    $("#connectionLabel").textContent = detail.connected ? "TWITCH LIVE" : "SIGNAL LOST";
    $("#signalDot").style.background = detail.connected ? "var(--acid)" : "var(--red)";
  });
  if (twitch.token && twitch.clientId) connectTwitch().catch((error) => statusError(error.message));
}

async function connectTwitch() {
  const clientId = $("#clientId").value.trim();
  if (!twitch.token) return twitch.login(clientId);
  twitch.clientId = clientId || twitch.clientId;
  twitch.storage.setItem("nightshift.clientId", twitch.clientId);
  $("#connectTwitch").textContent = "Connecting…";
  const identity = await twitch.connect();
  $("#twitchIdentity").innerHTML = `<span class="avatar">${escapeHtml(identity.display_name.slice(0, 2).toUpperCase())}</span><div><small>CONNECTED BROADCASTER</small><b>${escapeHtml(identity.display_name)}</b></div>`;
  $("#connectTwitch").textContent = "Connected";
  $("#connectionLabel").textContent = "TWITCH LIVE";
}

function statusError(message) {
  $("#twitchIdentity").innerHTML = `<span class="avatar">!</span><div><small>CONNECTION ERROR</small><b>${escapeHtml(message)}</b></div>`;
  $("#connectTwitch").textContent = "Connect Twitch";
}

$$('[data-view-target]').forEach((button) => button.addEventListener("click", () => switchView(button.dataset.viewTarget)));
$$('[data-trigger]').forEach((button) => button.addEventListener("click", () => injectEvent(button.dataset.trigger, "CONTROL ROOM")));
$("#startShow").addEventListener("click", begin);
$("#restart").addEventListener("click", begin);
$("#connectTwitch").addEventListener("click", () => connectTwitch().catch((error) => statusError(error.message)));
$("#disconnectTwitch").addEventListener("click", () => { twitch.clear(); location.reload(); });
$("#demoToggle").addEventListener("change", (event) => event.target.checked ? startDemo() : clearInterval(demoTimer));
$("#motionToggle").addEventListener("change", (event) => document.documentElement.classList.toggle("reduced-motion", event.target.checked));
channel?.addEventListener("message", ({ data }) => { if (data.type === "state" && document.visibilityState !== "visible") { state = data.state; render(); } });

wireTwitch();
const initialView = new URLSearchParams(location.search).get("view") || "gameplay";
switchView(["gameplay", "dashboard", "overlay"].includes(initialView) ? initialView : "gameplay");
begin();
setInterval(tick, 250);
