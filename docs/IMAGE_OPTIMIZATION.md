# Image optimization and verification

The public build uses verified WebP derivatives for every former PNG larger than 1 MB. After references were switched, the expanded visual matrix passed 28/28 and the browser campaign gate passed 8/8. Lossless PNG sources were moved out of the deployable directory to `art-source/`.

## Reproducible command

```powershell
node scripts/optimize-images.mjs --write
```

The dependency-free script uses the installed Chromium encoder through the DevTools protocol. It writes a report to `work/image-optimization/image-optimization-report.json`, outside the release bundle.

Defaults:

- opaque scene plates: WebP quality `0.94`;
- transparent character and prop art: WebP quality `1.0`;
- source threshold: 1,000,000 bytes;
- source PNGs are never deleted by the optimizer;
- output dimensions must exactly match;
- transparent inputs must remain transparent;
- mean alpha error must be no greater than `0.05` (the current run is exactly `0` for every asset);
- visible-color PSNR must be at least 35 dB.

Environment overrides are available as `IMAGE_OPTIMIZE_THRESHOLD`, `IMAGE_WEBP_QUALITY`, `IMAGE_WEBP_ALPHA_QUALITY`, and `QA_BROWSER`.

## Verified 2026-11-01 result

The eleven referenced source images total 27,704,661 bytes. Their public derivatives total 11,911,190 bytes, a reduction of 15,793,471 bytes or 57.0%. The superseded legacy `the-surgeon` source remains archived but its unused derivative is excluded from `dist/`.

- All 11 shipped dimension checks passed.
- All 6 shipped transparent assets retained transparency and had zero mean alpha error.
- Transparent sprites and props measured 49.57–51.99 dB visible-color PSNR.
- Opaque scene plates measured 38.28–41.78 dB PSNR.
- The Warden and reception plate were also reviewed side by side at rendered resolution.

The application now references the WebP files from HTML, CSS, JavaScript, and room metadata. The lossless PNGs remain in `art-source/` for rollback and re-encoding but are excluded from the static deployment directory. A real OBS capture is still required before public-release verification is complete.
