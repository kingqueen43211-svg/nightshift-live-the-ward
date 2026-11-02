import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "dist/app.mjs"), "utf8");
const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
const demoEdl = JSON.parse(readFileSync(resolve(root, "docs/demo-video/demo-edl.json"), "utf8"));

test("Ward 06 explains the audience-to-streamer handoff at the decision point", () => {
  assert.match(html, /Viewers choose power, light, danger, or support/i);
  assert.match(html, /streamer still opens the door, solves the puzzle, or chooses the route/i);
  assert.match(app, /The audience changes power or lights; you still open the door afterward/i);
  assert.match(app, /chat changes the Ward, but you still breach the physical door/i);
  assert.match(app, /Resolve labeled fallback/i);
});

test("the packaged judging edit is continuous, under three minutes, and truth-gated", () => {
  assert.equal(demoEdl.targetDurationSeconds, 172);
  assert.ok(demoEdl.targetDurationSeconds < demoEdl.rules.maximumDurationSeconds);
  let cursor = 0;
  for (const clip of demoEdl.timeline) {
    assert.equal(clip.finalStart, cursor, `timeline gap or overlap before ${clip.id}`);
    cursor = Number((cursor + clip.duration).toFixed(1));
  }
  assert.equal(cursor, demoEdl.targetDurationSeconds);
  assert.deepEqual(
    demoEdl.requiredExternalAssets.map(asset => asset.id),
    ["real-twitch", "native-obs", "codex-bts", "accessibility-human-qa", "closing-card"]
  );
  for (const asset of demoEdl.requiredExternalAssets) {
    assert.ok(demoEdl.timeline.some(clip => clip.id === asset.id && clip.requiredRealEvidence), `${asset.id} is not truth-gated`);
  }
});
