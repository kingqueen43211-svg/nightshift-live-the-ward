# RC8 release gate

This is a truth boundary, not an evidence claim. The local capture-integrity, demo-evidence, test, syntax, and release-inventory gates are implemented. Passing them proves only what their retained reports and artifacts establish.

## Local code gates

- `npm test` runs the unit and contract suite.
- `npm run check` syntax-checks the runtime, QA, capture, and demo-evidence scripts, then runs the test suite.
- `npm run release:audit` requires the capture and demo validators, EDL, sidecar schema, builder, and evidence-assembly instructions in addition to the deployable payload.
- `npm run capture:proof -- --preflight` fails unless `CAPTURE_EXPECTED_COMMIT` is a full SHA matching a clean repository's `HEAD` and the source/runtime hashes reconcile.
- `npm run demo:evidence:validate -- <explicit validator arguments>` fails unless exact-commit rehearsal and external media, matching sidecars, ffprobe, plan, and report paths are supplied. It does not create or infer evidence.
- `docs/demo-video/build-demo.ps1` reserves every source/intermediate/report/output path before writes, rejects adversarial canonical collisions, pins promoted bytes to the verified staging SHA-256, and atomically restores a prior valid MP4 if promotion verification fails.

## External evidence gates

| Gate | Status | Required retained evidence |
| --- | --- | --- |
| Real Twitch with a separate viewer | **NOT VERIFIED** | Genuine command/event accepted once with visible world change and matching passive overlay. |
| Native OBS Browser Source | **NOT VERIFIED** | OBS setup, transparency, captions, correct sizing, and one clean audio path. |
| Human review at judging scale | **NOT VERIFIED** | Unfamiliar-person readability and reduced-motion review at half-scale playback. |
| NVDA screen-reader pass | **NOT VERIFIED** | Retained NVDA keyboard, focus, naming, and announcement results on the release build. |
| Final video | **NOT VERIFIED** | Exact-commit inputs, passing sidecars, assembled MP4 report, under-three-minute check, and logged-out public playback. |
| Public submission | **NOT VERIFIED** | Logged-out public repository/site links, public video, and completed submission form on the final release. |

A simulated rehearsal cannot satisfy the Twitch or OBS rows. Browser automation cannot satisfy the human or NVDA rows. A passing local assembly report cannot prove upload, public playback, or submission.

Promote only after committing the intended release, rerunning all local gates from a clean tree, capturing fresh exact-commit evidence, completing the external rows, and retaining the validator/build reports with the submitted artifacts.
