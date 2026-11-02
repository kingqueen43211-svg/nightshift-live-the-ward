# NightShift Live RC8 — authoritative submission pack

Status at source-record creation: **pre-promotion hosted baseline verified; this candidate's Sites-assigned identity is recorded in the generated post-publication handoff; external submission evidence still required**.

This is the current judge-facing record. RC6 and RC7 documents are historical. Replace a bracketed field only after the referenced public artifact exists and has been checked while logged out.

## Release identity

| Item | Current retained fact |
| --- | --- |
| Public game | <https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/> |
| Pre-promotion hosted baseline | RC8 / Site version 13 |
| Pre-promotion pushed source commit | `54b9cd1d7ab75d2c4d0bd051bf3ddef4fa4f431c` |
| Source candidate represented here | Post-audit assembler safety fix; assigned commit/Site version belongs in the generated post-publication handoff |
| Unit / contract | 160 total: 159 passed · 1 optional permission-gated symlink skip · 0 failed |
| Visual | 33/33 passed, including four true 640×360 captures |
| Browser gates | gameplay 9/9 · integrity 5/5 · relay 17/17 · accessibility/reflow 11/11 · performance 10/10 |
| Release audit | 12.0 MiB · 25 deployable files |
| Public parity | `app.mjs`, `audio.mjs`, `engine.mjs`, `public-state.mjs`, `twitch.mjs`, and `styles.css` byte-matched the commit; `index.html` matched after excluding the host-injected challenge script |

Any source change after the tested tree creates a new candidate. Rerun the complete gate, retain its output, push it, save/deploy a new Site version, and create a new external release handoff only after parity and logged-out smoke pass.

The source candidate reserves every evidence, tool, intermediate, report, staging, backup, quarantine, lock, and output path before the video builder writes; it checks canonical paths, filesystem identities, hardlinks, and reparse targets. An exclusive build-directory lock prevents mixed concurrent assembly, concat input is BOM-less UTF-8, and the final report is staged. Final-video promotion is same-directory and atomic, retains/restores a prior MP4 without deleting another process's destination, and requires promoted bytes to match the verified staging SHA-256. These protections are implemented and tested; genuine source clips and a finished MP4 remain **NOT VERIFIED**.

## Devpost fields

### Title

NightShift Live: The Ward

### Tagline

Chat changes the Ward. The streamer still has to survive it.

### Short description

NightShift Live is a five-act Twitch horror game show where viewers alter power, danger, resources, routes, and the Warden while the streamer investigates, solves physical puzzles, and earns the ending. It combines Twitch EventSub support, a broadcast control room, a passive OBS overlay, cinematic pseudo-3D scenes, captioned procedural audio, and truthfully labeled rehearsal fallbacks.

### Full description

Most Twitch interactions sit beside the content. **NightShift Live: The Ward** makes the audience part of the horror without replacing the streamer.

The streamer crosses five persistent acts—Reception / Triage, Ward 06, the Operating Theatre, the Generator Room, and the final exits. They move among authored camera nodes, inspect evidence, manage inventory, breach the isolation corridor, counter the Warden, solve the `2 · 1 · 3` power sequence, and commit to a physical route. Health, danger, power, evidence, inventory, story state, doors, decisions, and checkpoints persist across the episode.

Chat controls a parallel layer of the same world. Viewers choose displayed commands and join Guardian or Chaos factions. Results can restore or kill lights, create resources, reveal evidence, change danger, alter routes, and move the Warden through distinct phases. The audience changes the conditions; it cannot press the streamer's physical action buttons. If nobody votes, the game announces a **DIRECTOR FALLBACK** rather than inventing viewers.

The broadcast product is part of the game. A streamer control room exposes Twitch status, show state, rehearsal controls, checkpoints, pacing, privacy, accessibility, a four-bus audio mixer, and caption presentation. Passive gameplay and transparent-overlay routes receive sanitized state without becoming a second controller or doubling audio. Every meaningful procedural cue produces a synchronized visual caption.

Original room plates combine with independently animated fog, light, foreground props, doors, breakers, lamps, tape, routes, the Warden, and the humane rooftop ending. Reduced-motion and reduced-effects paths preserve state and meaning. The ending recap separates streamer decisions, audience resolutions, and fallbacks so the dramatic finish also explains how it was earned.

Twitch OAuth, Helix identity validation, and EventSub handling are implemented for chat, follows, subscriptions, cheers, and raids. The bridge validates callback state, deduplicates event IDs, monitors keepalives, handles reconnects, and keeps simulated input visibly separate from authenticated input. Real two-account Twitch behavior remains **NOT VERIFIED** until the required recording exists.

## How Codex was used

Codex was the primary build partner for campaign and interaction design, original-asset integration, Twitch lifecycle hardening, deterministic game logic, responsive UI, audio and captions, accessibility and safety, automated browser gates, release optimization, truth auditing, and the final evidence pipeline.

Primary Codex session ID: `01a1976e-d289-7a22-9e87-7aefa57d3379`.

Show the real thread and a concise diff/test result in the judging video. Hide tokens, account information, unrelated messages, notifications, and personal local paths.

## Four judging criteria

- **Innovation / idea:** audience agency and streamer agency are distinct, simultaneous, and physically reconciled in one persistent horror world.
- **Potential impact:** each round gives viewers a legible way to help or sabotage while streamers get replayable routes, clip-ready threat beats, no-chat continuity, and one production console.
- **Technological implementation:** deterministic campaign engine, OAuth/Helix/EventSub lifecycle, immutable-viewer fairness, persistent state, sanitized passive OBS transport, procedural captioned audio, and fail-closed release/evidence gates.
- **Design:** five cinematic acts, authored camera compositions, readable physical targets, staged door/curtain/lamp/breaker/Warden choreography, compact broadcast HUD, accessibility controls, and an earned rooftop dawn.

## Judge path

1. Open the public game logged out.
2. Choose **How to Play**, then **Enter the Nightshift**.
3. In Reception, move to **Records**, complete the visible actions, and resolve the clearly labeled rehearsal result if no authenticated channel is connected.
4. Follow **Next Step** into Ward 06: inspect restraint marks, decode the intercom, lock the audience condition, then return to **Threshold** and physically open the door.
5. Continue through lamps/tape/Warden counterplay, the `2 · 1 · 3` generator sequence, Warden seal, and roof route to earn **MARA WALKS INTO DAWN**.
6. Open **Control room** for Twitch status, sound/caption/accessibility controls, and the passive OBS routes.

Simulation is an intentional no-credentials judge path, not live-Twitch proof.

## Required final URLs

- Live game: <https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/>
- Source repository: **[NOT VERIFIED — ADD FINAL PUBLIC/REVIEWER-ACCESSIBLE URL]**
- Public YouTube demo: **[NOT VERIFIED — ADD FINAL LOGGED-OUT URL]**
- Primary Codex session: `01a1976e-d289-7a22-9e87-7aefa57d3379`

## External evidence checklist

### Exact source and release

- [ ] Final commit is pushed to the submitted repository with assets, licenses, setup, and no secrets.
- [ ] A clean clone starts and its complete `npm run verify` passes.
- [ ] Repository, Site, source archive, recording, and final video identify the same final commit or disclose an exact delta.

### Twitch and OBS

- [ ] Broadcaster authorization plus a separate viewer creates one genuine accepted chat action.
- [ ] The command changes the world and matching passive overlay; duplicate/invalid input does not mutate state.
- [ ] Native OBS Studio is recorded at 1920×1080 and 1280×720 with transparency, captions, correct fit, refresh recovery, and one audio path.
- [ ] No rehearsal input or browser-only overlay is presented as that proof.

### Human quality

- [ ] Five unfamiliar-player sessions retain time to first action, help/stuck points, errors, pacing, route, and ending.
- [ ] A compressed 640×360 playback reading check is documented.
- [ ] Native NVDA spoken output is checked.
- [ ] Headphone and speaker reviews cover cues, ending soundscape, balance, clipping, and caption timing.
- [ ] A 30-minute Chrome + native OBS soak is retained.

### Video and submission

- [ ] Exact-release full audiovisual recording is nonzero, complete, captioned, zero-fallback for the earned humane route, and has a decoded audible ending.
- [ ] The 2:52 MP4 follows [`RC8_DEMO_NARRATION.md`](RC8_DEMO_NARRATION.md), includes genuine Twitch/OBS/Codex footage, preserves truth labels, and passes final media validation.
- [ ] YouTube plays logged out, is public, and is no longer than three minutes.
- [ ] Devpost contains the final game, repository, video, truthful description, and Codex session ID.
- [ ] Devpost visibly shows **Submitted**, not Draft, before the deadline.

## Truth gate

Real Twitch, native OBS, human/NVDA/listening review, a new exact-commit recording, the finished 2:52 MP4, public repository/YouTube, and Devpost submission are **NOT VERIFIED** unless the matching retained evidence exists. Filenames, sidecars, fixtures, simulated votes, zero-byte captures, and automated tests cannot close those gates by themselves.
