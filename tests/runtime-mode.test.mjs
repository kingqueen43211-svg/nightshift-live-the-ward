import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { modeForTwitchStatus, simulatedAudienceEnabled, twitchInputPaused, voteSourceText } from "../dist/runtime-mode.mjs";

const app = readFileSync(new URL("../dist/app.mjs", import.meta.url), "utf8");

test("transient Twitch phases pause simulation instead of blending fake and live votes", () => {
  for (const phase of ["AUTHORIZING", "CONNECTING", "RECONNECTING", "AUTH_EXPIRED", "ERROR"]) {
    const mode = modeForTwitchStatus({ phase, connected: false }, "LIVE TWITCH");
    assert.equal(simulatedAudienceEnabled(mode), false, `${phase} must not enable simulated audience input`);
    assert.equal(twitchInputPaused(mode), true, `${phase} must pause the live vote clock`);
  }
  assert.equal(modeForTwitchStatus({ phase: "LIVE_TWITCH", connected: true }), "LIVE TWITCH");
  assert.equal(modeForTwitchStatus({ phase: "DISCONNECTED", connected: false }), "SIMULATED");
  assert.equal(twitchInputPaused("LIVE TWITCH"), false);
  assert.equal(twitchInputPaused("SIMULATED"), false);
});

test("reconnect cannot change an audience tally through the simulator", () => {
  let tally = 4;
  const mode = modeForTwitchStatus({ phase: "RECONNECTING", connected: false }, "LIVE TWITCH");
  if (simulatedAudienceEnabled(mode)) tally += 1;
  assert.equal(tally, 4);
  assert.equal(voteSourceText({ mode, status: "voting", resolutionSource: null }), "TWITCH INPUT PAUSED · WAITING FOR SIGNAL");
});

test("vote source labels disclose rehearsal input", () => {
  assert.equal(voteSourceText({ mode: "SIMULATED", status: "voting", resolutionSource: null }), "REHEARSAL VOTE · SIMULATED INPUT");
  assert.equal(voteSourceText({ mode: "SIMULATED", status: "consequence", resolutionSource: "AUDIENCE" }), "REHEARSAL RESULT · SIMULATED INPUT");
  assert.equal(voteSourceText({ mode: "LIVE TWITCH", status: "voting", resolutionSource: null }), "LIVE TWITCH CHAT VOTE OPEN");
});

test("the browser loop freezes and preserves the vote window while Twitch input is paused", () => {
  assert.match(app, /audienceClockPausedAt \?\? Date\.now\(\)/,
    "the visible countdown must use its frozen time while Twitch is unavailable");
  assert.match(app, /!isPassiveView\(\)\) state\.roundEndsAt \+= Math\.max\(0, Date\.now\(\) - audienceClockPausedAt\)/,
    "reconnect must restore the unavailable time to the round");
  assert.match(app, /if \(audienceClockPausedAt === null\) tick\(state\)/,
    "the main loop must not resolve a vote while Twitch is unavailable");
});
