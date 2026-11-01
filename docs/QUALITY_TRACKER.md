# RC4 quality tracker

Status vocabulary: **PASS** only when the stated gate has objective evidence; **PARTIAL** when the implementation exists but a required manual or external proof is missing; **FAIL** for a reproduced blocker; **NOT TESTED** when no valid proof exists.

## Recorded RC4 quality gates

The complete RC4 `npm run verify` composite passed on 2026-11-01, followed by a successful public Sites promotion and anonymous HTTP/Chrome probe. External/manual gates remain separate.

| Gate | Status | Evidence / remaining proof |
| --- | --- | --- |
| S0 current-build inspection | PASS | Source, routes, public payload, browser console, 28 viewport/state captures, campaign/integrity/accessibility browser flows, an eight-cycle performance soak, and automated tests inspected. Final screenshots and machine-readable reports are indexed in [`evidence/RC4_EVIDENCE.md`](evidence/RC4_EVIDENCE.md). |
| S1 gold-standard corridor | PASS | Three authored camera compositions, independent depth layers, original curtain/gurney/door/Warden assets, linked multi-phase isolation door, staged threat poses, counterplay, reduced-motion behavior, and deterministic warning/open-door fixtures are implemented and visually reviewed. |
| S2 coherent 10–15 minute showcase section | PARTIAL | The five-act mechanics and director-safe fallbacks are playable end to end, but no uncut newcomer playtest has yet established a real 10–15 minute showcase duration or comprehension result. |
| S3 full campaign | PARTIAL | Five persistent acts, checkpoints, inventory crafting/use, prerequisites, distinct endings, fallback recovery, and structured recap pass automated and browser integration tests. A 20–35 minute duration remains a target, not a claim, until three human full runs are recorded. |
| S4 real Twitch + OBS | PARTIAL | OAuth/EventSub lifecycle and 17/17 separate-process relay gates pass, including exact state sync and a passive mirror. A public callback URL exists; broadcaster credentials, a second viewer, and native OBS alpha captures are still required. |
| S5 compositor-wide polish | PARTIAL | 28/28 visual gates, 9/9 browser gameplay gates, 5/5 browser integrity gates, 17/17 cross-process relay gates, 11/11 keyboard/contrast/reflow gates, 10/10 performance-soak gates, and 73/73 automated tests pass. NVDA, actual audio output, a native 30-minute Chrome+OBS soak, and native OBS remain manual gates. |
| S6 independent design review | PASS | Independent design and security/performance reviews are recorded. Their actionable local P1 findings were resolved; external Twitch/OBS/human proof remains explicitly open. |

## RC4 judge-fix gates

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

## Recorded automated evidence

- `npm run check`: **PASS**, 73 tests, 0 failures.
- `npm run qa:visual`: **PASS**, 28 scenarios, 0 geometry/overflow/alpha/motion failures, 0 browser-console errors.
- `npm run qa:gameplay`: **PASS**, 9 campaign/UI gates, including dynamic camera travel, visible progression, exact item effects, checkpoint recovery, truthful zero-chat labeling, a fully earned humane-ending path, fallback recap, and three clean visible-guidance runs without fixtures or fallbacks.
- `npm run qa:integrity`: **PASS**, 5 browser truthfulness/privacy/single-controller gates with zero console errors.
- `npm run qa:relay`: **PASS**, 17 checks across independent Chrome processes/profiles with exact state sync, zero mirror publications/mutations, and clean teardown.
- `npm run qa:accessibility`: **PASS**, 11 keyboard-only, focus, accessibility-tree, computed-contrast, and 200%-zoom-equivalent reflow checks.
- `npm run qa:performance`: **PASS**, 10 cold-load, forced-GC heap/DOM/listener, relay-rate, campaign-exercise, network/console, and teardown checks across eight measured campaign cycles; final heap delta 0.192 MiB, final DOM delta 0, final listener delta 0.
- `npm run release:audit`: **PASS**, static server, CSP/cache headers, routes, MIME handling, and traversal/missing-path behavior.
- Public `dist/` payload: **11.6 MiB** across 23 files.
- Image conversion: **57.0%** reduction for the eleven referenced large source images; dimensions preserved, transparent alpha error 0, and the post-switch screenshot matrix passed.
- Twitch lifecycle tests: OAuth state/expiry, critical versus optional subscriptions, message-ID dedupe, seamless reconnect, and keepalive timeout all pass.
- Audio tests: no-autoplay gesture gate, captions while locked/muted, room ambience, reduced-effects cues, routing, startup failure, and cleanup all pass.

## Capability truth table

| Capability | Implemented | Automated/browser evidence | External/manual verification |
| --- | ---: | ---: | ---: |
| Cinematic title and handoff | yes | yes | final demo-video capture pending |
| Three camera nodes per act | yes | dynamic travel contract passed | human comprehension test pending |
| Streamer investigation/deduction/survival | yes | yes | human pacing test pending |
| Physical isolation door and Warden phases | yes | yes | recorded play outcome pending |
| Five-act persistent campaign | yes | three clean visible-guidance browser runs passed without fixtures or fallbacks | five timed unfamiliar-human runs pending |
| Distinct endings and recap | yes | yes | narrative review pending |
| Zero-chat recovery path | yes | yes | live rehearsal pending |
| Captioned procedural audio | yes | module tests | real-browser listening/mix pass pending |
| Transparent OBS route | yes | computed alpha at 1920×1080 and 1280×720 | actual OBS capture pending |
| Twitch OAuth/EventSub | yes | deterministic lifecycle tests | real broadcaster + second viewer pending |
| Public logged-out deployment | yes | RC4 public Site returned anonymous HTTP 200 without login copy; deployed core modules/styles match verified code commit `3e655af`; real Chrome rendered the next-step/audience UI and settled a camera move | public repository and final video still require separate logged-out proof |
| 20–35 minute campaign | target only | instrumentation refuses to claim measured duration | three human runs required |

## Remaining release blockers

1. Register the exact production Twitch callback, then record broadcaster + second-viewer chat and channel-event proof.
2. Capture the transparent overlay inside real OBS at 1920×1080 and 1280×720.
3. Run five unfamiliar newcomer playtests and report actual duration, help needed, comprehension, stuck points, route choice, and ending distribution.
4. Complete NVDA, actual-audio mix, and a 30-minute native Chrome+OBS performance/memory check. Keyboard-only, computed contrast, 200% zoom-equivalent reflow, and the eight-cycle headless soak now pass.
5. Publish the exact repository commit and under-three-minute judging video, verify both logged out, and complete the Devpost entry with the Codex session ID only after the truth labels are current.

No document should describe the build as “first-place worthy,” live-Twitch verified, OBS verified, WCAG conformant, or a measured 20–35 minute experience until the matching evidence exists.
