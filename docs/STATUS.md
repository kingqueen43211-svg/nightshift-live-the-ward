# NightShift Live RC5 status

Date: 2026-11-01

Status terms:

- **VERIFIED LOCAL:** exercised in the shipped browser UI or an automated local gate.
- **IMPLEMENTED:** present in source and covered at the appropriate unit level, but still needs an external or manual proof.
- **WORKFLOW VALIDATED / OPERATOR RUN PENDING:** the guarded workflow and failure contract pass automation, but a required human browser-picker or native-app run has not occurred.
- **UNVERIFIED EXTERNAL:** requires an account, public service, native application, or person not available to the deterministic local harness.
- **NOT MEASURED:** no evidence supports a quantitative claim yet.

## Capability matrix

| Capability | Status | Evidence / boundary |
| --- | --- | --- |
| Five-act persistent campaign | VERIFIED LOCAL | Reception, Ward 06, theatre, generator, and exits carry health, danger, power, evidence, inventory, doors, story, camera, decisions, and checkpoints. The browser gate reaches a visible ending recap. |
| Streamer-only gameplay | VERIFIED LOCAL | Investigation, reconstruction, stealth, physical breach, Warden counterplay, the 2 · 1 · 3 sequence, inventory craft/use, containment, and route choice are browser-accessible. Failed attempts do not satisfy readiness. |
| First-time progression guidance | VERIFIED LOCAL | A persistent gameplay next-step panel explains the missing authored beat, audience-resolution state, consequence, transition, and final physical route choice. Gameplay and dashboard use the same advance path; Ward 06 preserves audience consequence before the streamer breach. Three clean visible-guidance browser runs reached the earned ending without fixtures or fallbacks. |
| Inventory consequence clarity | VERIFIED LOCAL | Item use reports exact before/after health, fear, danger, shield, or Warden changes. No-op uses retain the item. The condition strip and last-item effect remain visible after transient feedback; exact-delta and no-op browser/unit assertions pass. |
| Three camera nodes per room | VERIFIED LOCAL | Fifteen authored nodes expose from/to/moving state, purpose, visited state, and one accessible pressed control. Multiple depth layers travel at different rates while the plate URL remains unchanged. RC5 adds camera-destination reveals for records, locker medicine, restraints, service grid, theatre props, roof, and tunnel; dynamic and visual assertions pass. |
| Audience voting and zero-chat safety | VERIFIED LOCAL | One accepted vote per viewer per round, deterministic ties, physical consequences, and announced **DIRECTOR FALLBACK** behavior are engine- and browser-tested. |
| Guardian / Chaos factions | IMPLEMENTED | Membership, energy, cooldowns, and faction powers are covered in the pure engine. A real chat-session usability run remains. |
| Physical isolation door and scene beats | VERIFIED LOCAL | Door anticipation, bolt, swing, light/reflection, and settle beats are independently observable. Curtain, clues, three breaker levers, surgical lamps, confession tape, containment sigil, roof beacon, and tunnel gate expose authored physical state; captions retain the outcome with reduced motion. Contract and visual gates pass. |
| Staged Warden encounter | VERIFIED LOCAL | Original warning, approach/strike, passing, repel, and retreat states are driven by engine phases. RC4 keeps the countered reaction visibly present before fade instead of immediately hiding the repelled state; contract and visual gates pass. |
| Multiple endings and recap | VERIFIED LOCAL | Humane, roof, tunnel, containment, weak-escape, and failure logic are reachable. RC5 presents route and causal badges, a decision trace, audience/fallback provenance, route-specific visual treatment, and a matching musical resolution. The earned UI path still reaches **MARA WALKS INTO DAWN** with zero fallbacks. |
| Streamer control room | VERIFIED LOCAL | Start/pause/resume/stop, signal, rehearsal events, activity feed, privacy/safety settings, pacing telemetry, room readiness, checkpoint recovery, audience/next/recent state, and a four-bus broadcast mixer are present. |
| Transparent browser overlay | VERIFIED LOCAL / UNVERIFIED OBS | Computed backgrounds for html, body, app, and overlay are transparent at 1920×1080 and 1280×720. Actual transparency in the native OBS application remains unverified. |
| Responsive broadcast UI | VERIFIED LOCAL | The 29-state visual matrix covers gameplay from 1920×1080 through 390×844, compact cinematic HUD at 1280×720, desktop/phone dashboard, Warden/door fixtures, all camera destinations, overlay, and OS reduced motion with no current geometry or console failures. |
| Accessibility and safety hooks | VERIFIED LOCAL / UNVERIFIED NVDA | Eleven browser gates cover keyboard-only intro/gameplay/control-room operation, modal containment, 3px dual-contrast focus, the Chromium accessibility tree, computed normal/high-contrast color pairs, and 200% zoom-equivalent gameplay/control-room reflow. NVDA remains manual and no WCAG-conformance claim is made. |
| Action sound, adaptive score, and captions | VERIFIED LOCAL / AUDIBLE LISTENING PENDING | Gesture-gated action/item/audience/Warden/ending cues, five room ambiences, adaptive score, effects/ambience/music/master buses, compressor fallback, stereo panning, mixer controls, reduced-effects variants, cleanup, and exact captions pass unit/contract gates. A human audible Chrome/OBS mix review remains. |
| Synced OBS captions and single-controller audio | VERIFIED LOCAL / UNVERIFIED OBS | Sanitized `{cue,text,at}` state reaches passive gameplay/overlay surfaces through validated transport. Passive views remain inert and silent, so one authoritative controller supplies audio without doubling. Native OBS routing/listening remains unverified. |
| Five-minute rehearsal proof workflow | WORKFLOW VALIDATED / OPERATOR RUN PENDING | A headed-Chromium `getDisplayMedia`/`MediaRecorder` workflow requires the real **This Tab + Share tab audio** picker, a clean commit, captions, non-empty audio/video, earned humane ending, and zero fallbacks. No completed picker run or proof file is claimed yet. |
| Twitch OAuth and EventSub | IMPLEMENTED / UNVERIFIED EXTERNAL | OAuth state validation, automatic callback resume, Helix identity, chat and optional event subscriptions, dedupe, keepalive watchdog, reconnect handoff, backoff, and re-subscription pass lifecycle tests. The public callback now exists; broadcaster authorization and a second-viewer command still remain. |
| Clearly labeled rehearsal | VERIFIED LOCAL | Fixtures say **MODE: REHEARSAL** and disconnected normal play says **MODE: SIMULATED**. The local harness rejects an unverified live label. |
| Original asset provenance | DOCUMENTED | V3 source PNGs, purpose, prompt constraints, alpha verification, and public derivatives are recorded in the asset manifest. |
| Optimized public payload | VERIFIED LOCAL / RC5 DEPLOYMENT PENDING | RC5 continues to reference optimized WebP derivatives and bundled open-licensed fonts; its release-audit stage passed in the final composite. Lossless art sources remain outside the deployable directory. |
| Browser cold load and soak | VERIFIED LOCAL / NATIVE OBS PENDING | The final composite's 10/10 performance suite passes with a 0.285 MiB heap delta, zero final DOM growth, zero final listener growth, bounded relay posts, and clean teardown. A 30-minute native Chrome+OBS soak remains. |
| Public logged-out deployment | RC4 VERIFIED PUBLIC / RC5 NOT DEPLOYED | The [current production demo](https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/) is the previously verified RC4 build. RC5 has not been promoted or publicly probed and must not be described as the live Site yet. |
| Human campaign duration | NOT MEASURED | Engine timing is rehearsal telemetry only. No 20–35 minute or other duration claim is valid until complete newcomer runs are observed and recorded. |
| Multi-streamer hosted authority | NOT IMPLEMENTED | The entry is intentionally browser-authoritative. A production service would require server-side authorization-code OAuth, encrypted refresh storage, signed sessions, and centralized state. |

## Recorded RC5 suite evidence

- **npm run check:** 83/83 unit and contract tests pass.
- **npm run qa:visual:** 29/29 scenarios pass, including compact HUD, all fifteen camera compositions, active-target/HUD separation, and reduced-motion transitions.
- **npm run qa:gameplay:** 9/9 browser gates pass, including three clean visible-guidance earned-ending runs without fixtures or fallbacks and with visible rehearsal votes.
- **npm run qa:integrity:** 5/5 browser truth, privacy, and single-controller gates pass.
- **npm run qa:relay:** 17/17 independent-process state-sync and passive-mirror gates pass.
- **npm run qa:accessibility:** 11/11 keyboard, focus, accessibility-tree, computed-contrast, and 200%-reflow gates pass.
- **npm run qa:performance:** 10/10 gates pass; final heap delta 0.285 MiB, final DOM delta 0, final listener delta 0.
- Audio/caption/capture contracts cover action-specific cues, adaptive score, routed mixer, synchronized sanitized captions, passive silent mirrors, and truthful recorder failure states.
- The final all-in-one `npm run verify` composite passed end to end, including the release-audit stage. This is verified local candidate evidence, not an RC5 deployment claim.
- The current finding-to-test map is in [`RC5_JUDGE_FIX_CONTRACT.md`](RC5_JUDGE_FIX_CONTRACT.md); artifacts and the empty capture boundary are indexed in [`evidence/RC5_EVIDENCE.md`](evidence/RC5_EVIDENCE.md).

## Tests prove

- deterministic campaign, vote, fallback, inventory, checkpoint, ending, and Twitch lifecycle behavior;
- action focus survives the one-second render loop;
- camera selection keeps the same room plate, moves multiple depth layers by different amounts, locks travel controls while busy, settles deterministically, and exposes exactly one pressed node;
- rejected actions do not create false progress;
- the browser can craft/use inventory with exact persistent effects, reject a no-op without consuming the item, recover a checkpoint, disclose a fallback, cross five acts, and render a truthful ending recap;
- three isolated browser runs can follow visible gameplay guidance to the earned humane ending without fixtures or incomplete-room fallbacks;
- target layouts have no current functional-zone collisions, clipping, offscreen controls, opaque overlay roots, or unsuppressed reduced-motion animations.
- action, item, audience, Warden, score-stage, and ending events have authored cue/caption APIs and safe routing contracts;
- sanitized captions can reach passive OBS surfaces while passive views remain non-authoritative and silent;
- node-specific reveals, theatre/finale choreography, route/cause ending treatment, compact HUD, item chips, and pacing hints are present and contract/visual tested;
- the five-minute recorder rejects missing tab audio, dirty source, incomplete media, missing captions, fallback endings, and interrupted chunk order instead of claiming proof.

## Tests do not prove

- a broadcaster and second viewer can complete the final public Twitch flow;
- native OBS renders alpha and audio exactly as intended;
- Chrome will supply a tab-audio track in the real share-tab picker run, or that a complete five-minute rehearsal WebM has been captured;
- five unfamiliar newcomers understand the game or complete it within a target duration;
- the experience is screen-reader conformant (NVDA is still untested);
- native 30-minute Chrome+OBS memory, frame pacing, audio, GPU, and network behavior are production-ready;
- a public repository and video are available logged out.

## Release proof still required

1. Register the exact OAuth callback and run the two-account Twitch matrix in the Twitch verification guide.
2. Capture real OBS alpha at both target resolutions and confirm BroadcastChannel state propagation.
3. Listen to each room/cue in Chrome and OBS; repeat with mute and reduced effects to verify captions.
4. Complete the real Chrome **This Tab + Share tab audio** five-minute rehearsal capture and retain its passing manifest; do not substitute the workflow-validation test.
5. Complete NVDA, audible-mix, and a 30-minute native Chrome+OBS check; automated keyboard, zoom/reflow, computed contrast, and headless performance gates pass.
6. Run five independent newcomer playtests and publish observed timing, help requests, stuck points, routes, endings, and comprehension notes.
7. Record and publish the final demo video without presenting rehearsal as live proof.
8. Verify logged-out access to the exact submitted repository and public video, then save the complete Devpost entry with the Codex session ID.
