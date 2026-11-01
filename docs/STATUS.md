# NightShift Live V3 status

Date: 2026-11-01

Status terms:

- **VERIFIED LOCAL:** exercised in the shipped browser UI or an automated local gate.
- **IMPLEMENTED:** present in source and covered at the appropriate unit level, but still needs an external or manual proof.
- **UNVERIFIED EXTERNAL:** requires an account, public service, native application, or person not available to the deterministic local harness.
- **NOT MEASURED:** no evidence supports a quantitative claim yet.

## Capability matrix

| Capability | Status | Evidence / boundary |
| --- | --- | --- |
| Five-act persistent campaign | VERIFIED LOCAL | Reception, Ward 06, theatre, generator, and exits carry health, danger, power, evidence, inventory, doors, story, camera, decisions, and checkpoints. The browser gate reaches a visible ending recap. |
| Streamer-only gameplay | VERIFIED LOCAL | Investigation, reconstruction, stealth, physical breach, Warden counterplay, the 2 · 1 · 3 sequence, inventory craft/use, containment, and route choice are browser-accessible. Failed attempts do not satisfy readiness. |
| Three camera nodes per room | VERIFIED LOCAL | Fifteen authored nodes change scene composition, purpose cue, visited state, and one accessible pressed control. |
| Audience voting and zero-chat safety | VERIFIED LOCAL | One accepted vote per viewer per round, deterministic ties, physical consequences, and announced **DIRECTOR FALLBACK** behavior are engine- and browser-tested. |
| Guardian / Chaos factions | IMPLEMENTED | Membership, energy, cooldowns, and faction powers are covered in the pure engine. A real chat-session usability run remains. |
| Physical isolation door | VERIFIED LOCAL | Separate panel, linked bolts, lock state, hinge animation, connected theatre reveal, original door art, and open/closed fixtures pass visual QA. |
| Staged Warden encounter | VERIFIED LOCAL | Original warning, approach/strike, passing, and repel assets are driven by engine phases and appear in deterministic browser fixtures. |
| Multiple endings and recap | VERIFIED LOCAL | Humane, roof, tunnel, containment, weak-escape, and failure logic are reachable in tests; the browser gate checks route, evidence, audience, and fallback provenance. |
| Streamer control room | VERIFIED LOCAL | Start/pause/resume/stop, signal, rehearsal events, activity feed, privacy/safety settings, pacing telemetry, room readiness, and checkpoint recovery are present. |
| Transparent browser overlay | VERIFIED LOCAL / UNVERIFIED OBS | Computed backgrounds for html, body, app, and overlay are transparent at 1920×1080 and 1280×720. Actual transparency in the native OBS application remains unverified. |
| Responsive broadcast UI | VERIFIED LOCAL | The visual matrix covers gameplay from 1920×1080 through 390×844, desktop/phone dashboard, Warden/door fixtures, overlay, and OS reduced motion with no current geometry or console failures. |
| Accessibility and safety hooks | IMPLEMENTED / PARTIALLY VERIFIED | Dialog semantics, focus preservation, progress values, pause shortcut, 44px targets, reduced motion, reduced flashes, high contrast, hidden names, and optional jumpscares pass automated gates. Keyboard-only full run, NVDA, 200% zoom, and computed contrast review remain. |
| Procedural audio and captions | IMPLEMENTED | Gesture-gated five-room ambience, transition/Warden/UI cues, master volume/mute, reduced-effects variants, cleanup, and caption events pass eight unit tests. A manual audible Chrome/OBS recording check remains. |
| Twitch OAuth and EventSub | IMPLEMENTED / UNVERIFIED EXTERNAL | OAuth state validation, Helix identity, chat and optional event subscriptions, dedupe, keepalive watchdog, reconnect handoff, backoff, and re-subscription pass lifecycle tests. Broadcaster authorization and a second-viewer command on the final public callback remain. |
| Clearly labeled rehearsal | VERIFIED LOCAL | Fixtures say **MODE: REHEARSAL** and disconnected normal play says **MODE: SIMULATED**. The local harness rejects an unverified live label. |
| Original asset provenance | DOCUMENTED | V3 source PNGs, purpose, prompt constraints, alpha verification, and public derivatives are recorded in the asset manifest. |
| Optimized public payload | VERIFIED LOCAL | The app references verified WebP derivatives; release audit passes at 11.5 MiB. Lossless sources remain outside the deployable directory. |
| Public logged-out deployment | UNVERIFIED EXTERNAL | Static hosting configuration, security headers, server, and release audit exist. No final public HTTPS URL has been verified logged out. |
| Human campaign duration | NOT MEASURED | Engine timing is rehearsal telemetry only. No 20–35 minute or other duration claim is valid until complete newcomer runs are observed and recorded. |
| Multi-streamer hosted authority | NOT IMPLEMENTED | The entry is intentionally browser-authoritative. A production service would require server-side authorization-code OAuth, encrypted refresh storage, signed sessions, and centralized state. |

## Current automated evidence

- **npm run check:** 48/48 tests pass.
- **npm run qa:visual:** 13/13 scenarios pass with zero recorded browser console errors.
- **npm run qa:gameplay:** 7/7 browser campaign gates pass.
- **npm run release:audit:** pass; 11.5 MiB across the public build.
- **Image optimization:** 11 referenced sources reduced by 57.0% while preserving dimensions and alpha; post-switch visual and gameplay gates pass.

## Tests prove

- deterministic campaign, vote, fallback, inventory, checkpoint, ending, and Twitch lifecycle behavior;
- action focus survives the one-second render loop;
- camera selection changes composition and exposes exactly one pressed node;
- rejected actions do not create false progress;
- the browser can craft/use inventory, recover a checkpoint, disclose a fallback, cross five acts, and render a truthful ending recap;
- target layouts have no current functional-zone collisions, clipping, offscreen controls, opaque overlay roots, or unsuppressed reduced-motion animations.

## Tests do not prove

- a broadcaster and second viewer can complete the final public Twitch flow;
- native OBS renders alpha and audio exactly as intended;
- a newcomer understands the game or completes it within a target duration;
- the experience is screen-reader conformant;
- long-session memory, frame pacing, and network behavior are production-ready;
- a public URL, repository, and video are available logged out.

## Release proof still required

1. Deploy the current dist directory to public HTTPS and verify it logged out.
2. Register the exact OAuth callback and run the two-account Twitch matrix in the Twitch verification guide.
3. Capture real OBS alpha at both target resolutions and confirm BroadcastChannel state propagation.
4. Listen to each room/cue in Chrome and OBS; repeat with mute and reduced effects to verify captions.
5. Complete keyboard-only, NVDA, zoom/reflow, contrast, and long-session checks.
6. Run independent newcomer playtests and publish observed timing and comprehension notes.
7. Record and publish the final demo video without presenting rehearsal as live proof.
