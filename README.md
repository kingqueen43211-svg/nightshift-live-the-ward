# NightShift Live: The Ward

NightShift Live turns a Twitch horror stream into a live game show. Viewers vote in chat, split into Guardians and Chaos Crew, and change a cinematic hospital survival sequence in real time.

## What is working

- A complete 3-screen web experience: playable broadcast view, streamer control room, and transparent OBS overlay preview.
- Deterministic audience voting with one active vote per viewer and command aliases.
- Twitch OAuth and EventSub WebSocket support for `channel.chat.message`, follows, subscriptions, cheers, and raids.
- Gameplay consequences: power restoration, route progression, blackouts, danger, health, clues, monster proximity, alternate ending logic.
- Demo autopilot and manual event triggers for a reliable no-credentials judging path.
- Cross-tab state transport with `BroadcastChannel` for separate game and overlay browser sources.
- Original generated cinematic environment and creature art.
- Automated game-engine tests.

## Run in 30 seconds

Requires Node.js 20+.

```bash
npm start
```

Open `http://localhost:4173`. The demo starts automatically—no Twitch account is required.

Run verification:

```bash
npm run check
```

## Connect a real Twitch channel

1. Create an application in the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Add the exact URL where this app is running as an OAuth redirect URL. For local use: `http://localhost:4173/`.
3. Open **Control room**, paste the Client ID, and choose **Connect Twitch**.
4. Approve the requested read-only scopes. The app subscribes through Twitch EventSub over WebSocket.
5. Start the live sequence. Viewers vote with the commands shown on screen, such as `!restore` and `!dark`.

The OAuth token is stored only in that browser's local storage. It is never committed to source. Use **Clear session** to remove it.

## OBS setup

Add two Browser Sources:

- Main experience: `http://localhost:4173/`
- Transparent overlay: `http://localhost:4173/?view=overlay`

Use 1920×1080 for both. The app shares state between tabs via `BroadcastChannel`.

## Repository map

```text
dist/
  index.html        Product UI and all three screens
  styles.css        Cinematic visual system and responsive layout
  app.mjs           UI, show loop, Twitch event routing, demo mode
  engine.mjs        Pure voting and consequence engine
  twitch.mjs        OAuth, Helix, and EventSub WebSocket bridge
  assets/           Original generated visual assets
tests/
  engine.test.mjs   Vote and consequence tests
docs/
  ARCHITECTURE.md   Technical design and event flow
  MASTER_BUILD.md   Product, visual, animation, and scope spec
  SUBMISSION.md     Devpost-ready copy and checklist
  DEMO_SCRIPT.md    Under-three-minute video plan
```

## Built with Codex

Codex was the primary build partner for product scoping, the visual system, original asset generation, the voting engine, Twitch integration, UI implementation, tests, and the submission package. This chat's session ID should be supplied in the Devpost form.

## Production hardening after the hackathon

The static prototype intentionally uses Twitch's implicit OAuth flow for the fastest reliable demo. A production multi-streamer service should move OAuth to an authorization-code flow with a small backend, use encrypted server-side refresh-token storage, add signed session identities, centralize cross-device show state, and apply per-channel moderation/rate controls.

## License

Project code and original assets are supplied for the hackathon project. Twitch is a trademark of Twitch Interactive, Inc.; this project is not endorsed by Twitch.
