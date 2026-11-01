# RC5 finalist-quality judge contract

Date: 2026-11-01

RC5 targets the difference between a functional interactive prototype and a broadcast-ready finalist presentation: authored sound tied to physical action, scene-specific visual reveals, a legible cinematic mode, causal endings, and a truthful long-form audiovisual evidence workflow.

Status vocabulary:

- **VERIFIED LOCAL:** the relevant RC5 unit, contract, browser, or visual suite passed.
- **WORKFLOW VALIDATED / OPERATOR RUN PENDING:** automation proves the workflow and its rejection rules, but a required human browser-picker step has not occurred.
- **EXTERNAL PROOF REQUIRED:** deterministic local automation cannot establish the claim.
- **VERIFIED COMPOSITE:** the final all-in-one RC5 command passed end to end, including the release-audit stage.

## Finalist-quality acceptance contracts

| ID | Contract | RC5 product behavior | Deterministic evidence | Status |
| --- | --- | --- | --- | --- |
| A01 | Sound identifies the action, not merely success/error. | Records, locker, reconstruction, Subject 06, gurney, intercom, isolation door, theatre route, lamps, tape, Warden counter, individual breakers, power reroute, containment, roof, and tunnel use distinct procedural sequences. Items, audience consequences, Warden phases, and endings have dedicated APIs; rejected actions/items still emit exact captions. | `tests/audio.test.mjs`; `premium audio APIs are wired to physical gameplay...` in `tests/rc5-contract.test.mjs`. | VERIFIED LOCAL; audible listening pending |
| A02 | The broadcast mix has controllable hierarchy and safe headroom. | Effects, ambience, music, and master buses have independent controls; master uses compressor fallback; optional stereo panning follows world/action direction; adaptive score follows room and danger through restrained/rising/critical states. | Audio bus/compressor/panner/score tests; mixer contract in `tests/rc5-contract.test.mjs`. | VERIFIED LOCAL; target-hardware mix pending |
| A03 | Every meaningful sound has synchronized visual equivalence. | Caption emission occurs before the audio-playability check. Sanitized `{cue,text,at}` state renders in gameplay and passive overlay caption rails and travels through validated public transport while locked, muted, or unavailable. | `tests/audio.test.mjs`, `tests/broadcast.test.mjs`, and RC5 caption-transport contract. | VERIFIED LOCAL; native OBS observation pending |
| A04 | One controller produces sound; mirrors cannot double it. | The authoritative controller owns Web Audio. Passive mirror/overlay views are inert, receive captions/state, and do not become competing sound controllers. | Integrity, relay, broadcast, and RC5 contract suites. | VERIFIED LOCAL; native OBS routing pending |
| V01 | Camera destinations reveal authored world information. | Records desk, medication locker, corridor restraint, service grid, lamp array, restraint table, roof exit, and ambulance tunnel have node-specific in-world rigs tied to the existing spatial camera compositions. | Node selectors and rigs in `tests/rc5-contract.test.mjs`; 29/29 visual matrix including all fifteen camera nodes. | VERIFIED LOCAL |
| V02 | Theatre and finale carry decisive choreography. | Surgical lamps ignite, confession tape engages, containment sigil seals, roof beacon opens toward dawn, and tunnel gate rises in response to their exact action beats. Reduced-motion mode preserves state/caption meaning. | RC5 scene-rig contract plus visual and reduced-motion gates. | VERIFIED LOCAL |
| V03 | The ending explains why it happened. | Route and cause badges, streamer decision trace, evidence/truth/Warden/audience/fallback recap, route/tone data, finale treatment, and ending-specific score distinguish humane, roof, tunnel, unresolved, and failure outcomes. | Ending contract in `tests/rc5-contract.test.mjs`; campaign/gameplay ending assertions. | VERIFIED LOCAL |
| U01 | The broadcast can reduce chrome without hiding agency. | The streamer can toggle a compact cinematic HUD. It preserves actionable controls and essential audience/condition/next-step feedback while hiding secondary production detail; the compact 1280×720 scenario passes geometry checks. | `gameplay-compact-1280x720` in `scripts/visual-qa.mjs`; RC5 compact-HUD contract. | VERIFIED LOCAL; human readability pending |
| U02 | Item and pacing feedback stays specific and truthful. | Item effects render as exact before→after chips and pulse the affected meter. Idle pacing guidance points to the real next step and explicitly remains rehearsal telemetry, never a fabricated campaign-duration claim. | RC4/RC5 contracts, gameplay smoke, campaign pacing assertion, and 29-state visual suite. | VERIFIED LOCAL; unfamiliar-human pacing pending |
| P01 | Long-form proof must be a real, continuous audiovisual rehearsal. | The headed-browser workflow uses `getDisplayMedia` and `MediaRecorder`, requires the operator's **This Tab + Share tab audio** choice, holds the rehearsal at least five minutes, watermarks simulated input, records manifest/hash/milestones/captions/ending, and rejects missing audio/video, dirty source, fallbacks, interrupted media, or an unearned ending. | `continuous proof recorder requires a real five-minute audio-video rehearsal` in `tests/rc5-contract.test.mjs`; validation mode in `scripts/capture-proof.mjs`. | WORKFLOW VALIDATED / OPERATOR RUN PENDING |

## Recorded suite results

- Unit and contract: **83/83**.
- Visual: **29/29**, including compact HUD.
- Gameplay: **9/9**.
- Integrity: **5/5**.
- Independent-process relay: **17/17**.
- Accessibility/reflow: **11/11**.
- Performance: **10/10**, with final DOM delta 0, listener delta 0, and heap delta 0.285 MiB.

The final all-in-one RC5 composite is **VERIFIED COMPOSITE**. It passed end to end, including the release-audit stage. RC5 is now deployed to the public Site; anonymous HTTP checks byte-match its core runtime assets and a production browser smoke run passed. That deployment evidence does not close the separate Twitch, OBS, human, repository, video, or Devpost gates.

## Capture truth boundary

The capture workflow has been implemented and syntax/contract validated. The capture artifact directory currently contains no completed proof file. RC5 must not claim a successful five-minute audiovisual rehearsal until a real operator:

1. runs the workflow from a clean committed RC5 tree;
2. clicks **Share this tab + audio and start**;
3. selects **This Tab** and enables **Share tab audio** in Chrome's picker;
4. allows the uninterrupted five-act run to finish;
5. receives a non-empty WebM and manifest marked `COMPLETE_REHEARSAL_PROOF`;
6. checks that the manifest records audio and video tracks, observed captions, `MARA WALKS INTO DAWN`, bound Warden, zero fallbacks, no browser/chunk error, and the exact source commit.

Even a passing rehearsal capture proves neither live Twitch nor native OBS.

## External proof that remains open

| Required proof | Minimum evidence | Status |
| --- | --- | --- |
| Real Twitch | Broadcaster credential plus separate viewer, with continuous command → accepted vote → world consequence → dashboard → overlay evidence. | EXTERNAL PROOF REQUIRED |
| Native OBS | Alpha at 1920×1080 and 1280×720, correct controller/mirror state, caption visibility, and intended single audio feed in OBS. | EXTERNAL PROOF REQUIRED |
| Five unfamiliar humans | Five uncoached first-time sessions with duration, help, first stuck point, route, ending, and comprehension notes. | EXTERNAL PROOF REQUIRED |
| NVDA | Keyboard and spoken-output pass through intro, game, item/status feedback, control room, and causal ending. | EXTERNAL PROOF REQUIRED |
| Audible listening | Human review of every room, action family, score stage, Warden state, item, audience consequence, ending, bus control, mute, and reduced-effects path in Chrome and OBS. | EXTERNAL PROOF REQUIRED |
| Public repository/video/Devpost | Exact RC5 source available logged out; public ≤3-minute video; saved Devpost entry with demo, repo, video, description, and Codex session ID. | EXTERNAL PROOF REQUIRED |

Do not describe RC5 as first-place worthy, live-Twitch verified, OBS verified, audibly verified, newcomer proven, NVDA conformant, publicly deployed, or submission complete until the corresponding evidence exists.
