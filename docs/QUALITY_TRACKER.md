# V3 quality tracker

Status vocabulary: **PASS** only when the stated gate has objective evidence; **PARTIAL** when the implementation exists but a required manual or external proof is missing; **FAIL** for a reproduced blocker; **NOT TESTED** when no valid proof exists.

## Quality gates

| Gate | Status | Evidence / remaining proof |
| --- | --- | --- |
| S0 current-build inspection | PASS | Source, routes, public payload, browser console, 28 viewport/state captures, campaign/integrity/accessibility browser flows, an eight-cycle performance soak, and automated tests inspected. Reports live under `work/visual-qa`, `work/gameplay-smoke`, `work/integrity-browser-smoke`, `work/accessibility-browser-smoke`, `work/performance-soak`, and `work/image-optimization`. |
| S1 gold-standard corridor | PASS | Three authored camera compositions, independent depth layers, original curtain/gurney/door/Warden assets, linked multi-phase isolation door, staged threat poses, counterplay, reduced-motion behavior, and deterministic warning/open-door fixtures are implemented and visually reviewed. |
| S2 coherent 10–15 minute showcase section | PARTIAL | The five-act mechanics and director-safe fallbacks are playable end to end, but no uncut newcomer playtest has yet established a real 10–15 minute showcase duration or comprehension result. |
| S3 full campaign | PARTIAL | Five persistent acts, checkpoints, inventory crafting/use, prerequisites, distinct endings, fallback recovery, and structured recap pass automated and browser integration tests. A 20–35 minute duration remains a target, not a claim, until three human full runs are recorded. |
| S4 real Twitch + OBS | PARTIAL | OAuth/EventSub lifecycle and 16/16 separate-process relay gates pass, including exact state sync and a passive mirror. Broadcaster credentials, a second viewer, a public callback URL, and native OBS alpha captures are still required. |
| S5 compositor-wide polish | PARTIAL | 28/28 visual gates, 8/8 browser gameplay gates, 5/5 browser integrity gates, 16/16 cross-process relay gates, 11/11 keyboard/contrast/reflow gates, 10/10 performance-soak gates, and 64/64 automated tests pass. NVDA, actual audio output, a native 30-minute Chrome+OBS soak, and native OBS remain manual gates. |
| S6 independent design review | PASS | Independent design and security/performance reviews are recorded. Their actionable local P1 findings were resolved; external Twitch/OBS/human proof remains explicitly open. |

## Automated evidence

- `npm run check`: **PASS**, 64 tests, 0 failures.
- `npm run qa:visual`: **PASS**, 28 scenarios, 0 geometry/overflow/alpha/motion failures, 0 browser-console errors.
- `npm run qa:gameplay`: **PASS**, 8 campaign/UI gates, including focus persistence, camera ARIA/composition, rejected-action integrity, inventory craft/use, checkpoint recovery, truthful zero-chat labeling, a fully earned humane-ending path, and fallback recap.
- `npm run qa:integrity`: **PASS**, 5 browser truthfulness/privacy/single-controller gates with zero console errors.
- `npm run qa:relay`: **PASS**, 16 checks across independent Chrome processes/profiles with exact state sync, zero mirror publications/mutations, and clean teardown.
- `npm run qa:accessibility`: **PASS**, 11 keyboard-only, focus, accessibility-tree, computed-contrast, and 200%-zoom-equivalent reflow checks.
- `npm run qa:performance`: **PASS**, 10 cold-load, forced-GC heap/DOM/listener, relay-rate, campaign-exercise, network/console, and teardown checks across eight measured campaign cycles.
- `npm run release:audit`: **PASS**, static server, CSP/cache headers, routes, MIME handling, and traversal/missing-path behavior.
- Public `dist/` payload: **11.6 MiB** across 23 files.
- Image conversion: **57.0%** reduction for the eleven referenced large source images; dimensions preserved, transparent alpha error 0, and the post-switch screenshot matrix passed.
- Twitch lifecycle tests: OAuth state/expiry, critical versus optional subscriptions, message-ID dedupe, seamless reconnect, and keepalive timeout all pass.
- Audio tests: no-autoplay gesture gate, captions while locked/muted, room ambience, reduced-effects cues, routing, startup failure, and cleanup all pass.

## Capability truth table

| Capability | Implemented | Automated/browser evidence | External/manual verification |
| --- | ---: | ---: | ---: |
| Cinematic title and handoff | yes | yes | final demo-video capture pending |
| Three camera nodes per act | yes | yes | human comprehension test pending |
| Streamer investigation/deduction/survival | yes | yes | human pacing test pending |
| Physical isolation door and Warden phases | yes | yes | recorded play outcome pending |
| Five-act persistent campaign | yes | yes | three timed human runs pending |
| Distinct endings and recap | yes | yes | narrative review pending |
| Zero-chat recovery path | yes | yes | live rehearsal pending |
| Captioned procedural audio | yes | module tests | real-browser listening/mix pass pending |
| Transparent OBS route | yes | computed alpha at 1920×1080 and 1280×720 | actual OBS capture pending |
| Twitch OAuth/EventSub | yes | deterministic lifecycle tests | real broadcaster + second viewer pending |
| Public logged-out deployment | configuration ready | local release audit | public HTTPS URL pending |
| 20–35 minute campaign | target only | instrumentation refuses to claim measured duration | three human runs required |

## Remaining release blockers

1. Deploy `dist/` to a logged-out public HTTPS URL and run the clean-browser gate.
2. Register the exact production Twitch callback, then record broadcaster + second-viewer chat and channel-event proof.
3. Capture the transparent overlay inside real OBS at 1920×1080 and 1280×720.
4. Run three newcomer playtests and report actual duration, comprehension, stuck points, and ending distribution.
5. Complete NVDA, actual-audio mix, and a 30-minute native Chrome+OBS performance/memory check. Keyboard-only, computed contrast, 200% zoom-equivalent reflow, and the eight-cycle headless soak now pass.
6. Record and publish the under-three-minute judging video only after the above truth labels are current.

No document should describe the build as “first-place worthy,” live-Twitch verified, OBS verified, WCAG conformant, or a measured 20–35 minute experience until the matching evidence exists.
