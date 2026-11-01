# Public deployment and release gate

The playable build is static and can be hosted without a game server. A release is public-ready only after the URL works in a logged-out private window and the checks below pass. The existing authenticated `chatgpt.site` preview is not sufficient judge access.

Static hosting is ideal for judge access. For the live OBS recording, use `npm start` and the explicit `relay=local` URLs documented below so a Chrome control window and OBS's separate browser process share state through the loopback-only relay. The relay carries no OAuth token and is not exposed beyond `127.0.0.1`.

## Preflight

Run from the repository root:

```powershell
npm run check
npm run qa:visual
npm run release:audit
```

`qa:visual` must finish with every automated viewport, alpha, and reduced-motion gate passing. `release:audit` fails on missing release files, likely committed credentials, payloads over 40 MiB, or single files over 4 MiB. Its image-size warnings are optimization work that must be reviewed rather than silently ignored.

## Deploy the static directory

The checked-in `netlify.toml` publishes `dist/` and runs the release audit during the build. Import the repository into Netlify, deploy, and use the assigned HTTPS origin. The `dist/_headers` file supplies a Twitch-compatible content security policy, conservative caching, and browser hardening on Netlify and Cloudflare Pages.

For another static host, publish only `dist/` and reproduce the policies in `dist/_headers`. The existing `.openai/hosting.json` also points to `dist/`, but that host is acceptable only if logged-out visitors can open the final URL.

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

## Rollback

Keep the last known-good static deployment available while promoting a candidate. If OAuth, asset loading, OBS alpha, or the visual matrix regresses, restore the previous deployment rather than changing truth labels or weakening a test threshold.
