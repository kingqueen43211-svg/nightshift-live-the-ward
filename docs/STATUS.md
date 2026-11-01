# NightShift Live V2 status

## Implementation matrix

| Capability | Status | Evidence |
|---|---|---|
| Five-room persistent episode | IMPLEMENTED | Reception, Ward 06, theatre, generator, and exits retain health, danger, power, evidence, and inventory. |
| Cinematic UI-only 2.5D renderer | IMPLEMENTED | Ten independent visual planes with depth-scaled pointer parallax, fog, lighting, occlusion, rain, props, creature, and HUD. No 3D mesh renderer. |
| Physical audience consequences | IMPLEMENTED | Votes change doors, lights, props, creature visibility, breakers, exit power, health, evidence, and endings. |
| Unique deterministic voting | IMPLEMENTED | One accepted vote per normalized viewer per round; ordered tie resolution. |
| Guardian / Chaos factions | IMPLEMENTED | Join state, energy economy, cooldowns, and powers in the pure engine. |
| Streamer console | IMPLEMENTED | Start, pause, resume, stop, room advance, chat rehearsal, event rehearsal, signal status. |
| OBS browser view | IMPLEMENTED | `?view=overlay` plus cross-tab `BroadcastChannel` state. |
| Accessibility | IMPLEMENTED | Reduced motion, low effects, high contrast, hidden viewer names, optional jumpscares, live-region announcements. |
| Twitch EventSub WebSocket | IMPLEMENTED / UNVERIFIED LIVE | OAuth, identity validation, EventSub chat/follow/sub/cheer/raid subscriptions, reconnect, and routing exist. A real broadcaster credential and second viewer are required for final live verification. |
| Simulation | IMPLEMENTED | Always labeled `MODE: SIMULATED`; it uses the same engine entry points as normalized live events. |
| Automated engine coverage | IMPLEMENTED | Ten tests cover votes, ties, timers, persistence, puzzle order, cooldowns, dedupe, endings, and privacy. |
| Multi-streamer hosted backend | PLANNED | Hackathon build remains single-browser authoritative. Production should use server-side auth, encrypted refresh tokens, and centralized show state. |

## Verification performed

- `npm run check`: syntax checks and 10/10 engine tests pass.
- Local HTTP preview: all HTML, CSS, modules, and current room assets returned HTTP 200.
- Browser QA: gameplay and streamer control room visually inspected at 1280×720; episode start and voting timer verified.
- Live Twitch end-to-end: not claimed. Requires user-owned credentials and a second Twitch account.
