const TWITCH_MODES = Object.freeze({
  AUTHORIZING: "TWITCH AUTHORIZING",
  CONNECTING: "TWITCH CONNECTING",
  RECONNECTING: "TWITCH RECONNECTING",
  AUTH_EXPIRED: "TWITCH AUTH EXPIRED",
  ERROR: "TWITCH ERROR"
});

export function modeForTwitchStatus(detail = {}, currentMode = "SIMULATED") {
  if (detail.connected || detail.phase === "LIVE_TWITCH") return "LIVE TWITCH";
  if (detail.phase === "DISCONNECTED") return "SIMULATED";
  return TWITCH_MODES[detail.phase] || currentMode;
}

export function simulatedAudienceEnabled(mode) {
  return mode === "SIMULATED";
}

export function twitchInputPaused(mode) {
  return String(mode).startsWith("TWITCH ") && mode !== "LIVE TWITCH";
}

export function voteSourceText({ mode, status, resolutionSource }) {
  const rehearsal = mode === "SIMULATED" || mode === "REHEARSAL";
  if (status === "paused") return "VOTING PAUSED — COMMANDS WILL NOT COUNT";
  if (resolutionSource === "ZERO_CHAT_FALLBACK") return "DIRECTOR FALLBACK · NO CHAT VOTES";
  if (resolutionSource === "AUDIENCE") return rehearsal ? "REHEARSAL RESULT · SIMULATED INPUT" : "AUDIENCE RESULT APPLIED";
  if (twitchInputPaused(mode)) return "TWITCH INPUT PAUSED · WAITING FOR SIGNAL";
  if (status !== "voting") return "VOTE CLOSED";
  if (mode === "LIVE TWITCH") return "LIVE TWITCH CHAT VOTE OPEN";
  return "REHEARSAL VOTE · SIMULATED INPUT";
}
