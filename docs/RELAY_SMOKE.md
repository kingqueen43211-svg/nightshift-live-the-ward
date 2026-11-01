# Cross-process OBS relay browser smoke

`scripts/relay-browser-smoke.mjs` is the automated local proof for the loopback SSE relay used by Chrome and an OBS Browser Source. It deliberately uses two different Chromium operating-system processes and two isolated browser profiles, so a passing result cannot be explained by `BroadcastChannel`, shared local storage, or one browser process reusing a tab.

## Run

From the repository root:

```powershell
node scripts/relay-browser-smoke.mjs
```

The script locates Chrome or Edge automatically. To select a Chromium executable or artifact directory:

```powershell
$env:QA_BROWSER = 'C:\path\to\chrome.exe'
$env:QA_RELAY_ARTIFACT_DIR = 'C:\absolute\relay-smoke-output'
node scripts/relay-browser-smoke.mjs
```

## What it proves

1. Starts the shipped `scripts/serve.mjs` on an unused loopback port.
2. Starts an authoritative controller at `?relay=local&autostart=rehearsal`.
3. Starts a passive mirror at `?role=mirror&relay=local` in a separate process and profile.
4. Confirms the controller POSTs valid state and the mirror opens the SSE endpoint.
5. Captures the exact EventSource payload in the mirror and compares full session ID, room index, and vote map with the controller's outbound state.
6. Sends a rehearsal chat vote, advances from Reception to Ward 06, and verifies both changes arrive and render in the mirror.
7. Stops the controller, moves the mirror's clock beyond the vote deadline, and verifies the passive copy neither resolves the vote nor POSTs any state.
8. Fails on browser exceptions, console errors or warnings, relay HTTP failures, process/profile reuse, state mismatch, or cleanup failure.

## Artifacts

The default artifact directory is `../../work/relay-browser-smoke` relative to the repository. Each run writes:

- `relay-browser-smoke-report.json` with assertion results, process/profile evidence, relay request counts, synchronized state, console capture, and server output;
- `mirror-synced-vote-1280x720.png` after the relayed vote renders;
- `mirror-passive-expired-vote-1280x720.png` after the passive-mutation check.

The harness exits `0` only when every assertion passes, `1` for a product or cleanup failure, and `2` when no supported browser is installed.

## Boundary

This gate exercises the same local HTTP/SSE path intended for an OBS Browser Source, but it is still headless Chromium. A final submission must also capture the URLs in the native OBS application and verify alpha, audio, and timing at the target canvas resolutions.
