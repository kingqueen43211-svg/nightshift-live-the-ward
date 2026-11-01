# Architecture

## Deadline-first system

NightShift uses a static web architecture so judges can open it immediately, the OBS overlay can run as a browser source, and the real Twitch path does not require deploying a custom backend.

```text
Twitch OAuth → User access token → EventSub WebSocket
                                  ↓
                         TwitchBridge normalizes
                                  ↓
Chat message → vote parser → deterministic show engine → gameplay UI
Follow/sub/cheer/raid → event mapper ────────────────→ consequence UI
                                  ↓
                    privacy-safe public state DTO
                           ↙              ↘
          BroadcastChannel (same profile)  local SSE relay (cross-process)
                           ↘              ↙
                              OBS overlay
```

## Modules

- `engine.mjs`: pure state transitions. It owns five persistent rooms, one-vote-per-user semantics, option resolution, factions, health/danger/power, inventory, evidence, the generator puzzle, endings, and channel-event deduplication.
- `twitch.mjs`: Twitch identity validation, EventSub socket lifecycle, subscription creation, reconnect handling, and event normalization.
- `public-state.mjs`: strict bounds, nested-shape, authored-camera, and privacy validation for any state entering the OBS view.
- `runtime-mode.mjs`: Twitch/rehearsal mode policy, simulated-input gating, reconnect clock behavior, and truthful vote labels.
- `app.mjs`: DOM rendering, screen routing, show timing, demo autopilot, manual production triggers, visual feedback, and same-profile/cross-process state transport.

## Twitch event mapping

| Twitch signal | NightShift result |
|---|---|
| `channel.chat.message` | Parses a vote, faction join, or faction-power command; one vote per viewer per round |
| `channel.follow` | Small Guardian recovery pulse |
| `channel.subscribe` | Stronger recovery moment and broadcast callout |
| `channel.cheer` | Bits detonation; danger spike and entity reveal |
| `channel.raid` | Raid surge; major entity breach moment |

The bridge uses Twitch's official `wss://eventsub.wss.twitch.tv/ws` transport and creates subscriptions after receiving `session_welcome`.

## Reliability choices

- The game engine is independent of Twitch and covered by tests.
- Demo mode exercises the exact same vote path as real chat.
- Manual event controls exercise the exact same event mapper as Twitch notifications.
- Same-profile tabs use `BroadcastChannel` with a single-controller lease and a passive overlay.
- Real OBS and Chrome can be different browser processes, so `npm start` includes an opt-in loopback-only SSE state relay at `?relay=local`. It accepts same-origin JSON only, caps payload size, and sends the already-sanitized public state. OBS uses `role=mirror`, which is inert, never ticks the engine, and cannot acquire the publisher lease.
- Per-viewer vote maps, faction membership, EventSub IDs, and recursive checkpoints never enter the overlay transport. Hide-names mode also redacts visible actors.
- The browser-source route is query-string addressable.
- No client secret is used or committed.

## Security and production path

This hackathon build stores a user token locally and asks only for read scopes needed by its subscriptions. For production, use authorization code + PKCE or a confidential backend, token rotation, encrypted refresh storage, CSRF state verification, server-authoritative sessions, event deduplication by message ID, and observability for revoked subscriptions.
