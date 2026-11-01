# Accessibility and input audit

Audit date: 2026-11-01  
Scope: `dist/index.html`, `dist/app.mjs`, `dist/styles.css`, and the gameplay/dashboard/overlay interaction model  
Status: release blockers remain

This is a source-and-behavior audit, not a WCAG conformance claim. The current build has strong foundations—native buttons and inputs, visible focus styling, a polite announcement region, text labels alongside color-coded state, reduced-motion/low-effects/high-contrast controls, and decorative threat art hidden from assistive technology. The issues below must be fixed and verified before accessibility can be called complete.

## P0 — release blockers

### Preserve keyboard focus across the render loop

`render()` replaces `#actionTray.innerHTML` on every call. The one-second timer calls `render()` continuously, so a keyboard user's focused action button is removed from the DOM once per second. This prevents reliable review and activation of the room actions.

Fix in `dist/app.mjs`:

- Extract a keyed `renderActions(room)` function.
- Only rebuild the tray when the ordered action IDs change (for example, cache `room.actions.join("|")`).
- When an action genuinely changes the tray, preserve the active action ID and restore focus if that action still exists.
- Apply the same no-op-on-unchanged rule to any future interactive dynamic list.

Verify by tabbing to each action, leaving it focused for at least five timer ticks, then activating it with both Enter and Space.

### Make flash suppression truthful and complete

The intro says flash controls are available, but the existing settings do not consistently suppress flashes. `body.low-effects` only hides rain and far fog. Every player action still restarts `.impact-flash`; high danger still enables `.alarm`; room changes still run `.room-wipe`; and the `jumpscares` switch only controls Warden visibility.

Fix in `dist/app.mjs` and `dist/styles.css`:

- Add a clearly named `Reduced flashes` setting, or broaden `Low effects` and label it `Reduced flashes & effects`.
- When enabled, prevent the impact-flash class restart in the action handler and skip animated room wipes.
- Suppress alarm pulsing, Warden strike flashes, and any future rapid luminance changes.
- Honor `prefers-reduced-motion: reduce` on first load without requiring the dashboard switch, while still allowing an explicit in-app override.
- Keep essential danger and room-transition information in persistent text, not animation alone.

Verify with the OS preference and the in-app setting independently. Record a complete playthrough showing no rapid flash or unavoidable large motion in either mode.

### Treat the intro and ending as real modal states

The cinematic intro and ending visually cover the app but are not dialogs, do not mark the background inert, do not move focus, and do not contain focus. When the ending appears, background controls remain keyboard reachable. When the intro is dismissed, focus remains on a now-hidden button.

Fix in `dist/index.html` / `dist/app.mjs`:

- Give both overlays `role="dialog"`, `aria-modal="true"`, and an accessible title relationship.
- While either overlay is visible, make the underlying header/main inert.
- On open, focus the first meaningful control or the dialog heading (`tabindex="-1"`).
- On close, restore focus to the opener or move it to `#objective` for a newly started episode.
- Contain Tab/Shift+Tab within the visible dialog. Let Escape close the intro; at the ending, Escape should not silently discard results.

Verify forward and reverse focus traversal at both overlays and inspect the browser accessibility tree.

## P1 — high priority

### Fix the malformed reduced-motion rule

The current selector `body.reduced-motion *,@media(prefers-reduced-motion:reduce)` is invalid CSS; the automated visual QA confirms rain, fog, and Warden animation durations remain active.

Use two valid rules covering pseudo-elements as well:

```css
body.reduced-motion *,
body.reduced-motion *::before,
body.reduced-motion *::after {
  animation-duration: .01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: .01ms !important;
  scroll-behavior: auto !important;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Announce view, connection, validation, and ending changes

`#ariaStatus` announces action outcomes and toasts, but `switchView()`, Twitch connection errors/status, and the ending state do not announce themselves. The active navigation item also communicates state only with a CSS class.

Fix:

- Set `aria-current="page"` on the active view button and remove it from the others.
- Focus the destination's `h1` (temporarily focusable with `tabindex="-1"`) when a user changes views; do not steal focus on BroadcastChannel updates.
- Give `#twitchStatus` `role="status"` and ensure connection errors are announced.
- When the episode ends, open/focus the ending dialog and announce the ending name once.
- Add `aria-pressed` to any safety control implemented as a button; native checkboxes already expose state.

### Add semantics to changing game state

Several meaningful values are visually clear but structurally generic.

Fix:

- Mark health, entity danger, power, and objective completion as progress bars (`role="progressbar"`, an accessible label, and current/min/max values), updating `aria-valuenow` with the visual bars.
- Give the vote timer an accessible name. Do not put its one-second updates in a live region.
- Give `#eventToast` `role="status"` or retain the dedicated live region, but avoid duplicate announcements.
- Use `role="img"` plus the dynamic room description on `#scene`, or remove its ineffective generic `aria-label` and rely on the plate's informative `alt` plus a concise screen-reader scene summary.
- Expose room-map progress in text (for example, `Room 2 of 5`); the generated `<i>` elements are decorative only.

### Stop relying on a label that wraps a button

The `Chat command` `<label>` contains a `<div>`, input, and Send button. A label containing another interactive control creates confusing activation/name behavior.

Fix: use `<label for="chatCommand">Chat command</label>` followed by the input/button row. Give the Client ID input a stable `name`, and use an associated help/error element via `aria-describedby`.

### Provide an actual pause shortcut

There is no keyboard handler for Escape despite the QA checklist requiring Escape/pause. Add a documented shortcut that pauses only during active gameplay, never while typing in a text input, and announces the new state. Prefer Escape for pause/resume only if it does not conflict with an open modal; otherwise use a clearly disclosed key such as `P` and expose a persistent Pause button in gameplay.

## P2 — important polish

### Enlarge small controls and labels

Several controls fall below a robust 44×44 CSS-pixel touch target: top navigation buttons, dashboard buttons, and especially native checkbox/label rows. Increase their minimum block size or provide equivalent surrounding label hit areas. Keep at least 8 CSS pixels between adjacent targets.

Action buttons already use 58px minimum height on desktop and 47px on the phone breakpoint.

### Correct low-contrast microcopy

Most principal colors pass strongly against the dark base: primary text 17.74:1, muted text 7.32:1, cyan 13.38:1, and red 6.15:1. However, `.fine` (`#617472` on the panel-dark sample) measures about 3.91:1 while rendered as small text, below the 4.5:1 normal-text target. The intro footnote color (`#71827f`) and partially transparent text should also be measured against their composited backgrounds rather than assumed to pass.

Raise low-contrast microcopy to at least the existing `--muted` color, avoid important text below 11–12px, and run computed-color contrast checks in-browser because translucent glass backgrounds vary by scene.

### Improve heading and region structure

- Change dashboard panel headings from `h3` to `h2`, or introduce a real section-level `h2` before them.
- Give the primary navigation an accessible label.
- Consider named regions for streamer actions, audience vote, case file, and system status so screen-reader users can jump between them.
- Mark purely decorative intro rules, crosshair, fog, rain, and foreground props hidden from assistive technology where they are not already hidden.

### Persist and initialize safety preferences

Settings reset on reload and do not initialize from system preferences. Store accessibility settings locally, initialize reduced motion from `matchMedia`, synchronize checkbox state from application state on each settings render, and document that preferences are browser-local.

### Audio/caption status

The current build contains no audio files or Web Audio code, so there is no audio-caption implementation to validate. Narrative audio concepts such as the intercom and confession currently resolve as text outcomes. If sound is added, every speech-bearing cue needs synchronized captions/transcript text, and every informational non-speech cue needs a concise visual equivalent. Add independent music/effects/voice volume or mute controls before calling the audio experience accessible.

## Verification gate

Before release, complete all of the following:

1. Keyboard-only playthrough covering intro, all five rooms, dashboard, pause/resume, ending, and returning to the control room.
2. Screen-reader smoke tests in at least NVDA + Chrome on Windows: headings/regions, view changes, game-state values, action outcomes, connection errors, and ending dialog.
3. Automated browser checks for focus preservation across five render ticks, focus containment, reduced-motion computed styles, reduced-flash state, and all interactive target sizes.
4. Computed contrast audit on every text style over actual composited backgrounds, including high-contrast mode.
5. 200% zoom and 320 CSS-pixel reflow test without loss of controls or two-dimensional page scrolling.
6. Full playthrough with OS reduced motion and with the in-app safety preference, independently.
7. If audio is introduced, a caption/transcript review with sound muted.

Do not describe the build as WCAG conformant until these items have objective evidence and no unresolved blocker.
