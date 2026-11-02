# NightShift Live — 2:52 judging-video narration and screen copy

This script matches `docs/demo-video/demo-edl.json` exactly: **172 seconds**. Use the corrected exact-release proof, not the audited `02-33-43-114Z` recording. The real-Twitch, native-OBS, Codex, accessibility/human-QA, and closing-card clips are mandatory source assets.

Narration is optional under the current event rules, but the lines below give the edit a coherent story. If narration is omitted, use the shorter **screen copy** verbatim and let the game's sound and captions carry the physical beats.

| Final time | Source | Narration | Screen copy |
|---|---|---|---|
| 0:00–0:07 | Corrected final proof: humane dawn | “This is NightShift Live: a hospital horror game where chat changes the Ward—but the streamer still has to survive it.” | `CHAT CHANGES THE WARD. YOU SURVIVE IT.` |
| 0:07–0:20 | Title + Reception | “Five connected acts carry one persistent case, one streamer, and an audience that can help or sabotage.” | `5 ACTS · 1 PERSISTENT CASE` / `STREAMER ACTIONS + AUDIENCE CONSEQUENCES` |
| 0:20–0:44 | **Genuine Twitch broadcaster + separate viewer** | “A real viewer sends the command. EventSub accepts it once, the vote becomes authoritative, and the result physically changes the room.” | `REAL TWITCH · SEPARATE VIEWER` / `[COMMAND] → [ACCEPTED RESULT] → [WORLD CHANGE]` |
| 0:44–0:58 | **Native OBS Studio** | “The same sanitized state reaches a passive OBS Browser Source with transparent graphics, readable captions, and only one audio controller.” | `NATIVE OBS BROWSER SOURCE` / `TRANSPARENT · CAPTIONED · NO DOUBLED AUDIO` |
| 0:58–1:10 | **Actual Codex thread + source/tests** | “Codex helped turn the concept into the campaign, Twitch lifecycle, cinematic interface, audio, accessibility, tests, and release evidence.” | `BUILT WITH CODEX` / `SESSION 01a1976e-d289-7a22-9e87-7aefa57d3379` |
| 1:10–1:27 | Ward 06 result, clues, door | “Chat changes power or light. The streamer still reads the restraint marks, decodes the intercom, returns to the threshold, and opens the door.” | `CHAT CHANGES CONDITIONS` / `THE STREAMER MAKES THE MOVE` |
| 1:27–1:44 | Theatre lamps, tape, Warden counter | “Evidence changes counterplay. Aligning the lamps and decoding the confession creates the opening to repel the Warden.” | `EVIDENCE UNLOCKS COUNTERPLAY` |
| 1:44–1:58 | Generator arrival, `2 · 1 · 3`, grid consequence | “The Generator Room turns deduction into a physical sequence: two, one, three—then the emergency grid responds.” | `PHYSICAL PUZZLE · 2 → 1 → 3` |
| 1:58–2:08 | Five labeled audience-result cuts | “Each act gives the audience a different consequence while preserving the streamer's responsibility for what happens next.” | `5 DISTINCT AUDIENCE CONSEQUENCES` / retain `REHEARSAL / SIMULATED` on rehearsal clips |
| 2:08–2:19 | **Fresh accessibility + human-readability proof** | “Captions, direction, contrast, reduced motion, and broadcast-scale readability keep the show understandable without relying on sound alone.” | `CAPTIONS · DIRECTION · CONTRAST · REDUCED MOTION` / `READABLE AT TWITCH SCALE` |
| 2:19–2:44 | Seal → roof → Mara → sunrise → recap | “The best ending is earned: the truth is decoded, the Warden is bound, Mara reaches the roof, and the soundscape carries the dawn.” | `MARA WALKS INTO DAWN` / `TRUTH DECODED · WARDEN BOUND · FALLBACKS 0` |
| 2:44–2:52 | **Authored closing card** | “NightShift Live: The Ward. Play the nightshift, inspect the source, and decide what follows.” | `NIGHTSHIFT LIVE: THE WARD` / `[LIVE URL]` / `[REPOSITORY]` / `BUILT WITH CODEX` |

## Capture notes by mandatory external clip

### Real Twitch, 0:20–0:44

Use one continuous cause-to-effect take wherever possible:

1. show the separate viewer sending the displayed command in Twitch chat;
2. show the game in `LIVE TWITCH` mode;
3. show accepted vote/event state without revealing tokens or private identifiers;
4. hold through the visible physical change and matching overlay state.

If that footage does not exist, the judging video is not ready. Do not replace it with the rehearsal input box.

### Native OBS, 0:44–0:58

Show enough of OBS Studio to establish that it is the native application, briefly reveal the Browser Source configuration without secrets, then return to the program canvas. Include a visible caption and a single active audio path. The browser `?view=overlay` page by itself is not this proof.

### Codex, 0:58–1:10

Show the real build thread, one concise change or diff, and the final verification result. Keep the session ID readable. Hide account details, unrelated messages, local paths that reveal personal information, OAuth values, and notifications.

### Accessibility / human QA, 2:08–2:19

Use fresh footage from the final build. Show a caption preference changing the gameplay and overlay rail, reduced motion or high contrast, and a real 50%-player readability check. Mention NVDA or newcomer results only when retained human evidence exists.

### Closing card, 2:44–2:52

Use final logged-out URLs. Do not display `SUBMITTED`, a repository host, or YouTube availability until each is true. Keep the card legible at half size and free of third-party copyrighted material.

## Audio and edit checks

- Preserve original action audio for the door, Warden, generator, and humane ending.
- The ending must contain intended audible score or ambience throughout its 25-second selection; reject digital-zero tails.
- Normalize dialogue and game audio for clarity without crushing impact cues.
- Use only original or properly licensed material.
- Keep every text card readable at 50% player size.
- Preserve `REHEARSAL / SIMULATED` on rehearsal footage and `LIVE TWITCH` only on authenticated footage.
- Export at 1920×1080, 30 fps, H.264 video, stereo AAC audio; verify the final duration is **172 seconds or less**.
- Upload publicly to YouTube and confirm playback logged out before adding the link to Devpost.
