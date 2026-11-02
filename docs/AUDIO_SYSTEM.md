# RC8 procedural audio, score, captions, and capture

`dist/audio.mjs` supplies NightShift Live's production audio without downloaded sound files, external services, or autoplay. Physical actions, items, audience consequences, Warden phases, room ambience, transitions, adaptive score, and endings each have an authored procedural cue and an exact caption. RC8 retains persistent caption presentation preferences and optional speaker/directional metadata without changing campaign authority, and its demo validator decodes final-output audio windows instead of trusting a declared track alone.

Audio remains separate from campaign authority. If Web Audio is locked, unavailable, muted, or reduced, the action still completes and its caption still emits.

## Signal path

```text
action / item / audience / Warden effects ──> effects ──┐
five room-tone generators ─────────────────> ambience ──┼─> master ─> compressor ─> destination
adaptive room score + ending resolution ───> music ────┘
```

- `master`, `effects`, `ambience`, and `music` have independent gain and mute state.
- The master path uses a dynamics compressor when the browser supplies one: threshold −18 dB, knee 12, ratio 8:1, 3 ms attack, and 250 ms release. It falls back safely to the destination without changing gameplay.
- Directional actions use `StereoPannerNode` when available. Desk/lamp/breaker-one cues lean left; locker/route/breaker-three cues lean right; Warden phases accept their world direction; Guardian and Chaos consequences separate slightly across the field.
- The control room exposes Master, Effects, Ambience, and Adaptive score sliders plus mute and a gesture-gated calibration button.

## Authored sound vocabulary

`playAction()` schedules action-specific layers rather than one shared click. The cue map covers records and paper handling, medication-locker latch and door, file reconstruction, Subject 06 identification, gurney restraints, intercom cadence, isolation latch/bolts/steel scrape, theatre release, surgical lamp ignition, confession tape, Warden counter, three distinct breaker pitches, power reroute, binding seal, roof door, and ambulance-tunnel gate.

The other decisive APIs are:

- `playItem(item, { accepted, reason, effect })` — unique trauma-kit, sedative, stabilized-kit, flare, and shield sounds; exact result text is appended to the caption; rejected no-op use remains captioned.
- `playAudienceResult({ label, faction, effect })` — Guardian, Chaos, neutral, and rejected results use distinct patterns and preserve the physical consequence in text.
- `playWardenPhase({ phase, intensity, direction })` — dormant, distant, warning, approaching, striking, passing, repelled, retreating, and sealed phases vary density, level, noise, and pan.
- `playEnding({ ending, title })` — humane, roof, tunnel, and failure outcomes resolve on different music-layer sequences.
- `playTransition()` and `playUI()` — room transition and low-priority interface feedback.

Every cue is deterministic enough for testing while retaining procedural timing, layering, and spatial placement in the browser.

## Adaptive score

`startScore(roomId, { tension })` creates a two-voice score through the dedicated music bus. Reception, Ward 06, Operating Theatre, Generator Room, and Stairwell each have an authored root, minor tension tone, filter ceiling, and caption label.

`setTension()` follows live danger through three readable stages:

- **restrained** — low investigative pulse;
- **rising** — increased gain and filter bandwidth as danger climbs;
- **critical** — chase pulse near maximum danger.

The score changes gain, filter frequency, and slight pitch tension without restarting on every render. Room transitions replace the score cleanly. Reduced effects softens score level without silently coupling sound reduction to the reduced-motion setting. Ending presentation stops room ambience/score and plays the matching resolution once.

## Caption and OBS contract

All meaningful APIs call the caption path before testing whether audio can play. The immutable detail includes its cue, exact text, timestamp, and relevant structured fields such as room, action, item, consequence, intensity, direction, or ending.

```js
{
  cue: "action-force-door",
  text: "The isolation latch retracts, bolts hammer back, and the steel door scrapes open.",
  at: 1793548800000,
  action: "force-door",
  roomId: "surgery",
  accepted: true
}
```

The controller stores a sanitized `{ cue, text, at, speaker?, direction? }` subset in public state. The caption renders in the gameplay caption rail and `#overlayAudioCaption`, then travels through the validated `BroadcastChannel`/local-relay state used by passive OBS surfaces. Persistent controls cover enablement, small/medium/large text, soft/solid/maximum background, a 3–8 second duration, speaker labels, and left/center/right direction labels. Caption state contains no OAuth token, viewer map, EventSub ID, or private checkpoint data.

Passive mirror and overlay views are inert and do not create their own authoritative audio engine. The intended capture strategy is one controller tab producing the mix, with caption-only passive surfaces. This avoids doubled ambience, score, and cues while keeping the OBS overlay visually synchronized.

## Safety and accessibility contract

- Constructing `NightShiftAudio` does not create an `AudioContext`.
- `unlock({ userGesture: true })` is required from a trusted click or key handler; an unlock without that flag is refused.
- Captions emit while audio is locked, unavailable, muted, or reduced.
- `setReducedEffects(true)` removes noise transients, shortens sharp cues, and softens the score. Reduced motion does not silently change audio.
- Unknown room, action, item, Warden, or ending values fall back safely.
- Unsupported compression or stereo panning degrades without blocking the game.
- `destroy()` stops score, ambience, and tracked sources; disconnects buses/compressor; closes the context; and is idempotent.

## Continuous rehearsal capture

The recorder-assisted workflow is documented in [`CAPTURE_PROOF.md`](CAPTURE_PROOF.md). It opens a headed Chromium session, but the operator must click **Share this tab + audio and start**, choose **This Tab**, enable **Share tab audio**, and confirm the real browser picker. The scripted route then holds a truthful, watermarked rehearsal for at least five minutes and attempts to earn the humane ending with zero director fallbacks.

The workflow and recorder payload are implemented and contract-validated. A real picker run has **not** been completed or claimed. A valid manifest must show a clean committed source, video and tab-audio tracks, non-empty WebM bytes, observed caption events, the earned bound-Warden ending, zero fallbacks, and no chunk-order error. Cancelled, video-only, dirty-tree, incomplete, or silent runs remain failed/incomplete evidence.

This capture is rehearsal proof, not live Twitch, native OBS, an unfamiliar-human playtest, NVDA proof, or a substitute for a manual audible listening/mix review.

## Verification boundary

The retained RC8 suite results are:

- 160 total unit and contract tests: 159 passed, 1 optional Windows file-symlink case skipped because this host lacks symlink permission, and 0 failed;
- 33/33 visual states, including compact HUD and four true 640×360 captures;
- 9/9 gameplay, 5/5 integrity, 17/17 relay, 11/11 accessibility, and 10/10 performance gates;
- performance cleanup: no positive attached-DOM or listener growth, and post-GC heap remained within the enforced 8 MiB-or-75% budget.

The tests cover gesture gating, bus routing, compressor fallback, panning, adaptive score stages, action/item/audience/Warden/ending captions, caption preferences, reduced effects, cleanup, sanitized caption transport, passive-mirror behavior, the capture workflow contract, and decoded final-output ending/final-tail audio metrics. The retained RC8 composite passed end to end, and Site version 13 was anonymously probed. No completed RC8 recording, final MP4, human headphone/speaker listen, or native OBS audio review is claimed.

Browser QA still cannot prove that a human can hear and balance every cue on the target hardware, that Chrome supplies tab audio in the actual picker run, or that native OBS receives the intended mix. Those remain explicit manual gates.
