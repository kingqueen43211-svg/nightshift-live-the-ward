export const ROOMS = [
  { id:"intake", act:1, name:"Reception / Triage", code:"B1", plate:"reception-triage.webp", objective:"Identify Subject 06", hint:"Search, compare, then reconstruct the torn intake record.", actions:["search-desk","open-locker","reconstruct-file"], cameraNodes:["lobby-wide","records-desk","locker-close"], signatureMechanic:"investigation", requiredActions:["search-desk","open-locker","reconstruct-file"], safeFallback:"records" },
  { id:"surgery", act:2, name:"Ward 06", code:"B2", plate:"ward-corridor.webp", objective:"Cross the isolation corridor", hint:"Read the room, control your noise, then breach the physical door.", actions:["inspect-gurney","listen-intercom","hide-curtain","force-door"], cameraNodes:["corridor-wide","door-approach","threshold"], signatureMechanic:"stealth", requiredActions:["inspect-gurney","listen-intercom","force-door"], safeFallback:"restore" },
  { id:"theatre", act:3, name:"Operating Theatre", code:"B3", plate:"operating-theatre.webp", objective:"Expose the Surgeon’s history", hint:"Use light, evidence, and timing to survive the operating table.", actions:["align-lamps","play-tape","counter-warden"], cameraNodes:["theatre-wide","lamp-array","restraint-table"], signatureMechanic:"threat-counterplay", requiredActions:["align-lamps","play-tape","counter-warden"], safeFallback:"lights" },
  { id:"generator", act:4, name:"Generator Room", code:"B4", plate:"generator-room.webp", objective:"Restore emergency power", hint:"Deduce and throw the breakers in sequence 2 · 1 · 3.", actions:["breaker-1","breaker-2","breaker-3","reroute-power"], cameraNodes:["generator-wide","breaker-close","service-stairs"], signatureMechanic:"sequence-puzzle", requiredActions:["breaker-2","breaker-1","breaker-3","reroute-power"], safeFallback:"charge" },
  { id:"stairwell", act:5, name:"Stairwell / Exits", code:"B5", plate:"stairwell-exits.webp", objective:"Decide what the truth costs", hint:"Your evidence, resources, and final route determine who escapes.", actions:["seal-warden","open-roof","open-ambulance"], cameraNodes:["landing-wide","roof-exit","ambulance-tunnel"], signatureMechanic:"earned-final-choice", requiredActions:[], safeFallback:"roof" }
];

export const PACING_TARGETS = Object.freeze({
  openingObjectiveMs:15000,
  firstInteractionMs:30000,
  firstConsequenceMs:75000,
  rehearsalSectionMinMs:10*60*1000,
  rehearsalSectionMaxMs:15*60*1000,
  fullCampaignMinMs:20*60*1000,
  fullCampaignMaxMs:35*60*1000,
  maxUnintentionalIdleMs:25000
});

export const MECHANIC_KINDS = Object.freeze({
  "search-desk":"investigation","open-locker":"resource","reconstruct-file":"deduction",
  "inspect-gurney":"investigation","listen-intercom":"deduction","hide-curtain":"stealth","force-door":"environment",
  "align-lamps":"environment","play-tape":"narrative","counter-warden":"threat-counterplay",
  "breaker-1":"sequence-puzzle","breaker-2":"sequence-puzzle","breaker-3":"sequence-puzzle","reroute-power":"resource-management",
  "seal-warden":"narrative-choice","open-roof":"route-choice","open-ambulance":"route-choice"
});

const VOTES = {
  intake:[
    {id:"records",label:"Search patient records",command:"!records",faction:"guardian",effect:"A missing patient ledger surfaces."},
    {id:"medkit",label:"Raid the medicine locker",command:"!medkit",faction:"guardian",effect:"Emergency supplies restore health."},
    {id:"noise",label:"Ring the night bell",command:"!noise",faction:"chaos",effect:"The bell summons something nearby."}
  ],
  surgery:[
    {id:"restore",label:"Restore corridor power",command:"!restore",faction:"guardian",effect:"The isolation bolts release."},
    {id:"open",label:"Open isolation",command:"!open",faction:"guardian",effect:"A route to theatre unlocks."},
    {id:"dark",label:"Kill the lights",command:"!dark",faction:"chaos",effect:"The Surgeon advances in darkness."}
  ],
  theatre:[
    {id:"tape",label:"Play the confession",command:"!tape",faction:"guardian",effect:"The Ward’s experiment is exposed."},
    {id:"lights",label:"Focus surgical lamps",command:"!lights",faction:"guardian",effect:"The Surgeon recoils from the light."},
    {id:"release",label:"Release Subject 06",command:"!release",faction:"chaos",effect:"The restraint table tears open."}
  ],
  generator:[
    {id:"charge",label:"Charge emergency grid",command:"!charge",faction:"guardian",effect:"The exit network begins to wake."},
    {id:"shield",label:"Shield the operator",command:"!shield",faction:"guardian",effect:"The next attack is absorbed."},
    {id:"overload",label:"Overload the grid",command:"!overload",faction:"chaos",effect:"The station erupts in sparks."}
  ],
  stairwell:[
    {id:"roof",label:"Escape across the roof",command:"!roof",faction:"guardian",effect:"A rescue beacon answers."},
    {id:"ambulance",label:"Take the ambulance tunnel",command:"!ambulance",faction:"guardian",effect:"The underground bay unlocks."},
    {id:"contain",label:"Seal the Ward forever",command:"!contain",faction:"chaos",effect:"Someone must remain behind."}
  ]
};

export function roomFor(state){ return ROOMS[state.roomIndex] || ROOMS[0]; }
export function optionsFor(state){ return VOTES[roomFor(state).id]; }
function initialRoomStates(){ return Object.fromEntries(ROOMS.map((room,index)=>[room.id,{visited:index===0,completed:false,enteredAt:null,exitedAt:null,actions:[],attempts:[],cameraNode:room.cameraNodes[0],visitedNodes:[room.cameraNodes[0]],world:{}}])); }
export function createState(now=Date.now()){
  return {
    sessionId:`ward-${now}`,version:1,status:"briefing",mode:"SIMULATED",roomIndex:0,
    startedAt:null,roundEndsAt:now+30000,round:1,health:100,danger:22,power:8,
    inventory:[],evidence:[],doors:{isolation:false,theatre:false,exit:false},
    props:{desk:false,locker:false,lamps:false,tape:false,breakers:[false,false,false],breakerProgress:[]},
    player:{fear:12,noise:0,hidden:false,focus:100,lastAction:null,combo:0},
    story:{subjectIdentified:false,confessionDecoded:false,wardenBound:false},lastOutcome:"",lastActionAccepted:null,lastAdvanceAccepted:null,lastItemEffect:null,lastAudioCue:null,
    warden:{level:0,visible:false,contained:false,phase:"dormant"},guardians:50,chaos:50,
    energy:{guardian:45,chaos:45},cooldowns:{guardian:0,chaos:0},members:{},
    votes:{},voters:{},winner:null,ending:null,shield:false,recent:[],seenEventIds:[],
    act:1,camera:{nodeId:ROOMS[0].cameraNodes[0],moving:false,history:[ROOMS[0].cameraNodes[0]]},rooms:initialRoomStates(),
    campaign:{meaningfulActions:0,mechanics:[],decisions:[],voteResolutions:0,zeroChatFallbacks:0,fallbackRecoveries:0,lastMeaningfulAt:now,elapsedMs:0,checkpoint:null},
    endingRecap:null,voteResolutionSource:null,
    settings:{
      reducedMotion:false,lowEffects:false,highContrast:false,hideNames:false,jumpscares:true,
      captionEnabled:true,captionSize:"medium",captionBackground:"solid",captionSpeakerLabels:true,captionDirectional:true,captionDuration:5200
    }
  };
}

function ensureCampaignState(state){
  state.rooms ||= initialRoomStates(); state.campaign ||= {meaningfulActions:0,mechanics:[],decisions:[],voteResolutions:0,zeroChatFallbacks:0,fallbackRecoveries:0,lastMeaningfulAt:Date.now(),elapsedMs:0,checkpoint:null}; state.campaign.fallbackRecoveries??=0;
  state.camera ||= {nodeId:roomFor(state).cameraNodes[0],moving:false,history:[roomFor(state).cameraNodes[0]]}; state.act ||= roomFor(state).act; return state;
}

export function enterCameraNode(state,nodeId){
  ensureCampaignState(state); const room=roomFor(state); if(!room.cameraNodes.includes(nodeId)) return {state,accepted:false,reason:"Camera node is not connected to this room"};
  const roomState=state.rooms[room.id]; roomState.cameraNode=nodeId; if(!roomState.visitedNodes.includes(nodeId))roomState.visitedNodes.push(nodeId); state.camera.nodeId=nodeId; state.camera.history.push(nodeId); state.camera.history=state.camera.history.slice(-24); state.version++;
  log(state,"camera","STREAMER",`${room.name}: ${nodeId}`); return {state,accepted:true,nodeId};
}

export function campaignProgress(state,now=Date.now()){
  ensureCampaignState(state); const completed=ROOMS.filter(room=>state.rooms[room.id]?.completed).length; const mechanics=[...new Set(state.campaign.mechanics)];
  return {act:state.act,roomId:roomFor(state).id,completedRooms:completed,totalRooms:ROOMS.length,meaningfulActions:state.campaign.meaningfulActions,mechanics,elapsedMs:state.startedAt!==null?Math.max(0,now-state.startedAt):0,measured:false};
}

export function checkpointState(state,now=Date.now()){
  ensureCampaignState(state); const snapshot=structuredClone(state); snapshot.campaign.checkpoint=null; state.campaign.checkpoint={at:now,roomId:roomFor(state).id,state:snapshot}; return state.campaign.checkpoint;
}

export function restoreCheckpoint(state){
  ensureCampaignState(state); const checkpoint=state.campaign.checkpoint; if(!checkpoint?.state)return {state,restored:false,reason:"No checkpoint"}; const restored=structuredClone(checkpoint.state); restored.campaign.checkpoint=checkpoint; restored.version=(state.version||0)+1; return {state:restored,restored:true};
}

function log(state,type,actor,text){ state.recent.unshift({type,actor,text,at:Date.now()}); state.recent=state.recent.slice(0,18); }
function clamp(n,min=0,max=100){ return Math.max(min,Math.min(max,n)); }
function resetVote(state,now=Date.now(),duration=30000){ state.votes=Object.fromEntries(optionsFor(state).map(o=>[o.id,0])); state.voters={}; state.winner=null; state.voteResolutionSource=null; state.roundEndsAt=now+duration; state.status="voting"; }
export function startEpisode(state,now=Date.now(),duration=30000){
  const previousVersion=Number.isFinite(state.version)?state.version:0, preservedMode=state.mode||"SIMULATED", preservedSettings=structuredClone(state.settings||{}), fresh=createState(now);
  for(const key of Object.keys(state))delete state[key]; Object.assign(state,fresh); state.version=previousVersion+1; state.mode=preservedMode; state.settings={...fresh.settings,...preservedSettings}; state.startedAt=now; state.rooms.intake.enteredAt=now;
  resetVote(state,now,duration); log(state,"system","NIGHTSHIFT","Episode armed: Reception signal acquired"); return state;
}
export function pauseEpisode(state){ if(state.status!=="ended") state.status="paused"; return state; }
export function resumeEpisode(state,now=Date.now()){ if(state.status==="paused") resetVote(state,now,30000); return state; }
export function stopEpisode(state){ state.version++; state.status="briefing"; state.roundEndsAt=0; return state; }
export function normalizeCommand(message=""){ return message.trim().toLowerCase().split(/\s+/)[0]; }
export function castVote(state,viewer,message,actor=viewer){
  if(state.status!=="voting") return {state,accepted:false,reason:"Voting is closed"};
  const option=optionsFor(state).find(o=>o.command===normalizeCommand(message));
  if(!option) return {state,accepted:false,reason:"Unknown vote"};
  const voter=String(viewer||"anonymous").toLowerCase();
  if(state.voters[voter]) return {state,accepted:false,reason:"One vote per viewer"};
  state.voters[voter]=option.id; state.votes[option.id]=(state.votes[option.id]||0)+1;
  option.faction==="guardian" ? state.guardians++ : state.chaos++; state.energy[option.faction]=clamp(state.energy[option.faction]+2);
  log(state,"vote",actor,option.label); return {state,accepted:true,option};
}
export function tally(state){ return optionsFor(state).map((o,i)=>({option:o,count:state.votes[o.id]||0,i})).sort((a,b)=>b.count-a.count||a.i-b.i)[0]; }
function addUnique(list,item){ if(!list.includes(item)) list.push(item); }
export function applyEffect(state,id){
  if(id==="records"){ state.props.desk=true; addUnique(state.evidence,"Patient 06 ledger"); state.danger+=5; }
  if(id==="medkit"){ state.props.locker=true; addUnique(state.inventory,"Trauma kit"); state.health+=18; }
  if(id==="noise"){ state.danger+=22; state.warden.level+=.25; state.warden.visible=true; state.warden.phase="warning"; }
  if(id==="restore"){ state.power+=25; state.doors.isolation=true; state.danger-=8; }
  if(id==="open"){ state.doors.isolation=true; state.doors.theatre=true; }
  if(id==="dark"){ state.power-=20; state.danger+=25; state.warden.level+=.35; state.warden.visible=true; state.warden.phase="approaching"; }
  if(id==="tape"){ state.props.tape=true; addUnique(state.evidence,"Dr. Vale confession"); state.danger+=8; }
  if(id==="lights"){ state.props.lamps=true; state.power-=10; state.danger-=18; state.warden.visible=false; state.warden.phase="repelled"; }
  if(id==="release"){ state.danger+=30; state.warden.level+=.45; state.warden.visible=true; state.warden.phase="striking"; }
  if(id==="charge"){ state.power+=35; state.doors.exit=true; }
  if(id==="shield"){ state.shield=true; addUnique(state.inventory,"Audience shield"); }
  if(id==="overload"){ state.power-=25; state.health-=state.shield?0:18; state.shield=false; state.danger+=18; }
  state.health=clamp(state.health); state.danger=clamp(state.danger); state.power=clamp(state.power);
}
export function resolveVote(state,now=Date.now()){
  if(state.status!=="voting") return {state,resolved:false};
  ensureCampaignState(state); const total=Object.values(state.votes).reduce((sum,count)=>sum+count,0); let result=tally(state);
  if(total===0){const safeId=roomFor(state).safeFallback;const safeOption=optionsFor(state).find(option=>option.id===safeId)||result.option;result={option:safeOption,count:0,i:0};state.voteResolutionSource="ZERO_CHAT_FALLBACK";state.campaign.zeroChatFallbacks++;}
  else state.voteResolutionSource="AUDIENCE";
  state.winner=result.option; state.status="consequence"; applyEffect(state,result.option.id); state.campaign.voteResolutions++; state.campaign.lastMeaningfulAt=now;
  log(state,"result",state.voteResolutionSource==="AUDIENCE"?"CHAT":"DIRECTOR",total===0?`${result.option.label} selected as the announced zero-chat fallback`:`${result.option.label} wins with ${result.count} vote${result.count===1?"":"s"}`); return {state,resolved:true,winner:result.option,source:state.voteResolutionSource};
}
export function roomReadiness(state){
  ensureCampaignState(state); const room=roomFor(state),actions=state.rooms[room.id]?.actions||[]; const missing=room.requiredActions.filter(action=>!actions.includes(action));
  const criticalMissing=[];
  if(room.id==="intake"&&!state.story.subjectIdentified)criticalMissing.push("identify-subject-06");
  if(room.id==="surgery"&&!state.doors.theatre)criticalMissing.push("open-theatre-route");
  if(room.id==="theatre"&&!state.story.confessionDecoded)criticalMissing.push("decode-confession");
  if(room.id==="theatre"&&!state.inventory.includes("Binding sigil"))criticalMissing.push("survive-warden-counter");
  if(room.id==="generator"&&state.props.breakerProgress.join("-")!=="2-1-3")criticalMissing.push("complete-breaker-sequence");
  if(room.id==="generator"&&!state.doors.exit)criticalMissing.push("restore-exit-power");
  return {ready:missing.length===0&&criticalMissing.length===0,missing:[...new Set([...missing,...criticalMissing])]};
}
export function advanceRoom(state,now=Date.now(),duration=30000){
  ensureCampaignState(state); state.lastAdvanceAccepted=false;
  if(state.status!=="consequence"){state.lastOutcome=state.status==="ended"?"This episode has already ended.":"Resolve the current audience vote before advancing.";return state;}
  if(state.roomIndex>=ROOMS.length-1){if(!state.doors.exit){state.lastOutcome="The ending cannot resolve until the emergency exit network is powered.";return state;}state.lastOutcome="The audience consequence is locked. The streamer must choose the roof or ambulance route in the world.";return state;}
  const current=roomFor(state),readiness=roomReadiness(state),currentState=state.rooms[current.id]; currentState.completed=readiness.ready; currentState.exitedAt=now;
  if(!readiness.ready)log(state,"progress-warning","DIRECTOR",`Continuing with fallback support; missed: ${readiness.missing.join(", ")}`);
  if(current.id==="generator"&&!state.doors.exit){state.doors.exit=true;state.power=Math.max(35,state.power);state.danger=clamp(state.danger+12);addUnique(state.inventory,"Emergency exit bypass");state.campaign.fallbackRecoveries++;log(state,"director-recovery","DIRECTOR","Emergency bypass engaged so the campaign cannot softlock; danger increased.");}
  state.roomIndex++; state.round++; state.version++; const next=roomFor(state),nextState=state.rooms[next.id]; nextState.visited=true; nextState.enteredAt=now; state.act=next.act; state.camera.nodeId=next.cameraNodes[0]; state.camera.history.push(next.cameraNodes[0]);
  state.lastAdvanceAccepted=true; resetVote(state,now,duration); checkpointState(state,now); log(state,"system","NIGHTSHIFT",`${next.name} entered`); return state;
}
function recordPlayerProgress(state,action,accepted){
  ensureCampaignState(state); const room=roomFor(state),roomState=state.rooms[room.id]; roomState.attempts||=[]; roomState.attempts.push({action,accepted,outcome:state.lastOutcome}); roomState.attempts=roomState.attempts.slice(-32);
  if(accepted){const first=!roomState.actions.includes(action);if(first)roomState.actions.push(action);const mechanic=MECHANIC_KINDS[action]||"interaction";if(!state.campaign.mechanics.includes(mechanic))state.campaign.mechanics.push(mechanic);if(first)state.campaign.meaningfulActions++;if(["reconstruct-file","force-door","counter-warden","reroute-power","seal-warden","open-roof","open-ambulance"].includes(action))state.campaign.decisions.push({act:state.act,roomId:room.id,action,outcome:state.lastOutcome});state.campaign.lastMeaningfulAt=Date.now();}
  roomState.world={doors:structuredClone(state.doors),power:state.power,danger:state.danger,wardenPhase:state.warden.phase}; state.version++;
}

export function combineInventoryItems(state,itemA,itemB){
  ensureCampaignState(state); const pair=[itemA,itemB].sort(); const sedativePair=["Sedative ampoule","Trauma kit"].sort();
  if(pair[0]===sedativePair[0]&&pair[1]===sedativePair[1]&&state.inventory.includes(itemA)&&state.inventory.includes(itemB)){
    state.inventory=state.inventory.filter(item=>item!==itemA&&item!==itemB); addUnique(state.inventory,"Stabilized trauma kit"); state.campaign.mechanics.includes("inventory-combination")||state.campaign.mechanics.push("inventory-combination"); state.campaign.meaningfulActions++; state.campaign.lastMeaningfulAt=Date.now(); state.version++; state.lastOutcome="Sedative ampoule + Trauma kit → Stabilized trauma kit. One emergency treatment is ready."; state.lastItemEffect={accepted:true,item:"Stabilized trauma kit",summary:state.lastOutcome,effects:[{key:"craft",label:"CRAFTED",before:"2 components",after:"1 stabilized treatment"}],at:Date.now()}; log(state,"craft","STREAMER",state.lastOutcome); return {state,accepted:true,item:"Stabilized trauma kit",effects:state.lastItemEffect.effects,summary:state.lastOutcome};
  }
  return {state,accepted:false,reason:"Those items cannot be combined"};
}

function numericEffect(key,label,before,after){
  return {key,label,before,after,delta:after-before};
}

function effectSummary(effects){
  return effects.map(effect=>{
    if(typeof effect.before!=="number"||typeof effect.after!=="number")return `${effect.label}: ${effect.after}`;
    const sign=effect.delta>0?"+":"";
    return `${effect.label} ${sign}${effect.delta} (${effect.before} → ${effect.after})`;
  }).join(" · ");
}

export function useInventoryItem(state,item){
  ensureCampaignState(state);
  const reject=reason=>{state.lastItemEffect={accepted:false,item,summary:reason,effects:[],at:Date.now()};state.lastOutcome=reason;return {state,accepted:false,reason,effects:[]};};
  if(!state.inventory.includes(item))return reject("Item is not in inventory.");
  const before={health:state.health,fear:state.player.fear,danger:state.danger,shield:state.shield,wardenVisible:state.warden.visible,wardenPhase:state.warden.phase};
  if(item==="Trauma kit"){
    if(state.health>=100)return reject("Trauma kit retained: vitals are already at maximum.");
    state.health=clamp(state.health+25);
  }else if(item==="Sedative ampoule"){
    if(state.player.fear<=0&&state.danger<=0)return reject("Sedative retained: fear and entity threat are already stable.");
    state.player.fear=clamp(state.player.fear-25);state.danger=clamp(state.danger-5);
  }else if(item==="Stabilized trauma kit"){
    if(state.health>=100&&state.player.fear<=0)return reject("Stabilized kit retained: vitals and fear are already stable.");
    state.health=clamp(state.health+40);state.player.fear=clamp(state.player.fear-20);
  }else if(item==="Subscriber flare"){
    if(state.danger<=0&&!state.warden.visible&&state.warden.phase==="repelled")return reject("Subscriber flare retained: the Warden is already repelled and threat is at minimum.");
    state.danger=clamp(state.danger-18);state.warden.visible=false;state.warden.phase="repelled";
  }else if(item==="Audience shield"){
    if(state.shield)return reject("Audience shield retained: a shield is already armed.");
    state.shield=true;
  }else return reject("Item must be used at a matching world object.");

  const effects=[];
  if(state.health!==before.health)effects.push(numericEffect("health","VITALS",before.health,state.health));
  if(state.player.fear!==before.fear)effects.push(numericEffect("fear","FEAR",before.fear,state.player.fear));
  if(state.danger!==before.danger)effects.push(numericEffect("danger","THREAT",before.danger,state.danger));
  if(state.shield!==before.shield)effects.push({key:"shield",label:"SHIELD",before:before.shield?"armed":"offline",after:state.shield?"armed":"offline"});
  if(state.warden.phase!==before.wardenPhase||state.warden.visible!==before.wardenVisible)effects.push({key:"warden",label:"WARDEN",before:before.wardenPhase,after:state.warden.phase});
  if(!effects.length)return reject(`${item} retained: it would not change the current state.`);

  state.inventory.splice(state.inventory.indexOf(item),1); state.campaign.mechanics.includes("inventory-use")||state.campaign.mechanics.push("inventory-use"); state.campaign.meaningfulActions++; state.campaign.lastMeaningfulAt=Date.now(); state.version++;
  const summary=`${item}: ${effectSummary(effects)}.`; state.lastOutcome=summary; state.lastItemEffect={accepted:true,item,summary,effects,at:Date.now()}; log(state,"item","STREAMER",summary); return {state,accepted:true,item,effects,summary};
}

export function playerAction(state,action){
  state.player ||= {fear:12,noise:0,hidden:false,focus:100,lastAction:null,combo:0}; state.story ||= {subjectIdentified:false,confessionDecoded:false,wardenBound:false};
  ensureCampaignState(state); const existingRoomState=state.rooms?.[roomFor(state).id];
  if(existingRoomState?.actions?.includes(action)){state.lastActionAccepted=false;state.lastOutcome="That physical action is already complete.";return state;}
  let outcome="",accepted=false; state.player.hidden=false;
  if(action==="search-desk"){accepted=true;state.props.desk=true;addUnique(state.evidence,"Triage transfer slip");state.player.focus=clamp(state.player.focus-4);outcome="A transfer slip names Ward 06—but the patient line is torn away.";}
  if(action==="open-locker"){accepted=true;state.props.locker=true;addUnique(state.inventory,"Sedative ampoule");state.health=clamp(state.health+10);state.player.noise=clamp(state.player.noise+8);outcome="You recover a sedative. The locker clang echoes down the hall.";}
  if(action==="reconstruct-file"){if(state.props.desk&&state.props.locker){accepted=true;state.story.subjectIdentified=true;addUnique(state.evidence,"Subject 06: Mara Vale");state.player.combo++;outcome="The fragments match: Subject 06 was Dr. Vale’s daughter.";}else{state.player.fear=clamp(state.player.fear+6);outcome="Two fragments are missing. Search the entire reception first.";}}
  if(action==="inspect-gurney"){accepted=true;addUnique(state.evidence,"Restraint tag 06");state.danger=clamp(state.danger+5);state.player.focus=clamp(state.player.focus-5);outcome="Fresh restraint marks point toward the isolation door.";}
  if(action==="listen-intercom"){accepted=true;state.player.noise=clamp(state.player.noise-10);addUnique(state.evidence,"Intercom cadence: short-short-long");outcome="Behind the static: a warning timed to the door’s magnetic cycle.";}
  if(action==="hide-curtain"){accepted=true;state.player.hidden=true;state.player.noise=0;state.danger=clamp(state.danger-10);state.player.fear=clamp(state.player.fear+4);state.warden.phase="passing";outcome="You hold your breath as the Warden passes the curtain.";}
  if(action==="force-door"){
    const chaosCounter=state.winner?.id==="dark"&&state.evidence.length>=2&&state.rooms?.surgery?.actions?.includes("hide-curtain");
    const audienceOpened=state.winner?.id==="open"&&state.doors.isolation&&state.evidence.length>=2;
    if(audienceOpened){accepted=true;state.doors.theatre=true;state.player.noise=clamp(state.player.noise+8);outcome="Chat released the isolation bolts. You cross the threshold and open the route to theatre.";}
    else if(state.power>=20&&state.evidence.length>=2){accepted=true;state.doors.isolation=true;state.doors.theatre=true;state.player.noise=clamp(state.player.noise+18);outcome="The bolts retract on restored power. You breach isolation and open the route to theatre.";}
    else if(chaosCounter){accepted=true;state.doors.isolation=true;state.doors.theatre=true;state.health=clamp(state.health-10);state.danger=clamp(state.danger+10);state.player.noise=clamp(state.player.noise+28);outcome="With the lights dead, you use the curtain rail as a lever. The door tears open, but the manual breach costs 10 vitals and draws the Warden.";}
    else{state.health=clamp(state.health-8);state.player.fear=clamp(state.player.fear+12);outcome="The maglock rejects you. Read the corridor, resolve its power vote, or prepare a manual darkness breach.";}
  }
  if(action==="align-lamps"){accepted=true;state.props.lamps=true;state.warden.visible=false;state.warden.phase="repelled";state.danger=clamp(state.danger-12);state.power=clamp(state.power-8);outcome="Three surgical beams pin the Warden’s shadow to the wall.";}
  if(action==="play-tape"){accepted=true;state.props.tape=true;addUnique(state.evidence,"Theatre audio log");state.story.confessionDecoded=state.story.subjectIdentified;outcome=state.story.confessionDecoded?"Vale confesses: the Warden was built to contain Mara, not kill her.":"The confession references a patient you have not identified.";}
  if(action==="counter-warden"){if(state.props.lamps&&state.story.confessionDecoded){accepted=true;state.warden.visible=false;state.warden.phase="repelled";state.danger=clamp(state.danger-25);state.player.combo+=2;addUnique(state.inventory,"Binding sigil");outcome="Light and confession synchronize. You tear a binding sigil free.";}else{state.warden.visible=true;state.warden.phase="striking";state.health=clamp(state.health-14);state.danger=clamp(state.danger+14);outcome="Your counter fails. The Warden closes the distance.";}}
  if(action.startsWith("breaker-")){
    const n=Number(action.at(-1)); const expected=[2,1,3][state.props.breakerProgress.length];
    if(n===expected){accepted=true;state.props.breakerProgress.push(n);state.props.breakers[n-1]=true;} else {state.props.breakerProgress=[];state.props.breakers=[false,false,false];state.danger=clamp(state.danger+8);}
    if(state.props.breakerProgress.length===3){state.power=100;state.doors.exit=true;addUnique(state.inventory,"Exit power");outcome="2 · 1 · 3. The emergency grid detonates into life.";} else outcome=n===expected?`Breaker ${n} locks. The pattern is holding.`:"Wrong sequence. The generator screams and resets.";
  }
  if(action==="reroute-power"){if(state.props.breakerProgress.join("-")==="2-1-3"){accepted=true;state.power=100;state.danger=clamp(state.danger-8);outcome="Power rerouted from containment to the escape network.";}else{state.danger=clamp(state.danger+10);outcome="The dead grid backfeeds. Complete the breaker sequence first.";}}
  if(action==="seal-warden"){if(state.inventory.includes("Binding sigil")&&state.evidence.length>=4){accepted=true;state.story.wardenBound=true;state.warden.contained=true;state.danger=10;outcome="The evidence names the victim. The sigil seals the Warden without sacrificing Mara.";}else{state.danger=clamp(state.danger+18);outcome="You cannot complete the seal without the truth and the sigil.";}}
  if(action==="open-roof"||action==="open-ambulance"){
    if(roomFor(state).id!=="stairwell")outcome="The final route can only be opened from the exit stairwell.";
    else if(!state.doors.exit)outcome="The exit network is dead. Restore and reroute generator power first.";
    else if(state.status!=="consequence")outcome="The exit is powered, but the final audience vote must resolve before you commit.";
    else{accepted=true;outcome=action==="open-roof"?"You commit to the roof route and fire the rescue beacon.":"You commit to the ambulance tunnel beneath the Ward.";}
  }
  state.player.lastAction=action; state.lastActionAccepted=accepted; state.player.fear=clamp(state.player.fear+(state.danger>70?3:-1)); state.player.noise=clamp(state.player.noise-2); state.lastOutcome=outcome||`Unknown action: ${action}`;
  recordPlayerProgress(state,action,accepted); log(state,accepted?"action":"action-rejected","STREAMER",state.lastOutcome); if(accepted&&(action==="open-roof"||action==="open-ambulance"))finishEpisode(state,action==="open-roof"?"roof":"ambulance"); return state;
}
export function joinFaction(state,user,faction,actor=user){ if(!["guardian","chaos"].includes(faction)) return false; state.members[String(user).toLowerCase()]=faction; log(state,"faction",actor,`joined ${faction}`); return true; }
export function usePower(state,user,power,actor=user){
  const faction=state.members[String(user).toLowerCase()]; if(!faction) return {accepted:false,reason:"Join a faction first"};
  if(state.cooldowns[faction]>Date.now()) return {accepted:false,reason:"Power cooling down"}; if(state.energy[faction]<25) return {accepted:false,reason:"Not enough faction energy"};
  state.energy[faction]-=25; state.cooldowns[faction]=Date.now()+20000;
  if(faction==="guardian"){state.health=clamp(state.health+12);state.danger=clamp(state.danger-8);state.warden.phase="repelled";} else {state.danger=clamp(state.danger+12);state.warden.visible=true;state.warden.phase="warning";}
  log(state,"power",actor,power||`${faction} surge`); return {accepted:true};
}
export function ingestCommand(state,user,message,actor=user){
  const [cmd,arg]=String(message).trim().toLowerCase().split(/\s+/);
  if(cmd==="!join") return {state,accepted:joinFaction(state,user,arg,actor),kind:"faction"}; if(cmd==="!power") return {state,...usePower(state,user,arg,actor),kind:"power"};
  return {...castVote(state,user,message,actor),kind:"vote"};
}
export function applyChannelEvent(state,event){
  const id=event.id||`${event.type}:${event.user||"anon"}:${event.at||Date.now()}`; if(state.seenEventIds.includes(id)) return {state,accepted:false,reason:"Duplicate event"};
  state.seenEventIds.push(id); state.seenEventIds=state.seenEventIds.slice(-200);
  if(event.type==="follow"){state.energy.guardian=clamp(state.energy.guardian+8);state.health=clamp(state.health+4);}
  if(event.type==="subscribe"){state.health=clamp(state.health+15);addUnique(state.inventory,"Subscriber flare");}
  if(event.type==="cheer"){state.power=clamp(state.power+12);state.danger=clamp(state.danger+5);}
  if(event.type==="raid"){state.energy.guardian=100;state.energy.chaos=100;state.warden.visible=true;}
  log(state,"event",event.user||"TWITCH",event.type); return {state,accepted:true};
}
export function tick(state,now=Date.now()){
  ensureCampaignState(state); state.campaign.elapsedMs=state.startedAt!==null?Math.max(0,now-state.startedAt):0; state.campaign.needsPacingBeat=state.status!=="paused"&&state.status!=="ended"&&now-state.campaign.lastMeaningfulAt>PACING_TARGETS.maxUnintentionalIdleMs;
  if(state.status==="voting"&&now>=state.roundEndsAt) resolveVote(state,now); return state;
}
export function finishEpisode(state,choice="roof"){
  ensureCampaignState(state); const strong=state.evidence.length>=3&&state.power>=50,truth=state.story.confessionDecoded&&state.evidence.length>=4,doomed=state.health<=0||state.danger>=95;
  const route=choice==="contain"||state.winner?.id==="contain"?"contain":choice;
  state.ending=doomed?"THE WARD CLAIMS ANOTHER":state.story.wardenBound?"MARA WALKS INTO DAWN":truth&&route==="roof"?"THE TRUTH LEAVES WARD 06":route==="contain"?"THE LAST NIGHTSHIFT":route==="ambulance"?"THE TUNNEL REMEMBERS":strong?"DAWN BREAKS OVER WARD 06":"ESCAPE, WITHOUT ANSWERS";
  state.status="ended"; state.warden.contained=(state.story.wardenBound||strong)&&!doomed; state.campaign.elapsedMs=state.startedAt!==null?Math.max(0,Date.now()-state.startedAt):state.campaign.elapsedMs;
  state.endingRecap={ending:state.ending,route,evidence:state.evidence.length,subjectIdentified:state.story.subjectIdentified,confessionDecoded:state.story.confessionDecoded,wardenBound:state.story.wardenBound,streamerDecisions:state.campaign.decisions.slice(-6),audienceResolutions:state.campaign.voteResolutions,zeroChatFallbacks:state.campaign.zeroChatFallbacks,fallbackRecoveries:state.campaign.fallbackRecoveries,mechanics:[...state.campaign.mechanics],elapsedMs:state.campaign.elapsedMs,durationMeasured:false};
  const currentState=state.rooms[roomFor(state).id]; if(currentState){currentState.completed=true;currentState.exitedAt=Date.now();} log(state,"ending","NIGHTSHIFT",state.ending); return state;
}
export function publicState(state){
  const copy=structuredClone(state);
  // The OBS transport never needs per-viewer vote maps, faction membership,
  // EventSub identifiers, or a checkpoint containing a second full state tree.
  copy.voters={}; copy.members={}; copy.seenEventIds=[];
  if(copy.campaign)copy.campaign.checkpoint=null;
  if(copy.settings.hideNames)copy.recent=copy.recent.map(e=>({...e,actor:e.actor==="NIGHTSHIFT"||e.actor==="CHAT"?e.actor:"VIEWER"}));
  return copy;
}
