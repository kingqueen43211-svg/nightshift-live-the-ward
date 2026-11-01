# RC4 automated evidence index

Captured from the clean composite `npm run verify` on 2026-11-01. These artifacts prove the local/browser release contract; they do **not** substitute for real Twitch, native OBS, NVDA, audible-mix, unfamiliar-human, public-repository/video, or Devpost evidence.

## Visual captures

- [Desktop gameplay](rc4-gameplay-1280x720.png)
- [Phone gameplay](rc4-gameplay-390x844.png)
- [Generator breaker close-up](rc4-camera-generator-breaker-close.png)
- [Isolation door](rc4-door-1280x720.png)
- [Warden encounter](rc4-warden-1280x720.png)
- [Streamer control room](rc4-dashboard-1280x720.png)
- [Earned ending recap](rc4-earned-ending-1280x720.png)

## Machine-readable reports

| Gate | Result | Artifact |
| --- | --- | --- |
| Visual layouts | 28 / 28 | [report](rc4-visual-qa-report.json) |
| Browser gameplay | 9 / 9 | [report](rc4-gameplay-smoke-report.json) |
| Runtime integrity | 5 / 5 | [report](rc4-integrity-report.json) |
| Cross-process relay | 17 / 17 | [report](rc4-relay-report.json) |
| Browser accessibility | 11 / 11 | [report](rc4-accessibility-report.json) |
| Replay performance | 10 / 10 | [report](rc4-performance-report.json) |

The unit suite passed 73 / 73 and the release audit passed for a 23-file, 11.6 MiB payload in the same composite run. Unit and release-audit results are reproducible from the committed source with `npm run verify`.
