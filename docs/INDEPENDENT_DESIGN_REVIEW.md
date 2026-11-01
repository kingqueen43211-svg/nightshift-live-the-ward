# Independent game UX and art-direction review

Date: 2026-11-01  
Reviewer stance: senior game UX / broadcast art direction, independent of implementation  
Build reviewed: latest `v3/gold-corridor` screenshots and browser evidence

## Verdict

**86 / 100 — submission-worthy and visually distinctive, but not yet first-place proof.**

This reads as a real interactive show package rather than a themed poll. The title screen is premium, the hospital art is cohesive, the interface makes streamer and audience agency legible, the physical door provides a memorable world consequence, and the ending recap gives the run an authored payoff. The remaining gap is not basic polish; it is proof and instant readability at the most important threat moment.

## Scorecard

| Category | Score | Evidence-backed assessment |
| --- | ---: | --- |
| Visual hierarchy | **14 / 16** | Mission, streamer actions, audience vote, state meters, and case file occupy stable zones at desktop sizes. The title screen has an excellent focal sequence. At 720p the number of framed panels is near the density limit, and secondary labels are very small. |
| Originality | **12 / 15** | Abandoned-hospital horror is familiar, but the split agency—streamer-only investigation versus chat-authored physical consequences—feels specific. Camera nodes, factions, the linked door, and disclosed director fallbacks prevent it from reading as a generic Twitch poll skin. |
| Cinematic staging | **13 / 16** | Wet-floor reflections, cyan/red practical light, layered foreground props, a hinged isolation door, and distinct room compositions create convincing depth. The current Warden-warning frame is too dark and partially swallowed by the door/mission composition for an instant compressed-video read. |
| Streamer / audience clarity | **14 / 15** | “YOUR MOVE · CHAT CANNOT DO THIS FOR YOU” versus “CHAT CHOOSES WHAT BECOMES REAL” is the strongest product communication in the build. Locked prerequisites, camera purpose cues, vote provenance, and the recap make cause and effect understandable. |
| Responsive quality | **11 / 13** | The 390×844 and 768×1024 states are collision-free and preserve every primary control. On phones, the scene becomes mostly atmospheric wallpaper behind a vertically stacked control surface; functional, but less cinematic than desktop. |
| Accessibility and safety | **11 / 13** | Reduced motion, reduced effects, semantic progress, focus persistence, 44px targets, keyboard pause, captions, and high contrast are unusually strong for a prototype. Manual NVDA testing is not evidenced, and several 7–10px broadcast labels will be difficult in a small Twitch player. |
| Demo impact | **11 / 12** | The title screen, physical door reveal, audience/streamer split, and large ending title create a clear three-minute story. A live two-account Twitch-to-world-to-overlay proof is still missing, so the most persuasive claim has not yet been captured. |

## What is already excellent

1. **The opening promise is immediate.** `docs/evidence/v3-intro-1280x720.png` communicates genre, premise, and the Search → Deduce → Survive loop before asking for a click.
2. **The broadcast hierarchy is disciplined.** `work/visual-qa/gameplay-1280x720.png` keeps the game world visible while separating mission, meters, case file, player actions, and chat voting.
3. **Agency is visible, not buried in rules.** Locked action requirements and the two headline rails explain who controls what without a tutorial modal.
4. **The Ward 06 sequence has a real visual payoff.** `door-1280x720.png` shows a connected operating theatre through the opened door rather than swapping to an unrelated plate.
5. **The ending proves persistence.** `work/gameplay-smoke/ending-recap-1280x720.png` names route, evidence, decoded truth, Warden state, audience participation, and fallbacks. The disclosed fallback copy is especially credible.
6. **Mobile is deliberately composed.** `gameplay-390x844.png` has no clipped controls or accidental overlap; it is not merely a scaled desktop canvas.
7. **The control room looks like production software.** `dashboard-1280x720.png` cleanly separates signal, rehearsal events, activity, safety, and show controls.

## Release blockers

### 1. Capture the real product claim

The entry still needs one uncut proof showing a broadcaster plus a second viewer: Twitch message → accepted vote → physical world change → matching transparent OBS overlay. A public logged-out HTTPS URL and actual OBS capture are required. Rehearsal mode is excellent evidence of deterministic design, but it cannot substitute for this claim.

### 2. Make the Warden readable in one second

In `warden-1280x720.png`, the Warden is tonally close to the wall and partly competes with the isolation door. In a compressed judging video, the key threat risks reading as background texture. Give the character a restrained local cyan/red rim or lift its midtones roughly 15–20%, and stage the warning pose a little farther from the door edge. Do not brighten the whole scene.

### 3. Obtain human pacing and comprehension evidence

The five-act state model is convincing, but no screenshot or automated gate proves a newcomer understands prerequisites, camera nodes, factions, and the final route at show speed. Record at least three first-run sessions and report time-to-first-action, missed prerequisites, total duration, and ending comprehension. Do not claim the 20–35 minute target until measured.

## High-value polish after blockers

- Increase the smallest persistent broadcast labels and recap metadata by 1–2px, especially for a Twitch player viewed below native resolution.
- At 1920×1080, consider modest responsive HUD scaling; the world looks excellent, but the fixed-size control clusters become small relative to the canvas.
- The centered consequence toast briefly competes with the world focal point. For the final video, time captures after it clears or reduce its opacity/size for non-critical messages.
- Give the mobile dashboard control row a more deliberate grid; the isolated Stop button currently feels like a wrap artifact.
- Bundle the display fonts locally or document a tested fallback. External font loading is an avoidable demo dependency.
- Update the stale “8 pass / 5 fail” baseline prose in `docs/QA_RUNBOOK.md`; the current machine report is 13/13.
- Add one screenshot for each non-wide camera node. The current tests prove state changes, but the submission evidence does not yet demonstrate all authored compositions visually.

## Evidence reviewed

- Visual matrix: **13 passed, 0 failed, 0 console errors** across six gameplay viewports, two threat/door fixtures, two dashboards, two overlays, and reduced motion.
- Browser campaign smoke: **7 passed, 0 failed**, including focus persistence, camera ARIA/composition, rejected prerequisites, inventory, checkpoint restore, fallback truth, and ending recap.
- Key captures: `gameplay-1920x1080.png`, `gameplay-1280x720.png`, `gameplay-768x1024.png`, `gameplay-390x844.png`, `warden-1280x720.png`, `door-1280x720.png`, both dashboard sizes, both overlay sizes, reduced motion, and the ending recap.

Automated geometry and browser checks materially strengthen confidence, but they do not prove live Twitch behavior, actual OBS compositing, audio perception, screen-reader usability, human pacing, or audience delight.
