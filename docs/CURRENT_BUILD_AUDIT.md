# Current build audit — V3 quality branch

Date: 2026-11-01  
Branch: `v3/gold-corridor`
Original V2 baseline: `86d470176c713e1dd09cbb2bf79778dab3bb288e`

This audit separates implemented behavior, automated/browser evidence, and external verification. It supersedes the milestone-one audit. The app must continue to say **SIMULATED** or **REHEARSAL** unless a validated EventSub session is actually connected.

## Verified in the current build

- Three working product views: live episode, streamer control room, and an OBS browser-source route with root-level transparency.
- A five-act persistent campaign: Reception/Triage, Ward 06, Operating Theatre, Generator, and Stairwell/Exits.
- Three authored camera nodes per act with visible composition changes, persistent visited-node state, keyboard-operable controls, and a single correct `aria-pressed` node.
- Streamer-only investigation, deduction, stealth, sequencing, inventory craft/use, threat counterplay, containment, and final-route decisions.
- Audience voting, one-vote-per-viewer fairness, Guardian/Chaos state, channel-event consequences, and disclosed zero-chat director fallbacks.
- Clean run resets, successful-action-only readiness, checkpoint recovery, re-entrant advance protection, earned final exits, distinct endings, and structured recaps.
- A physical isolation door with original generated panel art, linked bolts, a connected-theatre reveal, hinge animation, reduced-motion behavior, and deterministic open/closed fixtures.
- Original Warden warning, approach/strike, and repel poses; original curtain and gurney foreground layers; independent fog, lighting, reflection, rain, shadow, and occlusion layers.
- Gesture-gated procedural Web Audio with five room ambiences, transition/Warden/UI cues, mute/volume controls, reduced-effects variants, visual captions, failure fallback, and deterministic cleanup.
- OAuth callback-state/expiry handling, EventSub critical/optional subscription separation, bounded dedupe, keepalive watchdog, seamless reconnect, and truthful connection phases.
- Strict privacy-safe OBS serialization, one-controller leasing, passive overlays/mirrors, and an opt-in loopback relay verified across independent Chrome processes and profiles.
- Dialog semantics and focus containment, focus-stable action controls, semantic progress values, pause shortcut, 44px primary targets, reduced motion/flashes, high contrast, hidden viewer names, and persistent browser-local safety settings.
- Dependency-free static preview, public-host security/cache configuration, Netlify publish configuration, logged-out deployment runbook, and release audit.
- Lossless PNG sources archived under `art-source/`; visually verified WebP derivatives ship from `dist/`.

## Objective evidence

| Command | Result |
| --- | --- |
| `npm run check` | 64 passed, 0 failed |
| `npm run qa:visual` | 28 passed, 0 failed; all 15 camera compositions; no console errors |
| `npm run qa:gameplay` | 8 passed, 0 failed; includes earned humane ending and truthful fallback ending |
| `npm run qa:integrity` | 5 passed, 0 failed; truth/privacy/controller checks |
| `npm run qa:relay` | 16 passed, 0 failed across separate browser processes/profiles |
| `npm run release:audit` | passed; 11.6 MiB public payload |
| `node scripts/optimize-images.mjs` | 11 referenced assets; 57.0% projected/source-to-public reduction |

Visual evidence includes desktop, tablet, phone, every camera node, Warden warning, open door, dashboard, transparent overlay, reduced motion, and ending recap captures under `work/visual-qa` and `work/gameplay-smoke`. Focused integrity and cross-process reports live under `work/integrity-browser-smoke` and `work/relay-browser-smoke`. The committed runbooks explain what these gates do and do not prove.

## Fixed since the original audit

- The Warden is no longer one static pasted image; it has phase-specific transparent poses and authored CSS staging.
- The corridor no longer exposes a generic marker door; it uses a detailed original isolation-door panel with physical state.
- Camera nodes are no longer engine-only metadata; they are playable controls that change framing and persist.
- Campaign APIs are no longer hidden from the browser; inventory, checkpoints, readiness, fallbacks, pacing telemetry, and recaps are visible and exercised by browser tests.
- Failed actions no longer count as completed objectives, old runs no longer contaminate new runs, repeated advance clicks cannot skip acts, and exits cannot bypass prerequisites.
- Mobile HUD collisions, clipped consequence copy, opaque OBS roots, and ineffective reduced-motion CSS are fixed and regression-tested.
- Action controls retain keyboard focus across the one-second render loop; intro/ending behave as modal dialogs.
- Audio is no longer an unsupported promise; it is optional, gesture-gated, captioned, safety-aware, and tested.
- Public large-image transfer was reduced substantially without discarding lossless sources.

## Still unverified or external

- The public HTTPS deployment is now available and statelessly verified at `https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/`; re-probe it after any publish or access-policy change.
- Real Twitch proof with the broadcaster account and a second viewer, including chat-to-world-to-overlay propagation and reconnection on the production callback.
- Actual OBS checkerboard/background captures at 1920×1080 and 1280×720. Computed browser alpha is necessary but not sufficient.
- Three timed newcomer full runs. The 20–35 minute value remains an authored target, not measured evidence.
- NVDA + Chrome, actual-audio listening/mix, and a 30-minute native Chrome+OBS performance/memory session. The complete keyboard route, 200% zoom-equivalent reflow, computed contrast, and eight-cycle headless soak now pass.
- Public repository/video/Devpost URLs and final submission actions owned by the user.

## Current release decision

The local build is a credible, cohesive V3 release candidate and no automated blocker is open. It is **not yet a fully verified public entry** because the account-owned Twitch, OBS, deployment, human-playtest, and submission gates cannot be completed without the user's external accounts and participants. Those gates must remain visible rather than being relabeled as complete.
