# Continuous rehearsal proof capture

`scripts/capture-proof.mjs` creates one uninterrupted WebM of a deliberately paced five-act NightShift rehearsal. The browser capture includes the game tab, its Web Audio output when Chrome supplies an audio track, and the visible in-game sound captions.

The workflow is intentionally recorder-assisted. Browsers require a real user gesture and a capture-picker choice before `getDisplayMedia()` can share a tab. The script does not bypass that control or claim success when the operator cancels it.

## Run it

From the repository root:

```powershell
node scripts/capture-proof.mjs --validate
node scripts/capture-proof.mjs
```

The optional `--validate` pass compiles both the Node script and its injected browser recorder payload without opening Chrome.

The script opens an isolated, headed Chrome or Edge window. In that window:

1. Click **Share this tab + audio and start**.
2. In the browser picker, select **This Tab** and choose the NightShift tab.
3. Keep **Share tab audio** enabled.
4. Click **Share**.

After Chrome confirms capture, the script starts the episode through the real Enter control and drives the visible UI through Reception, Ward 06, the Operating Theatre, the Generator Room, and the exits. It uses only visibly labelled rehearsal chat input, exercises camera travel and physical scene beats, earns `MARA WALKS INTO DAWN`, holds the ending on screen, and then finalizes the recorder.

Do not interact with the game while the scripted run is in progress. Stopping browser sharing early produces an incomplete manifest rather than a false pass.

## Artifacts

The default output directory is:

```text
../../work/capture-proof
```

relative to the repository root. Each run uses a unique timestamped base name and may create:

- one uninterrupted `.webm` recording;
- a machine-readable `.json` manifest;
- an opening screenshot;
- an earned-ending screenshot.

The manifest records the source commit and worktree state, media type, audio/video track counts, byte count, SHA-256 hash, milestones, accepted rehearsal inputs, ending recap, observed sound captions, browser errors, and acceptance results. The status is `COMPLETE_REHEARSAL_PROOF` only when the source is a clean committed tree, the file is non-empty, Chrome supplied a tab-audio track, caption events were observed, the humane ending was earned with zero director fallbacks, and no chunk-order error occurred.

Useful optional environment variables:

```powershell
$env:CAPTURE_BROWSER = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:CAPTURE_PROOF_DIR = "C:\absolute\output\directory"
$env:CAPTURE_STEP_MS = "1400"
$env:CAPTURE_SCENE_HOLD_MS = "24000"
$env:CAPTURE_MINIMUM_MS = "300000"
$env:CAPTURE_FINAL_HOLD_MS = "4000"
$env:CAPTURE_OPERATOR_TIMEOUT_MS = "300000"
node scripts/capture-proof.mjs
```

`CAPTURE_STEP_MS` is clamped to at least 350 ms. Each selected camera composition is held for 24 seconds by default, below the product's 25-second unintended-idle threshold. The recorder runs for at least five minutes by default so the proof is not a rapid test replay. Rehearsal votes are visibly entered at the beginning of each act, before those cinematic holds, so their 30-second windows remain truthful. `CAPTURE_MINIMUM_MS` is clamped to at least 60 seconds when a shorter engineering check is explicitly needed.

The five-minute proof file is separate from the edited public judging video, which must remain within the submission's three-minute limit.

## Truth and limitations

The video carries a persistent watermark:

```text
REHEARSAL PROOF · SIMULATED INPUT · NOT LIVE TWITCH
```

This workflow proves only that the local build can present one continuous, captioned, audiovisual rehearsal through its authored five-act route. It does **not** prove:

- Twitch OAuth or EventSub interoperability;
- a command from a separate real viewer account;
- native OBS transparency, audio routing, or cross-process rendering;
- first-time human discoverability or pacing;
- NVDA output.

Those claims still require the separate Twitch, OBS, unfamiliar-player, audible-mix, and screen-reader evidence described by the release contract.

Chrome can return a video-only stream if the operator leaves **Share tab audio** off or selects a surface that cannot supply audio. The script records that fact as `tabAudioTrackPresent: false`, writes an incomplete manifest, and exits nonzero. A video-only file must not be presented as audio proof.

Likewise, an automated rehearsal is not an unfamiliar-human playtest. Its deliberately paced timing must not be reported as measured campaign duration.
