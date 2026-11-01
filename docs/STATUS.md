# NightShift Live RC4 status

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
| First-time progression guidance | VERIFIED LOCAL | A persistent gameplay next-step panel explains the missing authored beat, audience-resolution state, consequence, transition, and final physical route choice. Gameplay and dashboard use the same advance path; Ward 06 preserves audience consequence before the streamer breach. Three clean visible-guidance browser runs reached the earned ending without fixtures or fallbacks. |
| Inventory consequence clarity | VERIFIED LOCAL | Item use reports exact before/after health, fear, danger, shield, or Warden changes. No-op uses retain the item. The condition strip and last-item effect remain visible after transient feedback; exact-delta and no-op browser/unit assertions pass. |
| Three camera nodes per room | VERIFIED LOCAL | Fifteen authored nodes expose from/to/moving state, purpose, visited state, and one accessible pressed control. Multiple depth layers travel at different rates while the plate URL remains unchanged; reduced motion applies the same destination without travel. Dynamic lifecycle and depth-displacement assertions pass. |
| Audience voting and zero-chat safety | VERIFIED LOCAL | One accepted vote per viewer per round, deterministic ties, physical consequences, and announced **DIRECTOR FALLBACK** behavior are engine- and browser-tested. |
| Guardian / Chaos factions | IMPLEMENTED | Membership, energy, cooldowns, and faction powers are covered in the pure engine. A real chat-session usability run remains. |
| Physical isolation door and scene beats | VERIFIED LOCAL | Door anticipation, bolt, swing, light/reflection, and settle beats are independently observable. Curtain closing, clue discovery, and three in-world breaker levers expose the authored physical state; captions retain the outcome with reduced motion. Contract and visual gates pass. |
| Staged Warden encounter | VERIFIED LOCAL | Original warning, approach/strike, passing, repel, and retreat states are driven by engine phases. RC4 keeps the countered reaction visibly present before fade instead of immediately hiding the repelled state; contract and visual gates pass. |
| Multiple endings and recap | VERIFIED LOCAL | Humane, roof, tunnel, containment, weak-escape, and failure logic are reachable in tests; a full browser UI path earns **MARA WALKS INTO DAWN** with six evidence items, five audience resolutions, and zero fallbacks, while a separate fallback run verifies provenance. |
| Streamer control room | VERIFIED LOCAL | Start/pause/resume/stop, signal, rehearsal events, activity feed, privacy/safety settings, pacing telemetry, room readiness, and checkpoint recovery are present. RC4 adds persistent audience state, next required action, and latest-event status. |
| Transparent browser overlay | VERIFIED LOCAL / UNVERIFIED OBS | Computed backgrounds for html, body, app, and overlay are transparent at 1920×1080 and 1280×720. Actual transparency in the native OBS application remains unverified. |
| Responsive broadcast UI | VERIFIED LOCAL | The visual matrix covers gameplay from 1920×1080 through 390×844, desktop/phone dashboard, Warden/door fixtures, overlay, and OS reduced motion with no current geometry or console failures. |
| Accessibility and safety hooks | VERIFIED LOCAL / UNVERIFIED NVDA | Eleven browser gates cover keyboard-only intro/gameplay/control-room operation, modal containment, 3px dual-contrast focus, the Chromium accessibility tree, computed normal/high-contrast color pairs, and 200% zoom-equivalent gameplay/control-room reflow. NVDA remains manual and no WCAG-conformance claim is made. |
| Procedural audio and captions | IMPLEMENTED | Gesture-gated five-room ambience, transition/Warden/UI cues, master volume/mute, reduced-effects variants, cleanup, and caption events pass eight unit tests. A manual audible Chrome/OBS recording check remains. |
| Twitch OAuth and EventSub | IMPLEMENTED / UNVERIFIED EXTERNAL | OAuth state validation, automatic callback resume, Helix identity, chat and optional event subscriptions, dedupe, keepalive watchdog, reconnect handoff, backoff, and re-subscription pass lifecycle tests. The public callback now exists; broadcaster authorization and a second-viewer command still remain. |
| Clearly labeled rehearsal | VERIFIED LOCAL | Fixtures say **MODE: REHEARSAL** and disconnected normal play says **MODE: SIMULATED**. The local harness rejects an unverified live label. |
| Original asset provenance | DOCUMENTED | V3 source PNGs, purpose, prompt constraints, alpha verification, and public derivatives are recorded in the asset manifest. |
| Optimized public payload | VERIFIED LOCAL | The app references verified WebP derivatives and locally bundled open-licensed fonts; release audit passes at 11.6 MiB. Lossless art sources remain outside the deployable directory. |
| Browser cold load and soak | VERIFIED LOCAL / NATIVE OBS PENDING | Hidden V3 scene art is deferred on Reception; cold transfer is 1.006 MiB. The latest eight measured full-campaign cycles pass with a 0.192 MiB final heap delta, zero final DOM/listener growth, bounded relay posts, and clean teardown. A 30-minute native Chrome+OBS soak remains. |
| Public logged-out deployment | PREVIOUS VERSION VERIFIED / RC4 PROMOTION PENDING | The [current production demo](https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/) previously returned HTTP 200 without cookies or login copy, and its deployed module hashes matched that pushed source. RC4 passed local verification but is not described as public until the exact candidate is deployed and the logged-out matrix is repeated. |
| Human campaign duration | NOT MEASURED | Engine timing is rehearsal telemetry only. No 20–35 minute or other duration claim is valid until complete newcomer runs are observed and recorded. |
| Multi-streamer hosted authority | NOT IMPLEMENTED | The entry is intentionally browser-authoritative. A production service would require server-side authorization-code OAuth, encrypted refresh storage, signed sessions, and centralized state. |

## Recorded RC4 automated evidence

- **npm run check:** 73/73 unit and contract tests pass.
- **npm run qa:visual:** 28/28 scenarios pass, including all fifteen camera compositions, active-target/HUD separation, and reduced-motion transitions.
- **npm run qa:gameplay:** 9/9 browser gates pass, including three clean visible-guidance earned-ending runs without fixtures or fallbacks and with visible rehearsal votes.
- **npm run qa:integrity:** 5/5 browser truth, privacy, and single-controller gates pass.
- **npm run qa:relay:** 17/17 independent-process state-sync and passive-mirror gates pass.
- **npm run qa:accessibility:** 11/11 keyboard, focus, accessibility-tree, computed-contrast, and 200%-reflow gates pass.
- **npm run qa:performance:** 10/10 gates pass across eight measured campaigns; final heap delta 0.192 MiB, final DOM delta 0, final listener delta 0.
- **npm run release:audit:** pass; 11.6 MiB across 23 public files.
- The complete `npm run verify` composite passed on 2026-11-01. This is local candidate evidence, not a claim that RC4 has already been publicly deployed.
- The full finding-to-test map is in [`RC4_JUDGE_FIX_CONTRACT.md`](RC4_JUDGE_FIX_CONTRACT.md).

## Tests prove

- deterministic campaign, vote, fallback, inventory, checkpoint, ending, and Twitch lifecycle behavior;
- action focus survives the one-second render loop;
- camera selection keeps the same room plate, moves multiple depth layers by different amounts, locks travel controls while busy, settles deterministically, and exposes exactly one pressed node;
- rejected actions do not create false progress;
- the browser can craft/use inventory with exact persistent effects, reject a no-op without consuming the item, recover a checkpoint, disclose a fallback, cross five acts, and render a truthful ending recap;
- three isolated browser runs can follow visible gameplay guidance to the earned humane ending without fixtures or incomplete-room fallbacks;
- target layouts have no current functional-zone collisions, clipping, offscreen controls, opaque overlay roots, or unsuppressed reduced-motion animations.

## Tests do not prove

- a broadcaster and second viewer can complete the final public Twitch flow;
- native OBS renders alpha and audio exactly as intended;
- five unfamiliar newcomers understand the game or complete it within a target duration;
- the experience is screen-reader conformant (NVDA is still untested);
- native 30-minute Chrome+OBS memory, frame pacing, audio, GPU, and network behavior are production-ready;
- a public repository and video are available logged out.

## Release proof still required

1. Register the exact OAuth callback and run the two-account Twitch matrix in the Twitch verification guide.
2. Capture real OBS alpha at both target resolutions and confirm BroadcastChannel state propagation.
3. Listen to each room/cue in Chrome and OBS; repeat with mute and reduced effects to verify captions.
4. Complete NVDA, audible-mix, and a 30-minute native Chrome+OBS check; the automated keyboard, zoom/reflow, computed-contrast, and eight-cycle headless-soak gates now pass.
5. Run five independent newcomer playtests and publish observed timing, help requests, stuck points, routes, endings, and comprehension notes.
6. Record and publish the final demo video without presenting rehearsal as live proof.
7. Verify logged-out access to the exact submitted repository and public video, then save the complete Devpost entry with the Codex session ID.
