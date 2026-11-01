import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROOMS } from "../dist/engine.mjs";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const html = read("../dist/index.html");
const app = read("../dist/app.mjs");
const css = read("../dist/styles.css");

test("every authored camera node has a spatial composition and transition lifecycle", () => {
  for (const node of ROOMS.flatMap(room => room.cameraNodes)) {
    assert.match(app, new RegExp(`(?:"${node}"|${node})\\s*:\\s*\\{\\s*x:`), `${node} needs a CAMERA_COMPOSITIONS entry`);
  }
  assert.match(app, /dataset\.cameraMoving/);
  assert.match(app, /setAttribute\("aria-busy"/);
  assert.match(app, /--camera-layer-x/);
  assert.match(css, /\.scene\s+\.layer\s*\{[^}]*translate:var\(--camera-layer-x/s);
  assert.match(css, /\.camera-travel/);
});

test("gameplay exposes progression, persistent item consequences, and audience state", () => {
  for (const id of ["nextStep", "nextStepTitle", "nextStepDetail", "gameplayAdvance", "itemEffectSummary", "conditionStrip", "audienceOutcome"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(app, /function nextStepModel/);
  assert.match(app, /renderNextStep\(room, readiness\)/);
  assert.match(app, /ITEM EFFECT APPLIED/);
  assert.match(app, /one vote per immutable viewer ID/i);
});

test("streamer dashboard exposes the current audience, next action, and latest event", () => {
  for (const id of ["dashAudience", "dashNext", "dashRecent", "restoreCheckpoint", "advanceRoom"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing dashboard control #${id}`);
  }
  assert.match(app, /#dashAudience/);
  assert.match(app, /#dashNext/);
  assert.match(app, /#dashRecent/);
});

test("physical interaction rigs and reduced-motion equivalents are present", () => {
  assert.match(html, /id="generatorRig"/);
  assert.equal((html.match(/data-breaker=/g) || []).length, 3);
  for (const beat of ["force-door:anticipation", "force-door:bolts", "force-door:swing", "hide-curtain:close", "counter-warden:repel"]) {
    assert.match(app + css, new RegExp(beat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing staged beat ${beat}`);
  }
  assert.match(css, /body\.reduced-motion\s+\.camera-travel/);
  assert.match(css, /warden\.visible\[data-phase="repelled"\]/);
});

test("the final audience result cannot silently replace streamer route choice", () => {
  assert.match(app, /roomFor\(state\)\.id === "stairwell"[\s\S]{0,500}streamer must now choose the physical route/);
  assert.match(read("../dist/engine.mjs"), /The streamer must choose the roof or ambulance route in the world/);
});
