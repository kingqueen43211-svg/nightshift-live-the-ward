# Twitch integration truth and verification contract

Updated: 2026-11-01

## Current truth

The browser bridge implements Twitch OAuth token capture, Helix identity validation, EventSub WebSocket subscriptions, chat/event normalization, duplicate notification rejection, keepalive monitoring, requested reconnect handling, exponential reconnect fallback, revocation reporting, and explicit connection phases.

It has **not** been verified with real broadcaster credentials or a second Twitch viewer. Until that test happens, every UI and submission statement must say `IMPLEMENTED / UNVERIFIED LIVE`. Local trigger buttons are rehearsal events and are not Twitch proof.

## Explicit connection phases

- `DISCONNECTED`
- `AUTHORIZING`
- `CONNECTING`
- `LIVE_TWITCH`
- `RECONNECTING`
- `AUTH_EXPIRED`
- `ERROR`

Only `LIVE_TWITCH` sets `connected: true`. Rehearsal mode remains owned by the game shell and must never be promoted to this phase.

## Implemented safeguards

- OAuth callback accepts a token only when the returned state matches the stored one, then removes the fragment from browser history.
- Authorization errors, mismatched state, expired validation, missing scopes, malformed EventSub packets, subscription revocation, socket failure, and keepalive timeout produce readable status states.
- Critical `channel.chat.message` subscription must succeed before the bridge reports live. Follow, subscription, cheer, and raid subscriptions are optional and their unavailable types are reported.
- EventSub notification IDs are retained in a bounded 500-entry dedupe window.
- Normalized chat includes immutable viewer ID and EventSub source ID in addition to display name.
- Twitch-requested reconnect keeps the old socket until the replacement receives `session_welcome`.
- Unexpected disconnect uses bounded exponential backoff, revalidates the token, and recreates subscriptions.
- Manual disconnect invalidates in-flight validation/subscription work, cancels timers, and cannot be reversed by a stale async continuation.
- Optional EventSub revocations remain a degraded live-chat session; a critical chat revocation is fatal and closes the socket.
- Transient Twitch phases disable simulated input and freeze the current vote window until live input returns or the broadcaster explicitly clears back to simulation.
- The opt-in local relay carries sanitized public state between Chrome and OBS without exposing viewer maps, EventSub IDs, or checkpoint snapshots.

## Automated proof

Run:

```text
node --test tests/twitch.test.mjs
```

Covered Twitch lifecycle cases:

1. OAuth state mismatch rejection and fragment scrubbing.
2. Expired validation token removal and `AUTH_EXPIRED` state.
3. Critical chat subscription plus optional subscription failure reporting.
4. Critical subscription cleanup and subscription metadata replacement.
5. Clear during validation and disconnect during subscription creation.
6. Optional versus critical subscription revocation behavior.
7. Duplicate EventSub notification rejection.
8. Twitch-requested seamless reconnect socket handoff.
9. Keepalive timeout transition and socket closure.

`tests/runtime-mode.test.mjs`, `tests/broadcast.test.mjs`, and `tests/relay.test.mjs` separately cover fake/live vote separation, frozen reconnect clocks, one-controller publishing, strict incoming-state validation, privacy redaction, and the same-origin cross-process relay.

These tests use deterministic fakes. They establish transport behavior, not Twitch service interoperability.

## Mandatory real-channel acceptance test

1. Register the correct redirect URL in a Twitch developer application.
2. Authorize a broadcaster in a private test channel. Do not record or expose the access token.
3. Confirm the dashboard reports `LIVE_TWITCH`, broadcaster identity, and active chat subscription.
4. From a separate viewer account, send an eligible vote command.
5. Capture one continuous recording showing Twitch chat from the separate viewer account, the accepted vote, vote tally, physical in-world effect, dashboard audit entry, and matching OBS state. Do not expose the raw immutable viewer ID on screen.
6. Deliver the same EventSub notification ID twice and prove only one mutation occurs.
7. Send a second vote from the same viewer and prove the one-vote-per-round rule rejects it without changing the tally.
8. Trigger reconnect, wait for `LIVE_TWITCH` recovery, then accept a new command.
9. Revoke/expire the token and prove the UI enters `AUTH_EXPIRED` without presenting rehearsal as live.

Mark the integration `VERIFIED LIVE` only when all nine steps are evidenced. The current result remains `UNVERIFIED LIVE`.

## Known architectural limit

The current static client still uses Twitch's browser token flow and stores the token in local browser storage. OAuth state validation reduces callback forgery risk, but a public production deployment should move authorization-code/PKCE or confidential token handling and authoritative EventSub/session state to a server. Do not expose this static control surface as an unauthenticated public admin route.
