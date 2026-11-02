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
const captureDiagnostics = read("scripts/capture-proof-diagnostics.mjs");
const combined = `${html}\n${app}`;

test("Ward 06 exposes a concrete, stateful prerequisite checklist", () => {
  assert.match(combined, /id=["']wardChecklist["']/);
  for (const step of ["inspect", "intercom", "audience", "hide", "breach"]) {
    assert.match(combined, new RegExp(`data-ward-step=["']${step}["']`), `missing Ward 06 checklist step ${step}`);
  }
  for (const instruction of ["restraint", "intercom", "audience", "threshold"]) {
    assert.match(app, new RegExp(instruction, "i"), `Ward 06 guidance must name ${instruction}`);
  }
  assert.match(app, /dark[\s\S]{0,500}hide/i, "the blackout branch must teach its curtain prerequisite");
  assert.match(app, /wardChecklist|renderWardChecklist/, "the checklist must be driven by current game state");
});

test("blocked and completed one-shot actions are non-punitive in the browser", () => {
  assert.match(app, /(?:disabled\s*=|\.disabled\s*=)[^\n]*(?:completed|requirement\.ready)|(?:completed|requirement\.ready)[^\n]*(?:disabled\s*=|\.disabled\s*=)/,
    "action rendering must disable unavailable and completed actions");
  assert.match(app, /aria-disabled/, "action buttons must expose their disabled state");
  assert.match(app, /requirement\.cue/, "disabled actions must retain a visible prerequisite explanation");
});

test("caption preferences are complete, persistent, and shared with OBS", () => {
  for (const id of [
    "captionEnabledToggle",
    "captionSpeakerToggle",
    "captionDirectionToggle",
    "captionSize",
    "captionBackground",
    "captionDuration"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`), `missing caption preference #${id}`);

  for (const [label, pattern] of [
    ["enabled", /captionEnabled/],
    ["speaker labels", /captionSpeaker(?:Labels)?/],
    ["direction", /captionDirection(?:al)?/],
    ["size", /captionSize/],
    ["background", /captionBackground/],
    ["duration", /captionDuration(?:Ms)?/]
  ]) {
    assert.match(app + engine, pattern, `caption preference ${label} must be initialized and rendered`);
  }
  assert.match(app, /localStorage\.setItem\(SETTINGS_KEY/, "caption preferences must use the established persistent settings store");
  assert.match(app, /#audioCaption[\s\S]{0,300}#overlayAudioCaption|\[\$\(\"#audioCaption\"\),\s*\$\(\"#overlayAudioCaption\"\)\]/,
    "gameplay and OBS captions must share the same preference renderer");
  assert.match(styles, /caption-(?:size|background)|--caption/, "caption size/background need explicit visual hooks");
});

test("action toasts never suppress critical captions", () => {
  assert.doesNotMatch(styles, /body:has\(\.event-toast\.show\)\s+\.audio-caption\s*\{[^}]*opacity\s*:\s*0/i,
    "critical action captions cannot be hidden for the lifetime of the action toast");
  assert.match(html, /id=["']audioCaption["'][^>]*aria-live=["']polite["']/);
  assert.match(html, /id=["']overlayAudioCaption["'][^>]*aria-live=["']polite["']/);
});

test("the humane finale contains a real staged world tableau", () => {
  for (const id of ["endingWorld", "endingMara", "endingWardenEcho"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ending world element #${id}`);
  }
  assert.match(styles, /humane-ending|ending[^}]*dawn|ending-dawn/i, "the finale must use an authored dawn scene asset or treatment");
  assert.match(styles, /#?endingMara|\.ending-mara/);
  assert.match(styles, /#?endingWardenEcho|\.ending-warden-echo/);
  assert.match(app, /endingTone[\s\S]{0,160}["']humane["']|data-ending-tone/i);
});

test("caption direction metadata is sanitized before passive transport", () => {
  assert.match(app, /direction/);
  assert.match(publicState, /direction/);
  assert.match(publicState, /lastAudioCue/, "caption metadata must travel only through the validated public state surface");
});

test("capture proof records exact failed URLs and blocks unclassified browser failures", () => {
  assert.match(capture, /Network\.enable/);
  assert.match(capture, /Network\.responseReceived/);
  assert.match(capture, /Network\.loadingFailed/);
  assert.match(capture, /networkRequestId/);
  assert.match(captureDiagnostics, /RESOURCE_OR_NETWORK_FAILURE/);
  assert.match(captureDiagnostics, /EXPECTED_MEDIA_PERMISSION_DENIAL/);
  assert.match(capture, /browserDiagnosticsAccountedFor/);
  assert.match(capture, /unresolvedBrowserIssues\.length === 0/);
});

test("the app declares a real favicon instead of producing browser-chrome 404 noise", () => {
  assert.match(html, /rel="icon"[^>]*href="\.\/favicon\.svg"/);
});
