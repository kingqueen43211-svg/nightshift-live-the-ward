# Current build audit — V3 quality branch

Date: 2026-11-01  
Baseline commit: `86d470176c713e1dd09cbb2bf79778dab3bb288e`  
Branch: `v3/gold-corridor`

This audit distinguishes what was directly inspected from what remains unverified. The original deployed `chatgpt.site` URL is authentication-gated for external visitors. Local evidence was collected from `http://localhost:4173/` at 1280×720 using the in-app browser and saved under `docs/evidence/`, including the intro, gameplay, open isolation door, and Warden warning fixtures.

## Verified good

- The local build starts successfully with `npm start` and has three working views: gameplay, control room, and OBS overlay (`dist/index.html`, `dist/app.mjs`).
- The existing five-room state engine preserves evidence, inventory, doors, power, faction energy, cooldowns, and endings (`dist/engine.mjs`).
- Live and simulated states are visually distinguished. Real Twitch is not claimed as verified (`dist/app.mjs`, `dist/twitch.mjs`).
- The title and room plates share a coherent grounded hospital aesthetic. The V3 title treatment was visually inspected at 1280×720 and has a clear focal hierarchy.
- The V3 gameplay composition was visually inspected at 1280×720: mission, vitals, case file, streamer actions, and audience vote have separate reserved zones with no mission-critical text collision.
- Syntax checks and 13 engine tests pass via `npm run check`.

## Weak before V3 pass

- The previous experience opened directly into gameplay with no strong title-to-world handoff.
- Streamer gameplay consisted mostly of one-click actions while voting occupied the dominant interaction loop.
- The corridor used one plate plus atmospheric overlays; the visible door was a generic marker rather than a physical multi-phase object.
- The Warden was one composited image with opacity/scale. It did not yet meet the V3 staged-character requirement.
- The vote panel and player action tray could visually crowd one another at 1280×720.
- Room travel used an occluding wipe but did not yet simulate a camera crossing a physical threshold.

## Implemented in milestone 1

- Added a cinematic, skippable title with clear promise and immediate start action (`dist/index.html`, `dist/styles.css`).
- Rebalanced the 1280×720 gameplay layout into reserved left/center/right zones; the player action rail and audience vote no longer share functional bounds.
- Added a physical surgical isolation door with separate bolts, panel, lock label, hinge rotation, impact response, and persistent engine-driven open state.
- Added foreground curtain/gurney occluders, crosshair, objective progression, threat state, story thread, and action feedback.
- Expanded player mechanics to observation, deduction, stealth, resource use, threat counterplay, power routing, and a final seal attempt (`dist/engine.mjs`).
- Added narrative prerequisites: identify Subject 06, decode the confession, earn a binding sigil, and use evidence to attempt containment.
- Added staged Warden phases (`warning`, `approaching`, `passing`, `striking`, `repelled`) with separate shadow, arms, body, eye, and mist layers. The first pass is visibly occluded by the corridor/door composition rather than pasted over the HUD.
- Added a clearly labeled local rehearsal autostart query for deterministic capture; it does not claim live Twitch.

## Broken or incomplete

- `chatgpt.site` remains unsuitable as the only judge-accessible deployment because logged-out visitors see a sign-in gate. A separate public host is still required.
- The surgical door currently uses CSS perspective rather than authored 6–10 frame art. Its shadow/reflection linkage is partial.
- The Warden now has independently moving arms and distinct approach/strike/repel states, but it still needs authored sprite poses, stronger silhouette readability, audio timing, and two fully recorded interaction outcomes before S1 can pass.
- The current HUD text is stylish but some labels remain below the V3 preferred 14px/720p threshold. These require a readability pass.
- Full responsive matrix, keyboard-only full run, reduced-flash, audio captions, performance measurements, and screenshot baselines are not complete.
- The campaign has five room plates, not yet eight or nine authored camera spaces. No 20–35 minute claim is valid.

## Unverified

- Real Twitch broadcaster OAuth, a second viewer command, EventSub reconnection, and live vote-to-world-to-OBS propagation.
- True alpha rendering inside actual OBS at both 1920×1080 and 1280×720.
- Three newcomer full-run timings and independent 90/100 quality review.
- Asset redistribution/license provenance for all current PNG files.

## Immediate next increment

Build the surgical corridor as the gold-standard scene: three authored camera nodes, door shadow/reflection linkage, staged Warden warning/approach/counterplay, world-space hotspots, and viewport collision tests. Preserve the current runnable build throughout.
