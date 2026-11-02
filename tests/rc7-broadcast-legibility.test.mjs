import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
const visualQa = readFileSync(new URL("../scripts/visual-qa.mjs", import.meta.url), "utf8");

test("broadcast-critical type has an explicit half-size legibility floor", () => {
  for (const token of ["--broadcast-label:10px", "--broadcast-detail:12px", "--broadcast-key:14px"]) {
    assert.match(styles, new RegExp(token.replace(/[()]/g, "\\$&")), `missing broadcast type token ${token}`);
  }
  for (const selector of [
    ".condition-strip span",
    ".next-step b",
    ".next-step span",
    ".vote-panel .vote-option>strong",
    ".event-toast span",
    ".audio-caption span"
  ]) assert.match(styles, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${selector} needs a broadcast legibility rule`);
});

test("critical guidance wraps instead of being clipped to an unreadable single line", () => {
  assert.match(styles, /\.next-step span\{[^}]*white-space:normal[^}]*overflow:visible[^}]*text-overflow:clip/);
  assert.match(styles, /\.player-loop>p\{[^}]*white-space:normal[^}]*overflow:visible[^}]*text-overflow:clip/);
  assert.match(styles, /\.action-tray button\.locked em\{[^}]*height:auto[^}]*min-height:11px/);
});

test("Cinema mode preserves objective, conditions, next action, and desktop vote state", () => {
  assert.match(styles, /body\.compact-hud \.mission>p\{display:-webkit-box/);
  assert.match(styles, /body\.compact-hud \.mission \.objective-progress\{display:block/);
  assert.match(styles, /body\.compact-hud \.condition-strip\{display:flex/);
  assert.match(styles, /body\.compact-hud \.next-step\{[^}]*box-shadow/);
  assert.match(styles, /@media\(min-width:851px\)[\s\S]*?body\.compact-hud \.vote-panel \.vote-options\{display:grid/);
});

test("toast and captions retain independent readable surfaces", () => {
  assert.match(styles, /\.event-toast span\{font-size:12px;line-height:1\.35\}/);
  assert.match(styles, /\.audio-caption\{max-width:calc\(100vw - 48px\)\}/);
  assert.match(styles, /body:has\(\.event-toast\.show\) \.audio-caption\{opacity:1;top:116px\}/);
  assert.doesNotMatch(styles, /body:has\(\.event-toast\.show\) \.audio-caption\{[^}]*display:none/);
  assert.match(styles, /@media\(min-width:501px\) and \(max-width:850px\)[\s\S]*?\.event-toast\{[^}]*width:calc\(50vw - 21px\)[\s\S]*?\.audio-caption[^}]*width:calc\(50vw - 21px\)/,
    "tablet captions and consequence toasts need non-overlapping half-width safe zones");
});

test("phone and 200-percent layouts use one reachable vertical reading order", () => {
  assert.match(styles, /@media\(max-width:500px\), \(max-width:850px\) and \(max-height:520px\)/);
  assert.match(styles, /#gameplay \.hud\{[^}]*display:grid[^}]*overflow-y:auto/);
  assert.match(styles, /#gameplay \.player-loop\{[^}]*max-height:none[^}]*overflow:visible/);
});

test("final-route choreography targets every phase emitted by the browser controller", () => {
  for (const phase of ["sigil", "bind", "sealed"]) {
    assert.match(styles, new RegExp(`data-scene-beat=["']seal-warden:${phase}["']`));
  }
  for (const phase of ["unlock", "swing", "dawn"]) {
    assert.match(styles, new RegExp(`data-scene-beat=["']open-roof:${phase}["']`));
  }
  for (const phase of ["unlock", "rise", "open"]) {
    assert.match(styles, new RegExp(`data-scene-beat=["']open-ambulance:${phase}["']`));
  }
  for (const action of ["seal-warden", "open-roof", "open-ambulance"]) {
    assert.match(styles, new RegExp(`data-scene-beat=["']${action}:complete["']`), `${action} needs the static reduced-motion completion state emitted by the app`);
  }
  assert.doesNotMatch(styles, /data-scene-beat=["'](?:seal-warden|open-roof|open-ambulance):impact["']/,
    "route rigs must not depend on the unused impact phase");
});

test("visual QA captures and measures an actual half-scale Twitch-player frame", () => {
  assert.match(visualQa, /gameplay-twitch-player-50pct-640x360/);
  assert.match(visualQa, /captureScale:\s*0\.5/);
  assert.match(visualQa, /expectedOutput:\s*\[640,\s*360\]/);
  assert.match(visualQa, /Page\.captureScreenshot/);
  assert.match(visualQa, /readUInt32BE\(16\)[\s\S]*readUInt32BE\(20\)/,
    "the gate must verify the physical PNG dimensions rather than only naming a scenario 640x360");
  for (const selector of ["#objective", "#nextStepTitle", "#nextStepDetail", "#healthValue,#dangerValue,#powerValue", "#actionTray button b", "#voteOptions .vote-option > strong", "#audioCaption span"]) {
    assert.match(visualQa, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(visualQa, /reason:\s*entry\.clipped\s*\?\s*['"]clipped['"]\s*:\s*['"]too-small['"]/);
  assert.match(visualQa, /\(hidden\|clip\|auto\|scroll\)/,
    "line-box rounding must not be mislabeled as clipping when overflow is visible");
});

test("visual QA renders every reduced-motion route completion state", () => {
  for (const [beat, selector] of [
    ["seal-warden:complete", ".containment-sigil"],
    ["open-roof:complete", ".roof-beacon"],
    ["open-ambulance:complete", ".tunnel-gate"],
  ]) {
    assert.match(visualQa, new RegExp(beat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(visualQa, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(visualQa, /completeStates\.some\(state => !state\.pass\)/);
  assert.match(visualQa, /signatureMatches/);
  assert.match(visualQa, /prefers-reduced-motion-\$\{sanitizeName\(probe\.beat\)\}-1280x720\.png/);
});
