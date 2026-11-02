# NightShift Live — historical RC7 submission pack

> **Superseded by [`RC8_SUBMISSION_PACK.md`](RC8_SUBMISSION_PACK.md).** Preserve this file as the RC7 planning record; do not use its release identity or pending placeholders as current evidence.

Status: **prepared copy; external evidence still required**. Replace every bracketed field only with a verified final URL or result. Do not submit a draft that still contains brackets.

Official source of truth:

- Rules: <https://twitchcon-codex.devpost.com/rules>
- Final-weekend checklist: <https://twitchcon-codex.devpost.com/updates/47341-final-weekend-make-your-project-come-alive>
- Deadline: **November 2, 2026, 2:00 PM Pacific / 4:00 PM Central**

## Devpost fields

### Title

NightShift Live: The Ward

### Tagline

Chat changes the Ward. The streamer still has to survive it.

### Short description

NightShift Live is a five-act Twitch horror game show where viewers alter power, danger, resources, routes, and the Warden while the streamer investigates, solves physical puzzles, and earns the ending. It combines real Twitch EventSub support, a broadcast control room, an OBS overlay, cinematic pseudo-3D scenes, captioned procedural audio, and truthfully labeled rehearsal fallbacks.

### Full description

Most Twitch interactions sit beside the content. **NightShift Live: The Ward** makes the audience part of the horror without replacing the streamer.

The streamer crosses five connected acts: Reception / Triage, Ward 06, the Operating Theatre, the Generator Room, and the final exits. They move between authored camera positions, inspect physical evidence, manage inventory, survive the isolation corridor, counter the Warden, solve the `2 · 1 · 3` power sequence, bind or evade the entity, and commit to a route. Health, danger, power, evidence, inventory, story state, doors, decisions, and checkpoints persist across the episode.

Chat controls a different layer of the same world. Viewers choose displayed commands and join Guardian or Chaos factions. Their results can restore or kill lights, create resources, reveal evidence, change danger, alter routes, and move the Warden through distinct threat phases. The audience changes the conditions; it cannot press the streamer's physical action buttons. If nobody votes, the game announces a **DIRECTOR FALLBACK** rather than inventing viewers.

The project is designed as a broadcast product, not only a game screen. A streamer control room exposes Twitch status, show state, rehearsal controls, checkpoints, pacing, privacy, accessibility, and a four-bus audio mixer. A passive browser route supplies a transparent OBS layout without becoming a second controller or doubling audio. Every meaningful procedural sound cue produces a synchronized visual caption, with persistent size, contrast, duration, speaker, and direction preferences.

The visual system uses original room plates plus independently animated fog, light, foreground props, doors, breakers, lamps, tape, routes, the Warden, and the humane rooftop ending. It remains usable with reduced motion and effects. The ending recap separates streamer decisions, audience results, and fallbacks so a dramatic finish never obscures how it was earned.

Twitch OAuth, Helix identity validation, and EventSub WebSocket handling are implemented for chat, follows, subscriptions, cheers, and raids. The bridge validates callback state, deduplicates event IDs, monitors keepalives, handles reconnects, and keeps simulated input visibly separate from authenticated live input.

The final entry will link the exact reviewed source, live build, and a sub-three-minute YouTube demonstration. The video must show a genuine separate-viewer Twitch command changing the game, actual OBS Studio capture, the strongest door/Warden/generator beats, the humane dawn, and the Codex development workflow. Until those clips exist, the five-minute rehearsal is supplementary engineering evidence only and is never described as live Twitch proof.

## How this addresses the four judging criteria

### Innovation / idea

NightShift separates audience agency from player agency. Viewers alter a persistent horror world while the streamer must still investigate, deduce, time reactions, solve sequences, use inventory, and choose the ending. That is materially different from a poll that selects the next video or presses the player's buttons for them.

### Potential impact

Every round gives viewers a legible way to help or sabotage, faction identity, a visible consequence, and a reason to return for different routes. Streamers get clip-ready threat beats, safe no-chat continuity, privacy controls, and one production surface instead of a collection of disconnected tools.

### Technological implementation and Codex

The project combines a deterministic campaign engine, Twitch OAuth/Helix/EventSub lifecycle, immutable-viewer vote fairness, bounded event deduplication, persistent state and checkpoints, sanitized cross-process OBS transport, gesture-gated procedural audio, synchronized captions, and automated browser gates. Codex helped design, implement, test, debug, optimize, package, and truth-audit these systems.

### Design

Five distinct acts use original cinematic imagery, authored camera compositions, readable physical targets, staged door/curtain/lamp/breaker/Warden choreography, a compact broadcast HUD, accessibility settings, and an earned rooftop dawn. The interface is designed to remain understandable to a first-time streamer while staying watchable at Twitch-player scale.

## How Codex was used

Codex was the primary build partner throughout the submission period. It helped:

- turn the streamer/audience split into a deterministic five-act campaign;
- implement the Twitch lifecycle, reconnect, fairness, privacy, and truth-label policies;
- build the pseudo-3D scene compositor, original-asset workflow, control room, and overlay;
- implement captioned procedural audio, accessibility preferences, and reduced-effects paths;
- create unit, contract, visual, gameplay, integrity, relay, accessibility, performance, release, and proof-capture gates;
- analyze independent judge feedback, reproduce the ending-audio failure, strengthen small-player readability and progression copy, and prepare exact release evidence;
- generate and reconcile the submission copy, video edit plan, and final release package without claiming external proof that had not occurred.

Primary Codex session ID: `01a1976e-d289-7a22-9e87-7aefa57d3379`.

Before submission, show the actual Codex thread and confirm the ID from the product's status surface. Do not expose tokens, account information, or unrelated conversation content in the video.

## Judge path

### Fast public path

1. Open **[FINAL LIVE URL]** in a logged-out browser.
2. Select **How to Play**, then **Enter the Nightshift**.
3. In Reception, move to **Records**, complete the visible actions, and resolve the labeled rehearsal result if no live channel is connected.
4. Follow the persistent **Next Step** panel into Ward 06; inspect the restraint marks and intercom, resolve the audience condition, then return to **Threshold** and physically open the door.
5. Continue through lamps/tape/Warden counterplay, the `2 · 1 · 3` generator sequence, Warden seal, and roof route to earn **MARA WALKS INTO DAWN**.
6. Open **Control room** to inspect Twitch status, audio/caption/accessibility controls, and the passive OBS route.

Simulation and rehearsal controls are deliberately labeled. They are a no-credentials judge path, not evidence that Twitch was connected.

### Clean-checkout path

Requirements: Node.js 20+.

```bash
git clone [FINAL REPOSITORY URL]
cd [FINAL REPOSITORY DIRECTORY]
npm start
```

Open `http://localhost:4173`. The preview server uses Node.js built-ins and does not require a dependency download. Run the current verification commands documented in `README.md`; record totals only from the final reviewed commit.

### Real Twitch path

1. Create or select a Twitch application and register the exact live callback URL.
2. In **Control room**, enter the Client ID and select **Connect Twitch**.
3. Authorize the broadcaster in Twitch; keep the OAuth fragment and token out of recordings.
4. Start the episode and have a separate viewer send one displayed command.
5. Show `LIVE TWITCH`, accepted authoritative input, the visible in-world consequence, and the matching passive overlay.

Do not substitute the rehearsal send box for this proof.

## Required URLs

- Live project: `https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/`
- Source repository: **[FINAL GITHUB / GITLAB / BITBUCKET URL]**
- Public YouTube demo: **[FINAL PUBLIC YOUTUBE URL]**
- Primary Codex session: `01a1976e-d289-7a22-9e87-7aefa57d3379`

## External evidence checklist

### Eligibility and source

- [ ] Final source, assets, license/provenance notes, and setup instructions are pushed to GitHub, GitLab, or Bitbucket.
- [ ] Repository is public, or a private GitHub/GitLab repository is shared with the reviewer address specified by the current Devpost rules.
- [ ] Clean checkout starts and the final verification suite passes on the exact submitted commit.
- [ ] Secret scan confirms no OAuth token, Client ID intended to remain private, email, credential, or generated browser profile is committed.
- [ ] Repository, live build, proof manifest, and release archive identify the same final commit or include a precise changed-file report.

### Twitch and OBS

- [ ] Exact public callback is registered in the Twitch developer application.
- [ ] Broadcaster authorization succeeds and a separate viewer sends a genuine command.
- [ ] The command is accepted once, an invalid/duplicate command does not mutate state, and the physical world plus passive overlay show the same consequence.
- [ ] Native OBS Studio Browser Source is captured at 1920×1080 and 1280×720 with transparency, captions, correct fit, refresh recovery, and no doubled audio.
- [ ] No simulated trigger, browser-only overlay, or generated telemetry is presented as the evidence above.

### Human quality

- [ ] Human headphone and loudspeaker review confirms the ending soundscape, action cues, mix, and caption timing.
- [ ] Five unfamiliar players record time-to-first-action, mistakes, help requests, stuck points, boredom points, routes, endings, and total duration.
- [ ] NVDA output is checked manually; no screen-reader conformance claim is made without that run.
- [ ] At least one 30-minute Chrome + native OBS session is monitored for frame pacing, audio, state recovery, and memory behavior.

### Video and Devpost

- [ ] All required real-evidence clips in `docs/demo-video/demo-edl.json` exist.
- [ ] The final cut follows `RC7_DEMO_NARRATION.md`, runs no longer than 2:52, and never relabels rehearsal footage.
- [ ] YouTube visibility is public, the video plays logged out, runtime is under three minutes, and real Twitch plus Codex footage appear clearly.
- [ ] Devpost fields contain the final live URL, repository URL, YouTube URL, truthful description, and primary Codex session ID.
- [ ] Team invitations, if any, are accepted.
- [ ] Devpost shows **Submitted**, not Draft, before the deadline.
- [ ] After the deadline, the submitted repository, video, and links remain unchanged until judging ends.

## Final truth gate

Do not write **verified**, **live**, **native OBS**, **human-tested**, **public repository**, **published video**, or **submitted** unless the corresponding checkbox above is backed by retained evidence. Automated tests support product claims; they do not replace accounts, native applications, people, or the final submission action.
