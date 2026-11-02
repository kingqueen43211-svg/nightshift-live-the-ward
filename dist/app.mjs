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
  "lobby-wide": ["LOBBY", "Scan reception and choose the first search"],
  "records-desk": ["RECORDS", "Inspect the torn intake record"],
  "locker-close": ["LOCKER", "Recover a survival resource"],
  "corridor-wide": ["CORRIDOR", "Locate the gurney, intercom, and isolation door"],
  "door-approach": ["GURNEY", "Read the restraint evidence"],
  threshold: ["THRESHOLD", "Commit to the isolation breach"],
  "theatre-wide": ["THEATRE", "Locate the lamp rig, tape deck, and Warden"],
  "lamp-array": ["LAMPS", "Prepare environmental counterplay"],
  "restraint-table": ["TABLE", "Decode the confession"],
  "generator-wide": ["GENERATOR", "Locate the breakers and service exit"],
  "breaker-close": ["BREAKERS", "Solve the 2 · 1 · 3 sequence"],
  "service-stairs": ["STAIRS", "Commit power to the escape grid"],
  "landing-wide": ["LANDING", "Check containment status and powered exits"],
  "roof-exit": ["ROOF", "Choose exposure and rescue"],
  "ambulance-tunnel": ["TUNNEL", "Choose the underground route"]
};
const CAMERA_COMPOSITIONS = {
  "lobby-wide": { x: 0, y: 0, zoom: 0, target: "records" },
  "records-desk": { x: 52, y: -8, zoom: .08, target: "records" },
  "locker-close": { x: -66, y: -5, zoom: .13, target: "locker" },
  "corridor-wide": { x: 0, y: 0, zoom: 0, target: "warden" },
  "door-approach": { x: 48, y: -4, zoom: .1, target: "gurney" },
  threshold: { x: -58, y: -2, zoom: .15, target: "door" },
  "theatre-wide": { x: 0, y: 0, zoom: 0, target: "warden" },
  "lamp-array": { x: -12, y: 34, zoom: .1, target: "lamps" },
  "restraint-table": { x: 8, y: -42, zoom: .14, target: "restraint" },
  "generator-wide": { x: 0, y: 0, zoom: 0, target: "generator" },
  "breaker-close": { x: -48, y: -2, zoom: .14, target: "breakers" },
  "service-stairs": { x: 55, y: -5, zoom: .1, target: "stairs" },
  "landing-wide": { x: 0, y: 0, zoom: 0, target: "routes" },
  "roof-exit": { x: -54, y: 16, zoom: .12, target: "roof" },
  "ambulance-tunnel": { x: 54, y: -22, zoom: .14, target: "tunnel" }
};
const ITEM_HELP = {
  "Trauma kit": "+25 vitals",
  "Sedative ampoule": "−25 fear · −5 threat",
  "Stabilized trauma kit": "+40 vitals · −20 fear",
  "Subscriber flare": "−18 threat · repel Warden",
  "Audience shield": "arm one-hit protection"
};
const MISSING_STEP_LABELS = {
  "search-desk": "search the records desk",
  "open-locker": "open the medication locker",
  "reconstruct-file": "reconstruct the intake file",
  "identify-subject-06": "identify Subject 06",
  "inspect-gurney": "inspect the restraint gurney",
  "listen-intercom": "decode the intercom cadence",
  "force-door": "breach the isolation door",
  "open-theatre-route": "open the route into theatre",
  "align-lamps": "align the surgical lamps",
  "play-tape": "decode the confession",
  "counter-warden": "counter the Warden",
  "decode-confession": "decode Dr. Vale's confession",
  "survive-warden-counter": "survive and recover the binding sigil",
  "breaker-1": "throw breaker 1 in sequence",
  "breaker-2": "start with breaker 2",
  "breaker-3": "finish with breaker 3",
  "reroute-power": "reroute power to the exits",
  "complete-breaker-sequence": "complete breaker sequence 2 · 1 · 3",
  "restore-exit-power": "restore the emergency exit grid"
};
const USABLE_ITEMS = new Set(["Trauma kit", "Sedative ampoule", "Stabilized trauma kit", "Subscriber flare", "Audience shield"]);

let state = createState();
let lastRoom = 0;
let toastTimer;
let autoAdvanceTimer;
let cameraTimer;
let sceneBeatTimers = [];
let roomTransitionTimer;
let wardenReactionTimer;
let cinematicBeatTimer;
let wardenReactionVisible = false;
let cameraMotion = null;
let audioCaptionTimer;
let advancing = false;
let lastActionKey = "";
let lastCameraKey = "";
let lastInventoryKey = null;
let endingWasOpen = false;
let lastAudioWardenPhase = null;
let lastRenderedAudioCueAt = "";
let lastAudienceAudioKey = "";
let lastEndingAudioKey = "";
let lastEndingRenderKey = "";
let lastPacingPromptKey = "";
let lastEffectPulseAt = 0;
let lastScoreRoom = "";
let audienceClockPausedAt = null;
let relayEvents = null;
let helpReturnFocus = null;

try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
  if (saved && typeof saved === "object") Object.assign(state.settings, saved);
  else state.settings.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
} catch {
  state.settings.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
}
state.settings.audioMuted ??= false;
state.settings.audioVolume ??= .78;
state.settings.audioEffectsVolume ??= .82;
state.settings.audioAmbienceVolume ??= .46;
state.settings.audioMusicVolume ??= .38;
state.settings.compactHud ??= false;
state.settings.captionEnabled ??= true;
state.settings.captionSize ??= "medium";
state.settings.captionBackground ??= "solid";
state.settings.captionSpeakerLabels ??= true;
state.settings.captionDirectional ??= true;
state.settings.captionDuration ??= 5200;
if (params.get("hud") === "compact") state.settings.compactHud = true;

const audio = createNightShiftAudio({
  reducedEffects: state.settings.lowEffects,
  volumes: {
    master: state.settings.audioVolume,
    effects: state.settings.audioEffectsVolume,
    ambience: state.settings.audioAmbienceVolume,
    music: state.settings.audioMusicVolume
  },
  onCaption: ({ cue, text, at = Date.now(), speaker, direction }) => {
    if (cue === "ui-click") return;
    state.lastAudioCue = {
      cue: String(cue || "sound").slice(0, 120),
      text: String(text || "").slice(0, 500),
      at,
      ...(typeof speaker === "string" ? { speaker: speaker.slice(0, 80) } : {}),
      ...(Number.isFinite(direction) ? { direction: Math.max(-1, Math.min(1, direction)) } : {})
    };
    displayAudioCue(state.lastAudioCue);
  }
});
audio.setMuted("master", state.settings.audioMuted);

function displayAudioCue(detail) {
  if (!detail?.text || !Number.isFinite(detail.at)) return;
  const cueKey = `${detail.at}|${detail.cue}|${detail.text}`;
  if (cueKey === lastRenderedAudioCueAt) return;
  lastRenderedAudioCueAt = cueKey;
  const targets = [$("#audioCaption"), $("#overlayAudioCaption")].filter(Boolean);
  if (!state.settings.captionEnabled) {
    for (const target of targets) target.hidden = true;
    return;
  }
  const cue = String(detail.cue || "sound");
  const speaker = detail.speaker || (cue.startsWith("warden") ? "WARDEN" : cue.startsWith("audience") ? "AUDIENCE" : cue.startsWith("score") ? "SCORE" : cue === "ambience" ? "ENVIRONMENT" : "NIGHTSHIFT");
  const direction = Number.isFinite(detail.direction)
    ? detail.direction < -.12 ? "LEFT" : detail.direction > .12 ? "RIGHT" : "CENTER"
    : "";
  const label = [state.settings.captionSpeakerLabels ? speaker : "SOUND CAPTION", state.settings.captionDirectional && direction ? direction : ""].filter(Boolean).join(" · ");
  for (const target of targets) {
    target.querySelector("span").textContent = detail.text;
    target.querySelector("small").textContent = label;
    target.dataset.cue = cue.startsWith("warden") ? "warden" : cue;
    target.hidden = false;
  }
  clearTimeout(audioCaptionTimer);
  audioCaptionTimer = setTimeout(() => {
    for (const target of targets) target.hidden = true;
  }, Math.max(3000, Math.min(8000, Number(state.settings.captionDuration) || 5200)));
}

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
  if ($("#helpDialog")?.open) return $("#helpDialog");
  if (!$("#cinematicIntro").classList.contains("dismissed")) return $("#cinematicIntro");
  if ($("#ending").classList.contains("show")) return $("#ending");
  return null;
}

function openHelp(trigger = document.activeElement) {
  const dialog = $("#helpDialog");
  helpReturnFocus = trigger instanceof HTMLElement ? trigger : $("#helpToggle");
  if (!dialog.open) dialog.showModal();
  setTimeout(() => $("#helpClose").focus(), 0);
}

function closeHelp() {
  const dialog = $("#helpDialog");
  if (dialog.open) dialog.close();
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
  const surgeryActions = state.rooms?.surgery?.actions || [];
  const wardCluesReady = ["inspect-gurney", "listen-intercom"].every(step => surgeryActions.includes(step));
  const audienceResolved = state.status === "consequence" || Boolean(state.winner);
  const darkCounterReady = state.winner?.id === "dark" && surgeryActions.includes("hide-curtain");
  const isolationRouteReady = state.winner?.id === "open" && state.doors.isolation;
  const restoredRouteReady = state.power >= 20 && audienceResolved;
  const wardMissing = [];
  if (!surgeryActions.includes("inspect-gurney")) wardMissing.push("inspect restraint marks");
  if (!surgeryActions.includes("listen-intercom")) wardMissing.push("decode the intercom");
  if (!audienceResolved) wardMissing.push("resolve the audience round");
  if (state.winner?.id === "dark" && !darkCounterReady) wardMissing.push("hide behind the curtain");
  const gates = {
    "reconstruct-file": [state.props.desk && state.props.locker, "Needs desk + locker"],
    "force-door": [wardCluesReady && audienceResolved && (restoredRouteReady || isolationRouteReady || darkCounterReady), wardMissing.length ? `First: ${wardMissing.join(" · ")}` : state.winner?.id === "dark" ? "Manual breach costs 10 vitals" : "Return to the threshold and cross isolation"],
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

function clearSceneBeat() {
  sceneBeatTimers.forEach(timer => clearTimeout(timer));
  sceneBeatTimers = [];
  delete $("#scene").dataset.sceneBeat;
}

function playSceneBeat(action, accepted) {
  clearSceneBeat();
  clearTimeout(cinematicBeatTimer);
  document.body.classList.remove("cinematic-beat");
  const scene = $("#scene");
  if (!accepted) {
    audio.playAction(action, {
      accepted: false,
      reason: state.lastOutcome || actionRequirement(action).cue,
      roomId: roomFor(state).id
    });
    scene.dataset.sceneBeat = `${action}:blocked`;
    sceneBeatTimers.push(setTimeout(() => delete scene.dataset.sceneBeat, state.settings.reducedMotion ? 0 : 520));
    return;
  }
  audio.playAction(action, {
    accepted: true,
    effect: state.lastOutcome,
    roomId: roomFor(state).id,
    pan: /locker|roof|ambulance|breaker-3/.test(action) ? .28 : /desk|lamp|breaker-1/.test(action) ? -.28 : 0
  });
  if (!state.settings.reducedMotion) {
    document.body.classList.add("cinematic-beat");
    cinematicBeatTimer = setTimeout(() => document.body.classList.remove("cinematic-beat"), 1900);
  }
  const sequences = {
    "force-door": [["anticipation", 0], ["bolts", 260], ["swing", 720], ["settle", 1420]],
    "hide-curtain": [["close", 0], ["hold", 420], ["release", 1250]],
    "counter-warden": [["impact", 0], ["repel", 360], ["retreat", 1050]],
    "search-desk": [["highlight", 0], ["collect", 380]],
    "open-locker": [["highlight", 0], ["collect", 380]],
    "reconstruct-file": [["highlight", 0], ["collect", 380]],
    "breaker-1": [["anticipation", 0], ["impact", 280]],
    "breaker-2": [["anticipation", 0], ["impact", 280]],
    "breaker-3": [["anticipation", 0], ["impact", 280]],
    "reroute-power": [["anticipation", 0], ["impact", 360], ["complete", 900]],
    "seal-warden": [["sigil", 0], ["bind", 480], ["sealed", 1320]],
    "open-roof": [["unlock", 0], ["swing", 420], ["dawn", 1180]],
    "open-ambulance": [["unlock", 0], ["rise", 420], ["open", 1180]]
  };
  const sequence = sequences[action] || [["impact", 0], ["complete", 420]];
  if (state.settings.reducedMotion || state.settings.lowEffects) {
    scene.dataset.sceneBeat = `${action}:complete`;
    sceneBeatTimers.push(setTimeout(() => delete scene.dataset.sceneBeat, 0));
    return;
  }
  for (const [phase, delay] of sequence) {
    sceneBeatTimers.push(setTimeout(() => { scene.dataset.sceneBeat = `${action}:${phase}`; }, delay));
  }
  const finalDelay = sequence.at(-1)[1] + 620;
  sceneBeatTimers.push(setTimeout(() => delete scene.dataset.sceneBeat, finalDelay));
}

function performAction(action) {
  playerAction(state, action);
  const accepted = state.lastActionAccepted !== false;
  playSceneBeat(action, accepted);
  if (accepted && action === "counter-warden") {
    wardenReactionVisible = true;
    clearTimeout(wardenReactionTimer);
    wardenReactionTimer = setTimeout(() => {
      wardenReactionVisible = false;
      render();
    }, state.settings.reducedMotion ? 0 : 1500);
  }
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
    const label = action === "force-door" && state.winner?.id === "open" ? "Cross isolation threshold" : actionLabel(action);
    const reasonId = `action-reason-${action}`;
    return `<button data-action="${escape(action)}" class="${completed ? "completed" : ""} ${requirement.ready ? "" : "locked"}" title="${escape(completed ? "Action already complete" : requirement.cue)}" aria-disabled="${String(Boolean(completed || !requirement.ready))}" aria-describedby="${escape(reasonId)}" ${completed || !requirement.ready ? "disabled" : ""}><small>${status} · 0${index + 1}</small><b>${escape(label)}</b><em id="${escape(reasonId)}">${escape(completed ? "Completed" : requirement.ready ? "Ready" : requirement.cue)}</em></button>`;
  }).join("");
  $$("[data-action]").forEach(button => button.addEventListener("click", () => performAction(button.dataset.action)));
  if (focusedAction) $("[data-action='" + CSS.escape(focusedAction) + "']")?.focus();
}

function selectCamera(nodeId) {
  if (state.camera?.moving) return;
  const fromNode = state.camera?.nodeId || roomFor(state).cameraNodes[0];
  if (fromNode === nodeId) return;
  const result = enterCameraNode(state, nodeId);
  if (!result.accepted) {
    showToast("CAMERA BLOCKED", result.reason, true);
    return;
  }
  state.camera.moving = !state.settings.reducedMotion;
  cameraMotion = state.camera.moving ? { from: fromNode, to: nodeId } : null;
  audio.playUI("click");
  render();
  announce(state.camera.moving ? `Camera traveling to ${CAMERA_META[nodeId]?.[0] || nodeId}` : `Camera moved to ${CAMERA_META[nodeId]?.[0] || nodeId}`);
  clearTimeout(cameraTimer);
  cameraTimer = setTimeout(() => {
    state.camera.moving = false;
    cameraMotion = null;
    render();
    announce(`Camera settled at ${CAMERA_META[nodeId]?.[0] || nodeId}`);
  }, state.settings.reducedMotion ? 0 : 960);
}

function applyCameraComposition(activeNode) {
  const scene = $("#scene");
  const composition = CAMERA_COMPOSITIONS[activeNode] || CAMERA_COMPOSITIONS[roomFor(state).cameraNodes[0]];
  const duration = state.settings.reducedMotion ? "0ms" : "920ms";
  $$("#scene .layer").forEach(layer => {
    const depth = Number(layer.dataset.depth || 0);
    const travel = .32 + depth * 2.35;
    layer.style.setProperty("--camera-layer-x", `${Math.round(composition.x * travel)}px`);
    layer.style.setProperty("--camera-layer-y", `${Math.round(composition.y * travel)}px`);
    layer.style.setProperty("--camera-layer-scale", String(1 + composition.zoom * (.4 + depth * 1.35)));
    layer.style.setProperty("--camera-duration", duration);
  });
  scene.style.setProperty("--camera-direction", String(cameraMotion && (CAMERA_COMPOSITIONS[cameraMotion.to]?.x || 0) < (CAMERA_COMPOSITIONS[cameraMotion.from]?.x || 0) ? -1 : 1));
  scene.style.setProperty("--camera-light-shift", `${Math.round(composition.x * .12)}px`);
  scene.dataset.cameraMoving = String(Boolean(state.camera?.moving));
  if (cameraMotion) {
    scene.dataset.cameraFrom = cameraMotion.from;
    scene.dataset.cameraTo = cameraMotion.to;
  } else {
    delete scene.dataset.cameraFrom;
    delete scene.dataset.cameraTo;
  }
  scene.setAttribute("aria-busy", String(Boolean(state.camera?.moving)));
  const target = $("#sceneTarget");
  target.dataset.sceneTarget = composition.target;
  const targetBoxes = {
    records: [38, 27, 22, 25], locker: [46, 27, 18, 27], warden: [40, 27, 24, 30], gurney: [43, 37, 22, 18], door: [42, 25, 20, 33], lamps: [38, 25, 26, 23], restraint: [38, 38, 27, 19], generator: [39, 24, 25, 33], breakers: [42, 25, 22, 32], stairs: [38, 24, 22, 33], routes: [39, 24, 24, 33], roof: [44, 23, 20, 34], tunnel: [36, 36, 24, 21]
  };
  const [left, top, width, height] = targetBoxes[composition.target] || [40, 20, 22, 38];
  target.style.cssText = `--target-left:${left}%;--target-top:${top}%;--target-width:${width}%;--target-height:${height}%`;
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
  $("#cameraRail").inert = Boolean(state.camera?.moving);
  $("#cameraRail").setAttribute("aria-disabled", String(Boolean(state.camera?.moving)));
  $("#cameraCue").textContent = CAMERA_META[activeNode]?.[1] || "Authored scene view";
  $("#scene").dataset.cameraNode = activeNode;
  $("#scene").dataset.cameraIndex = String(Math.max(0, room.cameraNodes.indexOf(activeNode)));
  applyCameraComposition(activeNode);
}

function itemEligibility(item) {
  if (item === "Trauma kit" && state.health >= 100) return { ready: false, reason: "VITALS MAX" };
  if (item === "Sedative ampoule" && state.player.fear <= 0 && state.danger <= 0) return { ready: false, reason: "FEAR + THREAT STABLE" };
  if (item === "Stabilized trauma kit" && state.health >= 100 && state.player.fear <= 0) return { ready: false, reason: "VITALS + FEAR STABLE" };
  if (item === "Subscriber flare" && state.danger <= 0 && !state.warden.visible && state.warden.phase === "repelled") return { ready: false, reason: "WARDEN ALREADY REPELLED" };
  if (item === "Audience shield" && state.shield) return { ready: false, reason: "SHIELD ALREADY ARMED" };
  return { ready: true, reason: ITEM_HELP[item] || "Use at the right moment" };
}

function inventoryButtons() {
  const usable = state.inventory.filter(item => USABLE_ITEMS.has(item));
  const canCraft = state.inventory.includes("Sedative ampoule") && state.inventory.includes("Trauma kit");
  const useButtons = usable.map(item => {
    const eligibility = itemEligibility(item);
    return `<button data-use-item="${escape(item)}" class="${eligibility.ready ? "" : "unavailable"}" title="${escape(eligibility.reason)}" ${eligibility.ready ? "" : "disabled"}><b>USE ${escape(item)}</b><small>${escape(eligibility.reason)}</small></button>`;
  }).join("");
  return `${canCraft ? '<button data-craft="stabilized"><b>CRAFT STABILIZED KIT</b><small>Combines healing + fear control</small></button>' : ""}${useButtons}`;
}

function renderInventory() {
  const key = [state.inventory.join("|"), state.health, state.player.fear, state.player.noise, state.danger, state.shield, state.warden.phase, state.lastItemEffect?.at || 0].join("|");
  if (key === lastInventoryKey) return;
  lastInventoryKey = key;
  const tags = state.inventory.length
    ? state.inventory.map(item => `<span class="item-tag">${escape(item)}</span>`).join("")
    : '<span class="item-empty">No carried items</span>';
  const buttons = inventoryButtons();
  $("#inventoryActions").innerHTML = `<div class="item-tags">${tags}</div>${buttons}`;
  $("#quickItems").innerHTML = buttons;
  $("#quickItems").hidden = !buttons;
  $("#conditionStrip").innerHTML = `<span>FEAR <b>${escape(state.player.fear)}</b></span><span>NOISE <b>${escape(state.player.noise)}</b></span><span>SHIELD <b>${state.shield ? "ARMED" : "OFF"}</b></span>`;
  const itemEffect = state.lastItemEffect;
  const effectPanel = $("#itemEffectSummary");
  effectPanel.classList.toggle("blocked", Boolean(itemEffect && !itemEffect.accepted));
  effectPanel.querySelector("span").textContent = itemEffect?.summary || "No item used yet. Effects will remain visible here.";
  effectPanel.querySelector(".item-effect-list")?.remove();
  if (itemEffect?.effects?.length) {
    effectPanel.insertAdjacentHTML("beforeend", `<div class="item-effect-list">${itemEffect.effects.map(effect =>
      `<span class="effect-chip" data-effect-kind="${escape(effect.key)}">${escape(effect.label)} <b>${escape(effect.before)} → ${escape(effect.after)}</b></span>`
    ).join("")}</div>`);
  }
  if (itemEffect?.accepted && itemEffect.at !== lastEffectPulseAt) {
    lastEffectPulseAt = itemEffect.at;
    const meterIds = { health: "#healthMeter", danger: "#dangerMeter" };
    for (const effect of itemEffect.effects || []) {
      const meter = $(meterIds[effect.key]);
      if (!meter) continue;
      meter.classList.remove("effect-pulse");
      void meter.offsetWidth;
      meter.classList.add("effect-pulse");
      setTimeout(() => meter.classList.remove("effect-pulse"), 800);
    }
  }
  $$("[data-use-item]").forEach(button => button.addEventListener("click", () => {
    const result = useInventoryItem(state, button.dataset.useItem);
    audio.playItem(button.dataset.useItem, {
      accepted: result.accepted,
      reason: result.reason,
      effect: result.summary
    });
    showToast(result.accepted ? "ITEM EFFECT APPLIED" : "ITEM RETAINED", result.accepted ? result.summary : result.reason, !result.accepted);
    render();
  }));
  $$("[data-craft]").forEach(button => button.addEventListener("click", () => {
    const result = combineInventoryItems(state, "Sedative ampoule", "Trauma kit");
    audio.playItem("Stabilized trauma kit", {
      accepted: result.accepted,
      reason: result.reason,
      effect: result.summary || state.lastOutcome
    });
    showToast(result.accepted ? "ITEM CRAFTED" : "CRAFT BLOCKED", result.accepted ? result.summary || state.lastOutcome : result.reason, !result.accepted);
    render();
  }));
}

function renderEnding() {
  $("#endingTitle").textContent = state.ending || "";
  const recap = state.endingRecap;
  if (!recap) {
    $("#endingRecap").innerHTML = "";
    lastEndingAudioKey = "";
    lastEndingRenderKey = "";
    return;
  }
  const endingRenderKey = JSON.stringify([
    recap.ending,
    recap.route,
    recap.evidence,
    recap.wardenBound,
    recap.audienceResolutions,
    recap.zeroChatFallbacks,
    recap.streamerDecisions
  ]);
  if (endingRenderKey === lastEndingRenderKey) return;
  lastEndingRenderKey = endingRenderKey;
  const audienceChoices = Math.max(0, (recap.audienceResolutions || 0) - (recap.zeroChatFallbacks || 0));
  const route = ["roof", "ambulance", "contain"].includes(recap.route) ? recap.route : "unknown";
  const doomed = /CLAIMS|WITHOUT ANSWERS/.test(recap.ending || "") || state.health <= 0;
  const humane = Boolean(recap.wardenBound) || /MARA WALKS/.test(recap.ending || "");
  const endingTone = humane ? "humane" : doomed ? "doomed" : "unresolved";
  const ending = $("#ending");
  ending.dataset.route = route;
  ending.dataset.endingTone = endingTone;
  $("#endingRouteBadge").textContent = `ROUTE · ${route === "ambulance" ? "TUNNEL" : route.toUpperCase()}`;
  $("#endingCauseBadge").textContent = humane ? "CAUSE · TRUTH + MERCY" : doomed ? "CAUSE · THREAT OVERWHELMED" : "CAUSE · ESCAPE TRADE-OFF";
  $("#endingSummary").textContent = audienceChoices
    ? "The streamer and audience shaped this ending together."
    : "The streamer completed this run with disclosed director fallbacks.";
  const decisionLabels = (recap.streamerDecisions || []).slice(-4).map(decision => actionLabel(decision.action));
  const audienceCause = audienceChoices
    ? `${audienceChoices} verified audience consequence${audienceChoices === 1 ? "" : "s"}`
    : `${recap.zeroChatFallbacks || 0} disclosed director fallback${recap.zeroChatFallbacks === 1 ? "" : "s"}`;
  $("#endingCause").textContent = `${humane ? "Mara was identified and the Warden was bound." : doomed ? "The Ward remained stronger than the escape plan." : "The route opened, but part of the case remained unresolved."} The run carried ${audienceCause}.`;
  $("#endingChoiceTrace").innerHTML = decisionLabels.length
    ? decisionLabels.map((label, index) => `<span><b>0${index + 1}</b>${escape(label)}</span>`).join("")
    : "<span><b>—</b>No decisive streamer actions recorded.</span>";
  const mechanics = recap.mechanics?.length ? recap.mechanics.join(" · ") : "core exploration";
  $("#endingRecap").innerHTML = `
    <span>ROUTE<b>${escape(String(recap.route || "unknown").toUpperCase())}</b></span>
    <span>EVIDENCE<b>${escape(recap.evidence)}</b></span>
    <span>TRUTH<b>${recap.confessionDecoded ? "DECODED" : "INCOMPLETE"}</b></span>
    <span>WARDEN<b>${recap.wardenBound ? "BOUND" : "UNCONTAINED"}</b></span>
    <span>AUDIENCE<b>${audienceChoices}</b></span>
    <span>FALLBACKS<b>${escape(recap.zeroChatFallbacks || 0)}</b></span>
    <p>${escape(mechanics)}</p>`;
  const endingAudioKey = `${recap.ending}|${route}|${endingTone}`;
  if (!isPassiveView() && endingAudioKey !== lastEndingAudioKey) {
    lastEndingAudioKey = endingAudioKey;
    audio.stopAmbience({ caption: false });
    audio.stopScore({ caption: false });
    const audioEnding = doomed ? "failure" : humane ? "humane" : route === "ambulance" ? "tunnel" : route === "roof" ? "roof" : "failure";
    audio.playEnding({ ending: audioEnding, title: recap.ending || "" });
  }
}

function missingStepText(missing = []) {
  return missing.map(step => MISSING_STEP_LABELS[step] || actionLabel(step)).join(" · ");
}

function wardChecklistModel() {
  const actions = state.rooms?.surgery?.actions || [];
  const inspectDone = actions.includes("inspect-gurney");
  const intercomDone = actions.includes("listen-intercom");
  const cluesDone = inspectDone && intercomDone;
  const audienceDone = state.status === "consequence" || Boolean(state.winner);
  const hideRequired = state.winner?.id === "dark";
  const hideDone = actions.includes("hide-curtain");
  const breachDone = actions.includes("force-door");
  const raw = [
    { id: "inspect", label: "Inspect restraint marks", detail: "Move to GURNEY and read tag 06.", done: inspectDone, unlocked: true, camera: "door-approach" },
    { id: "intercom", label: "Decode the intercom", detail: "Listen for the short · short · long magnetic cycle.", done: intercomDone, unlocked: true, camera: "corridor-wide" },
    { id: "audience", label: "Resolve audience consequence", detail: "Use a displayed command; if chat is quiet, the disclosed safe fallback is announced.", done: audienceDone, unlocked: cluesDone, camera: null },
    { id: "hide", label: hideRequired ? "Hide behind the curtain" : "Curtain countermeasure", detail: hideRequired ? "Lights failed. Hide first to prepare the manual breach." : "Only required if the audience kills the lights.", done: !hideRequired || hideDone, unlocked: audienceDone && hideRequired, optional: !hideRequired, camera: "corridor-wide" },
    { id: "breach", label: state.winner?.id === "open" ? "Cross isolation threshold" : "Breach isolation door", detail: "Return to THRESHOLD and make the physical move into theatre.", done: breachDone, unlocked: actionRequirement("force-door").ready, camera: "threshold" }
  ];
  let currentFound = false;
  return raw.map(step => {
    const current = !currentFound && !step.done && step.unlocked;
    if (current) currentFound = true;
    return { ...step, current };
  });
}

function nextStepModel(room = roomFor(state), readiness = roomReadiness(state)) {
  const nextRoom = ROOMS[state.roomIndex + 1];
  const isFinal = room.id === "stairwell";
  if (state.status === "briefing") return { phase: "briefing", title: "Start the episode", detail: "Enter the Ward to begin Reception / Triage.", label: "Start from the Control Room", disabled: true };
  if (state.status === "paused") return { phase: "paused", title: "Episode paused", detail: "Resume when the streamer and audience are ready.", label: "Paused", disabled: true };
  if (state.status === "ended") return { phase: "ended", title: "Episode complete", detail: state.ending || "Review the ending recap.", label: "Complete", disabled: true };
  const successful = state.rooms?.[room.id]?.actions || [];
  if (room.id === "surgery") {
    const steps = wardChecklistModel();
    const current = steps.find(step => step.current);
    const breachDone = successful.includes("force-door");
    if (!breachDone && current?.id !== "audience") {
      return { phase: "ward-checklist", title: `Ward 06 · ${current?.label || "Follow the corridor checklist"}`, detail: current?.detail || "Complete the visible corridor steps in order.", label: "Complete the highlighted step", disabled: true, steps };
    }
    if (!breachDone && current?.id === "audience") {
      const votes = totalVotes();
      return { phase: "audience-gate", title: "Resolve the corridor audience consequence", detail: votes ? `${votes} verified ${votes === 1 ? "vote is" : "votes are"} ready. Lock the result; the streamer still makes the door move.` : "No votes yet. Resolving uses the disclosed safe fallback—never a fabricated viewer.", label: "Resolve corridor vote", disabled: advancing, steps };
    }
    if (!breachDone) {
      return { phase: "ward-checklist", title: "Return to the isolation threshold", detail: actionRequirement("force-door").cue, label: "Use the highlighted door action", disabled: true, steps };
    }
  }
  const audienceUnlockReady = room.id === "surgery" && state.status === "voting" && ["inspect-gurney", "listen-intercom"].every(action => successful.includes(action));
  if (audienceUnlockReady) {
    const votes = totalVotes();
    return { phase: "audience-gate", title: "The isolation door needs the audience power result", detail: votes ? `${votes} verified ${votes === 1 ? "vote is" : "votes are"} ready. Resolve the corridor consequence, then breach the physical door.` : "Resolve the disclosed safe fallback to restore corridor power, then breach the physical door.", label: "Resolve corridor vote", disabled: advancing };
  }
  if (!readiness.ready && !isFinal) {
    const missing = missingStepText(readiness.missing);
    return { phase: "incomplete", title: "Complete the authored objective", detail: `Still required: ${missing}.`, label: "Complete objective", disabled: true };
  }
  if (state.status === "voting") {
    const votes = totalVotes();
    if (isFinal) return { phase: "ready", title: "Final audience decision is open", detail: votes ? `${votes} verified ${votes === 1 ? "vote is" : "votes are"} ready. Lock the result, then choose your physical route.` : "No votes yet. Resolving now uses the disclosed safe fallback, then the streamer chooses a route.", label: "Resolve final vote", disabled: advancing };
    return { phase: "ready", title: "Objective complete — the route is ready", detail: votes ? `${votes} verified ${votes === 1 ? "vote" : "votes"} will change the Ward before you enter ${nextRoom.name}.` : `No chat votes yet. Continuing uses the disclosed director fallback before ${nextRoom.name}.`, label: `Resolve & enter ${nextRoom.name} →`, disabled: advancing };
  }
  if (state.status === "consequence") {
    const winner = state.winner;
    if (isFinal) return { phase: "final-choice", title: winner ? `${winner.label} won the final vote` : "Final vote resolved", detail: `${winner?.effect || "The audience consequence is locked."} Optionally seal the Warden, then choose Roof or Ambulance; chat cannot make that move for you.`, label: "Choose Roof or Ambulance above", disabled: true };
    return { phase: "consequence", title: winner ? `${winner.label} changed the Ward` : "Audience consequence locked", detail: `${winner?.effect || "The consequence is ready."} Enter ${nextRoom.name} when ready.`, label: `Enter ${nextRoom.name} →`, disabled: advancing };
  }
  return { phase: state.status, title: "Follow the current objective", detail: room.hint, label: "Continue", disabled: true };
}

function renderNextStep(room, readiness) {
  const model = nextStepModel(room, readiness);
  const panel = $("#nextStep");
  panel.dataset.phase = model.phase;
  $("#nextStepTitle").textContent = advancing ? "Opening the route…" : model.title;
  $("#nextStepDetail").textContent = model.detail;
  const checklist = $("#wardChecklist");
  if (checklist) {
    const steps = model.steps || (room.id === "surgery" ? wardChecklistModel() : []);
    checklist.hidden = room.id !== "surgery";
    checklist.innerHTML = steps.map(step => `<button type="button" data-ward-step="${escape(step.id)}" ${step.camera ? `data-ward-camera="${escape(step.camera)}"` : ""} class="${step.done ? "done" : step.current ? "current" : step.optional ? "optional" : "locked"}" ${!step.camera || (!step.unlocked && !step.done) ? "disabled" : ""}><i aria-hidden="true">${step.done ? "✓" : step.current ? "→" : step.optional ? "◇" : "·"}</i><span><b>${escape(step.label)}</b><small>${escape(step.detail)}</small></span>${step.camera ? `<em>${escape(CAMERA_META[step.camera]?.[0] || "VIEW")}</em>` : ""}</button>`).join("");
    $$('[data-ward-camera]').forEach(button => button.addEventListener("click", () => selectCamera(button.dataset.wardCamera)));
  }
  const gameplayButton = $("#gameplayAdvance");
  gameplayButton.textContent = advancing ? "Opening route…" : model.label;
  gameplayButton.disabled = model.disabled || advancing;
  $("#dashNext").textContent = model.title;
  return model;
}

function audienceStatusText() {
  const votes = totalVotes();
  if (state.status === "voting") return `OPEN · ${votes} verified ${votes === 1 ? "vote" : "votes"} · one vote per immutable viewer ID · winner changes the Ward`;
  if (state.status === "consequence" && state.winner) return `LOCKED · ${state.winner.label} · ${state.winner.effect}`;
  if (state.status === "paused") return "PAUSED · Audience clock and input are held";
  if (state.status === "ended") return `COMPLETE · ${state.ending || "ending recorded"}`;
  return "STANDBY · Start the episode to open audience voting";
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
  displayAudioCue(state.lastAudioCue);
  $("#scene").dataset.room = room.id;
  if (!isPassiveView() && ["voting", "consequence"].includes(state.status)) {
    const tension = Math.max(0, Math.min(1, state.danger / 100));
    if (lastScoreRoom !== room.id) {
      lastScoreRoom = room.id;
      audio.startScore(room.id, { tension, caption: true });
    } else audio.setTension(tension, { caption: true });
  }
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

  $("#warden").classList.toggle("visible", (state.warden.visible || wardenReactionVisible) && state.settings.jumpscares);
  $("#warden").dataset.phase = state.warden.phase || "dormant";
  const audibleWardenPhase = ["warning", "approaching", "striking", "passing", "repelled", "retreating", "sealed"].includes(state.warden.phase) ? state.warden.phase : null;
  if (!isPassiveView() && audibleWardenPhase && audibleWardenPhase !== lastAudioWardenPhase) {
    audio.playWardenPhase({
      phase: audibleWardenPhase,
      intensity: state.danger / 100,
      direction: state.camera?.nodeId === "door-approach" ? .45 : state.camera?.nodeId === "threshold" ? -.45 : 0
    });
  }
  lastAudioWardenPhase = audibleWardenPhase;
  const wardenAsset = state.warden.phase === "repelled"
    ? "warden-repelled-v1.webp"
    : state.warden.phase === "warning" || state.warden.phase === "passing"
      ? "warden-warning-v1.webp"
      : "warden-approach-v1.webp";
  const wardenVisible = (state.warden.visible || wardenReactionVisible) && state.settings.jumpscares;
  if (wardenVisible && !$("#wardenSprite").src.endsWith(wardenAsset)) $("#wardenSprite").src = `./assets/v3/${wardenAsset}`;
  $(".blackout").style.opacity = state.power < 15 ? ".28" : "0";
  $(".alarm").style.opacity = !state.settings.lowEffects && state.danger > 70 ? "1" : "0";

  const doorOpen = room.id !== "surgery" || state.doors.isolation || state.doors.theatre;
  $("#doorRig").classList.toggle("visible", room.id === "surgery");
  $("#doorRig").classList.toggle("unlocked", doorOpen);
  $("#doorRig").classList.toggle("breach", room.id === "surgery" && state.player?.lastAction === "force-door" && state.lastActionAccepted);
  $("#generatorRig").classList.toggle("visible", room.id === "generator");
  $$("#generatorRig [data-breaker]").forEach(lever => {
    const index = Number(lever.dataset.breaker) - 1;
    lever.classList.toggle("active", Boolean(state.props.breakers[index]));
    lever.classList.toggle("expected", Number(lever.dataset.breaker) === [2, 1, 3][state.props.breakerProgress.length]);
  });
  $("#generatorSequence").textContent = `SEQUENCE ${state.props.breakerProgress.length ? state.props.breakerProgress.join(" · ") : "— — —"}`;

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
  $("#foregroundRig").classList.toggle("curtain-closed", Boolean(state.player?.hidden));

  const sourceLabel = voteSourceLabel();
  $("#voteSource").textContent = sourceLabel;
  $("#overlaySource").textContent = sourceLabel;
  renderOptions($("#voteOptions"));
  renderOptions($("#overlayOptions"), true);
  const audienceStatus = audienceStatusText();
  $("#audienceOutcome").textContent = audienceStatus;
  $("#overlayOutcome").textContent = audienceStatus;
  $("#dashAudience").textContent = state.status === "consequence" && state.winner ? state.winner.label : `${voteCount} ${voteCount === 1 ? "vote" : "votes"}`;
  if (!isPassiveView() && state.status === "consequence" && state.winner) {
    const audienceKey = `${state.sessionId}|${state.round}|${state.winner.id}`;
    if (audienceKey !== lastAudienceAudioKey) {
      lastAudienceAudioKey = audienceKey;
      audio.playAudienceResult({
        label: state.winner.label,
        faction: state.winner.faction,
        effect: state.winner.effect,
        accepted: true
      });
    }
  }
  renderFeed();
  const latestEvent = state.recent[0];
  $("#dashRecent").textContent = latestEvent ? `${latestEvent.actor}: ${latestEvent.text}` : "Episode ready";

  const readiness = roomReadiness(state);
  const nextStep = renderNextStep(room, readiness);
  $("#readinessStatus").textContent = readiness.ready ? "Readiness: all authored beats complete." : `Readiness: missing ${readiness.missing.join(" · ")}. Fallback support remains available.`;
  const progress = campaignProgress(state);
  const elapsedSeconds = Math.floor(progress.elapsedMs / 1000);
  $("#pacingStatus").textContent = state.campaign?.needsPacingBeat
    ? `Pacing prompt: ${elapsedSeconds}s elapsed with no meaningful action. Offer a clue or move camera. Rehearsal telemetry only.`
    : `Act ${progress.act} · ${elapsedSeconds}s rehearsal telemetry · not measured playtest data.`;
  if (!isPassiveView() && state.campaign?.needsPacingBeat) {
    const pacingKey = `${room.id}|${state.campaign.lastMeaningfulAt}|${nextStep.title}`;
    if (pacingKey !== lastPacingPromptKey) {
      lastPacingPromptKey = pacingKey;
      showToast("THE WARD WHISPERS", `${nextStep.title}. ${nextStep.detail}`);
      audio.playAction("pacing-hint", { effect: `${nextStep.title}. ${nextStep.detail}`, roomId: room.id });
    }
  }

  $("#ending").classList.toggle("show", state.status === "ended");
  renderEnding();
  if (state.status === "ended" && !isPassiveView() && $("#app").dataset.view !== "gameplay") switchView("gameplay");
  setEndingOpen(state.status === "ended");

  document.body.classList.toggle("reduced-motion", state.settings.reducedMotion);
  document.body.classList.toggle("low-effects", state.settings.lowEffects);
  document.body.classList.toggle("high-contrast", state.settings.highContrast);
  document.body.classList.toggle("compact-hud", state.settings.compactHud);
  document.body.dataset.captionSize = state.settings.captionSize;
  document.body.dataset.captionBackground = state.settings.captionBackground;
  $("#cinematicHudToggle").setAttribute("aria-pressed", String(Boolean(state.settings.compactHud)));
  audio.setReducedEffects(state.settings.lowEffects);
  audio.setVolume("master", state.settings.audioVolume);
  audio.setVolume("effects", state.settings.audioEffectsVolume);
  audio.setVolume("ambience", state.settings.audioAmbienceVolume);
  audio.setVolume("music", state.settings.audioMusicVolume);
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
  if ($("#audioEffectsVolume")) $("#audioEffectsVolume").value = String(Math.round(state.settings.audioEffectsVolume * 100));
  if ($("#audioAmbienceVolume")) $("#audioAmbienceVolume").value = String(Math.round(state.settings.audioAmbienceVolume * 100));
  if ($("#audioMusicVolume")) $("#audioMusicVolume").value = String(Math.round(state.settings.audioMusicVolume * 100));
  $("#captionEnabledToggle").checked = Boolean(state.settings.captionEnabled);
  $("#captionSpeakerToggle").checked = Boolean(state.settings.captionSpeakerLabels);
  $("#captionDirectionToggle").checked = Boolean(state.settings.captionDirectional);
  $("#captionSize").value = state.settings.captionSize;
  $("#captionBackground").value = state.settings.captionBackground;
  $("#captionDuration").value = String(state.settings.captionDuration);
  if ($("#audioStatus")) {
    const audioState = audio.getSettings();
    $("#audioStatus").textContent = audioState.state === "unlocked"
      ? `Audio ready · adaptive score ${audioState.tension >= .78 ? "critical" : audioState.tension >= .42 ? "rising" : "restrained"} · single controller capture`
      : "Audio locked · use Enter, Start, or Test sound; captions remain available";
  }

  $("#gameplayPause").disabled = !["voting", "consequence", "paused"].includes(state.status);
  $("#gameplayPause").textContent = state.status === "paused" ? "▶" : "Ⅱ";
  $("#gameplayPause").setAttribute("aria-label", state.status === "paused" ? "Resume episode" : "Pause episode");
  const finalChoiceLocked = room.id === "stairwell" && state.status === "consequence";
  const audienceGateReady = nextStep.phase === "audience-gate";
  const normalAdvanceBlocked = !readiness.ready && !audienceGateReady;
  $("#advanceRoom").disabled = advancing || finalChoiceLocked || normalAdvanceBlocked || ["briefing", "paused", "ended"].includes(state.status);
  $("#advanceRoom").textContent = advancing ? "Applying consequence…" : finalChoiceLocked ? "Choose a final route in Live episode" : nextStep.label;
  const recoveryAvailable = ["voting", "consequence"].includes(state.status) && !readiness.ready && room.id !== "stairwell";
  $("#directorRecovery").hidden = !recoveryAvailable;

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
  audio.startAmbience(toRoom);
  lastScoreRoom = toRoom;
  audio.startScore(toRoom, { tension: state.danger / 100, caption: true });
  const scene = $("#scene");
  scene.dataset.roomTransition = `${fromRoom}:${toRoom}`;
  clearTimeout(roomTransitionTimer);
  roomTransitionTimer = setTimeout(() => delete scene.dataset.roomTransition, state.settings.reducedMotion ? 0 : 1500);
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
  clearTimeout(cameraTimer);
  clearTimeout(roomTransitionTimer);
  clearTimeout(wardenReactionTimer);
  clearSceneBeat();
  wardenReactionVisible = false;
  cameraMotion = null;
  advancing = false;
  lastAudienceAudioKey = "";
  lastEndingAudioKey = "";
  lastEndingRenderKey = "";
  lastPacingPromptKey = "";
  lastAudioWardenPhase = null;
  lastScoreRoom = "";
  startEpisode(state, Date.now(), 30000);
  if (userGesture) audio.unlock({ userGesture: true }).then(result => {
    audio.startAmbience(roomFor(state).id);
    audio.startScore(roomFor(state).id, { tension: state.danger / 100, caption: false });
    if (!result.unlocked) render();
  });
  else audio.startAmbience(roomFor(state).id);
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

function advance({ allowFallback = false } = {}) {
  if (advancing) return;
  const resolvedNow = state.status === "voting";
  if (resolvedNow) resolveVote(state);
  if (state.status !== "consequence") {
    showToast("ADVANCE BLOCKED", "Resolve the current audience consequence first.", true);
    render();
    return;
  }
  if (roomFor(state).id === "stairwell") {
    if (state.winner) showToast("FINAL VOTE LOCKED", `${state.winner.label}. ${state.winner.effect} The streamer must now choose the physical route.`);
    render();
    setTimeout(() => $("[data-action='open-roof']")?.focus(), 0);
    return;
  }
  const readiness = roomReadiness(state);
  if (!readiness.ready && (resolvedNow || !allowFallback)) {
    const winnerText = state.winner ? `${state.winner.label}: ${state.winner.effect}` : "Audience consequence resolved.";
    showToast("WORLD CHANGED — OBJECTIVE CONTINUES", `${winnerText} Still required: ${missingStepText(readiness.missing)}.`);
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
    audio.startAmbience(roomFor(state).id);
    lastScoreRoom = "";
    announce("Episode resumed");
  } else if (["voting", "consequence"].includes(state.status)) {
    pauseEpisode(state);
    audio.stopAmbience();
    audio.stopScore({ caption: false });
    lastScoreRoom = "";
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
$("#introHelp").addEventListener("click", event => openHelp(event.currentTarget));
$("#helpToggle").addEventListener("click", event => openHelp(event.currentTarget));
$("#helpClose").addEventListener("click", closeHelp);
$("#helpResume").addEventListener("click", closeHelp);
$("#helpDialog").addEventListener("close", () => {
  const target = helpReturnFocus;
  helpReturnFocus = null;
  setTimeout(() => target?.isConnected && target.focus(), 0);
});
$("#enterWard").addEventListener("click", () => start({ userGesture: true }));
$("#startShow").addEventListener("click", () => start({ userGesture: true }));
$("#pauseShow").addEventListener("click", () => {
  pauseEpisode(state);
  audio.stopAmbience();
  audio.stopScore({ caption: false });
  lastScoreRoom = "";
  render();
  announce("Episode paused");
});
$("#resumeShow").addEventListener("click", () => {
  resumeEpisode(state);
  audio.startAmbience(roomFor(state).id);
  lastScoreRoom = "";
  render();
  announce("Episode resumed");
});
$("#stopShow").addEventListener("click", () => {
  clearTimeout(autoAdvanceTimer);
  clearTimeout(cameraTimer);
  clearTimeout(roomTransitionTimer);
  clearTimeout(wardenReactionTimer);
  clearSceneBeat();
  cameraMotion = null;
  wardenReactionVisible = false;
  advancing = false;
  audio.stopAmbience();
  audio.stopScore({ caption: false });
  lastScoreRoom = "";
  stopEpisode(state);
  render();
});
$("#advanceRoom").addEventListener("click", () => advance());
$("#directorRecovery").addEventListener("click", () => {
  if (!confirm("Director recovery skips unfinished authored actions and records a disclosed fallback. Continue?")) return;
  advance({ allowFallback: true });
});
$("#gameplayAdvance").addEventListener("click", () => advance());
$("#gameplayPause").addEventListener("click", togglePause);
$("#restartEnding").addEventListener("click", () => {
  state.status = "briefing";
  lastEndingAudioKey = "";
  lastEndingRenderKey = "";
  lastScoreRoom = "";
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
    lastAudienceAudioKey = "";
    lastScoreRoom = "";
    showToast("CHECKPOINT RESTORED", `Recovered ${roomFor(state).name}`);
  } else showToast("NO CHECKPOINT", result.reason, true);
  render();
});

$$("[data-trigger]").forEach(button => button.addEventListener("click", () => handleEvent(button.dataset.trigger)));
$("#sendChat").addEventListener("click", () => {
  const user = demoNames[Math.floor(Math.random() * demoNames.length)];
  const result = ingestCommand(state, user, $("#chatCommand").value);
  audio.playUI(result.accepted ? "vote" : "error");
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
for (const [id, key] of [
  ["captionEnabledToggle", "captionEnabled"],
  ["captionSpeakerToggle", "captionSpeakerLabels"],
  ["captionDirectionToggle", "captionDirectional"]
]) {
  $("#" + id).addEventListener("change", event => {
    state.settings[key] = event.target.checked;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    lastRenderedAudioCueAt = "";
    render();
  });
}
for (const [id, key, normalize] of [
  ["captionSize", "captionSize", value => ["small", "medium", "large"].includes(value) ? value : "medium"],
  ["captionBackground", "captionBackground", value => ["soft", "solid", "maximum"].includes(value) ? value : "solid"],
  ["captionDuration", "captionDuration", value => Math.max(3000, Math.min(8000, Number(value) || 5200))]
]) {
  $("#" + id).addEventListener("change", event => {
    state.settings[key] = normalize(event.target.value);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    lastRenderedAudioCueAt = "";
    render();
  });
}
$("#audioVolume").addEventListener("input", event => {
  state.settings.audioVolume = Number(event.target.value) / 100;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  render();
});
for (const [id, key] of [
  ["audioEffectsVolume", "audioEffectsVolume"],
  ["audioAmbienceVolume", "audioAmbienceVolume"],
  ["audioMusicVolume", "audioMusicVolume"]
]) {
  $("#" + id)?.addEventListener("input", event => {
    state.settings[key] = Number(event.target.value) / 100;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    render();
  });
}
$("#cinematicHudToggle").addEventListener("click", () => {
  state.settings.compactHud = !state.settings.compactHud;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  render();
  announce(state.settings.compactHud ? "Compact cinematic HUD enabled" : "Full production HUD enabled");
});
$("#audioTest")?.addEventListener("click", async () => {
  const result = await audio.unlock({ userGesture: true });
  audio.startAmbience(roomFor(state).id);
  audio.startScore(roomFor(state).id, { tension: .46, caption: false });
  audio.playAction("align-lamps", { effect: "Audio calibration cue complete.", roomId: roomFor(state).id });
  showToast(result.unlocked ? "AUDIO READY" : "CAPTIONS READY", result.unlocked ? "Ambience, adaptive score, and effects are active." : result.reason, !result.unlocked);
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
