# Campaign/UI integration audit

Date: 2026-11-01  
Scope: current `v3/gold-corridor` after the campaign-engine, Twitch-lifecycle, and visual-QA commits.

## Verdict

The pure engine now contains a credible five-act campaign model, but the browser experience exposes only its legacy surface. Camera nodes, inventory use/crafting, readiness, checkpoint restore, pacing prompts, and the structured ending recap are not imported or rendered by `dist/app.mjs`. The campaign is therefore testable through JavaScript but not yet fully playable or legible through the shipped UI.

## P0 — progression integrity

1. **A new episode inherits the previous run's world state.** `startEpisode()` (`dist/engine.mjs:104`) resets rooms/campaign metadata but not health, danger, power, evidence, inventory, doors, props, player, story, Warden, faction resources, votes/events, or recent history. A second run can begin at 7 health with an already-powered exit and old evidence. Reset gameplay state from a fresh baseline while deliberately preserving only production settings, connection mode, and any intended broadcaster/session identity.

2. **Failed interactions count as completed proof.** `playerAction()` always calls `recordPlayerProgress()` (`dist/engine.mjs:181` and `:160`). Attempting `reconstruct-file` before finding either fragment records the required action, so searching the desk and locker afterward makes `roomReadiness()` return ready even though `story.subjectIdentified` is false. The same pattern affects failed counters, breaker attempts, and route interactions. Return an explicit `{accepted, consequential, outcome}` result (or track successful actions separately) and let readiness require successful world-state predicates, not merely button presses.

3. **The final escape bypasses every earned prerequisite.** `open-roof` and `open-ambulance` immediately call `finishEpisode()` at the tail of `playerAction()` even if `doors.exit` is false, power is absent, no final vote has resolved, and the player never completed Acts 1–4. Gate route completion on the powered exit and the intended vote/consequence state. A rejected route attempt must not finish or be logged as a successful decision.

4. **The UI advance action is re-entrant.** `advance()` (`dist/app.mjs:45`) creates an untracked five-second timeout on every click. `autoAdvanceTimer` is declared and cleared but never assigned. Repeated clicks can queue multiple room advances and skip acts. Assign/cancel the timer, lock the control while resolving, and verify the expected room/version before applying the delayed transition.

## P1 — make the campaign playable in the browser

1. **Wire all campaign APIs.** The import at `dist/app.mjs:1` omits `enterCameraNode`, `campaignProgress`, `roomReadiness`, `combineInventoryItems`, `useInventoryItem`, and `restoreCheckpoint`. Add UI paths for each; otherwise their engine tests do not represent the shipped experience.

2. **Make three camera nodes visibly and mechanically distinct.** Every room defines three IDs in `ROOMS`, but no camera API is called by `app.mjs`, no camera controls exist in `dist/index.html`, and `render()` never writes `state.camera.nodeId` to the scene. Add a compact camera rail with three labeled destinations, current/visited state, keyboard operation, and a short purpose cue. On selection, call `enterCameraNode()`, put the node on `#scene.dataset.cameraNode`, and transition between authored compositions. Each node should change framing/foreground occlusion and reveal or enable a relevant interaction—not merely rename the same image.

   Suggested room affordances:

   | Room | Wide node | Investigation node | Commitment node |
   | --- | --- | --- | --- |
   | Intake | lobby threat/context | records desk evidence | locker resource |
   | Surgery | corridor/Warden telemetry | gurney restraint clue | isolation threshold/door |
   | Theatre | Warden and whole arena | surgical lamp alignment | restraint table/tape |
   | Generator | room and exit topology | breaker sequence | service stairs/reroute |
   | Stairwell | final threat/readiness | roof route | ambulance route |

3. **Expose prerequisites before clicks.** The action tray at `dist/index.html:21` renders every room action as an always-active button. Add state-aware hints/locks such as “needs two evidence + 20 power,” “align lamps first,” and “complete 2·1·3.” Rejections should explain the missing requirement without counting as completion. Do not turn the intended sequence into guesswork.

4. **Turn inventory from a counter into play.** The journal (`dist/index.html:24`) only shows item count/latest discovery. Render owned items with usable/craftable state, support the sedative + trauma-kit combination, and announce resulting health/fear/danger changes. Preserve a one-click safe path for stream pacing.

5. **Surface readiness and fallback truth.** Show `roomReadiness().missing` in the control room and immediately before advancing. When a zero-chat fallback resolves, label it `DIRECTOR FALLBACK` in gameplay/overlay rather than relying on the activity feed. When advancing incomplete, show the exact omissions and fallback support, not a generic transition.

6. **Provide checkpoint recovery.** `advanceRoom()` creates checkpoints and the engine can restore them, but no control invokes `restoreCheckpoint()`. Add a clearly labeled production-only “Recover checkpoint” action with confirmation/status feedback. Replace the live `state` binding with the restored state and re-render/broadcast it.

7. **Render the ending recap.** The ending layer (`dist/index.html:25`) shows only the title and generic copy. Present route, evidence, decoded truth, containment, audience resolutions, director fallbacks, and mechanics demonstrated from `endingRecap`. This is the payoff that proves player and chat choices mattered.

8. **Use pacing telemetry without making a duration claim.** `tick()` sets `needsPacingBeat`, but the UI ignores it. Give the streamer a private prompt after 25 seconds of inactivity and show elapsed time as “rehearsal telemetry / not measured playtest data.” Keep the documented 20–35 minute target unverified until human runs exist.

## P1 — ending and decision truth

- `finishEpisode()` can rewrite the physical route to `contain` whenever the audience winner was contain, even if the streamer clicked the roof. Record `audienceDirective` separately from `streamerRoute`, then resolve the authored conflict explicitly. The recap must not claim a route the player did not take.
- The final vote should alter the available cost, danger, rescue quality, or containment condition; it should not silently replace the streamer's physical choice.
- The “Your audience wrote this ending together” copy is inaccurate when all votes used zero-chat fallbacks. Generate truthful copy from `audienceResolutions` and `zeroChatFallbacks`.

## P2 — control and presentation hardening

- `render()` replaces the action tray every second, destroying keyboard focus. Diff/update existing controls or skip rebuilding unchanged trays so keyboard and switch users can finish actions reliably.
- `state.camera.moving` is never used. Use it to block double input during a short camera transition and to suppress motion when reduced-motion is active.
- Add UI integration tests that exercise camera-node selection, inventory crafting/use, checkpoint restore, a rejected final route, the humane ending, the tunnel ending, and a full zero-chat run.
- Add engine regressions for run reset, failed actions not satisfying readiness, and exit gating. The current nine campaign tests validate the happy-path model but do not catch these browser-critical bypasses.

## Reproduced evidence

The following read-only probes reproduced the highest-risk issues on this commit:

- Premature `reconstruct-file` + later desk/locker actions: readiness was `true` while `subjectIdentified` remained `false`.
- Calling `startEpisode()` twice: old inventory/evidence, 7 health, and `doors.exit=true` survived the reset.
- Jumping to Stairwell and invoking `open-roof`: the episode ended with `ESCAPE, WITHOUT ANSWERS` while `doors.exit=false`.

These are release blockers because they let the visible game contradict its campaign promises even though the isolated happy-path tests pass.
