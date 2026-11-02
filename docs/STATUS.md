# NightShift Live RC8 status

Date: 2026-11-02

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
| First-time progression guidance | VERIFIED LOCAL | A persistent gameplay next-step panel and explicit five-step Ward 06 checklist explain the missing authored beat, audience-resolution state, consequence, transition, and final physical route choice. Unavailable actions expose their exact prerequisites instead of accepting false progress. Gameplay and dashboard use the same advance path; Ward 06 preserves audience consequence before the streamer breach. Three clean visible-guidance browser runs reached the earned ending without fixtures or fallbacks. |
| Inventory consequence clarity | VERIFIED LOCAL | Item use reports exact before/after health, fear, danger, shield, or Warden changes. No-op uses retain the item. The condition strip and last-item effect remain visible after transient feedback; exact-delta and no-op browser/unit assertions pass. |
| Three camera nodes per room | VERIFIED LOCAL | Fifteen authored nodes expose from/to/moving state, purpose, visited state, and one accessible pressed control. Multiple depth layers travel at different rates while the plate URL remains unchanged. Camera-destination reveals cover records, locker medicine, restraints, service grid, theatre props, roof, and tunnel; dynamic and visual assertions pass. |
| Audience voting and zero-chat safety | VERIFIED LOCAL | One accepted vote per viewer per round, deterministic ties, physical consequences, and announced **DIRECTOR FALLBACK** behavior are engine- and browser-tested. |
| Guardian / Chaos factions | IMPLEMENTED | Membership, energy, cooldowns, and faction powers are covered in the pure engine. A real chat-session usability run remains. |
| Physical isolation door and scene beats | VERIFIED LOCAL | Door anticipation, bolt, swing, light/reflection, and settle beats are independently observable. Curtain, clues, three breaker levers, surgical lamps, confession tape, containment sigil, roof beacon, and tunnel gate expose authored physical state; captions retain the outcome with reduced motion. Contract and visual gates pass. |
| Staged Warden encounter | VERIFIED LOCAL | Original warning, approach/strike, passing, repel, and retreat states are driven by engine phases. RC4 keeps the countered reaction visibly present before fade instead of immediately hiding the repelled state; contract and visual gates pass. |
| Multiple endings and recap | VERIFIED LOCAL | Humane, roof, tunnel, containment, weak-escape, and failure logic are reachable. Route and causal badges, a decision trace, audience/fallback provenance, route-specific visual treatment, and a matching musical resolution remain visible. RC6 adds a real UI-free rooftop dawn tableau to the earned **MARA WALKS INTO DAWN** path; the clean path still completes with zero fallbacks. |
| Streamer control room | VERIFIED LOCAL | Start/pause/resume/stop, signal, rehearsal events, activity feed, privacy/safety settings, pacing telemetry, room readiness, checkpoint recovery, audience/next/recent state, and a four-bus broadcast mixer are present. |
| Transparent browser overlay | VERIFIED LOCAL / UNVERIFIED OBS | Computed backgrounds for html, body, app, and overlay are transparent at 1920×1080 and 1280×720. Actual transparency in the native OBS application remains unverified. |
| Responsive broadcast UI | VERIFIED LOCAL | The 33-state visual matrix covers gameplay from 1920×1080 through 390×844, compact cinematic HUD at 1280×720, four true 640×360 Twitch-player captures, desktop/phone dashboard, Warden/door fixtures, all camera destinations, overlay, and OS reduced motion with no current geometry or console failures. |
| Accessibility and safety hooks | VERIFIED LOCAL / UNVERIFIED NVDA | Eleven browser gates cover keyboard-only intro/gameplay/control-room operation, modal containment, 3px dual-contrast focus, the Chromium accessibility tree, computed normal/high-contrast color pairs, and 200% zoom-equivalent gameplay/control-room reflow. NVDA remains manual and no WCAG-conformance claim is made. |
| Action sound, adaptive score, and captions | VERIFIED LOCAL / AUDIBLE LISTENING PENDING | Gesture-gated action/item/audience/Warden/ending cues, five room ambiences, adaptive score, effects/ambience/music/master buses, compressor fallback, stereo panning, mixer controls, reduced-effects variants, cleanup, and exact captions pass unit/contract gates. A human audible Chrome/OBS mix review remains. |
| Synced OBS captions and single-controller audio | VERIFIED LOCAL / UNVERIFIED OBS | Sanitized caption state, including optional speaker and direction metadata, reaches passive gameplay/overlay surfaces through validated transport. Persistent caption enablement, size, background strength, duration, speaker-label, and directional-cue preferences apply to both rails. Passive views remain inert and silent, so one authoritative controller supplies audio without doubling. Native OBS routing/listening remains unverified. |
| Five-minute rehearsal proof workflow | WORKFLOW VALIDATED / OPERATOR RUN PENDING | A headed-Chromium `getDisplayMedia`/`MediaRecorder` workflow requires the real **This Tab + Share tab audio** picker, a clean commit, captions, non-empty audio/video, earned humane ending, and zero fallbacks. No completed picker run or proof file is claimed yet. |
| Truth-gated 2:52 assembly | VERIFIED LOCAL / MEDIA NOT VERIFIED | The builder reserves and collision-checks every input, sidecar, manifest, normalized clip, `concat.txt`, plan/report, staging, backup, quarantine, and output path before writes. Same-directory atomic promotion retains/restores a prior valid MP4 on failure and pins promoted bytes to the verified staging SHA-256. Adversarial Windows collision and rollback tests pass. Genuine source clips and a finished MP4 remain **NOT VERIFIED**. |
| Twitch OAuth and EventSub | IMPLEMENTED / UNVERIFIED EXTERNAL | OAuth state validation, automatic callback resume, Helix identity, chat and optional event subscriptions, dedupe, keepalive watchdog, reconnect handoff, backoff, and re-subscription pass lifecycle tests. The public callback now exists; broadcaster authorization and a second-viewer command still remain. |
| Clearly labeled rehearsal | VERIFIED LOCAL | Fixtures say **MODE: REHEARSAL** and disconnected normal play says **MODE: SIMULATED**. The local harness rejects an unverified live label. |
| Original asset provenance | DOCUMENTED | V3 source PNGs, purpose, prompt constraints, alpha verification, and public derivatives are recorded in the asset manifest. |
| Optimized release payload | VERIFIED LOCAL / VERIFIED PUBLIC | RC8 references optimized WebP derivatives and bundled open-licensed fonts. Its release-audit stage passed at 12.0 MiB across 25 deployable files, with lossless art sources kept outside the deployable directory. Fresh anonymous production probes byte-matched `app.mjs`, `audio.mjs`, `engine.mjs`, `public-state.mjs`, `twitch.mjs`, and `styles.css` to commit `54b9cd1d7ab75d2c4d0bd051bf3ddef4fa4f431c`. |
| Browser cold load and soak | VERIFIED LOCAL / NATIVE OBS PENDING | The retained RC8 10/10 performance suite passes with no positive attached-DOM or listener growth, post-GC heap within the enforced 8 MiB-or-75% budget, bounded relay posts, and clean teardown. A 30-minute native Chrome+OBS soak remains **NOT VERIFIED**. |
| Public logged-out deployment | VERIFIED PUBLIC BASELINE / CANDIDATE PROMOTION RECORDED EXTERNALLY | At the time this source record was cut, the [production demo](https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/) served RC8 / Site version 13 from commit `54b9cd1d7ab75d2c4d0bd051bf3ddef4fa4f431c`. Anonymous probes and production-browser smoke reached Help, Control Room, the browser OBS overlay, and Cinema HUD with zero warnings/errors. The Sites-assigned version/commit and fresh probes for this candidate belong in the generated post-publication handoff. This does not verify real Twitch or native OBS. |
| Human campaign duration | NOT MEASURED | Engine timing is rehearsal telemetry only. No 20–35 minute or other duration claim is valid until complete newcomer runs are observed and recorded. |
| Multi-streamer hosted authority | NOT IMPLEMENTED | The entry is intentionally browser-authoritative. A production service would require server-side authorization-code OAuth, encrypted refresh storage, signed sessions, and centralized state. |

## Recorded RC8 suite evidence

- **npm run check:** 160 unit and contract tests total on the retained RC8 source-candidate run: 159 passed, 1 optional Windows file-symlink case skipped because this host lacks symlink permission, and 0 failed.
- **npm run qa:visual:** 33/33 scenarios pass, including compact HUD, four true 640×360 captures, all fifteen camera compositions, active-target/HUD separation, and reduced-motion completion states.
- **npm run qa:gameplay:** 9/9 browser gates pass, including three clean visible-guidance earned-ending runs without fixtures or fallbacks and with visible rehearsal votes.
- **npm run qa:integrity:** 5/5 browser truth, privacy, and single-controller gates pass.
- **npm run qa:relay:** 17/17 independent-process state-sync and passive-mirror gates pass.
- **npm run qa:accessibility:** 11/11 keyboard, focus, accessibility-tree, computed-contrast, and 200%-reflow gates pass.
- **npm run qa:performance:** 10/10 gates pass; no positive attached-DOM or listener growth, and post-GC heap remained within the enforced 8 MiB-or-75% budget.
- Audio/caption/capture contracts cover action-specific cues, adaptive score, routed mixer, synchronized sanitized captions, passive silent mirrors, and truthful recorder failure states.
- The retained post-audit RC8 all-in-one `npm run verify` composite passed end to end, including the 12.0 MiB / 25-file release-audit stage. A separate post-deployment probe verified public HTTP access, parity for the six critical runtime/style files, and logged-out Help, Control Room, browser-overlay, and Cinema-HUD paths for the pre-promotion Site v13 baseline. This candidate requires a new Sites-assigned identity and fresh probe record after publication. A new source change must produce a new retained run before promotion.
- The historical finding-to-test map remains in [`RC5_JUDGE_FIX_CONTRACT.md`](RC5_JUDGE_FIX_CONTRACT.md), the RC6 art-direction acceptance map is in [`RC6_VISUAL_REFERENCE_MATRIX.md`](RC6_VISUAL_REFERENCE_MATRIX.md), and retained artifacts/manual proof boundaries are indexed in [`evidence/RC5_EVIDENCE.md`](evidence/RC5_EVIDENCE.md).

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
