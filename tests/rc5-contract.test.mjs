import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const app = read("dist/app.mjs");
const engine = read("dist/engine.mjs");
const html = read("dist/index.html");
const publicState = read("dist/public-state.mjs");
const styles = read("dist/styles.css");
const capture = read("scripts/capture-proof.mjs");

test("premium audio APIs are wired to physical gameplay and never gated before caption emission", () => {
  for (const method of ["playAction", "playItem", "playAudienceResult", "playWardenPhase", "playEnding", "startScore", "setTension"]) {
    assert.match(app, new RegExp(`audio\\.${method}\\(`), `${method} must be integrated into the browser controller`);
  }
  assert.doesNotMatch(app, /if \(audio\.unlocked\)[^\n]*audio\.(?:playAction|playItem|playAudienceResult|playWardenPhase|playUI)/,
    "cue methods must run while locked so their captions still emit");
  assert.match(app, /audio\.setReducedEffects\(state\.settings\.lowEffects\)/,
    "reduced motion must not silently reduce sound");
});

test("sanitized audio captions travel to passive OBS surfaces without enabling mirror audio", () => {
  assert.match(engine, /lastAudioCue:null/);
  assert.match(publicState, /incoming\.lastAudioCue/);
  assert.match(app, /state\.lastAudioCue = \{ cue, text, at \}/);
  assert.match(html, /id="overlayAudioCaption"[^>]*aria-live="polite"/);
  assert.match(app, /if \(PASSIVE_MIRROR\) \{[\s\S]*?#app"\)\.inert = true/);
});

test("camera destinations and decisive actions have authored in-world choreography", () => {
  for (const id of ["nodeRevealRig", "theatreRig", "lampRig", "tapeRig", "finalRouteRig"]) assert.match(html, new RegExp(`id="${id}"`));
  for (const node of ["records-desk", "locker-close", "lamp-array", "restraint-table", "roof-exit", "ambulance-tunnel"]) {
    assert.match(styles, new RegExp(`data-camera-node="${node}"`));
  }
  for (const action of ["align-lamps", "play-tape", "seal-warden", "open-roof", "open-ambulance"]) {
    assert.match(styles, new RegExp(`data-scene-beat[^}]*${action}`));
  }
});

test("ending presentation explains route, cause, decisions, and audiovisual tone", () => {
  for (const id of ["endingRouteBadge", "endingCauseBadge", "endingCause", "endingChoiceTrace"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /ending\.dataset\.route = route/);
  assert.match(app, /ending\.dataset\.endingTone = endingTone/);
  assert.match(app, /recap\.streamerDecisions/);
  assert.match(app, /audio\.playEnding/);
});

test("compact HUD and routed broadcast mixer remain user controlled", () => {
  assert.match(html, /id="cinematicHudToggle"[^>]*aria-pressed="false"/);
  assert.match(app, /classList\.toggle\("compact-hud", state\.settings\.compactHud\)/);
  for (const id of ["audioVolume", "audioEffectsVolume", "audioAmbienceVolume", "audioMusicVolume", "audioTest"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const bus of ["master", "effects", "ambience", "music"]) assert.match(app, new RegExp(`audio\\.setVolume\\("${bus}"`));
});

test("continuous proof recorder requires a real five-minute audio-video rehearsal", () => {
  assert.match(capture, /getDisplayMedia/);
  assert.match(capture, /new MediaRecorder/);
  assert.match(capture, /CAPTURE_MINIMUM_MS \|\| 300000/);
  assert.match(capture, /REHEARSAL PROOF · SIMULATED INPUT · NOT LIVE TWITCH/);
  assert.match(capture, /audioPresent/);
  assert.match(capture, /COMPLETE_REHEARSAL_PROOF/);
  assert.match(capture, /!worktree\.dirty/);
});
