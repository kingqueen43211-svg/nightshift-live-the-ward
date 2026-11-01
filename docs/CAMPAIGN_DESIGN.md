# Nightshift Live — Campaign Design and Rehearsal Protocol

## Campaign spine

The campaign is a five-act escape story with persistent state. Every room records whether it was visited and completed, its entry and exit timestamps, actions taken, camera nodes visited, and a snapshot of consequential world state. Inventory, evidence, health, danger, power, the Warden state, audience decisions, and the streamer's decisions carry forward.

| Act | Room | Primary mechanic | Required proof of play | Safe zero-chat choice |
| --- | --- | --- | --- | --- |
| 1 | Reception / Triage | Investigation and deduction | Search desk, open locker, reconstruct file | Search patient records |
| 2 | Ward 06 | Stealth and environmental breach | Inspect gurney, listen to intercom, force door | Restore the corridor feed |
| 3 | Operating Theatre | Threat counterplay | Align lamps, play tape, counter Warden | Flood theatre with light |
| 4 | Generator Room | Sequence puzzle and resource management | Breakers 2–1–3, then reroute power | Charge audience shields |
| 5 | Stairwell / Exits | Earned final choice | Route and containment choices | Take the roof route |

Each room exposes three authored camera nodes. The active camera node and visited-node history persist in both global camera state and room state, so presentation code can stage deliberate reveals without inventing navigation state.

## Resilience rules

- A vote with no participants resolves to that room's announced safe fallback. The result is labeled `ZERO_CHAT_FALLBACK`, logged as a director action, and counted separately from audience resolutions.
- Missing an authored interaction never traps a rehearsal. Advancing records the incomplete room, identifies the missing requirements in a `progress-warning`, creates a checkpoint on entry to the next room, and continues with fallback support.
- Checkpoints hold a deterministic campaign snapshot and can restore health, inventory, story, room, camera, vote, and world state without a circular snapshot chain.
- Required actions communicate the intended showcase path; they are not a hidden lock. Critical door and power state are included in readiness feedback.

## Meaningfully distinct endings

The ending resolver uses route, evidence, decoded truth, containment, health, danger, and whether the streamer completed the humane seal. The tested primary outcomes include:

- **MARA WALKS INTO DAWN** — the streamer uncovers the truth, acquires the binding sigil, and seals the Warden before taking the roof.
- **THE TUNNEL REMEMBERS** — the streamer chooses the ambulance tunnel, producing a different route and narrative result even after a strong run.

Other supported outcomes cover exposing the truth, choosing containment, escaping with strong evidence, escaping without answers, and losing to the Ward. `endingRecap` preserves the route, evidence count, story flags, final decisions, audience/fallback counts, mechanics demonstrated, and elapsed instrumentation for post-show review.

## Pacing instrumentation

`PACING_TARGETS` defines deterministic rehearsal targets rather than claiming observed human playtime:

- objective visible by 15 seconds
- first interaction by 30 seconds
- first consequence by 75 seconds
- focused rehearsal section target: 10–15 minutes
- complete campaign target: 20–35 minutes
- director pacing prompt after 25 seconds without a meaningful action

`tick()` and `campaignProgress()` report elapsed milliseconds from the supplied clock and set `needsPacingBeat` when the run idles. `campaignProgress().measured` and `endingRecap.durationMeasured` remain `false`: engine timestamps are instrumentation, not evidence that a human completed the game in the target window.

## Manual newcomer playtest

Run at least three fresh-player rehearsals before making a duration claim. Do not coach unless the player is stuck; record any intervention.

1. Start from the briefing with chat disconnected. Verify every vote announces and applies its safe fallback and the player can still reach an ending.
2. Start again with at least two voters. Give one audience option a clear majority in each room and verify the consequence, log source, and persistent state match the chosen option.
3. Complete the intended evidence path and humane seal, then replay the final room through the ambulance tunnel. Confirm both endings are reachable and their recaps differ.
4. In a separate run, deliberately skip required interactions in each act and advance. Confirm a warning names the missing actions, a checkpoint is created, and no run becomes unfinishable.
5. Record wall-clock time to first objective, first interaction, first consequence, each room transition, and ending. Report median and range across players; do not substitute engine target constants for observed times.
6. Capture player confusion, dead air over 25 seconds, missed affordances, and any moment the streamer cannot explain what chat changed. Turn those observations into fixes before presenting a 10–15-minute rehearsal claim.

The automated campaign tests validate deterministic state transitions, fallback safety, checkpoint recovery, inventory consequences, camera persistence, distinct endings, and pacing instrumentation. They do not replace human pacing or comprehension tests.
