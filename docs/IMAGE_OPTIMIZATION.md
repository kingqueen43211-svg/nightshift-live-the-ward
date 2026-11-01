# Image optimization and verification

The release now includes WebP alternatives for every PNG larger than 1 MB. The originals remain beside them until the application switches references and final screenshots are approved.

## Reproducible command

```powershell
node scripts/optimize-images.mjs --write
```

The dependency-free script uses the installed Chromium encoder through the DevTools protocol. It writes a report to `work/image-optimization/image-optimization-report.json`, outside the release bundle.

Defaults:

- opaque scene plates: WebP quality `0.94`;
- transparent character and prop art: WebP quality `1.0`;
- source threshold: 1,000,000 bytes;
- source PNGs are never deleted;
- output dimensions must exactly match;
- transparent inputs must remain transparent;
- mean alpha error must be no greater than `0.05` (the current run is exactly `0` for every asset);
- visible-color PSNR must be at least 35 dB.

Environment overrides are available as `IMAGE_OPTIMIZE_THRESHOLD`, `IMAGE_WEBP_QUALITY`, `IMAGE_WEBP_ALPHA_QUALITY`, and `QA_BROWSER`.

## Verified 2026-11-01 result

Twelve source images totaled 30,216,064 bytes. Their optimized alternatives total 13,370,792 bytes, a reduction of 16,845,272 bytes or 55.7% once references are switched.

- All 12 dimension checks passed.
- All 7 transparent assets retained transparency and had zero mean alpha error.
- Transparent sprites and props measured 49.57–51.99 dB visible-color PSNR.
- Opaque scene plates measured 38.28–41.78 dB PSNR.
- The Warden and reception plate were also reviewed side by side at rendered resolution.

The optimized files are alternatives, not a claim that the shipped page is smaller yet. Network savings only begin after the HTML, CSS, and JavaScript asset references are changed and the visual matrix is rerun. Do not remove the PNG fallbacks until the production screenshots, OBS alpha check, and rollback package are complete.
