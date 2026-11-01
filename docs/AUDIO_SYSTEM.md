# Procedural audio and caption system

`dist/audio.mjs` provides the production audio layer for NightShift Live without downloaded sound files, external services, or autoplay. It is deliberately separate from the game controller so audio can never block campaign progression.

## Safety contract

- Constructing `NightShiftAudio` does not create an `AudioContext`.
- `unlock({ userGesture: true })` must be called synchronously from a trusted click or key handler. Calling `unlock()` without that explicit flag is refused.
- Every meaningful cue emits a `caption` event and calls `onCaption`, including while audio is locked, unavailable, or muted.
- `setReducedEffects(true)` removes noise transients, shortens UI and Warden cues, and uses a reduced ambience texture.
- Master, effects, and ambience each have independent volume and mute state.
- `destroy()` stops tracked sources, stops ambience, disconnects buses, closes the context, and is safe to call more than once.
- AudioContext failure is non-fatal. The returned result describes the failure while visual captions remain available.

## Integration API

```js
import { createNightShiftAudio } from "./audio.mjs";

const audio = createNightShiftAudio({
  onCaption: ({ text }) => {
    document.querySelector("#audioCaption").textContent = text;
  }
});

// Call directly from the existing Enter the NightShift button handler.
await audio.unlock({ userGesture: true });
audio.startAmbience("intake");

// Campaign hooks.
audio.playTransition({ from: "intake", to: "surgery" });
audio.startAmbience("surgery");
audio.playWardenWarning({ intensity: state.danger / 100 });
audio.playUI(state.lastActionAccepted ? "success" : "error");

// Accessibility/dashboard hooks.
audio.setReducedEffects(state.settings.lowEffects);
audio.setVolume("master", .75);
audio.setVolume("ambience", .4);
audio.setVolume("effects", .8);
audio.setMuted("master", true);
```

The authored ambience room IDs are `intake`, `surgery`, `theatre`, `generator`, and `stairwell`. Unknown IDs fall back safely to the intake soundscape.

`playUI()` accepts `click`, `success`, `error`, and `vote`. The other cue methods are:

- `startAmbience(roomId)` / `stopAmbience()`
- `playTransition({ from, to })`
- `playWardenWarning({ intensity })`

## Caption payload

Both the callback and the `caption` event receive the same immutable detail object:

```js
{
  cue: "warden-warning",
  text: "Heavy footsteps scrape behind surgical plastic.",
  at: 1793548800000,
  intensity: 0.78
}
```

The built-in log retains the latest 64 entries via `getCaptionLog()`. Caption text is concise visual equivalence for informational cues; it is not decorative subtitle spam. Integration should place it in a persistent visual caption region and use the existing polite live region only when the cue carries gameplay information.

## Verification

`tests/audio.test.mjs` uses a deterministic fake Web Audio context. It verifies:

- no context creation without a trusted gesture;
- bus routing, volume, mute, and reused unlock behavior;
- captions while locked and muted;
- authored room ambience, switching, reuse, and stop behavior;
- reduced-effects removal of noise transients;
- tracked-source cleanup and idempotent destruction;
- invalid bus rejection.

Browser QA must additionally confirm the first click unlocks audio in Chrome, sound remains optional, the caption region is visible with sound muted, and changing/reloading views never creates duplicate ambience loops.
