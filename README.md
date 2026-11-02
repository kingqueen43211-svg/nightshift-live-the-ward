# NightShift Live: The Ward

NightShift Live turns a Twitch horror stream into a live game show. Viewers vote in chat, split into Guardians and Chaos Crew, and change a cinematic hospital survival sequence in real time.

**Public demo:** [Launch NightShift Live: The Ward](https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/)

## What is working

- A complete 3-screen web experience: playable broadcast view, streamer control room, and transparent OBS overlay preview.
- Deterministic audience voting with one active vote per viewer and command aliases.
- Twitch OAuth and EventSub WebSocket support for `channel.chat.message`, follows, subscriptions, cheers, and raids.
- A persistent five-act episode with evidence, usable/craftable inventory, checkpoints, authored prerequisites, door and power state, a breaker puzzle, director-safe fallbacks, and materially different endings with recaps.
- A persistent in-game next-step panel that explains the missing authored beat, audience-resolution state, consequence, transition, and final physical route choice without sending a first-time player to the control room.
- Exact, persistent inventory-effect feedback with no-op protection, so an item reports the health, fear, danger, shield, or Warden change and is retained when it cannot help.
- Three playable camera nodes in every act, with spatial multi-depth travel, deterministic settle, reduced-motion equivalents, target cues, and persistent visited-node state.
- A UI-only 2.5D scene compositor with independent depth, fog, lighting, reflection, occlusion, rain, physical-door, foreground-prop, Warden, and HUD layers; no 3D meshes or engine runtime.
- Staged physical beats for the isolation door, curtain, clues, in-world breaker levers, and the Warden's visible repel/retreat reaction.
- Node-specific records, locker, restraint, service-grid, theatre, and final-route reveals; the theatre and finale now carry authored lamp, tape, containment, roof, and tunnel choreography rather than relying on a shared background alone.
- Route- and cause-specific ending presentation with a decision trace, distinct visual tone, and an ending-specific musical resolution.
- Original phase-specific Warden, gurney, curtain, and isolation-door art with archived lossless sources and optimized public derivatives.
- Gesture-gated, action-specific procedural sound; separate effects, ambience, adaptive-score, and master buses; master compression; directional panning; reduced-effects variants; and exact visual captions.
- Sanitized sound captions transported to the gameplay and passive OBS surfaces while only the authoritative controller produces audio, preventing doubled capture.
- A user-controlled compact cinematic HUD, exact item-effect chips, and idle pacing hints that keep the authored next step visible without inventing a measured duration.
- A recorder-assisted five-minute rehearsal workflow that requires Chrome's real share-tab/audio picker and produces a manifest instead of fabricating proof when video, tab audio, clean source, captions, or the earned zero-fallback ending is missing.
- Clearly labeled simulated audience voting and manual event triggers for a reliable no-credentials judging path.
- Cross-tab state transport with `BroadcastChannel` for separate game and overlay browser sources.
- Responsive safety/accessibility controls, modal focus handling, semantic state, pause shortcuts, reduced motion/flashes, stable keyboard focus, and 200% zoom reflow.
- Automated engine, Twitch lifecycle, accessibility, audio, visual, and full-browser campaign gates.

## Release captures

| Warden threat beat | Persistent ending recap |
| --- | --- |
| ![The Warden approaches the isolation door while streamer actions and simulated rehearsal votes remain clearly separated.](docs/evidence/v3-warden-1280x720.png) | ![Earned humane ending recap showing the roof route, six evidence items, decoded truth, bound Warden, five audience resolutions, and zero fallbacks.](docs/evidence/v3-ending-recap-1280x720.png) |
| Full gameplay hierarchy | Streamer control room |
| ![NightShift gameplay with mission, camera nodes, streamer-only actions, audience voting, and case file.](docs/evidence/v3-gameplay-1280x720.png) | ![NightShift streamer control room with signal, rehearsal, activity, accessibility, and show controls.](docs/evidence/v3-dashboard-1280x720.png) |

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
npm run qa:gameplay
npm run qa:integrity
npm run qa:relay
npm run qa:accessibility
npm run qa:performance
npm run release:audit
```

The final RC6 all-in-one composite passed end to end: 90/90 unit and contract tests, 29/29 visual states including compact HUD, 9/9 browser gameplay gates, 5/5 integrity gates, 17/17 independent-process relay gates, 11/11 accessibility/reflow gates, 10/10 performance gates, and the release-audit stage. The final performance run finished with a −223 DOM-node delta, zero listener growth, and a 0.203 MiB post-GC heap delta. The audited deployable payload is 12.0 MiB across 24 files.

RC6 is deployed at the [public production Site](https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/) and has passed fresh anonymous HTTP plus production-browser probes. The live `app.mjs`, `engine.mjs`, `public-state.mjs`, `styles.css`, and humane-ending WebP byte-match the reviewed RC6 payload; the browser smoke entered gameplay, resolved Reception, and reached the Ward 06 prerequisite checklist with no console warnings or errors. The Chrome share-tab/audio capture workflow is implemented and contract-validated, but no completed five-minute audiovisual proof is claimed until an operator performs the real picker run and its manifest passes. Real Twitch, native OBS, five unfamiliar humans, NVDA, audible listening, public repository/video, and Devpost remain external gates.

Before sharing the entry, follow the logged-out hosting, OAuth callback, OBS alpha, and rollback steps in [`docs/PUBLIC_DEPLOYMENT.md`](docs/PUBLIC_DEPLOYMENT.md).

The finalist contract remains in [`docs/RC5_JUDGE_FIX_CONTRACT.md`](docs/RC5_JUDGE_FIX_CONTRACT.md); RC6's ten exact concept-reference reconciliations and current acceptance targets are tracked in [`docs/RC6_VISUAL_REFERENCE_MATRIX.md`](docs/RC6_VISUAL_REFERENCE_MATRIX.md).

RC5 screenshots and the still-empty capture-proof boundary remain indexed in [`docs/evidence/RC5_EVIDENCE.md`](docs/evidence/RC5_EVIDENCE.md). Fresh RC6 machine-readable reports are produced by `npm run verify` in the workspace evidence directories and must be preserved with the promoted commit.

## Connect a real Twitch channel

1. Create an application in the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Add the exact URL where this app is running as an OAuth redirect URL. For local use: `http://localhost:4173/`.
3. Open **Control room**, paste the Client ID, and choose **Connect Twitch**.
4. Approve the requested read-only scopes. The app subscribes through Twitch EventSub over WebSocket.
5. Start the live sequence. Viewers vote with the commands shown on screen, such as `!restore` and `!dark`.

The OAuth token is stored only in that browser's local storage. It is never committed to source. Use **Clear** to remove it. Real Twitch end-to-end behavior is implemented but remains **unverified** until tested with a broadcaster credential and a second viewer account.

## OBS setup

For a real cross-process OBS run, start the included local server. Keep the authoritative control/game tab in Chrome, then use passive Browser Sources in OBS:

- Chrome controller: `http://localhost:4173/?relay=local`
- Full gameplay mirror in OBS: `http://localhost:4173/?role=mirror&relay=local`
- Transparent compact overlay in OBS: `http://localhost:4173/?view=overlay&role=mirror&relay=local`

Use 1920×1080 for the full view and the resolution of your OBS canvas for the compact overlay. The explicit `relay=local` path uses the loopback-only server's same-origin SSE relay, so OBS and Chrome receive the same sanitized state even though they are different browser processes. `role=mirror` makes the OBS copy non-interactive and prevents it from becoming a competing show controller. Without the relay flag, same-profile tabs use `BroadcastChannel` only.

## Repository map

```text
dist/
  index.html        Product UI and all three screens
  styles.css        Cinematic visual system and responsive layout
  app.mjs           UI, show loop, campaign controls, audio hooks, demo mode
  audio.mjs         Gesture-gated procedural audio and visual captions
  engine.mjs        Persistent episode, voting, factions, puzzles, and endings
  public-state.mjs  Strict validation for privacy-safe OBS transport
  runtime-mode.mjs  Truthful Twitch/rehearsal input-mode policy
  twitch.mjs        OAuth, Helix, and EventSub WebSocket bridge
  assets/           Optimized public visual assets
art-source/         Lossless source art excluded from static deployment
tests/
  *.test.mjs        Engine, campaign, Twitch, relay, audio, and accessibility tests
docs/
  ARCHITECTURE.md   Technical design and event flow
  QUALITY_TRACKER.md Evidence-backed RC6 gate status
  RC4_JUDGE_FIX_CONTRACT.md Judge finding → behavior → proof mapping
  RC5_JUDGE_FIX_CONTRACT.md Finalist-quality audiovisual/visual/capture contract
  RC6_VISUAL_REFERENCE_MATRIX.md Ten exact concept frames → implementation and acceptance
  evidence/RC4_EVIDENCE.md Final screenshots and browser reports
  evidence/RC5_EVIDENCE.md RC5 suite artifacts and pending capture boundary
  SUBMISSION.md     Devpost-ready copy and checklist
  DEMO_SCRIPT.md    Under-three-minute video plan
  STATUS.md         Truthful implemented/simulated/unverified matrix
  ASSET_PROVENANCE.md Original V3 art manifest and integration notes
audit/
  AS_IS_AUDIT.md    V1 audit and V2 disposition
```

## Built with Codex

Codex was the primary build partner for product scoping, the visual system, original asset generation, the voting engine, Twitch integration, UI implementation, tests, and the submission package. Primary build session ID: `01a1976e-d289-7a22-9e87-7aefa57d3379`.

## Production hardening after the hackathon

The static prototype intentionally uses Twitch's implicit OAuth flow for the fastest reliable demo. A production multi-streamer service should move OAuth to an authorization-code flow with a small backend, use encrypted server-side refresh-token storage, add signed session identities, centralize cross-device show state, and apply per-channel moderation/rate controls.

## License

Project code and original assets are supplied for the hackathon project. Asset generation and derivative policy are recorded in `docs/ASSET_PROVENANCE.md`. Twitch is a trademark of Twitch Interactive, Inc.; this project is not endorsed by Twitch.
