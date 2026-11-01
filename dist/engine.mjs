export const ROOMS = [
  { id:"intake", name:"Reception / Triage", code:"B1", plate:"reception-triage.png", objective:"Identify Subject 06", hint:"Search, compare, then reconstruct the torn intake record.", actions:["search-desk","open-locker","reconstruct-file"] },
  { id:"surgery", name:"Ward 06", code:"B2", plate:"ward-corridor.png", objective:"Cross the isolation corridor", hint:"Read the room, control your noise, then breach the physical door.", actions:["inspect-gurney","listen-intercom","hide-curtain","force-door"] },
  { id:"theatre", name:"Operating Theatre", code:"B3", plate:"operating-theatre.png", objective:"Expose the Surgeon’s history", hint:"Use light, evidence, and timing to survive the operating table.", actions:["align-lamps","play-tape","counter-warden"] },
  { id:"generator", name:"Generator Room", code:"B4", plate:"generator-room.png", objective:"Restore emergency power", hint:"Deduce and throw the breakers in sequence 2 · 1 · 3.", actions:["breaker-1","breaker-2","breaker-3","reroute-power"] },
  { id:"stairwell", name:"Stairwell / Exits", code:"B5", plate:"stairwell-exits.png", objective:"Decide what the truth costs", hint:"Your evidence, resources, and final route determine who escapes.", actions:["seal-warden","open-roof","open-ambulance"] }
];

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
export function createState(now=Date.now()){
  return {
    sessionId:`ward-${now}`,version:1,status:"briefing",mode:"SIMULATED",roomIndex:0,
    startedAt:null,roundEndsAt:now+30000,round:1,health:100,danger:22,power:8,
    inventory:[],evidence:[],doors:{isolation:false,theatre:false,exit:false},
    props:{desk:false,locker:false,lamps:false,tape:false,breakers:[false,false,false],breakerProgress:[]},
    player:{fear:12,noise:0,hidden:false,focus:100,lastAction:null,combo:0},
    story:{subjectIdentified:false,confessionDecoded:false,wardenBound:false},lastOutcome:"",
    warden:{level:0,visible:false,contained:false},guardians:50,chaos:50,
    energy:{guardian:45,chaos:45},cooldowns:{guardian:0,chaos:0},members:{},
    votes:{},voters:{},winner:null,ending:null,shield:false,recent:[],seenEventIds:[],
    settings:{reducedMotion:false,lowEffects:false,highContrast:false,hideNames:false,jumpscares:true}
  };
}

function log(state,type,actor,text){ state.recent.unshift({type,actor,text,at:Date.now()}); state.recent=state.recent.slice(0,18); }
function clamp(n,min=0,max=100){ return Math.max(min,Math.min(max,n)); }
function resetVote(state,now=Date.now(),duration=30000){ state.votes=Object.fromEntries(optionsFor(state).map(o=>[o.id,0])); state.voters={}; state.winner=null; state.roundEndsAt=now+duration; state.status="voting"; }
export function startEpisode(state,now=Date.now(),duration=30000){ state.version++; state.startedAt=now; state.roomIndex=0; state.round=1; state.ending=null; resetVote(state,now,duration); log(state,"system","NIGHTSHIFT","Episode armed: Reception signal acquired"); return state; }
export function pauseEpisode(state){ if(state.status!=="ended") state.status="paused"; return state; }
export function resumeEpisode(state,now=Date.now()){ if(state.status==="paused") resetVote(state,now,30000); return state; }
export function stopEpisode(state){ state.version++; state.status="briefing"; state.roundEndsAt=0; return state; }
export function normalizeCommand(message=""){ return message.trim().toLowerCase().split(/\s+/)[0]; }
export function castVote(state,viewer,message){
  if(state.status!=="voting") return {state,accepted:false,reason:"Voting is closed"};
  const option=optionsFor(state).find(o=>o.command===normalizeCommand(message));
  if(!option) return {state,accepted:false,reason:"Unknown vote"};
  const voter=String(viewer||"anonymous").toLowerCase();
  if(state.voters[voter]) return {state,accepted:false,reason:"One vote per viewer"};
  state.voters[voter]=option.id; state.votes[option.id]=(state.votes[option.id]||0)+1;
  option.faction==="guardian" ? state.guardians++ : state.chaos++; state.energy[option.faction]=clamp(state.energy[option.faction]+2);
  log(state,"vote",viewer,option.label); return {state,accepted:true,option};
}
export function tally(state){ return optionsFor(state).map((o,i)=>({option:o,count:state.votes[o.id]||0,i})).sort((a,b)=>b.count-a.count||a.i-b.i)[0]; }
function addUnique(list,item){ if(!list.includes(item)) list.push(item); }
export function applyEffect(state,id){
  if(id==="records"){ state.props.desk=true; addUnique(state.evidence,"Patient 06 ledger"); state.danger+=5; }
  if(id==="medkit"){ state.props.locker=true; addUnique(state.inventory,"Trauma kit"); state.health+=18; }
  if(id==="noise"){ state.danger+=22; state.warden.level+=.25; state.warden.visible=true; }
  if(id==="restore"){ state.power+=25; state.doors.isolation=true; state.danger-=8; }
  if(id==="open"){ state.doors.isolation=true; state.doors.theatre=true; }
  if(id==="dark"){ state.power-=20; state.danger+=25; state.warden.level+=.35; state.warden.visible=true; }
  if(id==="tape"){ state.props.tape=true; addUnique(state.evidence,"Dr. Vale confession"); state.danger+=8; }
  if(id==="lights"){ state.props.lamps=true; state.power-=10; state.danger-=18; state.warden.visible=false; }
  if(id==="release"){ state.danger+=30; state.warden.level+=.45; state.warden.visible=true; }
  if(id==="charge"){ state.power+=35; state.doors.exit=true; }
  if(id==="shield"){ state.shield=true; addUnique(state.inventory,"Audience shield"); }
  if(id==="overload"){ state.power-=25; state.health-=state.shield?0:18; state.shield=false; state.danger+=18; }
  state.health=clamp(state.health); state.danger=clamp(state.danger); state.power=clamp(state.power);
}
export function resolveVote(state){
  if(state.status!=="voting") return {state,resolved:false};
  const result=tally(state); state.winner=result.option; state.status="consequence"; applyEffect(state,result.option.id);
  log(state,"result","CHAT",`${result.option.label} wins with ${result.count} vote${result.count===1?"":"s"}`); return {state,resolved:true,winner:result.option};
}
export function advanceRoom(state,now=Date.now(),duration=30000){
  if(state.roomIndex>=ROOMS.length-1) return finishEpisode(state,state.winner?.id||"roof");
  state.roomIndex++; state.round++; state.version++; resetVote(state,now,duration); log(state,"system","NIGHTSHIFT",`${roomFor(state).name} entered`); return state;
}
export function playerAction(state,action){
  state.player ||= {fear:12,noise:0,hidden:false,focus:100,lastAction:null,combo:0}; state.story ||= {subjectIdentified:false,confessionDecoded:false,wardenBound:false};
  let outcome=""; state.player.hidden=false;
  if(action==="search-desk"){state.props.desk=true;addUnique(state.evidence,"Triage transfer slip");state.player.focus=clamp(state.player.focus-4);outcome="A transfer slip names Ward 06—but the patient line is torn away.";}
  if(action==="open-locker"){state.props.locker=true;addUnique(state.inventory,"Sedative ampoule");state.health=clamp(state.health+10);state.player.noise=clamp(state.player.noise+8);outcome="You recover a sedative. The locker clang echoes down the hall.";}
  if(action==="reconstruct-file"){if(state.props.desk&&state.props.locker){state.story.subjectIdentified=true;addUnique(state.evidence,"Subject 06: Mara Vale");state.player.combo++;outcome="The fragments match: Subject 06 was Dr. Vale’s daughter.";}else{state.player.fear=clamp(state.player.fear+6);outcome="Two fragments are missing. Search the entire reception first.";}}
  if(action==="inspect-gurney"){addUnique(state.evidence,"Restraint tag 06");state.danger=clamp(state.danger+5);state.player.focus=clamp(state.player.focus-5);outcome="Fresh restraint marks point toward the isolation door.";}
  if(action==="listen-intercom"){state.player.noise=clamp(state.player.noise-10);addUnique(state.evidence,"Intercom cadence: short-short-long");outcome="Behind the static: a warning timed to the door’s magnetic cycle.";}
  if(action==="hide-curtain"){state.player.hidden=true;state.player.noise=0;state.danger=clamp(state.danger-10);state.player.fear=clamp(state.player.fear+4);outcome="You hold your breath as the Warden passes the curtain.";}
  if(action==="force-door"){if(state.power>=20&&state.evidence.length>=2){state.doors.isolation=true;state.doors.theatre=true;state.player.noise=clamp(state.player.noise+18);outcome="The bolts retract. The isolation door opens into real darkness.";}else{state.health=clamp(state.health-8);state.player.fear=clamp(state.player.fear+12);outcome="The maglock rejects you. Find evidence and restore enough power.";}}
  if(action==="align-lamps"){state.props.lamps=true;state.warden.visible=false;state.danger=clamp(state.danger-12);state.power=clamp(state.power-8);outcome="Three surgical beams pin the Warden’s shadow to the wall.";}
  if(action==="play-tape"){state.props.tape=true;addUnique(state.evidence,"Theatre audio log");state.story.confessionDecoded=state.story.subjectIdentified;outcome=state.story.confessionDecoded?"Vale confesses: the Warden was built to contain Mara, not kill her.":"The confession references a patient you have not identified.";}
  if(action==="counter-warden"){if(state.props.lamps&&state.story.confessionDecoded){state.warden.visible=false;state.danger=clamp(state.danger-25);state.player.combo+=2;addUnique(state.inventory,"Binding sigil");outcome="Light and confession synchronize. You tear a binding sigil free.";}else{state.warden.visible=true;state.health=clamp(state.health-14);state.danger=clamp(state.danger+14);outcome="Your counter fails. The Warden closes the distance.";}}
  if(action.startsWith("breaker-")){
    const n=Number(action.at(-1)); const expected=[2,1,3][state.props.breakerProgress.length];
    if(n===expected){state.props.breakerProgress.push(n);state.props.breakers[n-1]=true;} else {state.props.breakerProgress=[];state.props.breakers=[false,false,false];state.danger=clamp(state.danger+8);}
    if(state.props.breakerProgress.length===3){state.power=100;state.doors.exit=true;addUnique(state.inventory,"Exit power");outcome="2 · 1 · 3. The emergency grid detonates into life.";} else outcome=n===expected?`Breaker ${n} locks. The pattern is holding.`:"Wrong sequence. The generator screams and resets.";
  }
  if(action==="reroute-power"){if(state.props.breakerProgress.length===3){state.power=100;state.danger=clamp(state.danger-8);outcome="Power rerouted from containment to the escape network.";}else{state.danger=clamp(state.danger+10);outcome="The dead grid backfeeds. Complete the breaker sequence first.";}}
  if(action==="seal-warden"){if(state.inventory.includes("Binding sigil")&&state.evidence.length>=4){state.story.wardenBound=true;state.warden.contained=true;state.danger=10;outcome="The evidence names the victim. The sigil seals the Warden without sacrificing Mara.";}else{state.danger=clamp(state.danger+18);outcome="You cannot complete the seal without the truth and the sigil.";}}
  if(action==="open-roof"||action==="open-ambulance") finishEpisode(state,action==="open-roof"?"roof":"ambulance");
  state.player.lastAction=action; state.player.fear=clamp(state.player.fear+(state.danger>70?3:-1)); state.player.noise=clamp(state.player.noise-2); state.lastOutcome=outcome||action.replaceAll("-"," ");
  log(state,"action","STREAMER",state.lastOutcome); return state;
}
export function joinFaction(state,user,faction){ if(!["guardian","chaos"].includes(faction)) return false; state.members[String(user).toLowerCase()]=faction; log(state,"faction",user,`joined ${faction}`); return true; }
export function usePower(state,user,power){
  const faction=state.members[String(user).toLowerCase()]; if(!faction) return {accepted:false,reason:"Join a faction first"};
  if(state.cooldowns[faction]>Date.now()) return {accepted:false,reason:"Power cooling down"}; if(state.energy[faction]<25) return {accepted:false,reason:"Not enough faction energy"};
  state.energy[faction]-=25; state.cooldowns[faction]=Date.now()+20000;
  if(faction==="guardian"){state.health=clamp(state.health+12);state.danger=clamp(state.danger-8);} else {state.danger=clamp(state.danger+12);state.warden.visible=true;}
  log(state,"power",user,power||`${faction} surge`); return {accepted:true};
}
export function ingestCommand(state,user,message){
  const [cmd,arg]=String(message).trim().toLowerCase().split(/\s+/);
  if(cmd==="!join") return {state,accepted:joinFaction(state,user,arg),kind:"faction"}; if(cmd==="!power") return {state,...usePower(state,user,arg),kind:"power"};
  return {...castVote(state,user,message),kind:"vote"};
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
export function tick(state,now=Date.now()){ if(state.status==="voting"&&now>=state.roundEndsAt) resolveVote(state); return state; }
export function finishEpisode(state,choice="roof"){
  const strong=state.evidence.length>=3&&state.power>=50; const doomed=state.health<=0||state.danger>=95;
  state.ending=doomed?"THE WARD CLAIMS ANOTHER":choice==="contain"||state.winner?.id==="contain"?"THE LAST NIGHTSHIFT":strong?"DAWN BREAKS OVER WARD 06":choice==="ambulance"?"THE TUNNEL REMEMBERS":"ESCAPE, WITHOUT ANSWERS";
  state.status="ended"; state.warden.contained=strong&&!doomed; log(state,"ending","NIGHTSHIFT",state.ending); return state;
}
export function publicState(state){ const copy=structuredClone(state); if(copy.settings.hideNames) copy.recent=copy.recent.map(e=>({...e,actor:e.actor==="NIGHTSHIFT"||e.actor==="CHAT"?e.actor:"VIEWER"})); return copy; }
