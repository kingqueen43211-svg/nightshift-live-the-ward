# Public deployment and release gate

The playable build is static and can be hosted without a game server.

**Current production demo:** [https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/](https://nightshift-live-ward.chinnaaa-2023.chatgpt.site/)

The URL and its previously deployed source were verified publicly. The modified RC4 candidate is **not** considered promoted merely because this document exists; record a clean `npm run verify`, save/deploy the exact candidate commit, and repeat the logged-out public probe before describing RC4 as the verified production build.

On 2026-11-01, a stateless no-cookie request returned HTTP 200 with the game title and no login copy. A 26-request matrix covered all 23 deployable files plus the dashboard, overlay, and passive-mirror entry URLs with zero failures. The deployed `app.mjs`, `engine.mjs`, `styles.css`, and `twitch.mjs` hashes matched the pushed source byte-for-byte. The host rewrites the HTML shell, so `index.html` was verified by content rather than a raw hash.

The Sites serving layer does not interpret Netlify's `dist/_headers` file; the public probe did not observe that file's CSP response header. Do not claim the checked-in Netlify headers are active on this host. The app contains no client secret or shared server authority, and real Twitch/OBS verification remains a separate gate.

Static hosting is ideal for judge access. For the live OBS recording, use `npm start` and the explicit `relay=local` URLs documented below so a Chrome control window and OBS's separate browser process share state through the loopback-only relay. The relay carries no OAuth token and is not exposed beyond `127.0.0.1`.

## Preflight

Run from the repository root:

```powershell
npm run verify
```

The composite command covers unit, visual, campaign, integrity, separate-process relay, accessibility/reflow, performance-soak, and release-payload gates. `release:audit` fails on missing release files, likely committed credentials, payloads over 40 MiB, or single files over 4 MiB.

RC4 additionally requires the finding-to-proof checks in [`RC4_JUDGE_FIX_CONTRACT.md`](RC4_JUDGE_FIX_CONTRACT.md): visible next-step progression, exact/no-op-safe item consequences, dynamic multi-depth camera travel, active-target/HUD separation, staged physical reactions, persistent audience state, and three clean visible-guidance campaigns.

## Deploy the static directory

The checked-in `netlify.toml` publishes `dist/` and runs the release audit during the build. Import the repository into Netlify, deploy, and use the assigned HTTPS origin. The `dist/_headers` file supplies a Twitch-compatible content security policy, conservative caching, and browser hardening on Netlify and Cloudflare Pages.

For another static host, publish only `dist/` and reproduce the policies in `dist/_headers`. The existing `.openai/hosting.json` points Sites to `dist/`; re-run the stateless public matrix after any deployment or access-policy change.

Do not place a Twitch client secret or access token in the repository or hosting environment. This build needs only the public Client ID entered by the broadcaster in the control room.

## Register the Twitch callback

1. Copy the final HTTPS URL exactly, including its trailing `/`.
2. Add that exact URL to the app's OAuth Redirect URLs in the Twitch Developer Console.
3. Open the deployed control room, enter the public Client ID, and authorize the broadcaster.
4. Confirm the callback returns to the same origin, removes the token fragment from the address bar, and reaches `LIVE TWITCH` only after identity validation and EventSub subscription.
5. Complete the two-account evidence plan in `TWITCH_VERIFICATION.md`. Until then, live Twitch remains **UNVERIFIED**.

Preview domains and production domains are distinct OAuth callbacks. Register each one intentionally; a copied Client ID does not make an unregistered preview URL valid.

## Logged-out and broadcast verification

- Open the public gameplay, `?view=dashboard`, and `?view=overlay` URLs in a private window with no ChatGPT or hosting account session.
- Confirm every asset and module returns `200` and the browser console has no errors.
- Test once with network throttling. The current large PNG warnings identify the assets most likely to delay first interaction; replace them only with visually inspected derivatives.
- Add the overlay URL to OBS at both 1920×1080 and 1280×720, place a checkerboard or camera source below it, and capture proof of real alpha.
- For cross-process local capture, use `http://localhost:4173/?relay=local` in the authoritative Chrome controller, `http://localhost:4173/?role=mirror&relay=local` for a full-scene OBS source, and `http://localhost:4173/?view=overlay&role=mirror&relay=local` for the compact transparent overlay. Register `http://localhost:4173/` as the OAuth callback.
- Run a second-viewer chat command and preserve the timestamped evidence requested by `TWITCH_VERIFICATION.md`.
- Update the Twitch redirect and OBS URLs if the production domain changes.

After RC4 promotion, also confirm that the public build exposes the in-game next-step control, persistent audience/item status, spatial camera travel, generator levers, staged isolation door, and visible Warden repel behavior. Compare the deployed core-module hashes with the exact submitted commit; a healthy URL serving an older build is a failed release.

## Submission handoff

- Verify the repository at the exact submitted commit in a logged-out browser.
- Verify the YouTube demo is public, playable logged out, and no more than three minutes.
- Confirm the Devpost entry contains the public demo, repository, video, project description, and primary Codex session ID.
- Keep live Twitch, native OBS, five-unfamiliar-human, NVDA, and audible-mix claims marked pending unless their independent evidence packets exist.

## Rollback

Keep the last known-good static deployment available while promoting a candidate. If OAuth, asset loading, OBS alpha, or the visual matrix regresses, restore the previous deployment rather than changing truth labels or weakening a test threshold.
