# NightShift Live RC8 — 2:52 judging-video narration and screen copy

Target runtime: **172 seconds**. Use media from the exact final release candidate. The real-Twitch, native-OBS, Codex, accessibility/human-QA, and closing-card sources are mandatory and must pass the evidence validator before assembly.

| Final time | Source | Narration | Screen copy |
| --- | --- | --- | --- |
| 0:00–0:07 | Exact-release humane dawn | “This is NightShift Live: a hospital horror game where chat changes the Ward—but the streamer still has to survive it.” | `CHAT CHANGES THE WARD. YOU SURVIVE IT.` |
| 0:07–0:20 | Title + Reception | “Five connected acts carry one persistent case, one streamer, and an audience that can help or sabotage.” | `5 ACTS · 1 PERSISTENT CASE` / `STREAMER ACTIONS + AUDIENCE CONSEQUENCES` |
| 0:20–0:44 | Genuine Twitch broadcaster + separate viewer | “A real viewer sends the command. EventSub accepts it once, the vote becomes authoritative, and the result physically changes the room.” | `REAL TWITCH · SEPARATE VIEWER` / `[COMMAND] → [ACCEPTED RESULT] → [WORLD CHANGE]` |
| 0:44–0:58 | Native OBS Studio | “The same sanitized state reaches a passive OBS Browser Source with transparent graphics, readable captions, and only one audio controller.” | `NATIVE OBS BROWSER SOURCE` / `TRANSPARENT · CAPTIONED · NO DOUBLED AUDIO` |
| 0:58–1:10 | Actual Codex thread + source/tests | “Codex helped turn the concept into the campaign, Twitch lifecycle, cinematic interface, audio, accessibility, tests, and release evidence.” | `BUILT WITH CODEX` / `SESSION 01a1976e-d289-7a22-9e87-7aefa57d3379` |
| 1:10–1:27 | Ward 06 result, clues, door | “Chat changes power or light. The streamer still reads the restraint marks, decodes the intercom, returns to the threshold, and opens the door.” | `CHAT CHANGES CONDITIONS` / `THE STREAMER MAKES THE MOVE` |
| 1:27–1:44 | Theatre lamps, tape, Warden counter | “Evidence changes counterplay. Aligning the lamps and decoding the confession creates the opening to repel the Warden.” | `EVIDENCE UNLOCKS COUNTERPLAY` |
| 1:44–1:58 | Generator arrival, `2 · 1 · 3`, grid consequence | “The Generator Room turns deduction into a physical sequence: two, one, three—then the emergency grid responds.” | `PHYSICAL PUZZLE · 2 → 1 → 3` |
| 1:58–2:08 | Five labeled audience-result cuts | “Each act gives the audience a different consequence while preserving the streamer's responsibility for what happens next.” | `5 DISTINCT AUDIENCE CONSEQUENCES`; retain `REHEARSAL / SIMULATED` on rehearsal media |
| 2:08–2:19 | Fresh accessibility + human-readability proof | “Captions, direction, contrast, reduced motion, and broadcast-scale readability keep the show understandable without relying on sound alone.” | `CAPTIONS · DIRECTION · CONTRAST · REDUCED MOTION` / `READABLE AT TWITCH SCALE` |
| 2:19–2:44 | Seal → roof → Mara → sunrise → recap | “The best ending is earned: the truth is decoded, the Warden is bound, Mara reaches the roof, and the soundscape carries the dawn.” | `MARA WALKS INTO DAWN` / `TRUTH DECODED · WARDEN BOUND · FALLBACKS 0` |
| 2:44–2:52 | Authored closing card | “NightShift Live: The Ward. Play the nightshift, inspect the source, and decide what follows.” | `NIGHTSHIFT LIVE: THE WARD` / `[LIVE URL]` / `[REPOSITORY]` / `BUILT WITH CODEX` |

## Mandatory capture rules

### Real Twitch, 0:20–0:44

Use one continuous cause-to-effect take where possible: separate viewer sends a displayed command; the game shows `LIVE TWITCH`; the authoritative event is accepted once; the vote resolves; the physical room and passive overlay show the matching result. Hide tokens and private identifiers. Rehearsal controls cannot substitute for this clip.

### Native OBS, 0:44–0:58

Show enough native OBS Studio chrome and Browser Source configuration to establish the application without exposing secrets, then return to the program canvas. Demonstrate alpha, a visible caption, correct fitting, refresh recovery, and a single active audio path. The browser overlay page alone is not native-OBS proof.

### Codex, 0:58–1:10

Show the real build conversation, one concise change/diff, and the final exact-commit verification result. Keep the session ID readable; hide account details, unrelated content, notifications, and personal local paths.

### Accessibility / human QA, 2:08–2:19

Use the final build. Show a caption preference affecting gameplay and overlay, reduced motion or high contrast, and compressed 640×360 playback. Mention unfamiliar users, NVDA, or listening results only when retained human evidence exists.

### Closing card, 2:44–2:52

Use final logged-out URLs. Do not display `SUBMITTED`, a repository host, or YouTube availability until each is true. Keep every line readable at half size.

## Media acceptance

- 1920×1080, H.264 video, stereo AAC, 30 fps unless a verified stable 60 fps source is used.
- Runtime exactly follows the validated plan and remains at or below 172 seconds.
- Every cut is resolved from the final evidence/milestone plan; no historical hard-coded source timestamps.
- Rehearsal remains labeled; `LIVE TWITCH` and `NATIVE OBS` appear only on authenticated/observed media.
- Preserve door, Warden, generator, and humane-ending action audio.
- Decode the humane-ending window and final 25 seconds; reject digital zero, excessive silence, terminal silence, clipping, nonfinite samples, missing coverage, or wrong channel/codec output.
- Review the finished video on headphones and speakers and at 50% player size.
- Reserve and reject collisions across every input, sidecar, manifest, normalized clip, `concat.txt`, plan/report, staging, backup, quarantine, and output path before any write.
- Promote with a same-directory atomic replacement; preserve and restore a prior valid output on any post-promotion failure, and require promoted bytes to match the verified staging SHA-256.
- Upload publicly only after final human review, then verify playback while logged out.

The edit plan and validator prove structural consistency, hashes, declared provenance, and media properties. They do not independently prove that a clip genuinely depicts two Twitch accounts, native OBS, human testing, or a Codex session; a human must verify those facts before upload.
