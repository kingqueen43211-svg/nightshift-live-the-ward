# Visual and responsive QA runbook

The project includes a dependency-free Chromium QA harness at `scripts/visual-qa.mjs`. It serves `dist/` from an isolated local HTTP server, launches an installed Chrome or Edge headlessly, drives the page through Chrome DevTools Protocol, captures screenshots, and writes a machine-readable report.

## Run

```powershell
npm run qa:visual
```

The script automatically finds Chrome or Edge on Windows. To select another Chromium executable:

```powershell
$env:QA_BROWSER = 'C:\path\to\chrome.exe'
npm run qa:visual
```

Artifacts default to `../../work/visual-qa` relative to the project. Override without adding generated screenshots to the repository:

```powershell
$env:QA_ARTIFACT_DIR = 'C:\absolute\qa-output'
npm run qa:visual
```

Exit codes:

- `0`: every automated gate passed.
- `1`: browser ran successfully, but one or more quality gates failed.
- `2`: harness or browser startup failure.

## Covered scenarios

- Gameplay at 1920×1080, 1600×900, 1366×768, 1280×720, 768×1024, and 390×844.
- A 1280×720 gameplay frame physically encoded at 50% scale as a 640×360 PNG, with computed type-size and clipping checks for the objective, next step, resources, conditions, streamer actions, vote labels/percentages, consequence detail, and sound caption.
- Busy Warden and opened-door fixtures at 1280×720.
- All 15 authored camera compositions at 1280×720.
- Dashboard at desktop and phone sizes.
- OBS overlay at 1920×1080 and 1280×720.
- Native `prefers-reduced-motion: reduce` behavior, including separately rendered stationary final states for containment, roof-dawn, and ambulance-tunnel completion.
- Screenshot capture for every state, including the reduced-motion fixture.

For every viewport, the harness records:

- horizontal and vertical document overflow;
- intersections between mission, meters, journal, player-action, vote, and event zones;
- visible actionable controls outside the viewport;
- functional containers whose content is clipped;
- mode provenance (`SIMULATED`, `REHEARSAL`, or live);
- browser warnings and runtime exceptions.

The half-scale scenario is not a filename-only proxy. Chromium renders the 1280×720 game, `Page.captureScreenshot` encodes it with a `0.5` clip scale, and the harness reads the PNG header back to require a real 640×360 output. The JSON report records both CSS-pixel and scaled-output font sizes for every critical text target and fails on a missing target, a target below its declared floor, or clipped content.

The isolated browser profile has no Twitch credentials. Normal gameplay, dashboard, and overlay scenarios must therefore say `MODE: SIMULATED`; deterministic Warden and door fixtures must say `MODE: REHEARSAL`. Any unverified `LIVE TWITCH` claim fails the run. A real authenticated `LIVE TWITCH` check remains part of integration testing, not this local harness.

Overlay scenarios additionally verify that `html`, `body`, `#app`, and the overlay root all have transparent computed backgrounds. A normal browser screenshot with a dark background does not prove OBS alpha.

## Important limits

- Geometry checks catch collisions and clipping; they do not prove that a composition is beautiful. Review every screenshot manually.
- The 640×360 gate proves encoded dimensions plus deterministic type/clipping floors. It does **not** prove that every human can comfortably read a compressed Twitch stream; perform a logged-out player review at native and half size with unfamiliar viewers before making a human-readability claim.
- The harness cannot prove actual OBS rendering. Import the overlay into OBS and capture the checkerboard/background test at both required resolutions.
- Rehearsal fixtures prove deterministic UI states, not real Twitch connectivity.
- Font loading can differ when the external font provider is unavailable. Final builds should bundle licensed fonts locally.
- A passing reduced-motion check proves CSS timing suppression, not the usability of an entire reduced-motion playthrough.
- The reduced-motion route check forces the same `:complete` beats emitted by the controller, captures each final state, and verifies its visible static signature; it does not simulate the full prerequisite path to those endings.

## Manual review checklist after each run

1. Open every PNG in the artifact directory at 100% scale.
2. Check focal hierarchy, line wrapping, scene visibility, and whether the vote/player rails visually crowd the world even when rectangles do not intersect.
3. Inspect the Warden screenshot for readable warning/counterplay and correct occlusion.
4. Inspect the open-door screenshot for linked bolts, panel, light, shadow, reflection, and connected-room continuity.
5. Confirm dashboard forms remain understandable at phone width.
6. Test keyboard focus order, activation, Escape/pause, audio captions, and reduced-flash behavior manually.
7. Test the transparent overlay inside actual OBS.

Treat failures as release blockers or explicitly documented limitations. Do not weaken thresholds merely to make the command green.

## Current baseline

The release baseline is the machine-readable report written by the latest `npm run qa:visual` invocation. It includes the responsive gameplay/dashboard/overlay matrix, Warden and door fixtures, every authored camera composition, reduced-motion timing, mode provenance, and browser-console capture. Generated screenshots and the JSON report live under `work/visual-qa` and are not committed.

The current pass/fail totals are copied into `docs/QUALITY_TRACKER.md` only after the command completes successfully. Treat any mismatch between that tracker and the newest JSON report as stale documentation, not as a reason to weaken the gate.
