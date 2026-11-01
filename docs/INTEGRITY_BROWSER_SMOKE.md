# Integrity browser smoke

This focused Chromium smoke test protects NightShift’s audience-source truthfulness, OBS transport privacy, and single-controller behavior.

Run it from the repository root:

```powershell
node scripts/integrity-browser-smoke.mjs
```

The harness starts an isolated local server and a temporary headless Chrome or Edge profile. Set `QA_BROWSER` to an alternate Chromium executable when neither default Windows path is available.

It verifies five browser-visible guarantees:

1. The header reports votes this round instead of a fabricated viewer count, and rehearsal input is explicitly labelled as simulated.
2. Twitch authorization, connection, reconnection, expiration, and error phases never enable the simulated audience generator.
3. With **Hide viewer names** enabled, the OBS payload contains no rehearsal username, voter map, faction-member map, EventSub IDs, or recursive checkpoint.
4. An OBS overlay initializes without the cinematic intro and consumes controller messages without echoing them back.
5. The browser console has no warnings, resource errors, or uncaught runtime errors.

The JSON report is written to:

```text
../../work/integrity-browser-smoke/integrity-browser-smoke-report.json
```

Override that destination with `QA_INTEGRITY_ARTIFACT_DIR`.

Exit codes are deterministic:

- `0`: every integrity check passed and the temporary profile was removed.
- `1`: the browser ran, but one or more product assertions failed.
- `2`: the harness, browser startup, local server, or cleanup failed.

This smoke test is deliberately narrower than the full gameplay and visual suites. It does not prove live Twitch credentials, real EventSub delivery, OBS capture quality, public HTTPS deployment, or multiplayer timing; those require the documented external verification run.
