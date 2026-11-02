function normalizedOptions(options = []) {
  if (!Array.isArray(options)) return [];
  return options
    .filter(option => option && typeof option.command === "string" && option.command.startsWith("!"))
    .map(option => ({ id: option.id, label: option.label, command: option.command }));
}

export function viewerVotePrompt({ mode = "LIVE TWITCH", status = "briefing", options = [], recommendedId = null } = {}) {
  const currentOptions = normalizedOptions(options);
  const recommended = currentOptions.find(option => option.id === recommendedId) || currentOptions[0] || null;
  const alternatives = currentOptions.filter(option => option !== recommended);
  const commands = currentOptions.map(option => option.command);
  const alternativeText = alternatives.length
    ? `ALSO ACCEPTS: ${alternatives.map(option => option.command).join(" · ")}`
    : "";

  if (status === "paused") {
    return {
      state: "paused",
      headline: "VOTING PAUSED — COMMANDS WILL NOT COUNT",
      detail: recommended
        ? `WHEN VOTING RESUMES: TYPE ${recommended.command}${alternativeText ? ` · ${alternativeText}` : ""}`
        : "WAIT FOR THE STREAMER TO RESUME VOTING",
      recommendedCommand: recommended?.command || "",
      commands
    };
  }

  if (status === "voting") {
    if (String(mode).startsWith("TWITCH ") && mode !== "LIVE TWITCH") {
      return {
        state: "paused",
        headline: "TWITCH INPUT PAUSED — COMMANDS WILL NOT COUNT",
        detail: recommended
          ? `WHEN RECONNECTED: TYPE ${recommended.command}${alternativeText ? ` · ${alternativeText}` : ""}`
          : "WAIT FOR TWITCH TO RECONNECT",
        recommendedCommand: recommended?.command || "",
        commands
      };
    }
    const rehearsal = mode === "SIMULATED" || mode === "REHEARSAL";
    return {
      state: "open",
      headline: recommended
        ? rehearsal
          ? `REHEARSAL: ENTER ${recommended.command} IN CHAT SIMULATOR`
          : `VIEWERS: TYPE ${recommended.command} IN TWITCH CHAT`
        : "VIEWERS: VOTING IS OPEN",
      detail: `${rehearsal ? "TEST INPUT ONLY" : "PRESS SEND"}${alternativeText ? ` · ${alternativeText}` : ""}`,
      recommendedCommand: recommended?.command || "",
      commands
    };
  }

  const commandText = commands.length ? `CURRENT ROUND COMMANDS (CLOSED): ${commands.join(" · ")}` : "WAIT FOR THE NEXT ROUND";
  return {
    state: "closed",
    headline: status === "consequence" ? "VOTING CLOSED — RESULT LOCKED" : "VOTING NOT OPEN YET",
    detail: commandText,
    recommendedCommand: recommended?.command || "",
    commands
  };
}

export function commandToken(message = "") {
  const [command = "", argument = ""] = String(message).trim().toLowerCase().split(/\s+/);
  if (!command.startsWith("!")) return "";
  return ["!join", "!power"].includes(command) && argument ? `${command} ${argument}` : command;
}

export function isNightShiftCommand(message = "") {
  return Boolean(commandToken(message));
}

export function liveChatFeedback({ viewer = "VIEWER", message = "", result = {}, now = Date.now() } = {}) {
  const actor = String(viewer || "VIEWER").trim() || "VIEWER";
  const command = commandToken(message) || "CHAT COMMAND";
  const accepted = Boolean(result.accepted);
  const isVote = result.kind === "vote";
  const noun = isVote ? "VOTE" : "COMMAND";
  const label = result.option?.label ? ` · ${result.option.label}` : "";
  const reason = result.reason || "Command was not accepted";
  const text = accepted
    ? `${command} ${isVote ? "counted" : "accepted"}${label}`
    : `${command} not counted · ${reason}`;

  return {
    accepted,
    title: `TWITCH ${noun} ${accepted ? "ACCEPTED" : "REJECTED"}`,
    detail: `${actor}: ${text}`,
    event: {
      type: accepted ? "chat-accepted" : "chat-rejected",
      actor,
      text,
      at: now
    }
  };
}

export function appendLiveChatFeedback(state, feedback, limit = 18) {
  if (!state || !feedback?.event) return state;
  state.recent = [feedback.event, ...(Array.isArray(state.recent) ? state.recent : [])].slice(0, limit);
  return state;
}
