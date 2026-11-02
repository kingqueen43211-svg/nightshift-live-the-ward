# Historical RC6 image optimization and verification

> **Historical / superseded:** This file preserves the 2026-11-01 RC6 optimization measurements. It is not the current release-status record. See [Status](./STATUS.md) and the [RC8 release gate](./RC8_RELEASE_GATE.md) for the active candidate and deployment truth.

The RC6 release candidate used verified WebP derivatives for every referenced PNG larger than 1 MB. After references were switched, its expanded visual matrix passed 29/29 and its browser campaign gate passed 9/9. Lossless PNG sources remained outside the deployable directory under `art-source/`. Public RC6 promotion was pending at the time of this record.

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

Environment overrides are available as `IMAGE_OPTIMIZE_THRESHOLD`, `IMAGE_OPTIMIZE_MATCH`, `IMAGE_WEBP_QUALITY`, `IMAGE_WEBP_ALPHA_QUALITY`, and `QA_BROWSER`.

## Verified 2026-11-01 result

The twelve referenced source images total 29,922,670 bytes. Their deployable derivatives total 12,270,382 bytes, a reduction of 17,652,288 bytes or 59.0%. The superseded legacy `the-surgeon` source remains archived but its unused derivative is excluded from `dist/`.

- All 12 shipped dimension checks passed.
- All 6 shipped transparent assets retained transparency and had zero mean alpha error.
- Transparent sprites and props measured 49.57–51.99 dB visible-color PSNR.
- Opaque scene plates measured 38.28–41.78 dB PSNR.
- The Warden and reception plate were also reviewed side by side at rendered resolution.

The RC6 application referenced the WebP files from HTML, CSS, JavaScript, and room metadata. The lossless PNGs remained in `art-source/` for rollback and re-encoding but were excluded from the static deployment directory. Its release audit passed at 12.0 MiB across 24 files. At the time of this record, a real OBS capture, RC6 public promotion, and a fresh public-origin probe were still required before public-release verification could be complete. Current gates are tracked in [Status](./STATUS.md) and the [RC8 release gate](./RC8_RELEASE_GATE.md).
