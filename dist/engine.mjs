export const OPTIONS = [
  { id: "restore", label: "Restore power", command: "!restore", faction: "guardian", effect: "Lights stabilize. Danger falls." },
  { id: "open", label: "Open isolation", command: "!open", faction: "guardian", effect: "A sealed route unlocks." },
  { id: "dark", label: "Kill the lights", command: "!dark", faction: "chaos", effect: "The ward goes black." },
  { id: "release", label: "Release Subject 06", command: "!release", faction: "chaos", effect: "Something enters the corridor." }
];

export function createState(now = Date.now()) {
  return {
    phase: "briefing",
    round: 1,
    roundEndsAt: now + 32000,
    danger: 34,
    health: 100,
    clues: 0,
    guardians: 51,
    chaos: 49,
    votes: Object.fromEntries(OPTIONS.map((o) => [o.id, 0])),
    voters: {},
    activeOptions: ["restore", "dark"],
    recent: [],
    consequence: null,
    monster: 0,
    escaped: false,
    sessionStartedAt: now
  };
}

export function normalizeCommand(message = "") {
  const value = message.trim().toLowerCase().split(/\s+/)[0];
  const aliases = { "!1": "!restore", "!2": "!dark", "!left": "!restore", "!right": "!dark", "!help": "!restore", "!curse": "!dark" };
  return aliases[value] || value;
}

export function castVote(state, viewer, message) {
  if (state.phase !== "voting") return { state, accepted: false, reason: "Voting is closed" };
  const command = normalizeCommand(message);
  const option = OPTIONS.find((item) => item.command === command && state.activeOptions.includes(item.id));
  if (!option) return { state, accepted: false, reason: "Unknown vote" };
  const voter = String(viewer || "anonymous").toLowerCase();
  const previous = state.voters[voter];
  const votes = { ...state.votes };
  if (previous) votes[previous] = Math.max(0, votes[previous] - 1);
  votes[option.id] += 1;
  return {
    accepted: true,
    option,
    state: {
      ...state,
      votes,
      voters: { ...state.voters, [voter]: option.id },
      recent: [{ type: "vote", actor: viewer, text: `${option.label}` }, ...state.recent].slice(0, 6)
    }
  };
}

export function startRound(state, now = Date.now()) {
  const pairs = state.round % 3 === 1 ? ["restore", "dark"] : state.round % 3 === 2 ? ["open", "release"] : ["restore", "release"];
  return {
    ...state,
    phase: "voting",
    activeOptions: pairs,
    roundEndsAt: now + 26000,
    votes: Object.fromEntries(OPTIONS.map((o) => [o.id, 0])),
    voters: {},
    consequence: null
  };
}

export function resolveRound(state, now = Date.now()) {
  const ranked = state.activeOptions
    .map((id) => ({ id, count: state.votes[id] }))
    .sort((a, b) => b.count - a.count || state.activeOptions.indexOf(a.id) - state.activeOptions.indexOf(b.id));
  const winner = OPTIONS.find((option) => option.id === ranked[0].id);
  const isChaos = winner.faction === "chaos";
  const danger = Math.max(0, Math.min(100, state.danger + (isChaos ? 19 : -13)));
  const health = Math.max(0, state.health - (isChaos ? 8 : 0));
  const clues = state.clues + (winner.id === "open" || winner.id === "restore" ? 1 : 0);
  const chaos = Math.max(0, Math.min(100, state.chaos + (isChaos ? 4 : -4)));
  return {
    ...state,
    phase: "consequence",
    roundEndsAt: now + 9000,
    danger,
    health,
    clues,
    guardians: 100 - chaos,
    chaos,
    monster: isChaos ? Math.min(1, state.monster + 0.42) : Math.max(0, state.monster - 0.2),
    consequence: { ...winner, votes: ranked[0].count },
    recent: [{ type: isChaos ? "curse" : "blessing", actor: "THE AUDIENCE", text: winner.effect }, ...state.recent].slice(0, 6)
  };
}

export function nextRound(state, now = Date.now()) {
  if (state.health <= 0 || state.danger >= 100) return { ...state, phase: "ending", escaped: false };
  if (state.clues >= 3) return { ...state, phase: "ending", escaped: true };
  return startRound({ ...state, round: state.round + 1 }, now);
}

export function applyEvent(state, event) {
  const type = event.type;
  const isAid = type === "follow" || type === "subscribe";
  const text = type === "raid" ? `RAID SURGE · ${event.viewers || 1} SOULS` : type === "cheer" ? `BITS DETONATION · ${event.bits || 1}` : type === "subscribe" ? "SUBSCRIBER INTERVENTION" : "NEW WATCHER DETECTED";
  return {
    ...state,
    health: Math.min(100, state.health + (isAid ? 7 : 0)),
    danger: Math.max(0, Math.min(100, state.danger + (type === "cheer" || type === "raid" ? 12 : -4))),
    monster: Math.max(0, Math.min(1, state.monster + (type === "raid" ? 0.5 : type === "cheer" ? 0.25 : -0.08))),
    recent: [{ type, actor: event.actor || "TWITCH", text }, ...state.recent].slice(0, 6)
  };
}
