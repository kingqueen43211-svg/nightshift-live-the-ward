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
- Busy Warden and opened-door fixtures at 1280×720.
- Dashboard at desktop and phone sizes.
- OBS overlay at 1920×1080 and 1280×720.
- Native `prefers-reduced-motion: reduce` behavior.
- Screenshot capture for every state, including the reduced-motion fixture.

For every viewport, the harness records:

- horizontal and vertical document overflow;
- intersections between mission, meters, journal, player-action, vote, and event zones;
- visible actionable controls outside the viewport;
- functional containers whose content is clipped;
- mode provenance (`SIMULATED`, `REHEARSAL`, or live);
- browser warnings and runtime exceptions.

The isolated browser profile has no Twitch credentials. Normal gameplay, dashboard, and overlay scenarios must therefore say `MODE: SIMULATED`; deterministic Warden and door fixtures must say `MODE: REHEARSAL`. Any unverified `LIVE TWITCH` claim fails the run. A real authenticated `LIVE TWITCH` check remains part of integration testing, not this local harness.

Overlay scenarios additionally verify that `html`, `body`, `#app`, and the overlay root all have transparent computed backgrounds. A normal browser screenshot with a dark background does not prove OBS alpha.

## Important limits

- Geometry checks catch collisions and clipping; they do not prove that a composition is beautiful. Review every screenshot manually.
- The harness cannot prove actual OBS rendering. Import the overlay into OBS and capture the checkerboard/background test at both required resolutions.
- Rehearsal fixtures prove deterministic UI states, not real Twitch connectivity.
- Font loading can differ when the external font provider is unavailable. Final builds should bundle licensed fonts locally.
- A passing reduced-motion check proves CSS timing suppression, not the usability of an entire reduced-motion playthrough.

## Manual review checklist after each run

1. Open every PNG in the artifact directory at 100% scale.
2. Check focal hierarchy, line wrapping, scene visibility, and whether the vote/player rails visually crowd the world even when rectangles do not intersect.
3. Inspect the Warden screenshot for readable warning/counterplay and correct occlusion.
4. Inspect the open-door screenshot for linked bolts, panel, light, shadow, reflection, and connected-room continuity.
5. Confirm dashboard forms remain understandable at phone width.
6. Test keyboard focus order, activation, Escape/pause, audio captions, and reduced-flash behavior manually.
7. Test the transparent overlay inside actual OBS.

Treat failures as release blockers or explicitly documented limitations. Do not weaken thresholds merely to make the command green.

## Baseline captured 2026-11-01

The latest checked run used Chrome 156.0.8078.79 / DevTools protocol 1.3. It completed all 13 gates with 8 passes and 5 failures, so `npm run qa:visual` correctly exited `1`. The JSON report and 13 PNGs were written to `work/visual-qa`; no generated artifact is committed.

Passing scenarios:

- Gameplay at 1920×1080, 1600×900, 1366×768, and 1280×720.
- Warden-warning and open-door rehearsal fixtures at 1280×720.
- Dashboard at 1280×720 and 390×844; controls below the fold are inside the dashboard's intentional scroll container.
- Every tested mode label matched its expected `SIMULATED` or `REHEARSAL` provenance, and the browser reported no warnings or runtime exceptions.

Release-blocking findings:

- At both 768×1024 and 390×844, `.meters` intersects `.vote-panel` by 145×95 pixels.
- At 390×844, `#eventToast` is only 36 pixels wide while its content needs 79 pixels, producing a visibly vertical, clipped message.
- At both overlay resolutions, `html`, `body`, and `#app` compute to `rgb(3, 7, 8)`. The overlay section itself is transparent, but the page root is opaque, so OBS alpha is not valid.
- With native reduced motion enabled, `.rain`, `.far-fog`, `.mid-fog`, and `.warden` retain animation durations of 1.8s, 8s, 14s, and 6s respectively.

All browser scenarios recorded zero horizontal overflow and a consistent one-pixel document-height delta, which is inside the harness tolerance. Re-run the matrix after any layout, root-background, or motion CSS fix and replace this baseline with the new result.
