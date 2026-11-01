import {
  ROOMS,
  createState,
  roomFor,
  optionsFor,
  startEpisode,
  pauseEpisode,
  resumeEpisode,
  stopEpisode,
  ingestCommand,
  resolveVote,
  advanceRoom,
  playerAction,
  applyChannelEvent,
  tick,
  publicState,
  enterCameraNode,
  campaignProgress,
  roomReadiness,
  combineInventoryItems,
  useInventoryItem,
  restoreCheckpoint
} from "./engine.mjs";
import { TwitchBridge } from "./twitch.mjs";
import { createNightShiftAudio } from "./audio.mjs";
import { modeForTwitchStatus, simulatedAudienceEnabled, twitchInputPaused, voteSourceText } from "./runtime-mode.mjs";
import { isValidPublicState } from "./public-state.mjs";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => {
  const node = document.createElement("span");
  node.textContent = String(value ?? "");
  return node.innerHTML;
};
const channel = "BroadcastChannel" in window ? new BroadcastChannel("nightshift-live") : null;
const twitch = new TwitchBridge();
const demoNames = ["voidbunny", "mothsignal", "hexkitten", "ghostbyte", "neonwraith", "pixelpaladin"];
const SETTINGS_KEY = "nightshift.settings.v3";
const CONTROLLER_LEASE_KEY = "nightshift.controller-lease.v3";
const params = new URL(location.href).searchParams;
const LOCAL_RELAY = params.get("relay") === "local";
const PASSIVE_MIRROR = params.get("role") === "mirror";
const INSTANCE_ID = globalThis.crypto?.randomUUID?.() || `ward-tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const CAMERA_META = {
  "lobby-wide": ["LOBBY", "Wide threat context"],
  "records-desk": ["RECORDS", "Inspect the torn intake record"],
  "locker-close": ["LOCKER", "Recover a survival resource"],
  "corridor-wide": ["CORRIDOR", "Track the Warden's route"],
  "door-approach": ["GURNEY", "Read the restraint evidence"],
  threshold: ["THRESHOLD", "Commit to the isolation breach"],
  "theatre-wide": ["THEATRE", "Read the whole encounter"],
  "lamp-array": ["LAMPS", "Prepare environmental counterplay"],
  "restraint-table": ["TABLE", "Decode the confession"],
  "generator-wide": ["GENERATOR", "Read the exit topology"],
  "breaker-close": ["BREAKERS", "Solve the 2 · 1 · 3 sequence"],
  "service-stairs": ["STAIRS", "Commit power to the escape grid"],
  "landing-wide": ["LANDING", "Review final readiness"],
  "roof-exit": ["ROOF", "Choose exposure and rescue"],
  "ambulance-tunnel": ["TUNNEL", "Choose the underground route"]
};
const USABLE_ITEMS = new Set(["Trauma kit", "Sedative ampoule", "Stabilized trauma kit", "Subscriber flare", "Audience shield"]);

let state = createState();
let lastRoom = 0;
let toastTimer;
let autoAdvanceTimer;
let cameraTimer;
let audioCaptionTimer;
let advancing = false;
let lastActionKey = "";
let lastCameraKey = "";
let lastInventoryKey = null;
let endingWasOpen = false;
let lastAudioWardenPhase = null;
let audienceClockPausedAt = null;
let relayEvents = null;

try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
  if (saved && typeof saved === "object") Object.assign(state.settings, saved);
  else state.settings.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
} catch {
  state.settings.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
}
state.settings.audioMuted ??= false;
state.settings.audioVolume ??= .78;

const audio = createNightShiftAudio({
  reducedEffects: state.settings.lowEffects,
  volumes: { master: state.settings.audioVolume },
  onCaption: ({ cue, text }) => {
    if (cue === "ui-click") return;
    const caption = $("#audioCaption");
    if (!caption) return;
    caption.querySelector("span").textContent = text;
    caption.hidden = false;
    clearTimeout(audioCaptionTimer);
    audioCaptionTimer = setTimeout(() => { caption.hidden = true; }, cue === "ambience" ? 5200 : 3600);
  }
});
audio.setMuted("master", state.settings.audioMuted);

function announce(text) {
  $("#ariaStatus").textContent = "";
  requestAnimationFrame(() => {
    $("#ariaStatus").textContent = text;
  });
}

function ownsControllerLease() {
  if (isPassiveView()) return false;
  const now = Date.now();
  try {
    const lease = JSON.parse(localStorage.getItem(CONTROLLER_LEASE_KEY) || "null");
    if (lease?.id && lease.id !== INSTANCE_ID && Number(lease.expiresAt) > now) return false;
    localStorage.setItem(CONTROLLER_LEASE_KEY, JSON.stringify({ id: INSTANCE_ID, expiresAt: now + 3200 }));
    return true;
  } catch {
    return true;
  }
}

function isPassiveView() {
  return PASSIVE_MIRROR || $("#app").dataset.view === "overlay";
}

function visibleDialog() {
  if (!$("#cinematicIntro").classList.contains("dismissed")) return $("#cinematicIntro");
  if ($("#ending").classList.contains("show")) return $("#ending");
  return null;
}

function focusableIn(root) {
  return $$("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])")
    .filter(element => root.contains(element) && element.getClientRects().length);
}

function setIntroOpen(open) {
  const intro = $("#cinematicIntro");
  intro.classList.toggle("dismissed", !open);
  if (open) {
    $("#appHeader").inert = true;
    $("#appMain").inert = true;
    setTimeout(() => $("#enterWard").focus(), 0);
  } else if (!endingWasOpen) {
    $("#appHeader").inert = false;
    $("#appMain").inert = false;
  }
}

function setEndingOpen(open) {
  if (endingWasOpen === open) return;
  endingWasOpen = open;
  $(".scene").inert = open;
  $(".hud").inert = open;
  $("#appHeader").inert = open;
  if (open) {
    setTimeout(() => $("#endingTitle").focus(), 0);
    announce(`Episode complete. ${state.ending}`);
  } else if ($("#cinematicIntro").classList.contains("dismissed")) {
    $(".scene").inert = false;
    $(".hud").inert = false;
    $("#appHeader").inert = false;
  }
}

function switchView(view, userInitiated = false) {
  $$(".screen").forEach(screen => screen.classList.toggle("active", screen.id === view));
  $$(".nav").forEach(button => {
    const active = button.dataset.viewTarget === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("#app").dataset.view = view;
  document.documentElement.classList.toggle("overlay-mode", view === "overlay");
  document.body.classList.toggle("overlay-mode", view === "overlay");
  if (view !== "gameplay") setIntroOpen(false);
  const url = new URL(location.href);
  view === "gameplay" ? url.searchParams.delete("view") : url.searchParams.set("view", view);
  history.replaceState({}, "", url);
  if (userInitiated) {
    const heading = $(`#${view} h1, #${view} h2`);
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      setTimeout(() => heading.focus(), 0);
    }
    announce(view === "gameplay" ? "Live episode view" : view === "dashboard" ? "Control room view" : "OBS overlay preview");
  }
}

function totalVotes() {
  return Object.values(state.votes).reduce((sum, count) => sum + count, 0);
}

function pct(id) {
  const total = totalVotes();
  return total ? Math.round((state.votes[id] || 0) / total * 100) : 0;
}

function renderOptions(target, overlay = false) {
  target.innerHTML = optionsFor(state).map(option => overlay
    ? `<div class="overlay-option"><span>${escape(option.command)} · ${escape(option.label)}</span><b>${pct(option.id)}%</b></div>`
    : `<div class="vote-option ${option.faction === "chaos" ? "chaos" : ""}" style="--score:${pct(option.id)}%"><span><b>${escape(option.label)}</b><small>${escape(option.command)}</small></span><strong>${pct(option.id)}%</strong></div>`
  ).join("");
}

function renderFeed() {
  const events = state.recent.length ? state.recent : [{ type: "system", actor: "NIGHTSHIFT", text: "Episode ready" }];
  $("#activityFeed").innerHTML = events.slice(0, 7).map(event =>
    `<div class="feed-item"><span>${escape(event.type.toUpperCase())}</span><b>${escape(state.settings.hideNames && !["NIGHTSHIFT", "CHAT"].includes(event.actor) ? "VIEWER" : event.actor)}</b><em>${escape(event.text)}</em></div>`
  ).join("");
  $("#overlayRecent").textContent = `${events[0].actor} · ${events[0].text}`.toUpperCase();
}

function actionLabel(action) {
  return {
    "search-desk": "Search desk",
    "open-locker": "Open locker",
    "reconstruct-file": "Reconstruct file",
    "inspect-gurney": "Read restraint marks",
    "listen-intercom": "Decode intercom",
    "hide-curtain": "Hide & hold breath",
    "force-door": "Breach isolation",
    "align-lamps": "Align surgical lamps",
    "play-tape": "Decode confession",
    "counter-warden": "Counter the Warden",
    "breaker-1": "Throw breaker 1",
    "breaker-2": "Throw breaker 2",
    "breaker-3": "Throw breaker 3",
    "reroute-power": "Reroute power",
    "seal-warden": "Attempt the seal",
    "open-roof": "Open roof exit",
    "open-ambulance": "Open ambulance tunnel"
  }[action] || action;
}

function actionKind(action) {
  if (/search|inspect|listen|play/.test(action)) return "OBSERVE";
  if (/reconstruct|breaker|reroute|seal/.test(action)) return "DEDUCE";
  if (/hide|counter|force/.test(action)) return "SURVIVE";
  return "COMMIT";
}

function actionRequirement(action) {
  const gates = {
    "reconstruct-file": [state.props.desk && state.props.locker, "Needs desk + locker"],
    "force-door": [state.power >= 20 && state.evidence.length >= 2, "Needs 2 evidence + 20 power"],
    "play-tape": [state.story.subjectIdentified, "Identify Subject 06 first"],
    "counter-warden": [state.props.lamps && state.story.confessionDecoded, "Align lamps + decode confession"],
    "reroute-power": [state.props.breakerProgress.length === 3, "Complete 2 · 1 · 3"],
    "seal-warden": [state.inventory.includes("Binding sigil") && state.evidence.length >= 4, "Needs sigil + 4 evidence"],
    "open-roof": [roomFor(state).id === "stairwell" && state.doors.exit && state.status === "consequence", "Needs exit power + resolved vote"],
    "open-ambulance": [roomFor(state).id === "stairwell" && state.doors.exit && state.status === "consequence", "Needs exit power + resolved vote"]
  };
  const [ready = true, cue = "Ready"] = gates[action] || [];
  return { ready, cue };
}

function performAction(action) {
  playerAction(state, action);
  const accepted = state.lastActionAccepted !== false;
  if (audio.unlocked) audio.playUI(accepted ? "success" : "error");
  if (!state.settings.lowEffects) {
    $(".impact-flash").classList.remove("hit");
    void $(".impact-flash").offsetWidth;
    $(".impact-flash").classList.add("hit");
  }
  showToast(accepted ? actionKind(action) : "ACTION BLOCKED", state.lastOutcome, !accepted || state.danger > 75);
  render();
}

function renderActions(room) {
  const roomState = state.rooms?.[room.id];
  const gateKey = room.actions.map(action => `${action}:${actionRequirement(action).ready}`).join("|");
  const completedKey = (roomState?.actions || []).join("|");
  const key = `${room.id}|${gateKey}|${completedKey}`;
  if (key === lastActionKey) return;
  const focusedAction = document.activeElement?.dataset?.action;
  lastActionKey = key;
  $("#actionTray").innerHTML = room.actions.map((action, index) => {
    const requirement = actionRequirement(action);
    const completed = roomState?.actions?.includes(action);
    const status = completed ? "DONE" : requirement.ready ? actionKind(action) : "LOCKED";
    return `<button data-action="${escape(action)}" class="${completed ? "completed" : ""} ${requirement.ready ? "" : "locked"}" title="${escape(requirement.cue)}"><small>${status} · 0${index + 1}</small><b>${escape(actionLabel(action))}</b><em>${escape(requirement.ready ? "" : requirement.cue)}</em></button>`;
  }).join("");
  $$("[data-action]").forEach(button => button.addEventListener("click", () => performAction(button.dataset.action)));
  if (focusedAction) $("[data-action='" + CSS.escape(focusedAction) + "']")?.focus();
}

function selectCamera(nodeId) {
  if (state.camera?.moving) return;
  const result = enterCameraNode(state, nodeId);
  if (!result.accepted) {
    showToast("CAMERA BLOCKED", result.reason, true);
    return;
  }
  state.camera.moving = !state.settings.reducedMotion;
  if (audio.unlocked) audio.playUI("click");
  render();
  announce(`Camera moved to ${CAMERA_META[nodeId]?.[0] || nodeId}`);
  clearTimeout(cameraTimer);
  cameraTimer = setTimeout(() => {
    state.camera.moving = false;
    render();
  }, state.settings.reducedMotion ? 0 : 520);
}

function renderCamera(room) {
  const key = `${room.id}|${room.cameraNodes.join("|")}`;
  if (key !== lastCameraKey) {
    lastCameraKey = key;
    $("#cameraRail").innerHTML = room.cameraNodes.map((node, index) =>
      `<button data-camera-node="${escape(node)}" aria-pressed="false" title="${escape(CAMERA_META[node]?.[1] || node)}"><span>0${index + 1}</span>${escape(CAMERA_META[node]?.[0] || node)}</button>`
    ).join("");
    $$("#cameraRail [data-camera-node]").forEach(button => button.addEventListener("click", () => selectCamera(button.dataset.cameraNode)));
  }
  const activeNode = state.camera?.nodeId || room.cameraNodes[0];
  $$("#cameraRail [data-camera-node]").forEach(button => {
    const active = button.dataset.cameraNode === activeNode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = Boolean(state.camera?.moving);
  });
  $("#cameraCue").textContent = CAMERA_META[activeNode]?.[1] || "Authored scene view";
  $("#scene").dataset.cameraNode = activeNode;
  $("#scene").dataset.cameraIndex = String(Math.max(0, room.cameraNodes.indexOf(activeNode)));
}

function inventoryButtons() {
  const usable = state.inventory.filter(item => USABLE_ITEMS.has(item));
  const canCraft = state.inventory.includes("Sedative ampoule") && state.inventory.includes("Trauma kit");
  const useButtons = usable.map(item => `<button data-use-item="${escape(item)}">USE ${escape(item)}</button>`).join("");
  return `${canCraft ? '<button data-craft="stabilized">CRAFT STABILIZED KIT</button>' : ""}${useButtons}`;
}

function renderInventory() {
  const key = state.inventory.join("|");
  if (key === lastInventoryKey) return;
  lastInventoryKey = key;
  const tags = state.inventory.length
    ? state.inventory.map(item => `<span class="item-tag">${escape(item)}</span>`).join("")
    : '<span class="item-empty">No carried items</span>';
  const buttons = inventoryButtons();
  $("#inventoryActions").innerHTML = `<div class="item-tags">${tags}</div>${buttons}`;
  $("#quickItems").innerHTML = buttons;
  $("#quickItems").hidden = !buttons;
  $$("[data-use-item]").forEach(button => button.addEventListener("click", () => {
    const result = useInventoryItem(state, button.dataset.useItem);
    showToast(result.accepted ? "ITEM USED" : "ITEM BLOCKED", result.accepted ? state.lastOutcome : result.reason, !result.accepted);
    render();
  }));
  $$("[data-craft]").forEach(button => button.addEventListener("click", () => {
    const result = combineInventoryItems(state, "Sedative ampoule", "Trauma kit");
    showToast(result.accepted ? "ITEM CRAFTED" : "CRAFT BLOCKED", result.accepted ? state.lastOutcome : result.reason, !result.accepted);
    render();
  }));
}

function renderEnding() {
  $("#endingTitle").textContent = state.ending || "";
  const recap = state.endingRecap;
  if (!recap) {
    $("#endingRecap").innerHTML = "";
    return;
  }
  const audienceChoices = Math.max(0, (recap.audienceResolutions || 0) - (recap.zeroChatFallbacks || 0));
  $("#endingSummary").textContent = audienceChoices
    ? "The streamer and audience shaped this ending together."
    : "The streamer completed this run with disclosed director fallbacks.";
  const mechanics = recap.mechanics?.length ? recap.mechanics.join(" · ") : "core exploration";
  $("#endingRecap").innerHTML = `
    <span>ROUTE<b>${escape(String(recap.route || "unknown").toUpperCase())}</b></span>
    <span>EVIDENCE<b>${escape(recap.evidence)}</b></span>
    <span>TRUTH<b>${recap.confessionDecoded ? "DECODED" : "INCOMPLETE"}</b></span>
    <span>WARDEN<b>${recap.wardenBound ? "BOUND" : "UNCONTAINED"}</b></span>
    <span>AUDIENCE<b>${audienceChoices}</b></span>
    <span>FALLBACKS<b>${escape(recap.zeroChatFallbacks || 0)}</b></span>
    <p>${escape(mechanics)}</p>`;
}

function voteSourceLabel() {
  return voteSourceText({
    mode: state.mode,
    status: state.status,
    resolutionSource: state.voteResolutionSource
  });
}

function syncAudienceClock() {
  const shouldPause = state.status === "voting" && twitchInputPaused(state.mode);
  if (shouldPause && audienceClockPausedAt === null) audienceClockPausedAt = Date.now();
  if (!shouldPause && audienceClockPausedAt !== null) {
    if (state.status === "voting" && !isPassiveView()) state.roundEndsAt += Math.max(0, Date.now() - audienceClockPausedAt);
    audienceClockPausedAt = null;
  }
}

function ensureRoomVisualAssets(room) {
  const detailedCorridor = room.id === "surgery" || room.id === "theatre";
  if (detailedCorridor) {
    $$("#foregroundRig [data-room-src]").forEach(image => {
      if (!image.getAttribute("src")) image.src = image.dataset.roomSrc;
    });
  }
  $(".door-panel").classList.toggle("room-art-ready", room.id === "surgery");
}

function render() {
  syncAudienceClock();
  const room = roomFor(state);
  ensureRoomVisualAssets(room);
  const remaining = state.status === "voting"
    ? Math.max(0, Math.ceil((state.roundEndsAt - (audienceClockPausedAt ?? Date.now())) / 1000))
    : state.status === "paused" ? "II" : "--";

  if (!$("#plate").src.endsWith(room.plate)) $("#plate").src = `./assets/${room.plate}`;
  $("#plate").alt = room.name;
  $("#roomCode").textContent = `${room.code} · ${room.name.toUpperCase()}`;
  $("#objective").textContent = room.objective;
  $("#hint").textContent = room.hint;
  $("#overlayRoom").textContent = `${room.code} · ${room.name.toUpperCase()}`;
  $("#overlayObjective").textContent = room.objective;
  $("#roundTitle").textContent = `ROUND ${String(state.round).padStart(2, "0")} · ${room.name.toUpperCase()}`;
  $("#timerValue").textContent = remaining;
  $("#overlayTimer").textContent = remaining;

  for (const [name, value] of [["health", state.health], ["danger", state.danger], ["power", state.power]]) {
    $("#" + name + "Value").textContent = value;
    $("#" + name + "Bar").style.width = `${value}%`;
    $("#" + name + "Meter").setAttribute("aria-valuenow", String(value));
  }

  $("#guardianEnergy").textContent = state.energy.guardian;
  $("#chaosEnergy").textContent = state.energy.chaos;
  $("#factionBar").style.width = `${Math.round(state.guardians / Math.max(1, state.guardians + state.chaos) * 100)}%`;
  $("#roomMap").innerHTML = ROOMS.map((_, index) => `<i class="${index < state.roomIndex ? "done" : index === state.roomIndex ? "active" : ""}"></i>`).join("");
  $("#roomProgressText").textContent = `Room ${state.roomIndex + 1} of ${ROOMS.length}`;

  renderActions(room);
  renderCamera(room);
  renderInventory();

  $("#evidenceCount").textContent = `${state.evidence.length} evidence`;
  $("#inventoryCount").textContent = `${state.inventory.length} items`;
  $("#latestDiscovery").textContent = state.evidence.at(-1) || state.inventory.at(-1) || "Nothing recovered yet.";
  $("#dashRoom").textContent = room.name;
  $("#dashStatus").textContent = state.status.toUpperCase();
  $("#dashEvidence").textContent = state.evidence.length;
  $("#sessionId").textContent = state.sessionId.slice(-8);
  $("#modeLabel").textContent = `MODE: ${state.mode}`;
  const voteCount = totalVotes();
  $("#viewerCount").textContent = `${voteCount} ${voteCount === 1 ? "VOTE" : "VOTES"}`;

  $("#warden").classList.toggle("visible", state.warden.visible && state.settings.jumpscares);
  $("#warden").dataset.phase = state.warden.phase || "dormant";
  const audibleWardenPhase = state.warden.visible && ["warning", "approaching", "striking"].includes(state.warden.phase) ? state.warden.phase : null;
  if (audibleWardenPhase && audibleWardenPhase !== lastAudioWardenPhase) audio.playWardenWarning({ intensity: state.danger / 100 });
  lastAudioWardenPhase = audibleWardenPhase;
  const wardenAsset = state.warden.phase === "repelled"
    ? "warden-repelled-v1.webp"
    : state.warden.phase === "warning" || state.warden.phase === "passing"
      ? "warden-warning-v1.webp"
      : "warden-approach-v1.webp";
  const wardenVisible = state.warden.visible && state.settings.jumpscares;
  if (wardenVisible && !$("#wardenSprite").src.endsWith(wardenAsset)) $("#wardenSprite").src = `./assets/v3/${wardenAsset}`;
  $(".blackout").style.opacity = state.power < 15 ? ".68" : "0";
  $(".alarm").style.opacity = !state.settings.lowEffects && state.danger > 70 ? "1" : "0";

  const doorOpen = room.id !== "surgery" || state.doors.isolation || state.doors.theatre;
  $("#doorRig").classList.toggle("visible", room.id === "surgery");
  $("#doorRig").classList.toggle("unlocked", doorOpen);
  $("#doorRig").classList.toggle("breach", room.id === "surgery" && state.player?.lastAction === "force-door" && state.lastActionAccepted);

  const threat = state.danger > 75 ? "HUNTING" : state.danger > 45 ? "SEARCHING" : "UNDETECTED";
  $("#threatState").textContent = threat;
  $("#threatState").dataset.level = state.danger > 75 ? "critical" : state.danger > 45 ? "warning" : "safe";
  $("#sceneSummary").textContent = `${room.name}. ${room.hint} Entity state: ${threat.toLowerCase()}. Camera: ${CAMERA_META[state.camera?.nodeId]?.[0] || "wide"}.`;

  const successful = state.rooms?.[room.id]?.actions || [];
  const criticalSatisfied = room.id === "surgery" ? state.doors.theatre : room.id === "generator" ? state.doors.exit : true;
  const totalRequirements = room.requiredActions.length + (["surgery", "generator"].includes(room.id) ? 1 : 0);
  const metRequirements = room.requiredActions.filter(action => successful.includes(action)).length + (criticalSatisfied && ["surgery", "generator"].includes(room.id) ? 1 : 0);
  const roomProgress = totalRequirements ? Math.round(metRequirements / totalRequirements * 100) : state.doors.exit ? 100 : 50;
  $("#objectiveProgress").style.width = `${roomProgress}%`;
  $("#objectiveProgressTrack").setAttribute("aria-valuenow", String(roomProgress));
  $("#actionFeedback").textContent = state.lastOutcome || "Inspect the scene. Choose deliberately.";

  $("#storyThread").textContent = state.story?.wardenBound
    ? "WARDEN CONTAINED · MARA REMEMBERED"
    : state.story?.confessionDecoded
      ? "VALE BUILT THE WARDEN TO CONTAIN MARA"
      : state.story?.subjectIdentified
        ? "SUBJECT 06 · MARA VALE"
        : "SUBJECT 06 · IDENTITY UNKNOWN";
  $("#worldProp").classList.toggle("active", Object.values(state.doors).some(Boolean) || state.props.breakerProgress.length === 3);
  $("#worldProp").classList.toggle("discovered", state.evidence.length > 0);
  $("#foregroundRig").classList.toggle("active", room.id === "surgery" || room.id === "theatre");

  const sourceLabel = voteSourceLabel();
  $("#voteSource").textContent = sourceLabel;
  $("#overlaySource").textContent = sourceLabel;
  renderOptions($("#voteOptions"));
  renderOptions($("#overlayOptions"), true);
  renderFeed();

  const readiness = roomReadiness(state);
  $("#readinessStatus").textContent = readiness.ready ? "Readiness: all authored beats complete." : `Readiness: missing ${readiness.missing.join(" · ")}. Fallback support remains available.`;
  const progress = campaignProgress(state);
  const elapsedSeconds = Math.floor(progress.elapsedMs / 1000);
  $("#pacingStatus").textContent = state.campaign?.needsPacingBeat
    ? `Pacing prompt: ${elapsedSeconds}s elapsed with no meaningful action. Offer a clue or move camera. Rehearsal telemetry only.`
    : `Act ${progress.act} · ${elapsedSeconds}s rehearsal telemetry · not measured playtest data.`;

  $("#ending").classList.toggle("show", state.status === "ended");
  renderEnding();
  if (state.status === "ended" && !isPassiveView() && $("#app").dataset.view !== "gameplay") switchView("gameplay");
  setEndingOpen(state.status === "ended");

  document.body.classList.toggle("reduced-motion", state.settings.reducedMotion);
  document.body.classList.toggle("low-effects", state.settings.lowEffects);
  document.body.classList.toggle("high-contrast", state.settings.highContrast);
  audio.setReducedEffects(state.settings.lowEffects || state.settings.reducedMotion);
  audio.setVolume("master", state.settings.audioVolume);
  audio.setMuted("master", state.settings.audioMuted);
  for (const [id, key] of Object.entries({
    motionToggle: "reducedMotion",
    effectsToggle: "lowEffects",
    contrastToggle: "highContrast",
    namesToggle: "hideNames",
    scareToggle: "jumpscares"
  })) $("#" + id).checked = Boolean(state.settings[key]);
  $("#audioMuteToggle").checked = Boolean(state.settings.audioMuted);
  $("#audioVolume").value = String(Math.round(state.settings.audioVolume * 100));

  $("#gameplayPause").disabled = !["voting", "consequence", "paused"].includes(state.status);
  $("#gameplayPause").textContent = state.status === "paused" ? "▶" : "Ⅱ";
  $("#gameplayPause").setAttribute("aria-label", state.status === "paused" ? "Resume episode" : "Pause episode");
  $("#advanceRoom").disabled = advancing || ["briefing", "paused", "ended"].includes(state.status);
  $("#advanceRoom").textContent = advancing ? "Applying consequence…" : "Resolve consequence & advance room →";

  if (ownsControllerLease()) {
    const message = { type: "state", state: publicState(state) };
    channel?.postMessage(message);
    if (LOCAL_RELAY) {
      fetch("./__nightshift/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      }).catch(() => {});
    }
  }
}

function showToast(title, detail, danger = false) {
  const toast = $("#eventToast");
  toast.querySelector("b").textContent = title;
  toast.querySelector("span").textContent = detail;
  toast.style.borderColor = danger ? "var(--red)" : "var(--cyan)";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3800);
  announce(`${title}. ${detail}`);
}

function transitionRoom(fromRoom, toRoom) {
  audio.playTransition({ from: fromRoom, to: toRoom });
  if (audio.unlocked) audio.startAmbience(toRoom);
  if (!state.settings.lowEffects && !state.settings.reducedMotion) {
    $(".room-wipe").classList.remove("go");
    void $(".room-wipe").offsetWidth;
    $(".room-wipe").classList.add("go");
  }
}

function simulatedVote() {
  if (state.status !== "voting") return;
  const options = optionsFor(state);
  const option = options[Math.floor(Math.random() * options.length)];
  ingestCommand(state, demoNames[Math.floor(Math.random() * demoNames.length)], option.command);
  render();
}

function start({ userGesture = false } = {}) {
  clearTimeout(autoAdvanceTimer);
  advancing = false;
  startEpisode(state, Date.now(), 30000);
  if (userGesture) audio.unlock({ userGesture: true }).then(result => {
    if (result.unlocked) audio.startAmbience(roomFor(state).id);
  });
  lastRoom = 0;
  lastActionKey = "";
  lastCameraKey = "";
  lastInventoryKey = null;
  setIntroOpen(false);
  switchView("gameplay");
  showToast("EPISODE ARMED", "Audience voting is open in Reception / Triage");
  render();
  setTimeout(() => $("#objective").focus(), 0);
}

function advance() {
  if (advancing) return;
  if (state.status === "voting") resolveVote(state);
  if (state.status !== "consequence") {
    showToast("ADVANCE BLOCKED", "Resolve the current audience consequence first.", true);
    render();
    return;
  }
  if (state.winner) showToast(state.winner.label, state.winner.effect, state.winner.faction === "chaos");
  const expectedRoom = state.roomIndex;
  advancing = true;
  render();
  clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = setTimeout(() => {
    if (state.roomIndex !== expectedRoom || state.status !== "consequence") {
      advancing = false;
      render();
      return;
    }
    lastRoom = state.roomIndex;
    advanceRoom(state, Date.now(), 30000);
    advancing = false;
    if (state.lastAdvanceAccepted === false) showToast("ADVANCE BLOCKED", state.lastOutcome || "Room transition refused.", true);
    else if (state.roomIndex !== lastRoom) transitionRoom(ROOMS[lastRoom]?.id || "unknown", roomFor(state).id);
    lastActionKey = "";
    lastCameraKey = "";
    render();
  }, state.settings.reducedMotion ? 0 : 2600);
}

function togglePause() {
  if (state.status === "paused") {
    resumeEpisode(state);
    if (audio.unlocked) audio.startAmbience(roomFor(state).id);
    announce("Episode resumed");
  } else if (["voting", "consequence"].includes(state.status)) {
    pauseEpisode(state);
    audio.stopAmbience();
    announce("Episode paused");
  } else return;
  render();
}

function handleEvent(type, user = `demo_${Math.floor(Math.random() * 900)}`) {
  const result = applyChannelEvent(state, { id: `demo-${type}-${Date.now()}`, type, user, at: Date.now() });
  if (result.accepted) showToast(type.toUpperCase(), `${user} changed the physical state of the Ward`, type === "raid");
  render();
}

twitch.addEventListener("status", ({ detail }) => {
  $("#twitchStatus").textContent = detail.connected
    ? `Connected as ${detail.identity?.display_name || detail.identity?.login || "broadcaster"}`
    : detail.message || "Disconnected";
  state.mode = modeForTwitchStatus(detail, state.mode);
  announce($("#twitchStatus").textContent);
  render();
});
twitch.addEventListener("chat", ({ detail }) => {
  state.mode = "LIVE TWITCH";
  // Fairness is keyed to Twitch's immutable chatter ID. The display name is
  // kept only as the human-readable actor in the activity feed.
  ingestCommand(state, detail.viewerId || detail.viewer, detail.message, detail.viewer);
  render();
});
twitch.addEventListener("event", ({ detail }) => {
  state.mode = "LIVE TWITCH";
  applyChannelEvent(state, {
    ...detail,
    user: detail.actor,
    id: detail.sourceEventId || `twitch-${detail.type}-${detail.actorId || detail.actor || "anonymous"}-${Date.now()}`
  });
  render();
});
const oauthResume = twitch.resumeOAuthCallback();
if (oauthResume) {
  state.mode = "TWITCH CONNECTING";
  oauthResume.catch(error => {
    if (state.mode === "TWITCH CONNECTING") state.mode = "TWITCH ERROR";
    $("#twitchStatus").textContent = error.message;
    announce(error.message);
    render();
  });
}

$$("[data-view-target]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.viewTarget, true)));
$("#enterWard").addEventListener("click", () => start({ userGesture: true }));
$("#startShow").addEventListener("click", () => start({ userGesture: true }));
$("#pauseShow").addEventListener("click", () => {
  pauseEpisode(state);
  audio.stopAmbience();
  render();
  announce("Episode paused");
});
$("#resumeShow").addEventListener("click", () => {
  resumeEpisode(state);
  if (audio.unlocked) audio.startAmbience(roomFor(state).id);
  render();
  announce("Episode resumed");
});
$("#stopShow").addEventListener("click", () => {
  clearTimeout(autoAdvanceTimer);
  advancing = false;
  audio.stopAmbience();
  stopEpisode(state);
  render();
});
$("#advanceRoom").addEventListener("click", advance);
$("#gameplayPause").addEventListener("click", togglePause);
$("#restartEnding").addEventListener("click", () => {
  state.status = "briefing";
  $("#ending").classList.remove("show");
  setEndingOpen(false);
  switchView("dashboard", true);
  render();
});
$("#restoreCheckpoint").addEventListener("click", () => {
  const result = restoreCheckpoint(state);
  if (result.restored) {
    state = result.state;
    lastActionKey = "";
    lastCameraKey = "";
    lastInventoryKey = null;
    showToast("CHECKPOINT RESTORED", `Recovered ${roomFor(state).name}`);
  } else showToast("NO CHECKPOINT", result.reason, true);
  render();
});

$$("[data-trigger]").forEach(button => button.addEventListener("click", () => handleEvent(button.dataset.trigger)));
$("#sendChat").addEventListener("click", () => {
  const user = demoNames[Math.floor(Math.random() * demoNames.length)];
  const result = ingestCommand(state, user, $("#chatCommand").value);
  if (audio.unlocked) audio.playUI(result.accepted ? "vote" : "error");
  showToast(result.accepted ? "CHAT ACCEPTED" : "CHAT REJECTED", result.accepted ? `${user}: ${$("#chatCommand").value}` : result.reason, !result.accepted);
  render();
});

const settings = {
  motionToggle: "reducedMotion",
  effectsToggle: "lowEffects",
  contrastToggle: "highContrast",
  namesToggle: "hideNames",
  scareToggle: "jumpscares"
};
Object.entries(settings).forEach(([id, key]) => {
  $("#" + id).addEventListener("change", event => {
    state.settings[key] = event.target.checked;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    render();
  });
});
$("#audioMuteToggle").addEventListener("change", event => {
  state.settings.audioMuted = event.target.checked;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  render();
});
$("#audioVolume").addEventListener("input", event => {
  state.settings.audioVolume = Number(event.target.value) / 100;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  render();
});

$("#connectTwitch").addEventListener("click", async () => {
  try {
    const clientId = $("#clientId").value.trim();
    if (!clientId) throw new Error("Enter a Twitch Client ID");
    localStorage.setItem("nightshift-client-id", clientId);
    twitch.clientId = clientId;
    twitch.storage.setItem("nightshift.clientId", clientId);
    state.mode = "TWITCH CONNECTING";
    render();
    if (!twitch.token) {
      twitch.login(clientId);
      return;
    }
    await twitch.connect();
  } catch (error) {
    if (state.mode === "TWITCH CONNECTING") state.mode = "TWITCH ERROR";
    $("#twitchStatus").textContent = error.message;
    announce(error.message);
    render();
  }
});
$("#disconnectTwitch").addEventListener("click", () => {
  twitch.clear();
  state.mode = "SIMULATED";
  localStorage.removeItem("nightshift-client-id");
  $("#twitchStatus").textContent = "Simulation mode ready";
  render();
});

$("#scene").addEventListener("pointermove", event => {
  if (state.settings.reducedMotion) return;
  document.documentElement.style.setProperty("--mx", `${(event.clientX / innerWidth - .5) * -26}px`);
  document.documentElement.style.setProperty("--my", `${(event.clientY / innerHeight - .5) * -18}px`);
});

document.addEventListener("keydown", event => {
  const dialog = visibleDialog();
  if (dialog && event.key === "Tab") {
    const focusable = focusableIn(dialog);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (dialog === $("#cinematicIntro") && event.key === "Escape") {
    event.preventDefault();
    start({ userGesture: true });
    return;
  }
  const editable = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable;
  if (!dialog && !editable && $("#app").dataset.view === "gameplay" && (event.code === "KeyP" || event.key === "Escape")) {
    event.preventDefault();
    togglePause();
  }
});

function receivePublicMessage(message) {
  const incoming = message?.state;
  if (message?.type === "state" && isPassiveView() && isValidPublicState(incoming)) {
    state = incoming;
    render();
  }
}

channel?.addEventListener("message", event => receivePublicMessage(event.data));
window.addEventListener("beforeunload", () => {
  relayEvents?.close();
  try {
    const lease = JSON.parse(localStorage.getItem(CONTROLLER_LEASE_KEY) || "null");
    if (lease?.id === INSTANCE_ID) localStorage.removeItem(CONTROLLER_LEASE_KEY);
  } catch {}
});

const view = params.get("view") || "gameplay";
if (params.has("fixture") || params.get("autostart") === "rehearsal") document.body.classList.add("skip-intro");
switchView(view);
if (LOCAL_RELAY && (view === "overlay" || PASSIVE_MIRROR) && "EventSource" in window) {
  relayEvents = new EventSource("./__nightshift/events");
  relayEvents.addEventListener("message", event => {
    try { receivePublicMessage(JSON.parse(event.data)); }
    catch {}
  });
}
$("#clientId").value = localStorage.getItem("nightshift-client-id") || "";

if (params.get("autostart") === "rehearsal") {
  setIntroOpen(false);
  start();
} else if (params.get("fixture") === "camera-node") {
  setIntroOpen(false);
  start();
  const fixtureRoomIndex = ROOMS.findIndex(room => room.id === params.get("room"));
  const fixtureRoom = ROOMS[fixtureRoomIndex];
  const fixtureNode = params.get("camera");
  if (fixtureRoom && fixtureRoom.cameraNodes.includes(fixtureNode)) {
    state.mode = "REHEARSAL";
    state.roomIndex = fixtureRoomIndex;
    state.round = fixtureRoomIndex + 1;
    state.act = fixtureRoom.act;
    state.camera.nodeId = fixtureNode;
    state.camera.history = [fixtureNode];
    state.rooms[fixtureRoom.id].visited = true;
    state.rooms[fixtureRoom.id].cameraNode = fixtureNode;
    state.rooms[fixtureRoom.id].visitedNodes = [fixtureNode];
    $("#eventToast").classList.remove("show");
  }
} else if (params.get("fixture") === "surgery-door") {
  setIntroOpen(false);
  start();
  resolveVote(state, Date.now());
  advanceRoom(state, Date.now(), 30000);
  state.mode = "REHEARSAL";
  state.evidence = ["Triage transfer slip", "Intercom cadence"];
  state.power = 42;
  state.doors.isolation = true;
  state.doors.theatre = true;
  state.lastOutcome = "The bolts retract. The isolation door opens into real darkness.";
} else if (params.get("fixture") === "warden-warning") {
  setIntroOpen(false);
  start();
  resolveVote(state, Date.now());
  advanceRoom(state, Date.now(), 30000);
  state.mode = "REHEARSAL";
  state.danger = 78;
  state.warden.visible = true;
  state.warden.phase = "approaching";
  state.lastOutcome = "[Footsteps behind surgical plastic] The Warden is searching this corridor.";
} else {
  setIntroOpen(view === "gameplay");
}

if (PASSIVE_MIRROR) {
  setIntroOpen(false);
  $("#app").inert = true;
  document.body.classList.add("passive-mirror");
}

setInterval(() => {
  if (!isPassiveView()) {
    syncAudienceClock();
    if (audienceClockPausedAt === null) tick(state);
    if (state.status === "voting" && simulatedAudienceEnabled(state.mode) && Math.random() < .38) simulatedVote();
  }
  render();
}, 1000);
render();
