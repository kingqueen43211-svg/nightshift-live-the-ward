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
  const state=createState(1);startEpisode(state,1);assert.equal(roomReadiness(state).ready,false);resolveVote(state);advanceRoom(state,100);assert.equal(roomFor(state).id,"surgery");assert.equal(state.rooms.intake.completed,false);assert.equal(state.recent.some(event=>event.type==="progress-warning"),true);
});

test("inventory can be combined and used for a real resource consequence",()=>{
  const state=createState(1);playerAction(state,"open-locker");applyEffect(state,"medkit");assert.equal(combineInventoryItems(state,"Sedative ampoule","Trauma kit").accepted,true);state.health=35;state.player.fear=70;
  const result=useInventoryItem(state,"Stabilized trauma kit");assert.equal(result.accepted,true);assert.equal(state.health,75);assert.equal(state.player.fear,50);assert.equal(state.inventory.includes("Stabilized trauma kit"),false);assert.match(result.summary,/VITALS \+40 \(35 → 75\).*FEAR -20 \(70 → 50\)/);assert.equal(result.effects.length,2);
});

test("inventory items cannot be wasted and rejected uses remain carried",()=>{
  const state=createState(1);state.inventory=["Trauma kit","Audience shield"];state.health=100;state.shield=true;
  const healthResult=useInventoryItem(state,"Trauma kit");const shieldResult=useInventoryItem(state,"Audience shield");
  assert.equal(healthResult.accepted,false);assert.match(healthResult.reason,/retained.*maximum/i);assert.equal(shieldResult.accepted,false);assert.match(shieldResult.reason,/retained.*already armed/i);assert.deepEqual(state.inventory,["Trauma kit","Audience shield"]);
});

test("sedative and flare report exact resource and world-state consequences",()=>{
  const state=createState(1);state.inventory=["Sedative ampoule","Subscriber flare"];state.player.fear=30;state.danger=40;state.warden.visible=true;state.warden.phase="approaching";
  const sedative=useInventoryItem(state,"Sedative ampoule");assert.equal(sedative.accepted,true);assert.match(sedative.summary,/FEAR -25 \(30 → 5\).*THREAT -5 \(40 → 35\)/);
  const flare=useInventoryItem(state,"Subscriber flare");assert.equal(flare.accepted,true);assert.match(flare.summary,/THREAT -18 \(35 → 17\).*WARDEN: repelled/);assert.equal(state.warden.visible,false);assert.equal(state.warden.phase,"repelled");
});

test("checkpoint restore returns a deterministic recoverable campaign state",()=>{
  const state=createState(1);startEpisode(state,1);completeIntake(state);resolveVote(state);advanceRoom(state,100);const before=state.health;state.health=1;const restored=restoreCheckpoint(state);assert.equal(restored.restored,true);assert.equal(restored.state.health,before);assert.equal(roomFor(restored.state).id,"surgery");assert.equal(restored.state.status,"voting");assert.equal(restored.state.roundEndsAt,30100);
});

test("a coherent streamer path reaches the earned humane ending",()=>{
  const state=reachStairwell(createState(1));assert.equal(roomFor(state).id,"stairwell");assert.equal(state.doors.exit,true);assert.equal(state.inventory.includes("Binding sigil"),true);resolveVote(state);playerAction(state,"seal-warden");playerAction(state,"open-roof");
  assert.equal(state.ending,"MARA WALKS INTO DAWN");assert.equal(state.endingRecap.wardenBound,true);assert.ok(state.campaign.meaningfulActions>=13);assert.ok(state.campaign.mechanics.length>=6);
});

test("a different final route produces a materially different reachable ending",()=>{
  const state=reachStairwell(createState(1));castVote(state,"viewer-e","!ambulance");resolveVote(state);playerAction(state,"open-ambulance");assert.equal(state.ending,"THE TUNNEL REMEMBERS");assert.equal(state.endingRecap.route,"ambulance");assert.equal(state.endingRecap.streamerDecisions.at(-1).action,"open-ambulance");
});

test("starting a new episode clears the prior run while preserving production preferences",()=>{
  const state=createState(1);startEpisode(state,1);state.mode="LIVE_TWITCH";state.settings.reducedMotion=true;state.settings.highContrast=true;state.health=7;state.danger=99;state.power=100;state.inventory=["legacy item"];state.evidence=["legacy evidence"];state.doors.exit=true;state.story.subjectIdentified=true;state.warden.visible=true;state.members.viewer="guardian";state.seenEventIds=["old-event"];
  startEpisode(state,200,45000);assert.equal(state.mode,"LIVE_TWITCH");assert.equal(state.settings.reducedMotion,true);assert.equal(state.settings.highContrast,true);assert.equal(state.health,100);assert.equal(state.danger,22);assert.equal(state.power,8);assert.deepEqual(state.inventory,[]);assert.deepEqual(state.evidence,[]);assert.deepEqual(state.doors,{isolation:false,theatre:false,exit:false});assert.equal(state.story.subjectIdentified,false);assert.equal(state.warden.visible,false);assert.deepEqual(state.members,{});assert.deepEqual(state.seenEventIds,[]);assert.equal(state.roundEndsAt,45200);assert.equal(state.sessionId,"ward-200");
});

test("failed actions are attempts, not readiness or meaningful progress",()=>{
  const state=createState(1);startEpisode(state,1);const before=state.campaign.meaningfulActions;playerAction(state,"reconstruct-file");assert.equal(state.lastActionAccepted,false);assert.equal(state.rooms.intake.actions.includes("reconstruct-file"),false);assert.equal(state.rooms.intake.attempts.at(-1).accepted,false);assert.equal(state.campaign.meaningfulActions,before);playerAction(state,"search-desk");playerAction(state,"open-locker");assert.equal(roomReadiness(state).ready,false);playerAction(state,"reconstruct-file");assert.equal(state.lastActionAccepted,true);assert.equal(roomReadiness(state).ready,true);
});

test("advancement requires a resolved vote and repeated calls cannot skip a room",()=>{
  const state=createState(1);startEpisode(state,1);advanceRoom(state,100);assert.equal(state.roomIndex,0);assert.equal(state.lastAdvanceAccepted,false);resolveVote(state);advanceRoom(state,100);assert.equal(state.roomIndex,1);assert.equal(state.lastAdvanceAccepted,true);advanceRoom(state,101);assert.equal(state.roomIndex,1);assert.equal(state.lastAdvanceAccepted,false);
});

test("final routes require powered exits and a resolved final vote",()=>{
  const state=createState(1);startEpisode(state,1);state.roomIndex=4;state.act=5;playerAction(state,"open-roof");assert.equal(state.status,"voting");assert.equal(state.lastActionAccepted,false);resolveVote(state);advanceRoom(state,2);assert.equal(state.status,"consequence");assert.equal(state.lastAdvanceAccepted,false);state.doors.exit=true;playerAction(state,"open-roof");assert.equal(state.status,"ended");assert.equal(state.lastActionAccepted,true);
});

test("a Chaos blackout raises the cost but leaves the streamer a manual door counter",()=>{
  const state=createState(1);startEpisode(state,1);completeIntake(state);castVote(state,"viewer-a","!records");resolveVote(state);advanceRoom(state,100);
  playerAction(state,"inspect-gurney");playerAction(state,"listen-intercom");playerAction(state,"hide-curtain");castVote(state,"viewer-b","!dark");resolveVote(state);const before=state.health;playerAction(state,"force-door");
  assert.equal(state.lastActionAccepted,true);assert.equal(state.doors.theatre,true);assert.equal(state.health,before-10);assert.match(state.lastOutcome,/manual breach costs 10 vitals/i);assert.equal(roomReadiness(state).ready,true);
});

test("the audience open-isolation result leaves a valid streamer threshold action",()=>{
  const state=createState(1);startEpisode(state,1);completeIntake(state);castVote(state,"viewer-a","!records");resolveVote(state);advanceRoom(state,100);
  playerAction(state,"inspect-gurney");playerAction(state,"listen-intercom");castVote(state,"viewer-b","!open");const resolution=resolveVote(state);
  assert.equal(resolution.winner.id,"open");assert.equal(state.doors.isolation,true);assert.equal(state.doors.theatre,true);
  playerAction(state,"force-door");assert.equal(state.lastActionAccepted,true);assert.match(state.lastOutcome,/threshold|door|theatre/i);assert.equal(roomReadiness(state).ready,true);
});

test("director advancement cannot replace the streamer's physical final route",()=>{
  const state=createState(1);startEpisode(state,1);state.roomIndex=4;state.act=5;state.rooms.stairwell.visited=true;state.doors.exit=true;resolveVote(state);advanceRoom(state,2);assert.equal(state.status,"consequence");assert.equal(state.ending,null);assert.equal(state.lastAdvanceAccepted,false);assert.match(state.lastOutcome,/streamer must choose/i);
});

test("an incomplete generator applies a disclosed costly bypass instead of softlocking the finale",()=>{
  const state=createState(1);startEpisode(state,1);state.roomIndex=3;state.act=4;state.rooms.generator.visited=true;castVote(state,"viewer","!shield");resolveVote(state);assert.equal(state.doors.exit,false);advanceRoom(state,2);assert.equal(roomFor(state).id,"stairwell");assert.equal(state.doors.exit,true);assert.equal(state.inventory.includes("Emergency exit bypass"),true);assert.equal(state.campaign.fallbackRecoveries,1);assert.equal(state.rooms.generator.completed,false);assert.equal(state.recent.some(event=>event.type==="director-recovery"),true);
});

test("pacing metrics are instrumentation, never a fabricated duration claim",()=>{
  const state=createState(1);startEpisode(state,0);tick(state,PACING_TARGETS.maxUnintentionalIdleMs+1);const progress=campaignProgress(state,PACING_TARGETS.rehearsalSectionMinMs);assert.equal(state.campaign.needsPacingBeat,true);assert.equal(progress.measured,false);assert.equal(progress.elapsedMs,PACING_TARGETS.rehearsalSectionMinMs);
});

test("legacy strong-evidence ending remains reachable for backward compatibility",()=>{
  const state=createState(1);state.evidence=["a","b","c"];state.power=80;finishEpisode(state,"roof");assert.equal(state.ending,"DAWN BREAKS OVER WARD 06");
});
