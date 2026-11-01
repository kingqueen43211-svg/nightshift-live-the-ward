# V3 quality tracker

Status vocabulary: PASS only when evidenced in the running build; PARTIAL for implemented but incomplete; FAIL for a known blocker; NOT TESTED for missing proof.

| Gate | Status | Evidence / blocker |
|---|---|---|
| S0 current-build inspection | PARTIAL | Source, routes, local 1280×720 title/gameplay, and tests inspected. Formal multi-viewport captures and console/performance logs remain. |
| S1 gold-standard corridor | PARTIAL | Physical multi-part door, foreground occluders, parallax layers, staged Warden states, and streamer counterplay implemented. Three camera nodes, fully linked reflection/shadow, authored Warden pose frames, capture matrix, and measured FPS remain. |
| S2 coherent 10–15 minute section | FAIL | Mechanics expanded, but no newcomer uncut 10–15 minute playtest exists. |
| S3 full campaign | FAIL | No measured 20–35 minute campaign or three independent full runs. |
| S4 real Twitch + OBS | NOT TESTED | Code path exists; broadcaster authorization and second viewer are required. Simulation only. |
| S5 compositor-wide polish | PARTIAL | 1280×720 visually inspected and action/vote collision corrected. Full matrix, keyboard, captions, performance, and long-session tests remain. |
| S6 independent design review | NOT TESTED | Requires four independent reviewers after S1–S5. |

## Automated evidence

- `npm run check`: PASS
- Node syntax checks: PASS
- Engine tests: 13 passed, 0 failed
- New V3 tests cover Subject 06 deduction, isolation breach prerequisites/door state, and Warden counter prerequisites.
- 1280×720 geometry probe: 0 intersections across mission, meters, case file, player action rail, vote panel, and event toast; 0 visible actionable controls outside the viewport; 0 clipped primary panels.

## Truth table

| Capability | Implemented | Visually inspected | Real Twitch verified |
|---|---:|---:|---:|
| Cinematic title | yes | yes, 1280×720 | n/a |
| Streamer investigation/deduction | yes | yes, opening actions | n/a |
| Physical isolation door | yes, first pass | pending door-state capture | no |
| Guardian/Chaos vote engine | yes | yes, rehearsal UI | no |
| OBS overlay | yes, local route | not in actual OBS | no |
| Five-room progression | yes | opening room only in V3 pass | no |
| 20–35 minute campaign | no | no | no |
| Public logged-out deployment | no | auth gate confirmed | no |

## Current quality risks

1. Static Warden art remains the largest visual credibility gap.
2. CSS-only door perspective can look flat without authored frames and linked floor reflection.
3. The current build changes full room plates after a wipe; V3 requires connected camera travel.
4. Local client authority is insufficient for production Twitch proof.
5. No independent asset license/provenance manifest yet.
