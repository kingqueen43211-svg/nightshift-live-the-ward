import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createState, publicState } from "../dist/engine.mjs";
import { isValidPublicState } from "../dist/public-state.mjs";

const app = readFileSync(new URL("../dist/app.mjs", import.meta.url), "utf8");

test("OBS overlay is a passive BroadcastChannel consumer", () => {
  assert.match(app, /function ownsControllerLease\(\)[\s\S]*if \(isPassiveView\(\)\) return false/,
    "overlay views must never acquire the publishing lease");
  assert.match(app, /if \(ownsControllerLease\(\)\) \{[\s\S]*?channel\?\.postMessage\(message\)/,
    "state broadcasts must require the controller lease");
  assert.match(app, /if \(!isPassiveView\(\)\) \{[\s\S]*?if \(audienceClockPausedAt === null\) tick\(state\)/,
    "overlay clocks must not mutate or auto-resolve their mirrored state");
});

test("incoming overlay state is shape-checked before rendering", () => {
  assert.match(app, /isValidPublicState\(incoming\)/, "overlay messages must pass the public-state validator");
  const valid = publicState(createState(100));
  assert.equal(isValidPublicState(valid), true);
  const captioned = publicState(createState(100));
  captioned.lastAudioCue = { cue: "door-bolts", text: "The isolation bolts retract.", at: 125 };
  assert.equal(isValidPublicState(captioned), true, "sanitized sound captions should travel to passive overlays");
  for (const mutate of [
    state => { state.roomIndex = 99; },
    state => { state.health = Infinity; },
    state => { state.recent = [{ type: "vote", actor: "x", text: "x".repeat(501) }]; },
    state => { state.voters.leakedViewer = "records"; },
    state => { state.campaign.checkpoint = { state: {} }; },
    state => { state.camera.nodeId = "not-an-authored-node"; },
    state => { state.lastAudioCue = { cue: "x", text: "x".repeat(501), at: 100 }; }
  ]) {
    const tampered = structuredClone(valid);
    mutate(tampered);
    assert.equal(isValidPublicState(tampered), false);
  }
});

test("only one non-overlay tab publishes at a time", () => {
  assert.match(app, /CONTROLLER_LEASE_KEY/);
  assert.match(app, /lease\.id !== INSTANCE_ID[\s\S]*lease\.expiresAt/,
    "a live controller lease must suppress competing publishers");
  assert.match(app, /beforeunload[\s\S]*removeItem\(CONTROLLER_LEASE_KEY\)/,
    "the active controller should release its lease on clean shutdown");
});

test("the optional local relay bridges browser and OBS processes without weakening validation", () => {
  assert.match(app, /LOCAL_RELAY = params\.get\("relay"\) === "local"/);
  assert.match(app, /fetch\("\.\/__nightshift\/state"[\s\S]*JSON\.stringify\(message\)/,
    "controller state should be posted only through the explicit local relay path");
  assert.match(app, /new EventSource\("\.\/__nightshift\/events"\)/,
    "the OBS view should consume local relay events across browser processes");
  assert.match(app, /receivePublicMessage\(JSON\.parse\(event\.data\)\)/,
    "relayed state must pass through the same validated receive path");
  assert.match(app, /PASSIVE_MIRROR = params\.get\("role"\) === "mirror"/);
  assert.match(app, /if \(PASSIVE_MIRROR\) \{[\s\S]*?\.inert = true/,
    "a full-scene OBS mirror must be non-interactive and must never become a second controller");
});
