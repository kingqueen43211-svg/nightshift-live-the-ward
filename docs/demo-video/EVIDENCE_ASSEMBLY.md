# Truth-gated 2:52 demo assembly

`build-demo.ps1` does not infer proof from a filename. It refuses to assemble or publish the final MP4 until every source has media tracks, enough duration, an exact artifact hash, the exact reviewed commit, and the evidence required by `demo-edl.json`.

## Required tools

- Node.js 20+
- `ffmpeg` with H.264, AAC, `drawtext`, `loudnorm`, and concat support
- `ffprobe`

Pass explicit `-FfmpegPath` and `-FfprobePath` values when they are not on `PATH`.

## Final rehearsal proof

The `-FinalProofManifest` must be the schema-v3 JSON written by `scripts/capture-proof.mjs`. Validation requires all of the following:

- `COMPLETE_REHEARSAL_PROOF`, no failure record, exact clean release commit, and successful initial/final Git source/runtime-tree reconciliation;
- matching non-zero WebM filename, byte count, and SHA-256;
- browser-tab video and audio tracks;
- humane ending, captions, zero director fallbacks, and no unresolved diagnostics;
- at least 25 seconds of captured-stream ending telemetry with the configured non-silence and terminal-continuity gates;
- all schema-v3 acceptance flags true.

The edit positions are resolved from named capture milestones. Fixed timestamps from the historical RC6 rehearsal are no longer accepted.

## External evidence sidecars

Each external MP4 needs a JSON sidecar conforming to `evidence-sidecar.schema.json`. A sidecar is a retained human verification record, not something the assembler invents. It must identify the exact source commit and the media file's exact name, byte count, SHA-256, and ffprobe duration.

The EDL owns the boolean assertions required for each source:

- `real-twitch`: genuine live Twitch, separate viewer, no simulation, one authoritative acceptance, visible world change, matching passive overlay;
- `native-obs`: real OBS Studio Browser Source, visible source setup, transparency, captions, correct sizing, one clean audio path;
- `codex-bts`: actual Codex session, exact commit, current verification visible;
- `accessibility-human-qa`: retained human review at half scale with readable captions and reduced-motion demonstration;
- `closing-card`: live URL and repository checked logged out, Codex session ID visible, submission wording truthful.

Do not set a boolean to `true` until the retained clip visibly establishes it. The validator checks the sidecar against the actual media hash and fails on a false, missing, stale, or wrong-commit record.

## Sidecar example

```json
{
  "schemaVersion": 1,
  "kind": "NIGHTSHIFT_EXTERNAL_EVIDENCE",
  "sourceId": "real-twitch",
  "status": "VERIFIED_EVIDENCE",
  "verifiedAt": "2026-11-02T12:00:00Z",
  "verifiedBy": "operator",
  "source": { "commit": "FULL_40_CHARACTER_COMMIT" },
  "artifact": {
    "fileName": "real-twitch.mp4",
    "bytes": 1,
    "sha256": "64_LOWERCASE_HEX_CHARACTERS",
    "durationSeconds": 24
  },
  "assertions": {
    "liveTwitch": false,
    "separateViewer": false,
    "notSimulated": false,
    "authoritativeInputAcceptedOnce": false,
    "worldChangeVisible": false,
    "passiveOverlayMatched": false
  },
  "notes": ["Template only. Replace measured fields and verify each assertion after capture."]
}
```

The deliberately false template cannot pass validation.

## Validate without rendering

Run the normal command with `-ValidateOnly`. It writes `build/assembly-plan.json` and `build/assembly-preflight.evidence.json` only after all input gates pass.

## Render and verify

The assembler:

1. validates all sources and sidecars;
2. builds every cut from the EDL-generated plan;
3. burns the source truth label into every segment;
4. normalizes to 1920×1080, 30 fps, stereo 48 kHz H.264/AAC;
5. binds the render to the exact preflight plan and evidence-set hashes, so a changed EDL, manifest, sidecar, or source cannot be promoted mid-build;
6. rejects any resolved-path collision among sources, sidecars, the EDL, validator, plan, preflight/prepublish/final reports, staging file, and final output before preflight writes anything;
7. assembles to an `.unverified.mp4` staging file;
8. ffprobes the staging result and enforces MP4, H.264, yuv420p, AAC, stereo 48 kHz, the 172-second target, and the 180-second ceiling;
9. decodes float PCM from both the 25-second humane-ending window and the final 25 seconds, rejecting digital zero, more than one terminal second of silence, poor sample coverage, non-finite samples, or sample clipping;
10. promotes it to the requested output only after it passes;
11. repeats the media and decoded-audio checks after promotion and writes the final evidence report with the plan, evidence-set, source, manifest, output, and audio-analysis facts.

The decoded-audio gate proves digital continuity, not perceived mix quality. Headphone and speaker listening, stereo-image and balance review, YouTube transcode review, logged-out YouTube playback, and Devpost submission remain external actions. `ASSEMBLY_VERIFIED` does not claim those actions occurred.
