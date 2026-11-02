import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appendLiveChatFeedback,
  isNightShiftCommand,
  liveChatFeedback,
  viewerVotePrompt
} from "../dist/vote-ui.mjs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../dist/app.mjs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
const options = [
  { id: "restore", label: "Restore corridor power", command: "!restore" },
  { id: "open", label: "Open isolation", command: "!open" },
  { id: "dark", label: "Kill the lights", command: "!dark" }
];

test("viewer guide prioritizes one safe command while listing every exact current command", () => {
  const prompt = viewerVotePrompt({ status: "voting", options, recommendedId: "restore" });
  assert.equal(prompt.headline, "VIEWERS: TYPE !restore IN TWITCH CHAT");
  assert.equal(prompt.detail, "PRESS SEND · ALSO ACCEPTS: !open · !dark");
  assert.deepEqual(prompt.commands, ["!restore", "!open", "!dark"]);
});

test("paused guide uses the required unambiguous warning and does not invite an immediate vote", () => {
  const prompt = viewerVotePrompt({ status: "paused", options, recommendedId: "restore" });
  assert.equal(prompt.headline, "VOTING PAUSED — COMMANDS WILL NOT COUNT");
  assert.match(prompt.detail, /WHEN VOTING RESUMES: TYPE !restore/);
  assert.match(prompt.detail, /!open · !dark/);
});

test("viewer guide never presents rehearsal or reconnecting input as live Twitch chat", () => {
  const rehearsal = viewerVotePrompt({ mode: "SIMULATED", status: "voting", options, recommendedId: "restore" });
  assert.equal(rehearsal.headline, "REHEARSAL: ENTER !restore IN CHAT SIMULATOR");
  assert.equal(rehearsal.detail, "TEST INPUT ONLY · ALSO ACCEPTS: !open · !dark");
  const reconnecting = viewerVotePrompt({ mode: "TWITCH RECONNECTING", status: "voting", options, recommendedId: "restore" });
  assert.equal(reconnecting.headline, "TWITCH INPUT PAUSED — COMMANDS WILL NOT COUNT");
  assert.match(reconnecting.detail, /WHEN RECONNECTED: TYPE !restore/);
});

test("live Twitch commands create explicit accepted and rejected feedback events", () => {
  const accepted = liveChatFeedback({
    viewer: "bigtestingbot",
    message: "!restore please",
    result: { accepted: true, kind: "vote", option: options[0] },
    now: 123
  });
  assert.equal(accepted.title, "TWITCH VOTE ACCEPTED");
  assert.equal(accepted.detail, "bigtestingbot: !restore counted · Restore corridor power");
  assert.deepEqual(accepted.event, {
    type: "chat-accepted",
    actor: "bigtestingbot",
    text: "!restore counted · Restore corridor power",
    at: 123
  });

  const rejected = liveChatFeedback({
    viewer: "bigtestingbot",
    message: "!restore",
    result: { accepted: false, kind: "vote", reason: "Voting is paused — commands will not count" },
    now: 124
  });
  assert.equal(rejected.title, "TWITCH VOTE REJECTED");
  assert.match(rejected.detail, /!restore not counted · Voting is paused/);

  const state = { recent: Array.from({ length: 18 }, (_, index) => ({ type: "old", actor: "x", text: String(index) })) };
  appendLiveChatFeedback(state, rejected);
  assert.equal(state.recent.length, 18);
  assert.equal(state.recent[0].type, "chat-rejected");
});

test("ordinary Twitch conversation does not trigger command rejection feedback", () => {
  assert.equal(isNightShiftCommand("Here ready to test"), false);
  assert.equal(isNightShiftCommand("!restore"), true);
  assert.equal(isNightShiftCommand("  !JOIN Guardian  "), true);
});

test("both gameplay and OBS surfaces contain the large live viewer guide", () => {
  assert.match(html, /id="viewerVoteGuide"[^>]*role="status"/);
  assert.match(html, /id="overlayViewerVoteGuide"[^>]*role="status"/);
  assert.match(styles, /\.viewer-vote-guide b\{[^}]*font:700 18px\/1\.22/);
  assert.match(styles, /\.viewer-vote-guide\[data-state="paused"\]/);
  assert.match(app, /appendLiveChatFeedback\(state/);
  assert.match(app, /showToast\(feedback\.title, feedback\.detail, !result\.accepted\)/);
});
