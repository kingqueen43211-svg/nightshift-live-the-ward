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
                         BroadcastChannel state
                                  ↓
                            OBS overlay tab
```

## Modules

- `engine.mjs`: pure state transitions. It owns five persistent rooms, one-vote-per-user semantics, option resolution, factions, health/danger/power, inventory, evidence, the generator puzzle, endings, and channel-event deduplication.
- `twitch.mjs`: Twitch identity validation, EventSub socket lifecycle, subscription creation, reconnect handling, and event normalization.
- `app.mjs`: DOM rendering, screen routing, show timing, demo autopilot, manual production triggers, visual feedback, and cross-tab state.

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
- The overlay does not require a second server connection.
- The browser-source route is query-string addressable.
- No client secret is used or committed.

## Security and production path

This hackathon build stores a user token locally and asks only for read scopes needed by its subscriptions. For production, use authorization code + PKCE or a confidential backend, token rotation, encrypted refresh storage, CSRF state verification, server-authoritative sessions, event deduplication by message ID, and observability for revoked subscriptions.
