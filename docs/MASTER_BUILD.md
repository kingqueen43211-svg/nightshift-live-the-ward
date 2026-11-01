# Master Build Package

## One-line pitch

**NightShift Live: The Ward is a cinematic Twitch horror game show where viewers become the director—saving, sabotaging, and reshaping the stream in real time.**

## Product promise

The experience must be understood in five seconds, produce a memorable chat-controlled change within thirty seconds, and look like a broadcast product rather than a developer dashboard.

## Hackathon vertical slice

### Objective

The streamer must recover three ward circuits before health reaches zero or entity proximity reaches critical.

### Audience loop

1. The broadcast announces two opposing fates.
2. Each Twitch viewer has one active vote and may change it until the timer closes.
3. The winning choice changes scene lighting, threat level, progression, and broadcast graphics.
4. Channel events interrupt the loop with premium callouts.
5. Three restored circuits unlock the mercy ending; unchecked danger unlocks the audience ending.

### Guardian actions

- Restore power
- Open isolation
- Follow pulse
- Subscriber intervention

### Chaos actions

- Kill the lights
- Release Subject 06
- Bits detonation
- Raid surge

## Visual direction

- **World:** realistic abandoned hospital rendered as luxury horror—wet tile, volumetric haze, surgical cyan, intermittent emergency red.
- **Creature:** an original faceless surgical apparition made from torn clinical fabric, smoke, porcelain, and fragmented instruments.
- **UI:** broadcast instrumentation rather than fantasy ornament. Narrow mono labels, oversized timers, slim telemetry bars, high-contrast outcome cards.
- **Palette:** near-black `#050809`, surgical cyan `#6cf6df`, guardian acid `#b8ff62`, emergency red `#ff3e46`.
- **Motion:** deliberate parallax and fog during calm; hard cuts, alarm flashes, and brief camera impact on Chaos outcomes.

## Animation beats

1. **Signal acquisition:** HUD fades up over the ward; the live indicator pulses.
2. **Vote open:** the vote module lifts into frame, timer activates, and percentage fills respond continuously.
3. **Vote lock:** the winner holds while the losing choice visually recedes.
4. **Consequence:** Guardian wins cool the scene and lower danger; Chaos wins black out the corridor and reveal the entity.
5. **Channel event:** a centered broadcast sting names the event and its world effect.
6. **Ending:** the transmission hard-cuts to a full-frame title and replay action.

## Screen definitions

### Live experience

Full-bleed ward gameplay, objective, vitals, entity proximity, vote module, faction balance, and broadcast event stings.

### Control room

Twitch connection, live status, start control, deterministic event triggers, activity stream, and safety/motion toggles.

### OBS overlay

Transparent presentation of the current vote, timer, factions, and latest audience event. Designed for a 1920×1080 Browser Source.

## Current completion boundary

Completed now: the working broadcast loop, original art, real Twitch EventSub path, demo mode, cross-tab overlay, UI animation, responsive layout, tests, documentation, and submission copy.

Intentionally deferred: free-roaming 3D navigation, positional audio, persistent streamer accounts, cloud show-state sync, AI narration, multiple maps, and monetized Extension actions. These are post-deadline expansion items and should not distract from the judged vertical slice.

## Next sprint after submission

1. Replace the static world with a React Three Fiber ward using the same engine contract.
2. Add Web Audio stems and ducking around Twitch stings.
3. Add OpenAI-generated safe announcer copy with deterministic fallbacks.
4. Add a server-authoritative multi-device room and replay timeline.
5. Package five additional streamer themes using the same overlay system.
