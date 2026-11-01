# Devpost submission pack

## Title

NightShift Live: The Ward

## Tagline

Twitch chat does not watch the nightmare. It directs it.

## Public demo

[https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/](https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/)

## Short description

NightShift Live is a cinematic Twitch horror game show built around a deliberate split of power: the streamer investigates, deduces, hides, solves, and commits to a route, while viewers vote through chat to change doors, power, danger, resources, and the Warden itself. The entry includes a five-act persistent campaign, streamer control room, transparent OBS view, opt-in captioned soundscape, and a deterministic rehearsal path that never pretends to be live.

## Full description

Most Twitch interaction sits beside the content. NightShift Live puts the audience inside the game without taking the game away from the streamer.

In **The Ward**, the streamer crosses five connected acts: Reception / Triage, Ward 06, the Operating Theatre, the Generator Room, and the final exits. Each room has three authored camera nodes with a different purpose—context, investigation, and commitment. The streamer must identify Subject 06, read physical evidence, survive the isolation corridor, expose the Warden's origin, solve a 2 · 1 · 3 power sequence, and decide what the truth costs.

Chat controls a parallel layer of the same world. Viewers vote on displayed commands; Guardians and Chaos Crew build energy and can spend faction powers. Winning choices restore or destroy power, open routes, create resources, change danger, reveal evidence, and move the Warden through warning, approach, strike, passing, and repel phases. Follows, subscriptions, cheers, and raids enter through the same normalized event pipeline. If chat is quiet, an announced **DIRECTOR FALLBACK** keeps the show moving without fabricating participation.

The result is not a poll laid over a video. Streamer actions and audience consequences share persistent health, danger, power, evidence, inventory, doors, story flags, checkpoints, and ending logic. Failed actions do not count as progress. Final exits must be earned. Multiple reachable endings conclude with a recap that separates streamer decisions, audience resolutions, and zero-chat fallbacks.

The broadcast product is part of the game: a control room handles show state, rehearsal events, Twitch connection, checkpoints, pacing telemetry, privacy, and safety settings; a separate browser route provides a transparent OBS overlay; and BroadcastChannel carries state between views. The procedural Web Audio layer starts only after an explicit gesture, has mute and volume control, softens under reduced-effects preferences, and emits a visual caption for every meaningful sound cue.

The V3 art pass uses original project-specific room plates plus transparent Warden poses, curtain, gurney, and isolation-door layers. Lossless sources and prompt constraints are recorded in the asset-provenance manifest. The public build uses visually verified WebP derivatives and locally bundled open-licensed fonts to keep the deployable payload at 11.6 MiB.

### How it uses Twitch

NightShift authenticates the broadcaster with Twitch OAuth, validates identity through Helix, and connects to EventSub over WebSocket. The bridge handles critical chat separately from optional channel subscriptions, deduplicates message IDs, monitors keepalives, validates reconnect handoffs, and re-subscribes after bounded backoff. Chat, follows, subscriptions, cheers, and raids are normalized before they reach the deterministic game engine.

The Twitch implementation is complete in source and lifecycle tests, but live end-to-end proof is still pending. The submission must not call it verified until a broadcaster authorizes the final public HTTPS callback and a second account sends a command that visibly changes gameplay and the OBS view.

### How Codex was used

Codex was the primary build partner across product design, campaign architecture, original asset generation and integration, Twitch lifecycle hardening, deterministic game logic, responsive UI implementation, accessibility and safety work, procedural audio, release optimization, and the submission package. Codex also built the unit, visual, and browser-campaign gates used to catch progression, focus, camera ARIA, mobile-layout, OBS-alpha, and reduced-motion defects.

Primary Codex build session ID: `01a1976e-d289-7a22-9e87-7aefa57d3379`.

### What is next

The remaining work is proof, not a different product concept:

- register and test the exact Twitch callback with a broadcaster and second viewer;
- capture real transparency inside OBS at 1920×1080 and 1280×720;
- run and time complete newcomer playthroughs before making a duration claim;
- record the final public demo video;
- complete NVDA, audible-mix, native OBS, and 30-minute Chrome+OBS evidence; keyboard/zoom/contrast and the eight-cycle headless soak now pass.

## Judging criteria

- **Innovation:** streamer agency and audience agency are distinct, simultaneous, and physically reconciled in one persistent horror world.
- **Potential impact:** every show has clear participation, faction identity, replayable routes, clip-ready threat beats, and a safe no-chat fallback.
- **Technical implementation:** deterministic campaign engine, hardened Twitch EventSub lifecycle, persistent state and checkpoints, cross-tab OBS transport, procedural captioned audio, and layered automated gates.
- **Design:** original cinematic art, three authored camera compositions per room, a physical multi-phase isolation door, staged Warden poses, responsive broadcast hierarchy, and a complete streamer-facing control room.

## Verified local evidence

- **npm run check:** 64/64 tests pass.
- **npm run qa:visual:** 28/28 viewport, fixture, authored-camera, OBS-alpha, and reduced-motion scenarios pass.
- **npm run qa:gameplay:** 8/8 browser campaign gates pass, including a five-act earned humane-ending path with zero fallbacks.
- **npm run qa:integrity:** 5/5 browser truthfulness, privacy, and single-controller gates pass.
- **npm run qa:relay:** 16/16 checks pass across separate Chrome processes and profiles; exact session/vote/room state crosses the loopback relay while the mirror remains inert.
- **npm run qa:accessibility:** 11/11 keyboard, focus, accessibility-tree, computed-contrast, and 200%-reflow checks pass.
- **npm run qa:performance:** 10/10 checks pass across the latest eight measured campaigns; cold transfer is 1.006 MiB, post-GC heap delta is 0.23 MiB, and final DOM/listener growth is zero.
- **npm run release:audit:** pass; public payload is 11.6 MiB.

These results prove the local build and its deterministic browser paths. A separate stateless public matrix verifies judge access and deployable-file availability; neither class of evidence substitutes for real Twitch, real OBS, human pacing, or screen-reader evidence.

## Final submission checklist

- [ ] Push the reviewed branch to a hosted repository.
- [ ] Make the repository public, or share the private GitHub/GitLab repository with the required Devpost reviewer account.
- [ ] Run the README instructions on a clean machine.
- [x] Deploy the dist directory to a logged-out public HTTPS URL and verify it without an authenticated session.
- [ ] Register that exact URL as the Twitch OAuth redirect.
- [ ] Record a two-account Twitch command and at least one real channel event.
- [ ] Capture the transparent browser source in real OBS at both target resolutions.
- [ ] Complete and record newcomer pacing runs; report observed timing rather than the design target.
- [ ] Upload a public video under three minutes and verify it logged out.
- [x] Record the primary Codex build session ID (`01a1976e-d289-7a22-9e87-7aefa57d3379`).
- [x] Add the public demo URL.
- [ ] Add the repository URL.
