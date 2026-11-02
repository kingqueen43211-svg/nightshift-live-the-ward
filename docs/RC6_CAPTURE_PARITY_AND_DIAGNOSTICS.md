# RC6 capture parity and browser-diagnostic classification

This note reconciles the five-minute rehearsal manifest at capture commit
`20f949f567e0c276b76f4b54184ac6eb3097fbf8` with the submitted v11 source
commit `3f342aa39f304b503dae47f57f77aa2986133daf`.

## Runtime parity

- The two commits have the same `dist/` Git tree:
  `f83bb3432d6408939e9485ab6c2d63fa13f6ef64`.
- Their `docs/` trees are also identical:
  `21d32b147acb5f27adb615a4a6bfba78c510daf9`.
- `git diff 20f949f..3f342aa -- dist` is empty. Every recorded game runtime
  file, font, environment plate, foreground, and RC6 ending asset is
  byte-identical between the capture and v11 source.
- Only two source paths differ: `scripts/capture-proof.mjs` and
  `tests/rc5-contract.test.mjs`. The capture branch temporarily enabled
  Chrome's test-only single-tab auto-selection switch. The v11 branch removes
  that automation hook and adds contract assertions for the hidden recorder
  prompt and timer-resolved final vote. It does not change the game being
  recorded.

The manifest's commit mismatch is therefore real and must remain disclosed,
but it is a **capture-harness/test mismatch, not a deployed-game mismatch**.
A new capture should still use the exact final post-fix commit so the evidence
does not require this explanation.

## Historical 404 classification

The schema-v1 manifest stored only Chrome's generic `Failed to load resource`
text, so it cannot retroactively prove a URL. The same app/server revision has
repeatable browser reports in `docs/evidence/rc4-relay-report.json` and
`docs/evidence/rc5-relay-report.json`; in both, the only ignored 404 is
`/favicon.ico`. The page previously declared no icon, and no gameplay asset
request is missing from the successful browser matrices. That makes the two
capture 404s reproducibly attributable to the optional browser icon with high
confidence, but this is a classification based on corroborating evidence—not a
claim that the old manifest preserved data it did not.

RC7 adds a local `dist/favicon.svg` and explicit icon link, eliminating that
browser-chrome request. Capture schema v3 attaches CDP diagnostics before the
app navigation, then records exact URL, method, resource type, status, request
ID, and a narrow classification for every future failed resource. Only a
same-origin `GET /favicon.ico` returning 404 as an `Other`/`Image` resource is
eligible for that historical optional-icon classification. Any other failure
blocks `COMPLETE_REHEARSAL_PROOF` until reviewed.

## Permissions Policy classification

Both the local server and deploy headers intentionally send:

`Permissions-Policy: camera=(), microphone=(), geolocation=()`

NightShift contains no `getUserMedia` call. Its proof recorder uses
`navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` to
capture the selected browser tab. The accepted manifest independently verifies
one display-video track and one tab-audio track. Chrome's camera/microphone
policy messages therefore describe deliberately denied device access, not a
failure of tab capture or a missing game capability.

Schema v3 preserves those messages and classifies only an exact Chrome
camera/microphone policy violation entry as
`EXPECTED_MEDIA_PERMISSION_DENIAL`. All other browser warnings remain
unclassified and prevent a complete proof status.

Schema v3 also measures the real shared display stream during a dedicated
25-second humane-ending window. A present audio track or a scheduled Web Audio
node is not sufficient: complete status requires analyser sample coverage,
non-silent sample ratio, RMS, and peak thresholds from the captured stream.
That detects the historical digital-zero tail while leaving audible mix,
stereo separation, and headphone quality as explicit human-review gates.

## Verification commands

```text
git diff --name-status 20f949f..3f342aa
git rev-parse 20f949f:dist
git rev-parse 3f342aa:dist
git diff --quiet 20f949f 3f342aa -- dist
npm run capture:proof -- --validate
npm test
```

