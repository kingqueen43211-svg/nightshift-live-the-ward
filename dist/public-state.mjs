import { ROOMS } from "./engine.mjs";

const STATUS = new Set(["briefing", "voting", "consequence", "paused", "ended"]);
const MODE = /^(?:SIMULATED|REHEARSAL|LIVE TWITCH|TWITCH (?:AUTHORIZING|CONNECTING|RECONNECTING|AUTH EXPIRED|ERROR))$/;
const plainObject = value => value && typeof value === "object" && !Array.isArray(value);
const finiteIn = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const shortString = (value, max = 500) => typeof value === "string" && value.length <= max;
const stringList = (value, max = 128) => Array.isArray(value) && value.length <= max && value.every(item => shortString(item, 240));

export function isValidPublicState(incoming) {
  if (!plainObject(incoming)) return false;
  const room = ROOMS[incoming.roomIndex];
  if (!room) return false;

  const objectFields = ["settings", "votes", "campaign", "doors", "props", "player", "story", "warden", "energy", "rooms", "camera", "voters", "members"];
  if (!objectFields.every(key => plainObject(incoming[key]))) return false;
  if (!Number.isInteger(incoming.version) || incoming.version < 0) return false;
  if (!Number.isInteger(incoming.roomIndex) || incoming.roomIndex < 0 || incoming.roomIndex >= ROOMS.length) return false;
  if (!shortString(incoming.sessionId, 128) || !incoming.sessionId) return false;
  if (!STATUS.has(incoming.status) || !MODE.test(incoming.mode)) return false;
  if (![incoming.health, incoming.danger, incoming.power].every(value => finiteIn(value, 0, 100))) return false;
  if (!Number.isInteger(incoming.round) || incoming.round < 1 || !Number.isFinite(incoming.roundEndsAt)) return false;
  if (![incoming.guardians, incoming.chaos].every(value => finiteIn(value, 0, 10_000_000))) return false;
  if (!stringList(incoming.evidence) || !stringList(incoming.inventory)) return false;

  if (incoming.lastAudioCue !== null && incoming.lastAudioCue !== undefined) {
    if (!plainObject(incoming.lastAudioCue)) return false;
    if (!shortString(incoming.lastAudioCue.cue, 120) || !shortString(incoming.lastAudioCue.text, 500)) return false;
    if (!Number.isFinite(incoming.lastAudioCue.at)) return false;
  }

  if (!Array.isArray(incoming.recent) || incoming.recent.length > 18 || !incoming.recent.every(event =>
    plainObject(event) && shortString(event.type, 80) && shortString(event.actor, 120) && shortString(event.text, 500)
  )) return false;

  const voteEntries = Object.entries(incoming.votes);
  if (voteEntries.length > room.actions.length + 4 || !voteEntries.every(([id, count]) =>
    room && shortString(id, 80) && Number.isInteger(count) && finiteIn(count, 0, 10_000_000)
  )) return false;

  if (!Array.isArray(incoming.props.breakerProgress) || !Array.isArray(incoming.campaign.mechanics) || !Array.isArray(incoming.campaign.decisions)) return false;
  if (!plainObject(incoming.rooms[room.id]) || !Array.isArray(incoming.rooms[room.id].actions)) return false;
  if (!room.cameraNodes.includes(incoming.camera.nodeId)) return false;
  if (![incoming.energy.guardian, incoming.energy.chaos].every(value => finiteIn(value, 0, 100))) return false;

  // Public OBS messages must never contain private audience maps, EventSub IDs,
  // or the recursive checkpoint snapshot.
  if (Object.keys(incoming.voters).length || Object.keys(incoming.members).length) return false;
  if (!Array.isArray(incoming.seenEventIds) || incoming.seenEventIds.length) return false;
  if (incoming.campaign.checkpoint !== null) return false;
  return true;
}
