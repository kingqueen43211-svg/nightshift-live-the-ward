# RC7 judge response to the independent RC6 audit

This is a claim-by-claim response to `NightShift_RC6_Independent_Final_Judge_Audit.md`. It separates repository evidence from proof that still requires accounts, native software, people, or publication.

Disposition key:

- **FIXED EVIDENCE** — a concrete source, contract, or packaged evidence path now addresses the finding. A final exact-commit run may still be required.
- **STILL-EXTERNAL GATE** — local automation cannot establish the claim.
- **NOT CLAIMED** — the submission will not describe the missing proof, visual equivalence, metric, or publication as complete.

Final RC7 commit identifiers, artifact hashes, suite totals, deployment version, and public submission URLs are intentionally not stated here. They belong in the final evidence record only after the exact artifacts exist.

## Direct evidence and proof integrity

| Independent-audit finding | Disposition | RC7 response |
|---|---|---|
| RC6 source/archive/video hashes, one continuous 300-second VP9/mono-Opus file, opening/ending stills, successful manifest, and 50 recorded caption events were independently verified. | **FIXED EVIDENCE** as historical RC6 proof; **NOT CLAIMED** as final RC7 evidence | Those values and artifacts remain the historical RC6 record. They are not reused as final-release hashes, format proof, caption totals, or stereo proof. |
| The RC6 video contains real audio, then digital zero from about 272 seconds through the ending. | **FIXED EVIDENCE** locally; **STILL-EXTERNAL GATE** for the final recording | `dist/audio.mjs` now sustains the humane ending bed for 36 seconds with a six-second fade. Capture schema v3 measures the actual shared display stream for at least 25 seconds and fails closed on poor coverage, low RMS/peak, low non-silent ratio, or more than one second of terminal silence. A new exact-commit capture and human listen are still required. |
| RC6 had 90 independently rerun unit tests; other documented suite totals were not independently rerun. | **NOT CLAIMED** as current totals | No RC6 count is presented as an RC7 result. Final counts must come from the final reviewed commit and retained reports. |
| The five-act rehearsal, five audience results, seven evidence items, humane ending, and zero fallbacks were visible, but the 24-second holds do not measure newcomer duration. | **FIXED EVIDENCE** for the authored route; **NOT CLAIMED** for human pacing | The rehearsal remains supplementary route evidence. It is not a measured 20–35-minute session, retention result, or unfamiliar-player run. |
| Anonymous public smoke reached gameplay, Help, Cinema, and the browser overlay; later acts, Twitch, and native OBS were not independently exercised. | **FIXED EVIDENCE** only for that limited RC6 smoke; **STILL-EXTERNAL GATE** beyond it | The response preserves the audit's narrow scope. Real Twitch and native OBS evidence remain mandatory below. |
| Capture commit `20f949f567e0c276b76f4b54184ac6eb3097fbf8` differed from submitted commit `3f342aa39f304b503dae47f57f77aa2986133daf`. | **FIXED EVIDENCE** | `docs/RC6_CAPTURE_PARITY_AND_DIAGNOSTICS.md` records that both commits have the identical `dist/` tree, `f83bb3432d6408939e9485ab6c2d63fa13f6ef64`, and an empty `git diff ... -- dist`. Only the capture harness and a contract test differed. The mismatch remains disclosed; a new capture should still use the exact final commit. |
| The old manifest contained two unlocated 404s and camera/microphone Permissions Policy messages. | **FIXED EVIDENCE** for diagnosis and future capture; **NOT CLAIMED** as a retroactive exact URL record | Historical reports make the optional `/favicon.ico` explanation high-confidence, not certain. RC7 adds an explicit favicon and attaches diagnostics before app navigation, recording URL, method, resource type, status, request ID, console source, and narrow classification. Only exact expected cases are allowlisted; every other warning or resource failure blocks complete proof. Intentional `getUserMedia` denial is kept separate from verified `getDisplayMedia` tab video/audio. |

## Visual-reference findings

| Reference finding | Disposition | Response and remaining boundary |
|---|---|---|
| 1. Reception is atmospheric but crowded; targets and small-player labels need stronger focus. | **FIXED EVIDENCE** plus **STILL-EXTERNAL GATE** | Broadcast-critical type, wrapping, caption/toast separation, and Cinema-mode guidance have explicit source contracts. `scripts/visual-qa.mjs` renders 1280×720 and physically encodes it at `0.5` scale, then reads the PNG header to require a real 640×360 image and checks critical type/clipping. Comfortable human readability after stream compression still needs a logged review. |
| 2. Control room is functional but not concept-equivalent; setup needs a newcomer test. | **NOT CLAIMED** plus **STILL-EXTERNAL GATE** | It is described as a functional broadcaster surface, not a visual replica of the reference. A first-time streamer setup session remains required. |
| 3. State-linked effects exist, but long holds can feel static and event text can dominate the reveal. | **NOT CLAIMED** as cinematic equivalence | The 2:52 EDL selects short consequence beats instead of presenting the five-minute hold pattern as natural pacing. Final editorial and human review must confirm that physical changes read before overlays. |
| 4. The generator sequence is clear but not yet proven as macro-scale kinetic spectacle. | **NOT CLAIMED** | The submission claims the implemented `2 · 1 · 3` mechanic and state consequence, not concept-art-equivalent cinematography. |
| 5. The Ward door works, but uncut animation quality and first-time comprehension need proof. | **FIXED EVIDENCE** for guidance; **STILL-EXTERNAL GATE** for comprehension | Ward 06 copy now states that viewers change conditions while the streamer still opens the door, and the persistent next step distinguishes verified vote from labeled fallback. The uncut close-range review and unfamiliar-player result remain external. |
| 6. Containment exists; tense human stealth play was not evaluated. | **STILL-EXTERNAL GATE** | Retained unfamiliar-player sessions must establish reaction, stealth, and consequence comprehension. |
| 7. Warden counterplay exists; reference-level movement was not proven. | **NOT CLAIMED** plus **STILL-EXTERNAL GATE** | No claim of monster-action visual equivalence is made. The final cut still needs an uncut readable Warden beat. |
| 8. Case-state UI exists; there is no fully navigable visual deduction board. | **NOT CLAIMED** | The product is described as evidence collection, identity reconstruction, confession, and recap—not a full interactive evidence-board system. |
| 9. The rooftop ending is visually strong, but the RC6 ending hold is silent. | **FIXED EVIDENCE** locally; **STILL-EXTERNAL GATE** for recorded quality | The sustained ending soundscape and captured-stream tail gate address digital silence. The final uncut ending still needs an audible exact-commit capture and headphone/loudspeaker review. |
| 10. Accessibility controls are functionally strong; NVDA, live caption visibility, volume, and native OBS still need people. | **FIXED EVIDENCE** for implemented controls; **STILL-EXTERNAL GATE** for human/native proof | Automated contracts support controls, captions, reduced motion/effects, contrast, and responsive layout. They do not substitute for NVDA, listening, compressed-player, or OBS testing. |

## Ordered fix crosswalk

| Audit action | Disposition | Evidence or gate |
|---|---|---|
| P0.1 Remove unintended ending silence. | **FIXED EVIDENCE** locally; **STILL-EXTERNAL GATE** for acceptance | Authored 36-second bed and fade in `dist/audio.mjs`; captured-stream telemetry and fail-closed checks in `scripts/capture-proof.mjs` and `scripts/capture-proof-diagnostics.mjs`; actual final listen/recording still required. |
| P0.2 Reconcile exact-release proof parity. | **FIXED EVIDENCE** for RC6 parity | The identical RC6 runtime-tree fact is documented with the exact tree ID. The next proof should nevertheless be captured from the exact final clean commit. |
| P0.3 Improve 720p/small-player UI legibility. | **FIXED EVIDENCE** for deterministic geometry/type gates; **STILL-EXTERNAL GATE** for human reading | Exact half-scale 640×360 output, critical target floors, wrapping, clipping, and collision checks are implemented. A logged human read at full and half player size remains required. |
| P0.4 Account for manifest errors. | **FIXED EVIDENCE** for future captures | Explicit favicon, pre-navigation CDP attachment, exact request/console records, narrow allowlist, and unresolved-issue failure gate replace generic log counting. Historical schema-v1 omissions are not rewritten. |
| P0.5 Clarify audience condition versus streamer action. | **FIXED EVIDENCE** for product copy; **STILL-EXTERNAL GATE** for 5/5 discovery | Intro, Ward 06 decision copy, next-step guidance, and labeled fallback state the handoff directly. Five fresh-player results remain required. |
| P1.6 Prove cinematic physical choreography. | **NOT CLAIMED** as complete; **STILL-EXTERNAL GATE** | Phase-specific route choreography and reduced-motion completion states exist, but the final uncut door/curtain/lever/Warden/lamp review must still be retained. |
| P1.7 Preserve critical HUD data in Cinema mode. | **FIXED EVIDENCE** locally; **STILL-EXTERNAL GATE** for usability | Source contracts keep objective, conditions, next action, progress, and desktop vote state accessible; a human no-stranding check remains required. |
| P1.8 Demonstrate meaningful agency and consequences. | **STILL-EXTERNAL GATE** | Human sessions must explain how streamer action, audience result, evidence, and prior state affected the outcome. |
| P1.9 Strengthen ending cinematic/audio staging. | **FIXED EVIDENCE** locally; **STILL-EXTERNAL GATE** for the final sequence | The authored ending bed and tail telemetry address the known audio defect. A final uncut 15+ second readable, audible ending remains required. |

## Judging-video response

- **FIXED EVIDENCE:** `docs/demo-video/demo-edl.json`, `docs/demo-video/build-demo.ps1`, and `docs/RC7_DEMO_NARRATION.md` package one continuous **2:52 / 172-second** edit plan. The EDL is contiguous, remains below the three-minute limit, keeps rehearsal clips labeled, and truth-gates real Twitch, native OBS, Codex, accessibility/human-QA, and closing-card footage. The build script refuses missing required assets and rejects the audited silent RC6 proof by filename.
- **STILL-EXTERNAL GATE:** the required clips, final exact-commit recording, final render, logged-out playback check, and public YouTube upload do not yet become true merely because the EDL and assembly path exist.
- **NOT CLAIMED:** the five-minute simulated rehearsal is not the judging video, a natural pacing study, real Twitch evidence, native OBS evidence, or a stereo-quality demonstration.

## Hard external blockers

| Required proof | Status | Minimum retained evidence |
|---|---|---|
| Real Twitch | **STILL-EXTERNAL GATE** | Exact public redirect; broadcaster authorization; separate viewer's genuine command; authoritative event/vote ID accepted once; invalid/duplicate rejection; visible in-world and passive-overlay consequence; `LIVE TWITCH` provenance. |
| Native OBS | **STILL-EXTERNAL GATE** | OBS Studio Browser Source at 1280×720 and 1920×1080; transparency, fit, captions, refresh recovery, and one clean audio path without doubling. |
| Human play, readability, listening, and inclusion | **STILL-EXTERNAL GATE** | Five unfamiliar-player sessions recording time-to-first-action, errors, help/stuck/boredom points, choices, route, ending, and whole-run duration; full/half-size viewing; headphone and loudspeaker review of balance, peaks/clipping, captions, and ending fade; native NVDA spoken-output run; and a 30-minute browser/OBS session. |
| Public repository | **STILL-EXTERNAL GATE** | Exact reviewed source, provenance/licenses, secret scan, clean-checkout result, and public access or correctly granted private-review access. |
| Public YouTube video | **STILL-EXTERNAL GATE** | Final under-three-minute render with the required genuine footage, public visibility, and successful logged-out playback. |
| Devpost | **STILL-EXTERNAL GATE** | Final live/repository/video URLs, truthful copy and Codex session ID, team state, and visible **Submitted** status before the deadline. |

## Readiness statement

The audit's scores remain an RC6 snapshot and are not silently raised by this response. RC7 now has concrete local answers for the runtime-parity question, ending-audio implementation and telemetry, diagnostic provenance, small-player render gate, puzzle handoff copy, and a truth-gated 2:52 edit package. It is **not claimed to be first-place-ready or submitted** until every hard external blocker above has retained evidence.
