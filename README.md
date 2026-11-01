# NightShift Live: The Ward

NightShift Live turns a Twitch horror stream into a live game show. Viewers vote in chat, split into Guardians and Chaos Crew, and change a cinematic hospital survival sequence in real time.

## What is working

- A complete 3-screen web experience: playable broadcast view, streamer control room, and transparent OBS overlay preview.
- Deterministic audience voting with one active vote per viewer and command aliases.
- Twitch OAuth and EventSub WebSocket support for `channel.chat.message`, follows, subscriptions, cheers, and raids.
- A persistent five-room episode with evidence, inventory, door and power state, a breaker puzzle, physical consequences, and multiple outcome-dependent endings.
- A UI-only 2.5D scene composer with ten independent depth/effect planes and original room plates; no 3D meshes or engine runtime.
- Demo autopilot and manual event triggers for a reliable no-credentials judging path.
- Cross-tab state transport with `BroadcastChannel` for separate game and overlay browser sources.
- Original generated cinematic environment and creature art.
- Automated game-engine tests.

## Run in 30 seconds

Requires Node.js 20+.

```bash
npm start
```

Open `http://localhost:4173`, choose **Control room**, then **Start episode**. No Twitch account is required for the clearly labeled simulation path.

The preview server uses only Node.js built-ins, so startup does not download a package. Use `npm start -- --port 5000` when port 4173 is unavailable.

Run verification:

```bash
npm run check
npm run qa:visual
npm run release:audit
```

Before sharing the entry, follow the logged-out hosting, OAuth callback, OBS alpha, and rollback steps in [`docs/PUBLIC_DEPLOYMENT.md`](docs/PUBLIC_DEPLOYMENT.md).

## Connect a real Twitch channel

1. Create an application in the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Add the exact URL where this app is running as an OAuth redirect URL. For local use: `http://localhost:4173/`.
3. Open **Control room**, paste the Client ID, and choose **Connect Twitch**.
4. Approve the requested read-only scopes. The app subscribes through Twitch EventSub over WebSocket.
5. Start the live sequence. Viewers vote with the commands shown on screen, such as `!restore` and `!dark`.

The OAuth token is stored only in that browser's local storage. It is never committed to source. Use **Clear** to remove it. Real Twitch end-to-end behavior is implemented but remains **unverified** until tested with a broadcaster credential and a second viewer account.

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
  engine.mjs        Persistent episode, voting, factions, puzzles, and endings
  twitch.mjs        OAuth, Helix, and EventSub WebSocket bridge
  assets/           Original generated visual assets
tests/
  engine.test.mjs   Vote and consequence tests
docs/
  ARCHITECTURE.md   Technical design and event flow
  MASTER_BUILD.md   Product, visual, animation, and scope spec
  SUBMISSION.md     Devpost-ready copy and checklist
  DEMO_SCRIPT.md    Under-three-minute video plan
  STATUS.md         Truthful implemented/simulated/unverified matrix
audit/
  AS_IS_AUDIT.md    V1 audit and V2 disposition
```

## Built with Codex

Codex was the primary build partner for product scoping, the visual system, original asset generation, the voting engine, Twitch integration, UI implementation, tests, and the submission package. This chat's session ID should be supplied in the Devpost form.

## Production hardening after the hackathon

The static prototype intentionally uses Twitch's implicit OAuth flow for the fastest reliable demo. A production multi-streamer service should move OAuth to an authorization-code flow with a small backend, use encrypted server-side refresh-token storage, add signed session identities, centralize cross-device show state, and apply per-channel moderation/rate controls.

## License

Project code and original assets are supplied for the hackathon project. Twitch is a trademark of Twitch Interactive, Inc.; this project is not endorsed by Twitch.
