# Devpost Submission Pack

## Title

NightShift Live: The Ward

## Tagline

Twitch chat does not watch the nightmare. It directs it.

## Short description

NightShift Live is a cinematic Twitch-controlled horror game show. Viewers vote through chat to restore power, open routes, kill the lights, or release the creature, while follows, subscriptions, cheers, and raids become live story events. Streamers get a broadcast-ready experience, control room, and OBS overlay designed to create unforgettable clips.

## Full description

Most Twitch interaction sits beside the content. NightShift Live puts the audience inside it.

In **The Ward**, a streamer is trapped in an abandoned hospital and must restore three circuits before the entity reaches them. Every round presents two opposing outcomes. Guardians try to stabilize the ward; Chaos Crew makes it more dangerous. Viewers vote with commands in Twitch chat, and one active vote per viewer keeps the result legible and fair.

The winning choice changes the actual show state: progression, danger, health, lighting, visual effects, and monster proximity. Twitch channel events create larger broadcast moments. A follow sends a recovery pulse, a subscription intervenes, Bits trigger a detonation, and a raid breaches the ward.

The project includes a streamer control room, a transparent OBS Browser Source, deterministic rehearsal mode, manual production triggers, responsive visual design, original cinematic artwork, and an automated test suite for its voting and consequence engine.

### How it uses Twitch

NightShift authenticates the broadcaster with Twitch OAuth, validates identity through Helix, connects to EventSub over WebSocket, and subscribes to chat messages plus follow, subscription, cheer, and raid events. The app normalizes these signals into a deterministic game engine and shares state with the OBS overlay.

### How Codex was used

Codex was the primary build partner. It helped define a scope that could be completed before the deadline, generated and refined the visual direction, created original cinematic assets, implemented Twitch OAuth and EventSub, built the live voting engine and interfaces, wrote automated tests, and produced the architecture, setup, and judging materials. Add the Codex session ID from this build thread to the submission form.

### What is next

The same event engine can drive a fully navigable 3D ward, new genre packs, AI-generated safe announcer copy, audio stems, and cloud-synchronized show rooms. The hackathon version proves the essential promise: Twitch viewers can direct a beautiful live game, and the streamer gets a reliable product they can run tonight.

## Judging criteria

- **Innovation:** audience choices alter the horror experience itself, not only a poll or chatbot response.
- **Potential impact:** it produces repeatable participation, retention hooks, and clip-ready stream moments.
- **Technical implementation:** real Twitch OAuth/EventSub, deterministic state engine, cross-tab OBS sync, reconnect handling, and automated tests.
- **Design:** an original cinematic world, premium motion language, readable broadcast hierarchy, and a complete streamer-facing control room.

## Final submission checklist

- [ ] Push this complete folder to GitHub, GitLab, or Bitbucket.
- [ ] Make the repository public, or share the private GitHub/GitLab repository with `testing@devpost.com`.
- [ ] Confirm the README instructions work on a clean machine.
- [ ] Register the final demo URL as a Twitch OAuth redirect.
- [ ] Record a real Twitch vote and event.
- [ ] Upload a public YouTube video shorter than three minutes.
- [ ] Add the public demo URL and repository URL.
- [ ] Add the Codex session ID for this thread.
- [ ] Submit before November 2, 2026 at 4:00 PM Central Time.
