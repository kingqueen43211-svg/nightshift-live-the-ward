# RC6 quality tracker

Status vocabulary: **PASS** only when the stated gate has objective evidence; **PARTIAL** when the implementation exists but a required manual or external proof is missing; **FAIL** for a reproduced blocker; **NOT TESTED** when no valid proof exists.

## Recorded RC6 suite gates

The final RC6 all-in-one `npm run verify` composite passed end to end. This verifies the local release candidate only: the public Site remains the independently checked prior baseline until RC6 is promoted and receives a fresh anonymous byte probe and production-browser smoke check. External/manual gates remain separate.

| Gate | Status | Evidence / remaining proof |
| --- | --- | --- |
| S0 current-build inspection | PASS | Source, routes, browser console, 29 viewport/state captures, campaign/integrity/accessibility browser flows, performance soak, 90 unit/contract tests, and the 12.0 MiB / 24-file release-audit stage passed in the final composite. Historical evidence is indexed in [`evidence/RC5_EVIDENCE.md`](evidence/RC5_EVIDENCE.md), and RC6 visual acceptance criteria are recorded in [`RC6_VISUAL_REFERENCE_MATRIX.md`](RC6_VISUAL_REFERENCE_MATRIX.md). |
| S1 gold-standard corridor | PASS | Spatial camera travel, node-specific records/locker/restraint/service reveals, theatre lamps/tape/containment, final roof/tunnel treatment, physical door, Warden phases, action-specific cues, and reduced-motion/caption equivalents pass local contract and visual gates. |
| S2 coherent 10–15 minute showcase section | PARTIAL | The five-act mechanics and director-safe fallbacks are playable end to end, but no uncut newcomer playtest has yet established a real 10–15 minute showcase duration or comprehension result. |
| S3 full campaign | PARTIAL | Five persistent acts, checkpoints, inventory crafting/use, prerequisites, distinct endings, fallback recovery, and route/cause/decision recap pass automated and browser integration tests. A 20–35 minute duration remains a target, not a claim, until five unfamiliar-human full runs are recorded. |
| S4 real Twitch + OBS | PARTIAL | OAuth/EventSub lifecycle and 17/17 separate-process relay gates pass, including exact state sync and a passive mirror. A public callback URL exists; broadcaster credentials, a second viewer, and native OBS alpha captures are still required. |
| S5 compositor-wide polish | PARTIAL | 29/29 visual gates including compact HUD, 9/9 gameplay, 5/5 integrity, 17/17 relay, 11/11 accessibility/reflow, 10/10 performance, and 90/90 unit/contract tests pass. NVDA, audible output, real share-tab/audio capture, native OBS, and a native 30-minute soak remain manual gates. |
| S6 independent design review | PASS | Independent design and security/performance reviews are recorded. Their actionable local P1 findings were resolved; external Twitch/OBS/human proof remains explicitly open. |

## RC6 finalist-quality gates

| Gate | Status | Evidence / remaining proof |
| --- | --- | --- |
| A01 authored action sound | PASS | Physical actions, items, audience outcomes, Warden phases, transitions, and endings expose action-specific procedural sequences and exact captions; blocked/no-op paths remain captioned. Audible listening is still manual. |
| A02 adaptive broadcast mix | PASS | Five-room ambience and adaptive score route through effects/ambience/music/master gains, compressor fallback, and optional stereo panning; mixer controls and reduced-effects behavior pass unit/contract tests. |
| A03 caption synchronization | PASS | Sanitized caption state, including optional speaker and directional metadata, reaches gameplay and passive overlay rails through validated transport without enabling audio on mirror controllers. Persistent enablement, size, background-strength, duration, speaker-label, and directional-cue preferences are contract-tested. Native OBS observation remains external. |
| V01 camera-specific reveals | PASS | Records, medicine locker, corridor restraint, service grid, theatre, roof, and tunnel reveal rigs are bound to authored camera nodes and included in the 29-state visual matrix. |
| V02 theatre/finale choreography | PASS | Surgical lamps, confession tape, containment sigil, roof beacon, and tunnel gate respond to decisive scene beats with reduced-motion state/caption equivalents. |
| V03 causal ending treatment | PASS | Ending UI exposes route, cause, streamer decision trace, audience/fallback provenance, visual tone, and ending-specific score resolution. The earned humane route adds a UI-free rooftop dawn tableau. |
| U01 broadcast legibility | PASS | Compact cinematic HUD, exact item-effect chips, meter response, and truthful idle pacing hints are user-controlled and locally tested. Human comprehension remains external. |
| P01 continuous rehearsal proof | PARTIAL | The five-minute `getDisplayMedia`/`MediaRecorder` workflow, watermark, clean-tree/audio/video/caption/ending checks, and failure manifest are implemented and contract-validated. A real Chrome **This Tab + Share tab audio** picker run is pending; no complete WebM is claimed. |

## RC4 regression gates retained through RC6

The implementation and proof details live in [`RC4_JUDGE_FIX_CONTRACT.md`](RC4_JUDGE_FIX_CONTRACT.md). The local automation rows passed in the final composite; that result cannot close an external/manual gate.

| Gate | Status | RC4 evidence / remaining proof |
| --- | --- | --- |
| M01 visible progression | PASS | Persistent gameplay guidance and the shared advance path pass browser automation; Reception continues to Ward 06 without visiting the dashboard. |
| M02 item consequence | PASS | Structured exact deltas, persistent effect text, condition state, and no-op retention pass unit/contract and browser assertions. |
| M03 clean completion | PASS | Three isolated visible-guidance runs reached the earned humane ending without fixtures or fallbacks, using visible rehearsal votes. Five unfamiliar human sessions remain an external requirement. |
| S01 spatial camera travel | PASS | All fifteen nodes declare x/y/zoom/target compositions; browser automation passes unchanged-plate, busy/control lifecycle, multi-depth motion, near/far displacement ratio, and deterministic-settle assertions. |
| S02 zero target interference | PASS | Visual QA passes active-world-target/HUD separation across the supported viewport matrix and reduced-motion transition checks. |
| S03 physical choreography | PASS | Door, curtain, clue, breaker, and Warden-repel beats pass DOM/CSS contract and visual gates with reduced-motion text/state equivalents. |
| S05 consequence legibility | PASS | Persistent audience outcome, gameplay condition/item effect, and dashboard audience/next/recent fields pass required status-surface assertions. |
| S10 dynamic proof | PASS | Motion/consequence assertions and three clean end-to-end runs pass, replacing reliance on final-state screenshots alone. A public uncut capture remains required for submission proof. |

## Recorded RC6 automated evidence

- `npm run check`: **PASS**, 90 tests, 0 failures.
- `npm run qa:visual`: **PASS**, 29 scenarios including compact HUD, with 0 geometry/overflow/alpha/motion failures and 0 browser-console errors.
- `npm run qa:gameplay`: **PASS**, 9 campaign/UI gates, including dynamic camera travel, visible progression, exact item effects, checkpoint recovery, truthful zero-chat labeling, a fully earned humane-ending path, fallback recap, and three clean visible-guidance runs without fixtures or fallbacks.
- `npm run qa:integrity`: **PASS**, 5 browser truthfulness/privacy/single-controller gates with zero console errors.
- `npm run qa:relay`: **PASS**, 17 checks across independent Chrome processes/profiles with exact state sync, zero mirror publications/mutations, and clean teardown.
- `npm run qa:accessibility`: **PASS**, 11 keyboard-only, focus, accessibility-tree, computed-contrast, and 200%-zoom-equivalent reflow checks.
- `npm run qa:performance`: **PASS**, 10 cold-load, forced-GC heap/DOM/listener, relay-rate, campaign-exercise, network/console, and teardown checks; final heap delta 0.203 MiB, final DOM delta -223, final listener delta 0.
- Final all-in-one `npm run verify` composite: **PASS**, including the 12.0 MiB / 24-file release-audit stage. This is local RC6 evidence, not a public-deployment claim.
- Image conversion: **59.0%** reduction for the twelve referenced large source images; dimensions preserved, transparent alpha error 0, opaque-image PSNR remains above the documented floor, and the post-switch screenshot matrix passed.
- Twitch lifecycle tests: OAuth state/expiry, critical versus optional subscriptions, message-ID dedupe, seamless reconnect, and keepalive timeout all pass.
- Audio tests: no-autoplay gesture gate, captions while locked/muted, room ambience, adaptive score, four-bus routing, compressor fallback, stereo panning, action/item/audience/Warden/ending cues, reduced effects, startup failure, and cleanup all pass.

## Capability truth table

| Capability | Implemented | Automated/browser evidence | External/manual verification |
| --- | ---: | ---: | ---: |
| Cinematic title and handoff | yes | yes | final demo-video capture pending |
| Three camera nodes per act | yes | dynamic travel and node-specific reveal contracts passed | human comprehension test pending |
| Streamer investigation/deduction/survival | yes | yes | human pacing test pending |
| Physical isolation door and Warden phases | yes | yes | recorded play outcome pending |
| Five-act persistent campaign | yes | three clean visible-guidance browser runs passed without fixtures or fallbacks | five timed unfamiliar-human runs pending |
| Distinct endings and recap | yes | route/cause/decision/visual/audio contract passed | narrative review pending |
| Zero-chat recovery path | yes | yes | live rehearsal pending |
| Captioned procedural audio | yes | action-specific cues, adaptive score, buses, compression, panning, captions, and passive transport pass | real-browser listening/mix pass pending |
| Continuous five-minute rehearsal capture | workflow yes; artifact no | recorder/manifest failure contract validated | real Chrome share-tab/audio picker run pending |
| Transparent OBS route | yes | computed alpha at 1920×1080 and 1280×720 | actual OBS capture pending |
| Twitch OAuth/EventSub | yes | deterministic lifecycle tests | real broadcaster + second viewer pending |
| Public logged-out deployment | prior baseline yes; RC6 pending | prior production probe returned HTTP 200, byte-matched its core runtime assets, and reached gameplay, compact HUD, mixer, and caption state | promote RC6, repeat the stateless byte and browser probes, then prove the source repository and final video logged out |
| 20–35 minute campaign | target only | instrumentation refuses to claim measured duration | five unfamiliar-human runs required |

## Remaining release blockers

1. Register the exact production Twitch callback, then record broadcaster + second-viewer chat and channel-event proof.
2. Capture the transparent overlay inside real OBS at 1920×1080 and 1280×720.
3. Run the real Chrome **This Tab + Share tab audio** five-minute rehearsal capture; retain a passing manifest and do not treat workflow validation as the recording.
4. Run five unfamiliar newcomer playtests and report actual duration, help needed, comprehension, stuck points, route choice, and ending distribution.
5. Complete NVDA, actual-audio listening/mix, and a 30-minute native Chrome+OBS performance/memory check. Keyboard-only, computed contrast, 200% zoom-equivalent reflow, and headless performance gates pass.
6. Promote the reviewed RC6 payload and repeat the stateless anonymous byte probe plus production-browser smoke check; until then, keep the public Site labeled as the prior baseline.
7. Publish the exact repository commit and under-three-minute judging video, verify both logged out, and finish Devpost with the Codex session ID only after truth labels are current.

No document should describe the build as “first-place worthy,” live-Twitch verified, OBS verified, WCAG conformant, or a measured 20–35 minute experience until the matching evidence exists.
