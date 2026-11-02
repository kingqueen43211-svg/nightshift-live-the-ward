# Historical RC6 security and performance release review

> **Historical / superseded:** This file preserves the 2026-11-01 RC6 audit evidence and measurements. It is not the current release-status record. See [Status](./STATUS.md) and the [RC8 release gate](./RC8_RELEASE_GATE.md) for the active candidate, current totals, and remaining external gates.

Date: 2026-11-01  
Reviewed branch: `v3/gold-corridor`  
Scope: browser client, Twitch lifecycle, public/OBS state transport, loopback relay, static-server headers and caching, and deployable payload

## Historical RC6 release verdict

At the time of this RC6 review, no known P0 or P1 defect remained in the locally reviewable scope after the fixes below. The candidate was considered suitable for a controlled hackathon demonstration, but this was not a production security certification. Real Twitch interoperability, native OBS behavior, public-host configuration, and a native 30-minute Chrome+OBS run remained external gates.

Evidence captured against the RC6 working tree reviewed on 2026-11-01:

- security/transport/Twitch subset: **22/22 tests passed**;
- full unit/contract suite: **90/90 tests passed** in the final RC6 composite;
- focused integrity browser smoke: **5/5 passed**, with zero browser-console errors;
- expanded visual/browser matrix: **29/29 passed**, with zero browser-console errors;
- accessibility browser gate: **11/11 passed** across keyboard-only operation, focus, accessibility tree, contrast, and 200%-zoom-equivalent reflow;
- performance browser gate: **10/10 passed** across cold load and eight measured full-campaign cycles;
- release audit: **passed**, **12.0 MiB across 24 deployable files**, with no file over the 4 MiB hard limit.

## Trust boundaries

1. **Twitch:** OAuth and Helix/EventSub responses are remote input. Display names, messages, event payloads, subscription status, reconnect URLs, and authorization failures are treated as untrusted.
2. **Authoritative browser tab:** one non-passive tab owns the local game state. Local storage holds the public Client ID, OAuth access token, preferences, and a short controller lease. It is not a server authority.
3. **Same-profile transport:** `BroadcastChannel` is a convenience transport between same-origin browser tabs. It is not trusted merely because it is same-origin; received state is validated before use.
4. **Cross-process OBS transport:** the optional `relay=local` path sends a sanitized state message to a loopback-only Node server and receives it through SSE. The relay never receives the Twitch token.
5. **Passive OBS views:** `view=overlay` and `role=mirror` are consumers. They do not tick the engine, generate simulated votes, acquire a controller lease, or publish state.
6. **Public static host:** `dist/` is independently deployable. Host behavior is trusted only after the final HTTPS origin and its effective headers are checked logged out.

## Fixed release defects

### Twitch lifecycle and truthfulness

- Connection-generation guards now invalidate stale validation, subscription, socket-welcome, and reconnect continuations. **Clear** or **Disconnect** cannot be reversed by an older asynchronous operation.
- A failed critical chat subscription closes the failed socket, clears the keepalive watchdog and subscription metadata, and never reports live.
- Fresh EventSub sessions replace subscription metadata instead of accumulating it.
- Helix `401`, and required-scope `403`, clear the persisted bearer token and identity and enter `AUTH_EXPIRED`.
- Optional event subscription failures and revocations remain a degraded live-chat session with explicit unavailable-capability metadata. Critical chat revocation remains fatal.
- Duplicate EventSub IDs are bounded and ignored after first delivery. Keepalive timeout, Twitch-requested seamless reconnect, and exponential reconnect fallback are covered by deterministic tests.
- Transient Twitch phases no longer switch the game to simulation. They disable simulated input and freeze the live vote clock; reconnect restores the unavailable time instead of blending fake and real votes or resolving a silent fallback.
- Rehearsal vote labels are explicit, and the former fabricated viewer number is now the actual round vote count.

### OBS transport integrity and privacy

- A 3.2-second local-storage lease permits only one same-profile controller to publish. The lease is renewed by the owner and released on clean unload.
- Overlay and full-scene mirror routes are passive, including when running in a separate OBS browser process.
- Incoming state must pass `isValidPublicState`. Validation covers authored room/camera bounds, mode and status allowlists, meter and vote limits, render-critical nested structures, bounded strings/arrays, and privacy invariants.
- The public-state serializer always removes per-viewer vote maps, faction membership, EventSub IDs, and recursive checkpoint snapshots. With **Hide viewer names** enabled, visible actors are also redacted. A seeded username is absent from the serialized payload in both unit and browser evidence.
- The local relay binds only to `127.0.0.1`, accepts only same-origin JSON POSTs, caps messages at 256 KiB, validates the complete public state before broadcast, and uses `no-store` SSE responses. Cross-origin and malformed POSTs are rejected in integration tests.
- The passive consumer applies the same validator to both BroadcastChannel and SSE messages, so the relay does not create a weaker ingress path.

### Static delivery and dependency hardening

- HTML is `no-cache`; modules, CSS, assets, and fonts use a five-minute cache with `must-revalidate`, avoiding the former long-lived cache risk on non-fingerprinted filenames.
- CSP restricts scripts, fonts, images, connections, frames, forms, and objects to the required sources. OAuth/Twitch endpoints are explicitly allowlisted. Camera, microphone, and geolocation are disabled by Permissions Policy.
- Space Grotesk and DM Mono are bundled locally under OFL 1.1, eliminating the Google Fonts runtime dependency and allowing the external font origins to be removed from CSP.
- The release audit rejects likely committed OAuth secrets, missing required modules/fonts, oversized files, a public payload above 40 MiB, and insecure non-loopback HTTP URLs.

## Performance assessment

### Verified locally

- The deployable directory is **12.0 MiB across 24 files**. No file exceeds the 4 MiB release-audit limit.
- Twelve large referenced images were converted to visually verified WebP derivatives with a documented **59.0% byte reduction**, preserved dimensions, and preserved transparency where applicable. Lossless sources remain outside `dist/`.
- The 29-state Chromium matrix covers 390×844 through 1920×1080, all 15 authored camera compositions, Warden and door fixtures, the humane-ending rooftop tableau, dashboards, transparent overlays, and reduced motion. It recorded no current geometry, overflow, alpha, motion, or console failure.
- The focused browser integrity run recorded no echo storm: the controller produced traffic while the passive overlay produced zero posts.
- Procedural audio is gesture-gated, reuses room ambience nodes, tracks one-shots, and has deterministic cleanup tests. Reduced-effects mode removes the noisy threat transients.
- Reception cold start transfers **1.006 MiB** and no hidden V3 Warden/curtain/gurney/door asset. Those scene assets load only when the relevant room or threat phase becomes active.
- Across the latest eight measured full-campaign cycles, forced-GC JavaScript heap changed by **0.203 MiB**; the final DOM delta was **-223** and the final listener delta was **0**; relay posts remained between **67–70 per cycle**; network, browser console, process teardown, and profile cleanup all passed.

### Remaining performance risks

- The cinematic image set is still the dominant transfer cost. A cold, throttled mobile/network pass on the final public origin is required; local screenshots do not measure first contentful paint or decode time.
- The built-in loopback server intentionally favors a dependency-free demo path and does not gzip/Brotli-compress static text. A production CDN should provide compression and HTTP/2 or HTTP/3.
- The local relay posts the latest public state on renders and relies on browser/loopback backpressure. The demo rate is small and bounded by the client loop, but a production multi-streamer service needs coalescing, per-session authorization, quotas, and telemetry.
- The eight-cycle headless soak is strong local leak evidence, but it is not a 30-minute native Chrome+OBS CPU/GPU/frame-time trace. Animated fog, rain, compositing filters, Web Audio, SSE, and OBS still require that production-shaped run.
- Audio quality, OBS audio routing, GPU behavior, and mobile battery impact are not proven by unit or headless-browser tests.

## Known residual security limits

- The static client uses Twitch's browser token flow and stores the access token in browser local storage. OAuth state matching and fragment scrubbing reduce callback risk, but any same-origin script compromise can still access that token.
- CSP retains `'unsafe-inline'` for styles because runtime meters and authored state use inline style properties. Script execution remains self-only, but production hardening should move dynamic presentation to classes or nonced styles where practical.
- The loopback relay is a single-machine demo transport, not authenticated multiplayer infrastructure. Same-origin POST checks protect normal browser use, but another local process running as the same user is outside this boundary.
- `BroadcastChannel` and the lease prevent accidental duplicate controllers; they are not defenses against malicious same-origin code.
- The game engine is browser-authoritative. A hosted multi-streamer product needs authorization-code/PKCE or a confidential backend, encrypted refresh-token storage, signed sessions, server-side rate limiting/moderation, audit logs, and centralized authoritative state.
- The final host can weaken or omit checked-in headers. Effective production headers must be inspected after deployment.

## Historical RC6 external release gates

1. Re-check effective production CSP/MIME/cache behavior in a clean browser; all public routes and assets return 200, but the current Sites host does not apply the checked-in Netlify `_headers` policy.
2. Use a broadcaster and separate viewer account to record chat command → accepted vote → physical world change → matching OBS state. Exercise reconnect, token expiry, and one real optional channel event.
3. Capture the passive full-scene mirror and compact transparent overlay inside native OBS at 1920×1080 and 1280×720. Confirm alpha, audio, and zero competing-controller behavior.
4. Run a 30-minute Chrome + OBS soak and record frame time, CPU/GPU, memory trend, relay request rate, reconnect recovery, and audio cleanup.
5. Complete NVDA and human browser-native zoom/perception checks. Keyboard-only operation, computed contrast, and 200% zoom-equivalent reflow pass automated browser gates, but do not establish WCAG conformance.
6. Run newcomer playtests and report measured timing and comprehension. Do not replace human evidence with engine targets.

The historical RC6 conclusion was: **RC6 locally verified, with public promotion and a fresh anonymous production probe pending; live Twitch, native OBS, effective production-header review, native 30-minute performance, NVDA, and human usability remain unverified external evidence**. The already probed public Site was evidence for the prior baseline, not proof that RC6 was deployed. For the active candidate, use [Status](./STATUS.md) and the [RC8 release gate](./RC8_RELEASE_GATE.md).
