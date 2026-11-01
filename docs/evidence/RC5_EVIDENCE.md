# RC5 evidence index

Date: 2026-11-01

This index separates recorded RC5 suite artifacts from proof that still needs a person, external account, native application, public service, or browser capture-picker choice.

## Recorded suite results

| Suite | Result | Primary local artifact |
| --- | ---: | --- |
| Unit and contract | 83/83 | Console result from `npm run check`; contracts include `tests/rc5-contract.test.mjs`. |
| Visual | 29/29 | [`rc5-visual-qa-report.json`](rc5-visual-qa-report.json) |
| Gameplay | 9/9 | [`rc5-gameplay-smoke-report.json`](rc5-gameplay-smoke-report.json) |
| Integrity | 5/5 | [`rc5-integrity-report.json`](rc5-integrity-report.json) |
| Independent-process relay | 17/17 | [`rc5-relay-report.json`](rc5-relay-report.json) |
| Accessibility/reflow | 11/11 | [`rc5-accessibility-report.json`](rc5-accessibility-report.json) |
| Performance | 10/10 | [`rc5-performance-report.json`](rc5-performance-report.json) |

The final composite performance result records final DOM delta 0, final listener delta 0, and final heap delta 0.285 MiB.

The final all-in-one `npm run verify` composite passed end to end, including the release-audit stage. RC5 was then deployed to the public Site and checked independently through anonymous HTTP and a production browser smoke run. This still is not proof of Twitch, native OBS, human playtesting, or submission completion.

## Visual artifacts

The full local `work/visual-qa/` directory contains the 29-scenario matrix. Portable high-value RC5 frames copied into this evidence directory are:

- [`rc5-gameplay-compact-1280x720.png`](rc5-gameplay-compact-1280x720.png) — user-controlled compact cinematic HUD;
- [`rc5-theatre-restraint-1280x720.png`](rc5-theatre-restraint-1280x720.png) — authored theatre-restraint choreography;
- [`rc5-ambulance-tunnel-1280x720.png`](rc5-ambulance-tunnel-1280x720.png) — distinct ambulance-tunnel finale route;
- [`rc5-earned-ending-1280x720.png`](rc5-earned-ending-1280x720.png) — earned humane ending with causal recap;
- [`rc5-dashboard-1280x720.png`](rc5-dashboard-1280x720.png) — broadcaster dashboard and audio controls.

Additional browser evidence:

- `work/gameplay-smoke/earned-ending-1280x720.png` — earned humane ending path;
- `work/gameplay-smoke/ending-recap-1280x720.png` — fallback-provenance path;
- `work/relay-browser-smoke/mirror-synced-vote-1280x720.png` — independent-process mirror state;
- `work/accessibility-browser-smoke/gameplay-200pct-640x360.png` and `dashboard-200pct-640x360.png` — 200%-zoom-equivalent reflow.

These are local QA artifacts outside the deployable `dist/` directory. They are not a substitute for the final public video or native OBS captures.

## What the contracts establish

The 83-test unit/contract run covers:

- action-specific physical cues, items, audience consequences, Warden phases, and ending resolutions;
- adaptive score room identity and restrained/rising/critical danger stages;
- effects, ambience, music, and master routing; compressor fallback; optional stereo panning; mute/volume; reduced effects; and cleanup;
- captions emitted while sound is locked/muted/unavailable and sanitized caption state transported to passive surfaces;
- silent, inert passive mirrors so only one controller produces capture audio;
- node-specific reveal rigs, theatre/finale choreography, route/cause/decision ending treatment, compact HUD, and the four-bus mixer;
- the five-minute capture workflow's real picker, watermark, minimum duration, clean-tree, audio/video, caption, earned-ending, zero-fallback, and truthful-failure requirements.

The 29-state visual report adds the compact HUD to the previous viewport, overlay, Warden, door, reduced-motion, and all-fifteen-camera matrix.

## Capture proof: intentionally still open

`work/capture-proof/` contains no completed RC5 audiovisual proof at the time of this index. That absence is intentional and truthful: browser security requires a person to approve the real capture picker.

The workflow is implemented and validated, but a complete artifact requires:

```powershell
node scripts/capture-proof.mjs --validate
node scripts/capture-proof.mjs
```

In the headed browser, the operator must click **Share this tab + audio and start**, choose **This Tab**, enable **Share tab audio**, and click **Share**. The run must then complete without interference.

Only a non-empty WebM plus a manifest marked `COMPLETE_REHEARSAL_PROOF` may be called the continuous rehearsal proof. The manifest must identify a clean committed source, both audio and video tracks, observed captions, a humane bound-Warden ending, zero fallbacks, the recording hash, and no chunk-order/browser error. A video-only, cancelled, interrupted, dirty-tree, or incomplete run is failed evidence.

The rehearsal watermark must remain visible:

```text
REHEARSAL PROOF · SIMULATED INPUT · NOT LIVE TWITCH
```

This five-minute artifact is separate from the public judging video, which must remain no more than three minutes.

## External evidence ledger

| Evidence | Current state |
| --- | --- |
| RC5 final all-in-one composite | Passed end to end, including release audit |
| RC5 public deployment and anonymous probe | Complete; HTTP 200, core runtime assets byte-match, and production browser smoke passed |
| Real Twitch broadcaster + second viewer | Pending |
| Native OBS alpha, caption, state, and single-audio-feed proof | Pending |
| Five unfamiliar-human sessions | Pending |
| NVDA spoken-output session | Pending |
| Human audible listening/mix review | Pending |
| Real Chrome five-minute tab-audio rehearsal capture | Pending |
| Logged-out public RC5 repository | Pending |
| Logged-out public ≤3-minute video | Pending |
| Completed Devpost entry | Pending |

No pending row should be closed from a screenshot, a contract test, a simulated rehearsal label, or documentation alone.
