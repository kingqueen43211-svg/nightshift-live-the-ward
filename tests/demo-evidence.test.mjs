import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { analyzeDecodedPcm, validateAssemblyEvidence } from "../scripts/validate-demo-evidence.mjs";

const root = resolve(import.meta.dirname, "..");
const edlPath = resolve(root, "docs/demo-video/demo-edl.json");
const edl = JSON.parse(readFileSync(edlPath, "utf8"));
const buildScript = readFileSync(resolve(root, "docs/demo-video/build-demo.ps1"), "utf8");
const expectedCommit = "a".repeat(40);

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function media(durationSeconds, overrides = {}) {
  return {
    durationSeconds,
    containerNames: ["matroska", "webm"],
    videoStreamCount: 1,
    audioStreamCount: 1,
    width: 1280,
    height: 720,
    fps: 30,
    videoCodec: "vp9",
    videoPixelFormat: "yuv420p",
    audioCodec: "opus",
    audioChannels: 2,
    audioSampleRate: 48000,
    ...overrides
  };
}

function decodedAudio(overrides = {}) {
  return {
    decodedDurationSeconds: 25,
    nonFiniteSampleCount: 0,
    peakAbsolute: 0.25,
    overallRms: 0.08,
    nonSilentWindowRatio: 1,
    trailingSilenceSeconds: 0,
    clippedSampleCount: 0,
    ...overrides
  };
}

function pcmWindows(amplitudes) {
  const samplesPerWindow = 48000 * 2 / 10;
  const buffer = Buffer.alloc(amplitudes.length * samplesPerWindow * 4);
  let offset = 0;
  for (const amplitude of amplitudes) {
    for (let sample = 0; sample < samplesPerWindow; sample++) {
      buffer.writeFloatLE(sample % 2 ? -amplitude : amplitude, offset);
      offset += 4;
    }
  }
  return buffer;
}

function makeFixture() {
  const directory = mkdtempSync(join(tmpdir(), "nightshift-demo-evidence-"));
  const sourceFiles = {};
  const manifestFiles = {};
  const durations = {
    "final-proof": 300,
    "real-twitch": 30,
    "native-obs": 20,
    "codex-bts": 15,
    "accessibility-human-qa": 15,
    "closing-card": 10
  };

  for (const source of edl.sources) {
    const extension = source.id === "final-proof" ? "webm" : "mp4";
    const path = join(directory, `${source.id}.${extension}`);
    writeFileSync(path, Buffer.alloc(256 + source.id.length, source.id.length));
    sourceFiles[source.id] = path;
  }

  const milestoneTimes = {
    "episode:start": 1000,
    "dashboard:open for !records": 3000,
    "act1:search-desk": 30000,
    "room:Ward 06": 61000,
    "act2:inspect-gurney": 88000,
    "act2:force-door": 117000,
    "room:Operating Theatre": 122000,
    "rehearsal-vote:!tape": 123000,
    "act3:align-lamps": 149000,
    "act3:counter-warden": 176000,
    "room:Generator Room": 181000,
    "act4:breaker-2": 208000,
    "advance:Stairwell / Exits": 213000,
    "room:Stairwell / Exits": 215000,
    "act5:seal-warden": 267000,
    "ending:MARA WALKS INTO DAWN": 271000
  };
  const proofPath = sourceFiles["final-proof"];
  const proofManifest = {
    schemaVersion: 3,
    status: "COMPLETE_REHEARSAL_PROOF",
    provenance: { mode: "REHEARSAL_SIMULATED_INPUT", liveTwitch: false, nativeObs: false },
    source: {
      commit: expectedCommit,
      expectedCommit,
      sourceTree: "b".repeat(40),
      runtimeTree: "c".repeat(40),
      sourceManifestSha256: "d".repeat(64),
      runtimeManifestSha256: "e".repeat(64),
      worktree: { dirty: false, entries: [] },
      integrity: {
        initial: { valid: true, head: expectedCommit },
        final: { valid: true, head: expectedCommit },
        reconciliation: { verified: true }
      }
    },
    recording: {
      path: proofPath,
      bytes: readFileSync(proofPath).length,
      sha256: hash(proofPath),
      durationMs: 300000,
      audioTrackCount: 1,
      videoTrackCount: 1,
      displaySurface: "browser",
      endingAudioTail: {
        verified: true,
        durationMs: 26000,
        nonSilentRatio: 0.99,
        trailingSilenceMs: 0,
        checks: {
          capturedStreamAnalyser: true,
          runningAnalyser: true,
          duration: true,
          sampleCoverage: true,
          nonSilentRatio: true,
          terminalContinuity: true,
          peak: true,
          rmsPeak: true
        }
      }
    },
    diagnostics: { summary: { unresolvedCount: 0, allIssuesAccountedFor: true } },
    automation: { ending: "MARA WALKS INTO DAWN", recap: ["ROUTEROOF", "FALLBACKS0"] },
    milestones: Object.entries(milestoneTimes).map(([label, atMs]) => ({ label, atMs })),
    acceptance: {
      uninterruptedVideoBytes: true,
      tabAudioTrackPresent: true,
      browserTabSurfaceSelected: true,
      endingAudioTailVerified: true,
      captionEventsObserved: true,
      earnedHumaneEnding: true,
      zeroDirectorFallbacks: true,
      browserDiagnosticsAccountedFor: true,
      gitCommandsSucceeded: true,
      releaseCommitMatched: true,
      runtimeSourceHashesReconciled: true,
      cleanCommittedSource: true,
      rehearsalProvenanceOnly: true
    },
    failure: null
  };
  const proofManifestPath = join(directory, "final-proof.json");
  writeJson(proofManifestPath, proofManifest);
  manifestFiles["final-proof"] = proofManifestPath;

  for (const source of edl.sources.filter(candidate => candidate.kind === "external-evidence")) {
    const path = sourceFiles[source.id];
    const sidecar = {
      schemaVersion: 1,
      kind: "NIGHTSHIFT_EXTERNAL_EVIDENCE",
      sourceId: source.id,
      status: "VERIFIED_EVIDENCE",
      verifiedAt: "2026-11-02T12:00:00.000Z",
      verifiedBy: "test operator",
      source: { commit: expectedCommit },
      artifact: {
        fileName: basename(path),
        bytes: readFileSync(path).length,
        sha256: hash(path),
        durationSeconds: durations[source.id]
      },
      assertions: Object.fromEntries(source.requiredAssertions.map(assertion => [assertion, true])),
      notes: []
    };
    const manifestPath = join(directory, `${source.id}.json`);
    writeJson(manifestPath, sidecar);
    manifestFiles[source.id] = manifestPath;
  }

  const mediaByPath = Object.fromEntries(Object.entries(sourceFiles).map(([sourceId, path]) => [resolve(path), media(durations[sourceId])]));
  return {
    directory,
    sourceFiles,
    manifestFiles,
    mediaByPath,
    config: {
      edlPath,
      expectedCommit,
      sourceFiles,
      manifestFiles,
      probeMedia: path => mediaByPath[resolve(path)]
    }
  };
}

function withFixture(t) {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.directory, { recursive: true, force: true }));
  return fixture;
}

test("demo evidence validator resolves EDL cuts from exact proof milestones", t => {
  const fixture = withFixture(t);
  const result = validateAssemblyEvidence(fixture.config);
  assert.equal(result.report.status, "PREASSEMBLY_EVIDENCE_VERIFIED");
  assert.equal(result.plan.targetDurationSeconds, 172);
  assert.equal(result.plan.clips.length, 23);
  assert.equal(result.plan.clips.find(clip => clip.id === "ward-door").sourceStart, 115.7);
  assert.equal(result.plan.clips.find(clip => clip.id === "humane-ending").sourceStart, 266.1);
  assert.ok(result.plan.clips.every(clip => clip.truthLabel));
  assert.match(result.report.assemblyPlan.sha256, /^[0-9a-f]{64}$/);
  assert.match(result.report.evidenceSet.sha256, /^[0-9a-f]{64}$/);
});

test("build script consumes the generated plan and burns truth labels without historical fixed cuts", () => {
  assert.match(buildScript, /Get-Content[^\n]+\$planPath[^\n]+ConvertFrom-Json/);
  assert.match(buildScript, /for \(\$index = 0; \$index -lt \$plan\.clips\.Count/);
  assert.match(buildScript, /drawtext=text='\$label'/);
  assert.match(buildScript, /expected-plan-sha256/);
  assert.match(buildScript, /expected-evidence-set-sha256/);
  assert.doesNotMatch(buildScript, /271\.4|266\.8|213\.8|207\.6/);
});

test("demo evidence validator rejects wrong-commit rehearsal proof", t => {
  const fixture = withFixture(t);
  const manifest = JSON.parse(readFileSync(fixture.manifestFiles["final-proof"], "utf8"));
  manifest.source.commit = "b".repeat(40);
  writeJson(fixture.manifestFiles["final-proof"], manifest);
  assert.throws(() => validateAssemblyEvidence(fixture.config), /does not match/);
});

test("demo evidence validator rejects zero-byte proof and stale media hashes", async t => {
  await t.test("zero-byte proof", () => {
    const fixture = makeFixture();
    try {
      writeFileSync(fixture.sourceFiles["final-proof"], Buffer.alloc(0));
      assert.throws(() => validateAssemblyEvidence(fixture.config), /zero bytes/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
  await t.test("wrong external hash", () => {
    const fixture = makeFixture();
    try {
      const manifest = JSON.parse(readFileSync(fixture.manifestFiles["native-obs"], "utf8"));
      manifest.artifact.sha256 = "0".repeat(64);
      writeJson(fixture.manifestFiles["native-obs"], manifest);
      assert.throws(() => validateAssemblyEvidence(fixture.config), /SHA-256/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
});

test("demo evidence validator rejects missing tracks and silent ending telemetry", async t => {
  await t.test("missing native OBS audio", () => {
    const fixture = makeFixture();
    try {
      fixture.mediaByPath[resolve(fixture.sourceFiles["native-obs"])] = media(20, { audioStreamCount: 0 });
      assert.throws(() => validateAssemblyEvidence(fixture.config), /native-obs has no audio stream/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
  await t.test("silent rehearsal ending", () => {
    const fixture = makeFixture();
    try {
      const manifest = JSON.parse(readFileSync(fixture.manifestFiles["final-proof"], "utf8"));
      manifest.recording.endingAudioTail.verified = false;
      manifest.acceptance.endingAudioTailVerified = false;
      writeJson(fixture.manifestFiles["final-proof"], manifest);
      assert.throws(() => validateAssemblyEvidence(fixture.config), /ending audio tail is not verified/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
  await t.test("missing required ending-audio check", () => {
    const fixture = makeFixture();
    try {
      const manifest = JSON.parse(readFileSync(fixture.manifestFiles["final-proof"], "utf8"));
      delete manifest.recording.endingAudioTail.checks.terminalContinuity;
      writeJson(fixture.manifestFiles["final-proof"], manifest);
      assert.throws(() => validateAssemblyEvidence(fixture.config), /terminalContinuity/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
});

test("demo evidence validator rejects unverified Twitch or OBS assertions", async t => {
  for (const [sourceId, assertion] of [["real-twitch", "liveTwitch"], ["native-obs", "nativeObs"]]) {
    await t.test(`${sourceId}/${assertion}`, () => {
      const fixture = makeFixture();
      try {
        const manifest = JSON.parse(readFileSync(fixture.manifestFiles[sourceId], "utf8"));
        manifest.assertions[assertion] = false;
        writeJson(fixture.manifestFiles[sourceId], manifest);
        assert.throws(() => validateAssemblyEvidence(fixture.config), new RegExp(`${assertion}`));
      } finally {
        rmSync(fixture.directory, { recursive: true, force: true });
      }
    });
  }
});

test("demo evidence validator pins post-render checks to the preflight plan and evidence set", async t => {
  await t.test("milestone plan drift", () => {
    const fixture = makeFixture();
    try {
      const preflight = validateAssemblyEvidence(fixture.config);
      const manifest = JSON.parse(readFileSync(fixture.manifestFiles["final-proof"], "utf8"));
      manifest.milestones.find(milestone => milestone.label === "act2:force-door").atMs += 1000;
      writeJson(fixture.manifestFiles["final-proof"], manifest);
      assert.throws(() => validateAssemblyEvidence({
        ...fixture.config,
        expectedPlanSha256: preflight.report.assemblyPlan.sha256
      }), /Assembly plan changed after preflight/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("valid but changed external evidence set", () => {
    const fixture = makeFixture();
    try {
      const preflight = validateAssemblyEvidence(fixture.config);
      const sourcePath = fixture.sourceFiles["codex-bts"];
      writeFileSync(sourcePath, Buffer.alloc(512, 7));
      const sidecar = JSON.parse(readFileSync(fixture.manifestFiles["codex-bts"], "utf8"));
      sidecar.artifact.bytes = readFileSync(sourcePath).length;
      sidecar.artifact.sha256 = hash(sourcePath);
      writeJson(fixture.manifestFiles["codex-bts"], sidecar);
      assert.throws(() => validateAssemblyEvidence({
        ...fixture.config,
        expectedEvidenceSetSha256: preflight.report.evidenceSet.sha256
      }), /Evidence set changed after preflight/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
});

test("demo evidence validator enforces the final MP4 target and 180-second ceiling", async t => {
  await t.test("verified target", () => {
    const fixture = makeFixture();
    try {
      const outputPath = join(fixture.directory, "assembled.mp4");
      writeFileSync(outputPath, Buffer.alloc(1024, 9));
      fixture.mediaByPath[resolve(outputPath)] = media(172, {
        containerNames: ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"],
        width: 1920,
        height: 1080,
        videoCodec: "h264",
        videoPixelFormat: "yuv420p",
        audioCodec: "aac",
        audioChannels: 2,
        audioSampleRate: 48000
      });
      const result = validateAssemblyEvidence({ ...fixture.config, outputPath, analyzeAudio: () => decodedAudio() });
      assert.equal(result.report.status, "ASSEMBLY_VERIFIED");
      assert.equal(result.report.output.media.durationSeconds, 172);
      assert.equal(result.report.output.decodedAudio.humaneEnding.decodedDurationSeconds, 25);
      assert.equal(result.report.output.decodedAudio.finalTail.trailingSilenceSeconds, 0);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("wrong pixel format", () => {
    const fixture = makeFixture();
    try {
      const outputPath = join(fixture.directory, "assembled.mp4");
      writeFileSync(outputPath, Buffer.alloc(1024, 9));
      fixture.mediaByPath[resolve(outputPath)] = media(172, {
        containerNames: ["mp4"],
        width: 1920,
        height: 1080,
        videoCodec: "h264",
        videoPixelFormat: "yuv444p",
        audioCodec: "aac"
      });
      assert.throws(() => validateAssemblyEvidence({ ...fixture.config, outputPath, analyzeAudio: () => decodedAudio() }), /pixel format/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("over 180 seconds", () => {
    const fixture = makeFixture();
    try {
      const outputPath = join(fixture.directory, "assembled.mp4");
      writeFileSync(outputPath, Buffer.alloc(1024, 9));
      fixture.mediaByPath[resolve(outputPath)] = media(180.1, {
        containerNames: ["mp4"],
        width: 1920,
        height: 1080,
        videoCodec: "h264",
        videoPixelFormat: "yuv420p",
        audioCodec: "aac"
      });
      assert.throws(() => validateAssemblyEvidence({ ...fixture.config, outputPath, analyzeAudio: () => decodedAudio() }), /exceeds 180 seconds/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
});

test("demo evidence validator rejects decoded output silence and clipping", async t => {
  async function withOutput(t, analysisForWindow) {
    const fixture = makeFixture();
    t.after(() => rmSync(fixture.directory, { recursive: true, force: true }));
    const outputPath = join(fixture.directory, "assembled.mp4");
    writeFileSync(outputPath, Buffer.alloc(1024, 9));
    fixture.mediaByPath[resolve(outputPath)] = media(172, {
      containerNames: ["mp4"],
      width: 1920,
      height: 1080,
      videoCodec: "h264",
      videoPixelFormat: "yuv420p",
      audioCodec: "aac"
    });
    return () => validateAssemblyEvidence({
      ...fixture.config,
      outputPath,
      analyzeAudio: (_path, window) => analysisForWindow(window)
    });
  }

  await t.test("digital-zero humane ending", async t => {
    const validate = await withOutput(t, window => window.label === "humane-ending window"
      ? decodedAudio({ peakAbsolute: 0, overallRms: 0, nonSilentWindowRatio: 0, trailingSilenceSeconds: 25 })
      : decodedAudio());
    assert.throws(validate, /Humane-ending window decoded audio is digital zero/);
  });

  await t.test("terminally silent final tail", async t => {
    const validate = await withOutput(t, window => window.label === "final 25-second tail"
      ? decodedAudio({ nonSilentWindowRatio: 0.96, trailingSilenceSeconds: 1.1 })
      : decodedAudio());
    assert.throws(validate, /Final 25-second tail decoded audio has 1\.1s terminal silence/);
  });

  await t.test("clipped final tail", async t => {
    const validate = await withOutput(t, window => window.label === "final 25-second tail"
      ? decodedAudio({ clippedSampleCount: 3 })
      : decodedAudio());
    assert.throws(validate, /contains 3 clipped sample/);
  });
});

test("decoded PCM analysis measures continuity, terminal silence, and clipping", () => {
  const continuous = analyzeDecodedPcm(pcmWindows(Array(10).fill(0.1)), { label: "continuous", durationSeconds: 1 });
  assert.equal(continuous.decodedDurationSeconds, 1);
  assert.equal(continuous.nonSilentWindowRatio, 1);
  assert.equal(continuous.trailingSilenceSeconds, 0);
  assert.equal(continuous.clippedSampleCount, 0);
  assert.equal(continuous.peakAbsolute, 0.1);

  const silentTail = analyzeDecodedPcm(pcmWindows([...Array(5).fill(0.1), ...Array(11).fill(0)]), { label: "silent-tail", durationSeconds: 1.6 });
  assert.equal(silentTail.trailingSilenceSeconds, 1.1);
  assert.equal(silentTail.nonSilentWindowCount, 5);

  const clipped = analyzeDecodedPcm(pcmWindows([1]), { label: "clipped", durationSeconds: 0.1 });
  assert.ok(clipped.clippedSampleCount > 0);
  assert.equal(clipped.peakAbsolute, 1);

  const digitalZero = analyzeDecodedPcm(pcmWindows([0]), { label: "zero", durationSeconds: 0.1 });
  assert.equal(digitalZero.peakAbsolute, 0);
  assert.equal(digitalZero.overallRms, 0);
  assert.equal(digitalZero.nonSilentWindowRatio, 0);
});

test("build script rejects path collisions before invoking media tools", { skip: process.platform !== "win32" }, async t => {
  const fixture = withFixture(t);
  const powershell = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  assert.equal(existsSync(powershell), true, `PowerShell not found at ${powershell}`);
  const common = [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve(root, "docs/demo-video/build-demo.ps1"),
    "-ExpectedCommit", expectedCommit,
    "-FinalProof", fixture.sourceFiles["final-proof"],
    "-FinalProofManifest", fixture.manifestFiles["final-proof"],
    "-RealTwitch", fixture.sourceFiles["real-twitch"],
    "-RealTwitchManifest", fixture.manifestFiles["real-twitch"],
    "-NativeObs", fixture.sourceFiles["native-obs"],
    "-NativeObsManifest", fixture.manifestFiles["native-obs"],
    "-CodexBts", fixture.sourceFiles["codex-bts"],
    "-CodexBtsManifest", fixture.manifestFiles["codex-bts"],
    "-AccessibilityQa", fixture.sourceFiles["accessibility-human-qa"],
    "-AccessibilityQaManifest", fixture.manifestFiles["accessibility-human-qa"],
    "-ClosingCard", fixture.sourceFiles["closing-card"],
    "-ClosingCardManifest", fixture.manifestFiles["closing-card"],
    "-FfprobePath", process.execPath,
    "-ValidateOnly"
  ];

  await t.test("output cannot overwrite an evidence input", () => {
    const originalHash = hash(fixture.sourceFiles["final-proof"]);
    const result = spawnSync(powershell, [...common, "-OutputPath", fixture.sourceFiles["final-proof"]], { encoding: "utf8", windowsHide: true });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: input or manifest: FinalProof and output|Path collision: output and input or manifest: FinalProof/);
    assert.equal(hash(fixture.sourceFiles["final-proof"]), originalHash);
  });

  await t.test("final report cannot overwrite the output", () => {
    const collisionPath = join(fixture.directory, "same-target.mp4");
    const result = spawnSync(powershell, [...common, "-OutputPath", collisionPath, "-EvidenceReportPath", collisionPath], { encoding: "utf8", windowsHide: true });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: final evidence report and output|Path collision: output and final evidence report/);
    assert.equal(existsSync(collisionPath), false);
  });
});

