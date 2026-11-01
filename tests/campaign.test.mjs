import test from "node:test";
import assert from "node:assert/strict";
import {
  PACING_TARGETS,createState,startEpisode,enterCameraNode,campaignProgress,resolveVote,
  advanceRoom,roomFor,roomReadiness,playerAction,castVote,combineInventoryItems,
  useInventoryItem,applyEffect,restoreCheckpoint,finishEpisode,tick
} from "../dist/engine.mjs";

function completeIntake(state){
  playerAction(state,"search-desk");playerAction(state,"open-locker");playerAction(state,"reconstruct-file");
}

function reachStairwell(state){
  startEpisode(state,1,30000);
  completeIntake(state);castVote(state,"viewer-a","!records");resolveVote(state);advanceRoom(state,100);
  playerAction(state,"inspect-gurney");playerAction(state,"listen-intercom");castVote(state,"viewer-b","!restore");resolveVote(state);playerAction(state,"force-door");advanceRoom(state,200);
  playerAction(state,"align-lamps");playerAction(state,"play-tape");playerAction(state,"counter-warden");castVote(state,"viewer-c","!lights");resolveVote(state);advanceRoom(state,300);
  playerAction(state,"breaker-2");playerAction(state,"breaker-1");playerAction(state,"breaker-3");playerAction(state,"reroute-power");castVote(state,"viewer-d","!charge");resolveVote(state);advanceRoom(state,400);
  return state;
}

test("camera nodes are authored per room and persist in room state",()=>{
  const state=createState(1);startEpisode(state,1);assert.equal(enterCameraNode(state,"records-desk").accepted,true);assert.equal(state.rooms.intake.cameraNode,"records-desk");
  assert.equal(enterCameraNode(state,"not-a-node").accepted,false);completeIntake(state);resolveVote(state);advanceRoom(state,100);assert.equal(state.camera.nodeId,"corridor-wide");assert.deepEqual(state.rooms.intake.visitedNodes,["lobby-wide","records-desk"]);
});

test("zero-chat vote resolves to an announced room-safe fallback",()=>{
  const state=createState(1);startEpisode(state,1);const result=resolveVote(state);assert.equal(result.source,"ZERO_CHAT_FALLBACK");assert.equal(result.winner.id,"records");assert.equal(state.campaign.zeroChatFallbacks,1);assert.equal(state.evidence.includes("Patient 06 ledger"),true);
});

test("missing optional interactions never softlock room progression",()=>{
  const state=createState(1);startEpisode(state,1);assert.equal(roomReadiness(state).ready,false);advanceRoom(state,100);assert.equal(roomFor(state).id,"surgery");assert.equal(state.rooms.intake.completed,false);assert.equal(state.recent.some(event=>event.type==="progress-warning"),true);
});

test("inventory can be combined and used for a real resource consequence",()=>{
  const state=createState(1);playerAction(state,"open-locker");applyEffect(state,"medkit");assert.equal(combineInventoryItems(state,"Sedative ampoule","Trauma kit").accepted,true);state.health=35;state.player.fear=70;
  assert.equal(useInventoryItem(state,"Stabilized trauma kit").accepted,true);assert.equal(state.health,75);assert.equal(state.player.fear,50);assert.equal(state.inventory.includes("Stabilized trauma kit"),false);
});

test("checkpoint restore returns a deterministic recoverable campaign state",()=>{
  const state=createState(1);startEpisode(state,1);completeIntake(state);resolveVote(state);advanceRoom(state,100);const before=state.health;state.health=1;const restored=restoreCheckpoint(state);assert.equal(restored.restored,true);assert.equal(restored.state.health,before);assert.equal(roomFor(restored.state).id,"surgery");assert.equal(restored.state.status,"voting");assert.equal(restored.state.roundEndsAt,30100);
});

test("a coherent streamer path reaches the earned humane ending",()=>{
  const state=reachStairwell(createState(1));assert.equal(roomFor(state).id,"stairwell");assert.equal(state.doors.exit,true);assert.equal(state.inventory.includes("Binding sigil"),true);playerAction(state,"seal-warden");playerAction(state,"open-roof");
  assert.equal(state.ending,"MARA WALKS INTO DAWN");assert.equal(state.endingRecap.wardenBound,true);assert.ok(state.campaign.meaningfulActions>=13);assert.ok(state.campaign.mechanics.length>=6);
});

test("a different final route produces a materially different reachable ending",()=>{
  const state=reachStairwell(createState(1));playerAction(state,"open-ambulance");assert.equal(state.ending,"THE TUNNEL REMEMBERS");assert.equal(state.endingRecap.route,"ambulance");assert.equal(state.endingRecap.streamerDecisions.at(-1).action,"open-ambulance");
});

test("pacing metrics are instrumentation, never a fabricated duration claim",()=>{
  const state=createState(1);startEpisode(state,0);tick(state,PACING_TARGETS.maxUnintentionalIdleMs+1);const progress=campaignProgress(state,PACING_TARGETS.rehearsalSectionMinMs);assert.equal(state.campaign.needsPacingBeat,true);assert.equal(progress.measured,false);assert.equal(progress.elapsedMs,PACING_TARGETS.rehearsalSectionMinMs);
});

test("legacy strong-evidence ending remains reachable for backward compatibility",()=>{
  const state=createState(1);state.evidence=["a","b","c"];state.power=80;finishEpisode(state,"roof");assert.equal(state.ending,"DAWN BREAKS OVER WARD 06");
});
