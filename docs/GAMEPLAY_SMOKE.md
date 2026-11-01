# Browser gameplay smoke gate

Run the deterministic browser-level campaign gate with:

```powershell
npm run qa:gameplay
```

The script serves `dist/` from an isolated local server, launches installed Chrome or Edge through the DevTools protocol, and drives the actual browser UI. It does not reach into the engine module or substitute engine-unit tests for user-visible behavior.

The gate verifies:

- a focused streamer action keeps the same DOM identity across multiple one-second render ticks;
- selecting a camera node changes scene composition, its purpose cue, and exactly one `aria-pressed` camera control;
- attempting a locked action reports the prerequisite without marking the action complete or advancing semantic objective progress;
- a Twitch-style vote can create a craftable inventory pair, which the UI can craft and consume;
- the production checkpoint control restores room-entry evidence and inventory state;
- a vote with no chat participation is disclosed as `DIRECTOR FALLBACK` in both gameplay and the OBS overlay;
- a complete five-act fallback run reaches a visible, focused ending dialog with route and fallback provenance;
- the browser reports no runtime warnings or errors.

Artifacts are written outside the release directory to `work/gameplay-smoke/` by default:

- `gameplay-smoke-report.json` contains every assertion, duration, and failure;
- `ending-recap-1280x720.png` captures the final recap state.

Override the output directory or browser executable when needed:

```powershell
$env:QA_GAMEPLAY_ARTIFACT_DIR = 'C:\absolute\qa-output'
$env:QA_BROWSER = 'C:\path\to\chrome.exe'
npm run qa:gameplay
```

Exit codes are `0` for all gates passing, `1` for a reproduced gameplay failure, and `2` for harness/browser infrastructure failure. A failing assertion should be treated as an application defect; do not relax it to match broken behavior.

This smoke gate does not replace a real broadcaster/viewer Twitch test, a human pacing playtest, screen-reader verification, or OBS capture.
