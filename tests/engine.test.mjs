import test from "node:test";
import assert from "node:assert/strict";
import { createState, startRound, castVote, resolveRound, applyEvent } from "../dist/engine.mjs";

test("a viewer has exactly one active vote", () => {
  let state = startRound(createState(0), 0);
  state = castVote(state, "viewer-a", "!restore").state;
  state = castVote(state, "viewer-a", "!dark").state;
  assert.equal(state.votes.restore, 0);
  assert.equal(state.votes.dark, 1);
});

test("aliases normalize into active choices", () => {
  let state = startRound(createState(0), 0);
  const result = castVote(state, "viewer-b", "!left please");
  assert.equal(result.accepted, true);
  assert.equal(result.option.id, "restore");
});

test("winning chaos vote raises danger and reveals monster", () => {
  let state = startRound(createState(0), 0);
  state = castVote(state, "a", "!dark").state;
  state = castVote(state, "b", "!dark").state;
  const resolved = resolveRound(state, 0);
  assert.equal(resolved.consequence.id, "dark");
  assert.ok(resolved.danger > state.danger);
  assert.ok(resolved.monster > state.monster);
});

test("Twitch events map to deterministic gameplay effects", () => {
  const state = createState(0);
  const raid = applyEvent(state, { type: "raid", viewers: 500, actor: "raider" });
  assert.equal(raid.danger, state.danger + 12);
  assert.equal(raid.recent[0].actor, "raider");
  const follow = applyEvent(state, { type: "follow", actor: "new-viewer" });
  assert.equal(follow.danger, state.danger - 4);
});
