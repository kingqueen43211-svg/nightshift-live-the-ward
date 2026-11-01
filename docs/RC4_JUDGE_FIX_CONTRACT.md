# RC4 judge-fix contract

Date: 2026-11-01

RC4 turns the latest judge-style review into observable product behavior and deterministic release gates. This document separates what the candidate implements locally from evidence that can only come from Twitch, OBS, assistive technology, unfamiliar people, or public submission services.

Status vocabulary:

- **VERIFIED LOCAL:** present in the RC4 source and passed in the recorded 2026-11-01 `npm run verify` composite.
- **EXTERNAL PROOF REQUIRED:** code or local automation cannot establish the claim.

## Judge findings converted into acceptance contracts

| ID | RC4 contract | Product behavior | Deterministic evidence | Status |
| --- | --- | --- | --- | --- |
| M01 | A first-time player can find the next required action without opening the control room. | The gameplay surface now has a persistent next-step panel for incomplete, audience-resolution, consequence, transition, and final-route phases. The gameplay and dashboard controls share one advance path. Ward 06 explicitly requires the corridor vote before the physical breach. | `tests/rc4-contract.test.mjs`; browser continuation and three clean guided campaigns in `scripts/gameplay-smoke.mjs`. | VERIFIED LOCAL |
| M02 | Every inventory use exposes a concrete benefit, and an item cannot be wasted when it would do nothing. | Item results report exact before/after health, fear, danger, shield, or Warden changes. No-op trauma kits, sedatives, stabilized kits, flares, and shields are retained. A persistent effect summary and condition strip remain visible after the toast. | Exact-delta and no-op-retention cases in `tests/campaign.test.mjs`; browser effect assertion in `scripts/gameplay-smoke.mjs`. | VERIFIED LOCAL |
| M03 | The earned ending is reachable through visible guidance, without fixtures or incomplete-room fallbacks. | Three isolated browser runs follow only visible gameplay controls, collect the authored clues, resolve audience consequences, complete the 2 · 1 · 3 breaker sequence, bind the Warden, and choose the roof route. The report records room timestamps, guidance, recap, and ending. | `three clean visible-guidance runs reach an earned ending without fixtures or fallbacks` in `scripts/gameplay-smoke.mjs`. | VERIFIED LOCAL; unfamiliar-human proof remains external |
| S01 | Camera changes read as spatial travel rather than image replacement. | All fifteen nodes have declared x/y/zoom/target compositions. Camera travel exposes from/to/moving state, marks the scene busy, disables the rail, moves near layers farther than far layers, and settles deterministically. | Dynamic camera lifecycle and parallax assertions in `scripts/gameplay-smoke.mjs`; composition contract in `tests/rc4-contract.test.mjs`. | VERIFIED LOCAL |
| S02 | The HUD does not cover the current world target at supported viewports. | The active door, clue, generator, Warden, or route target is measured against visible HUD regions. The caption toast sits beneath the top bar; phone layouts preserve vote commands and controls. | Target-intersection, clipping, overflow, scene-coverage, and reduced-motion checks in `scripts/visual-qa.mjs`. | VERIFIED LOCAL |
| S03 | High-value physical actions have readable staged reactions. | The isolation door exposes anticipation, bolt, swing, and settle beats; the curtain closes; clue beats highlight; three in-world breaker levers track state; Warden repel remains visible before retreat. Reduced-motion mode keeps the outcome and caption while removing travel. | DOM/CSS beat contract in `tests/rc4-contract.test.mjs`; browser visual fixtures in `scripts/visual-qa.mjs`. | VERIFIED LOCAL |
| S05 | Streamer and audience state is legible without inference. | The vote panel keeps a persistent audience outcome. The control room shows audience state, next required action, and latest event. The gameplay strip exposes fear, noise, shield, and the last item effect. | Required status-surface assertions in `tests/rc4-contract.test.mjs`; gameplay browser assertions. | VERIFIED LOCAL |
| S10 | The release proves motion and consequence dynamically, not with final-state screenshots alone. | Browser automation samples camera motion state, multi-depth displacement, control lockout, deterministic settle, exact item deltas, route gating, audience consequence, and three complete earned runs. | `npm run qa:gameplay`, `npm run qa:visual`, and the JSON reports they emit. | VERIFIED LOCAL |

## Recorded RC4 result

The complete `npm run verify` composite passed on 2026-11-01: 73/73 unit and contract tests, 28/28 visual states, 9/9 gameplay gates, 5/5 integrity gates, 17/17 relay gates, 11/11 accessibility/reflow gates, 10/10 performance gates, and a passing release audit at 11.6 MiB across 23 files. The performance run completed eight measured campaigns with a 0.192 MiB final heap delta, zero final DOM growth, and zero final listener growth.

This is local release-candidate evidence. It does not claim that RC4 has already been deployed publicly, and it does not satisfy any external proof row below.

## External proof that must not be simulated

These gates remain pending until the named evidence exists:

| Required proof | Minimum acceptable evidence | Current status |
| --- | --- | --- |
| Real Twitch | One broadcaster credential plus a separate viewer account, with a continuous capture from chat command to accepted vote, world consequence, dashboard event, and matching overlay. | EXTERNAL PROOF REQUIRED |
| Native OBS | Real Browser Source alpha at 1920×1080 and 1280×720, plus controller-to-mirror state sync in the OBS process. | EXTERNAL PROOF REQUIRED |
| Five unfamiliar humans | Five first-time, uncoached sessions with duration, first stuck point, help needed, route, ending, and comprehension notes. Automation is not a substitute. | EXTERNAL PROOF REQUIRED |
| NVDA | Keyboard and spoken-output pass through intro, gameplay, voting status, inventory, control room, and ending dialog. | EXTERNAL PROOF REQUIRED |
| Audible mix | Headphone/monitor recording check for every room, cue, mute state, reduced-effects state, captions, and OBS output. | EXTERNAL PROOF REQUIRED |
| Public repository | Logged-out access to the exact submitted commit, source, assets, license/provenance, and run instructions. | EXTERNAL PROOF REQUIRED |
| Public video | Logged-out YouTube playback of the final video, no more than three minutes, visibly truthful about Twitch mode. | EXTERNAL PROOF REQUIRED |
| Devpost submission | Saved entry containing repository URL, public video, project description, public demo, and Codex session ID before the deadline. | EXTERNAL PROOF REQUIRED |

## Release-candidate commands

Run the complete gate from the repository root:

```powershell
npm run verify
```

The local composite gate is complete. Public promotion still requires saving/deploying the exact candidate and repeating the logged-out probe; live-Twitch, native-OBS, NVDA, audio, human, repository, video, and Devpost claims require their separate evidence above.

