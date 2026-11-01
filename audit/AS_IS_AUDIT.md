# As-is audit and V2 disposition

The recovered V1 was a polished single-room prototype. It had a strong cinematic corridor, a dashboard, an OBS route, a Twitch EventSub bridge, and a small deterministic vote engine. Its main gap was depth: progression, inventory, factions, puzzle state, multi-room story persistence, and meaningfully different endings were represented only as a short repeated loop.

## Preserved

- Cinematic hospital art direction and glass broadcast HUD.
- Three-screen product structure: gameplay, control room, overlay.
- EventSub WebSocket transport and Twitch normalization intent.
- Deterministic, testable pure-state engine pattern.
- Original corridor and Surgeon visual assets.

## Rebuilt for V2

- The engine now owns a five-room episode, persistent evidence and inventory, door and power state, a 2-1-3 breaker puzzle, faction membership/energy/cooldowns, event idempotency, and five outcome texts.
- The gameplay scene now composes ten independently moving or reacting layers and swaps original room plates through an occluded transition.
- Votes and actions create physical world changes rather than only changing meters.
- Simulation is visibly labeled and no live verification is implied.
- Accessibility and privacy settings are part of the operator console.

## Remaining production work

- Move OAuth to an authorization-code/PKCE or confidential server flow with encrypted token storage.
- Persist show state outside a single browser for multi-device recovery.
- Run a real broadcaster plus second-viewer EventSub rehearsal and capture evidence.
- Add moderation policies, telemetry, and load tests for larger channels.
