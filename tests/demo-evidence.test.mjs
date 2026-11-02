import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

async function waitUntil(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolvePromise => setTimeout(resolvePromise, 25));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
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
  assert.match(buildScript, /Get-EdlClipReservations/);
  assert.match(buildScript, /normalized clip\[\$\(\$reservation\.Index\)\]:/);
  assert.match(buildScript, /Duplicate generated clip id in demo EDL/);
  assert.match(buildScript, /NightShift\.FileIdentity/);
  assert.match(buildScript, /"demo assembly builder" = \$builder/);
  assert.match(buildScript, /"ffmpeg executable" = \$ffmpeg/);
  assert.match(buildScript, /Assert-WritablePathsAreFresh/);
  assert.match(buildScript, /"exclusive build-directory lock" = \$buildLockPath/);
  assert.match(buildScript, /FileMode\]::CreateNew/);
  assert.match(buildScript, /\$publishedByThisRun = \$false/);
  assert.match(buildScript, /if \(\$publishedByThisRun\)/);
  assert.match(buildScript, /\$postPromotionReportPath/);
  assert.match(buildScript, /FileShare\]::Read/);
  assert.match(buildScript, /"concat list" = \$concatPath/);
  assert.match(buildScript, /\[System\.IO\.File\]::Replace\(\$stagingOutput, \$resolvedOutput, \$promotionBackup/);
  assert.match(buildScript, /--expected-output-sha256/);
  assert.match(buildScript, /WriteAllLines\(\$concatPath[^\n]+UTF8Encoding\]::new\(\$false\)/);
  assert.doesNotMatch(buildScript, /Set-Content[^\n]+\$concatPath/);
  assert.doesNotMatch(buildScript, /271\.4|266\.8|213\.8|207\.6/);
});

test("demo evidence validator rejects wrong-commit rehearsal proof", t => {
  const fixture = withFixture(t);
  const manifest = JSON.parse(readFileSync(fixture.manifestFiles["final-proof"], "utf8"));
  manifest.source.commit = "b".repeat(40);
  writeJson(fixture.manifestFiles["final-proof"], manifest);
  assert.throws(() => validateAssemblyEvidence(fixture.config), /does not match/);
});

test("demo evidence validator rejects standalone and montage cuts with the same generated id", t => {
  const fixture = withFixture(t);
  const duplicateEdl = structuredClone(edl);
  const montage = duplicateEdl.timeline.find(clip => Array.isArray(clip.segments));
  montage.id = "cold";
  montage.segments[0].id = "open";
  const duplicateEdlPath = join(fixture.directory, "duplicate-generated-id-edl.json");
  writeJson(duplicateEdlPath, duplicateEdl);
  assert.throws(
    () => validateAssemblyEvidence({ ...fixture.config, edlPath: duplicateEdlPath }),
    /Duplicate generated clip id: cold-open/
  );
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

  await t.test("promoted bytes differ from the verified staging hash", () => {
    const fixture = makeFixture();
    try {
      const outputPath = join(fixture.directory, "assembled.mp4");
      writeFileSync(outputPath, Buffer.alloc(1024, 9));
      assert.throws(() => validateAssemblyEvidence({
        ...fixture.config,
        outputPath,
        expectedOutputSha256: "0".repeat(64),
        analyzeAudio: () => decodedAudio()
      }), /Assembled output changed after verification/);
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
  const builderPath = resolve(root, "docs/demo-video/build-demo.ps1");
  const guardNode = join(fixture.directory, "guard-node.cmd");
  const guardFfprobe = join(fixture.directory, "guard-ffprobe.cmd");
  const guardFfmpeg = join(fixture.directory, "guard-ffmpeg.cmd");
  writeFileSync(guardNode, "@exit /b 91\r\n", "utf8");
  writeFileSync(guardFfprobe, "@exit /b 92\r\n", "utf8");
  writeFileSync(guardFfmpeg, "@exit /b 93\r\n", "utf8");
  const buildGuardArgs = ({
    outputPath,
    evidenceReportPath,
    realTwitch = fixture.sourceFiles["real-twitch"],
    edlPath: selectedEdlPath = edlPath,
    nodePath = guardNode,
    ffprobePath = guardFfprobe,
    ffmpegPath = guardFfmpeg
  }) => {
    const args = [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", builderPath,
      "-ExpectedCommit", expectedCommit,
      "-FinalProof", fixture.sourceFiles["final-proof"],
      "-FinalProofManifest", fixture.manifestFiles["final-proof"],
      "-RealTwitch", realTwitch,
      "-RealTwitchManifest", fixture.manifestFiles["real-twitch"],
      "-NativeObs", fixture.sourceFiles["native-obs"],
      "-NativeObsManifest", fixture.manifestFiles["native-obs"],
      "-CodexBts", fixture.sourceFiles["codex-bts"],
      "-CodexBtsManifest", fixture.manifestFiles["codex-bts"],
      "-AccessibilityQa", fixture.sourceFiles["accessibility-human-qa"],
      "-AccessibilityQaManifest", fixture.manifestFiles["accessibility-human-qa"],
      "-ClosingCard", fixture.sourceFiles["closing-card"],
      "-ClosingCardManifest", fixture.manifestFiles["closing-card"],
      "-EdlPath", selectedEdlPath,
      "-NodePath", nodePath,
      "-FfprobePath", ffprobePath,
      "-FfmpegPath", ffmpegPath,
      "-OutputPath", outputPath,
      "-ValidateOnly"
    ];
    if (evidenceReportPath) args.push("-EvidenceReportPath", evidenceReportPath);
    return args;
  };
  const runGuard = options => spawnSync(powershell, buildGuardArgs(options), { encoding: "utf8", windowsHide: true });

  await t.test("output cannot overwrite an evidence input", () => {
    const originalHash = hash(fixture.sourceFiles["final-proof"]);
    const result = runGuard({ outputPath: fixture.sourceFiles["final-proof"] });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: input or manifest: FinalProof and output|Path collision: output and input or manifest: FinalProof/);
    assert.equal(hash(fixture.sourceFiles["final-proof"]), originalHash);
    assert.equal(existsSync(join(fixture.directory, "assembly-plan.json")), false);
  });

  await t.test("canonical parent traversal cannot disguise an evidence input as output", () => {
    const sourcePath = fixture.sourceFiles["final-proof"];
    const disguisedPath = join(fixture.directory, "nonexistent-child", "..", basename(sourcePath));
    const originalHash = hash(sourcePath);
    const result = runGuard({ outputPath: disguisedPath });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: input or manifest: FinalProof and output|Path collision: output and input or manifest: FinalProof/);
    assert.equal(hash(sourcePath), originalHash);
    assert.equal(existsSync(join(fixture.directory, "assembly-plan.json")), false);
  });

  await t.test("junction-alias parents cannot disguise the same future output", t => {
    const realDirectory = join(fixture.directory, "junction-real");
    const aliasDirectory = join(fixture.directory, "junction-alias");
    mkdirSync(realDirectory);
    try {
      symlinkSync(realDirectory, aliasDirectory, "junction");
    } catch (error) {
      t.skip(`Windows junction creation is unavailable: ${error.code || error.message}`);
      return;
    }
    const outputPath = join(aliasDirectory, "same-future-file.mp4");
    const reportPath = join(realDirectory, "same-future-file.mp4");
    const result = runGuard({ outputPath, evidenceReportPath: reportPath });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: .*final evidence report|Path collision: .*output/);
    assert.equal(existsSync(outputPath), false);
    assert.equal(existsSync(join(aliasDirectory, "assembly-plan.json")), false);
  });

  await t.test("final report cannot overwrite the output", () => {
    const collisionPath = join(fixture.directory, "same-target.mp4");
    const result = runGuard({ outputPath: collisionPath, evidenceReportPath: collisionPath });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: final evidence report and output|Path collision: output and final evidence report/);
    assert.equal(existsSync(collisionPath), false);
  });

  await t.test("final report cannot overwrite the builder or a resolved tool executable", () => {
    const protectedPaths = [
      ["builder", builderPath],
      ["Node.js", guardNode],
      ["ffprobe", guardFfprobe],
      ["ffmpeg", guardFfmpeg]
    ];
    for (const [label, protectedPath] of protectedPaths) {
      const originalHash = hash(protectedPath);
      const outputDirectory = join(fixture.directory, `protected-${label.replace(/[^a-z]/gi, "-")}`);
      const result = runGuard({
        outputPath: join(outputDirectory, "final.mp4"),
        evidenceReportPath: protectedPath
      });
      assert.notEqual(result.status, 0, `${label} collision unexpectedly passed`);
      assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: .*final evidence report|Path collision: final evidence report and /);
      assert.equal(hash(protectedPath), originalHash, `${label} bytes changed`);
      assert.equal(existsSync(join(outputDirectory, "assembly-plan.json")), false, `${label} collision wrote a plan`);
    }
  });

  await t.test("pre-existing writable intermediates are refused without modification", () => {
    const outputDirectory = join(fixture.directory, "stale-intermediate");
    mkdirSync(outputDirectory);
    const planPath = join(outputDirectory, "assembly-plan.json");
    writeFileSync(planPath, "retained prior plan\n", "utf8");
    const originalHash = hash(planPath);
    const result = runGuard({ outputPath: join(outputDirectory, "final.mp4") });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Refusing to overwrite pre-existing writable assembly path for assembly plan/);
    assert.equal(hash(planPath), originalHash);
    assert.equal(existsSync(join(outputDirectory, "assembly-preflight.evidence.json")), false);
  });

  await t.test("a concurrent run is rejected by the exclusive build-directory lock", async () => {
    const outputDirectory = join(fixture.directory, "concurrent-lock");
    const outputPath = join(outputDirectory, "final.mp4");
    const lockPath = join(outputDirectory, ".nightshift-demo-assembly.lock");
    const blockingNode = join(fixture.directory, "blocking-node.cmd");
    writeFileSync(blockingNode, "@ping 127.0.0.1 -n 4 > nul\r\n@exit /b 91\r\n", "utf8");
    const sourceHashes = Object.fromEntries(Object.entries(fixture.sourceFiles).map(([name, path]) => [name, hash(path)]));
    const first = spawn(powershell, buildGuardArgs({ outputPath, nodePath: blockingNode }), {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let firstStdout = "";
    let firstStderr = "";
    first.stdout.on("data", chunk => { firstStdout += chunk; });
    first.stderr.on("data", chunk => { firstStderr += chunk; });
    const firstExit = new Promise((resolvePromise, rejectPromise) => {
      first.once("error", rejectPromise);
      first.once("exit", code => resolvePromise(code));
    });
    try {
      await waitUntil(() => existsSync(lockPath));
      const second = runGuard({ outputPath });
      assert.notEqual(second.status, 0);
      assert.match(`${second.stdout}\n${second.stderr}`, /exclusive build-directory lock|Another demo assembly owns the build directory lock/);
      assert.equal(existsSync(join(outputDirectory, "assembly-plan.json")), false);
      for (const [name, path] of Object.entries(fixture.sourceFiles)) {
        assert.equal(hash(path), sourceHashes[name], `${name} media changed during concurrent rejection`);
      }
    } finally {
      const firstStatus = await firstExit;
      assert.notEqual(firstStatus, 0, `${firstStdout}\n${firstStderr}`);
    }
    assert.equal(existsSync(lockPath), false, "the owning run should release its build-directory lock");
  });

  await t.test("concat list cannot overwrite evidence", () => {
    const outputDirectory = join(fixture.directory, "concat-collision");
    mkdirSync(outputDirectory);
    const collisionInput = join(outputDirectory, "concat.txt");
    writeFileSync(collisionInput, "retained concat evidence\n");
    const originalHash = hash(collisionInput);
    const result = runGuard({ outputPath: join(outputDirectory, "final.mp4"), realTwitch: collisionInput });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: input or manifest: RealTwitch and concat list|Path collision: concat list and input or manifest: RealTwitch/);
    assert.equal(hash(collisionInput), originalHash);
    assert.equal(existsSync(join(outputDirectory, "assembly-plan.json")), false);
  });

  await t.test("hardlinked concat list cannot overwrite evidence", () => {
    const outputDirectory = join(fixture.directory, "hardlink-collision");
    mkdirSync(outputDirectory);
    const sourcePath = fixture.sourceFiles["real-twitch"];
    const collisionPath = join(outputDirectory, "concat.txt");
    linkSync(sourcePath, collisionPath);
    const originalHash = hash(sourcePath);
    const result = runGuard({ outputPath: join(outputDirectory, "final.mp4") });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: .*concat list|Path collision: .*RealTwitch/);
    assert.equal(hash(sourcePath), originalHash);
    assert.equal(hash(collisionPath), originalHash);
    assert.equal(existsSync(join(outputDirectory, "assembly-plan.json")), false);
  });

  await t.test("symlinked concat list cannot overwrite evidence", t => {
    const outputDirectory = join(fixture.directory, "symlink-collision");
    mkdirSync(outputDirectory);
    const sourcePath = fixture.sourceFiles["real-twitch"];
    const collisionPath = join(outputDirectory, "concat.txt");
    try {
      symlinkSync(sourcePath, collisionPath, "file");
    } catch (error) {
      t.skip(`Windows symlink creation is unavailable: ${error.code || error.message}`);
      return;
    }
    const originalHash = hash(sourcePath);
    const result = runGuard({ outputPath: join(outputDirectory, "final.mp4") });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: .*concat list|Path collision: .*RealTwitch/);
    assert.equal(hash(sourcePath), originalHash);
    assert.equal(hash(collisionPath), originalHash);
    assert.equal(existsSync(join(outputDirectory, "assembly-plan.json")), false);
  });

  await t.test("dynamic normalized clip cannot overwrite evidence", () => {
    const outputDirectory = join(fixture.directory, "clip-collision");
    mkdirSync(outputDirectory);
    const collisionInput = join(outputDirectory, "00-cold-open.mp4");
    writeFileSync(collisionInput, "retained normalized-clip evidence\n");
    const originalHash = hash(collisionInput);
    const result = runGuard({ outputPath: join(outputDirectory, "final.mp4"), realTwitch: collisionInput });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Path collision: normalized clip\[0\]: cold-open|Path collision: input or manifest: RealTwitch and normalized clip\[0\]: cold-open/);
    assert.equal(hash(collisionInput), originalHash);
    assert.equal(existsSync(join(outputDirectory, "assembly-plan.json")), false);
  });

  await t.test("duplicate standalone and montage IDs cannot hide either normalized evidence path", () => {
    const outputDirectory = join(fixture.directory, "duplicate-reservation-collision");
    mkdirSync(outputDirectory);
    const duplicateEdlPath = join(fixture.directory, "duplicate-reservation-edl.json");
    writeJson(duplicateEdlPath, {
      timeline: [
        { id: "foo-bar" },
        { id: "foo", segments: [{ id: "bar" }] }
      ]
    });
    const firstEvidence = fixture.sourceFiles["real-twitch"];
    const secondEvidence = fixture.sourceFiles["native-obs"];
    const firstCandidate = join(outputDirectory, "00-foo-bar.mp4");
    const secondCandidate = join(outputDirectory, "01-foo-bar.mp4");
    linkSync(firstEvidence, firstCandidate);
    linkSync(secondEvidence, secondCandidate);
    const firstHash = hash(firstEvidence);
    const secondHash = hash(secondEvidence);
    const result = runGuard({
      outputPath: join(outputDirectory, "final.mp4"),
      edlPath: duplicateEdlPath
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Duplicate generated clip id in demo EDL: foo-bar/);
    assert.equal(hash(firstEvidence), firstHash);
    assert.equal(hash(secondEvidence), secondHash);
    assert.equal(hash(firstCandidate), firstHash);
    assert.equal(hash(secondCandidate), secondHash);
    assert.equal(existsSync(join(outputDirectory, "assembly-plan.json")), false);
  });
});

test("failed post-promotion verification atomically restores the prior final MP4", { skip: process.platform !== "win32" }, t => {
  const fixture = withFixture(t);
  const powershell = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const toolRoot = join(fixture.directory, "fake-tools");
  const outputDirectory = join(fixture.directory, "atomic-output");
  mkdirSync(toolRoot);
  mkdirSync(outputDirectory);

  const fakeValidator = join(toolRoot, "fake-validator.mjs");
  const fakeNode = join(toolRoot, "fake-node.cmd");
  const fakeFfmpeg = join(toolRoot, "fake-ffmpeg.cmd");
  writeFileSync(fakeValidator, `
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const planPath = value("--plan");
const reportPath = value("--report");
const outputPath = value("--output");
const edl = JSON.parse(readFileSync(value("--edl"), "utf8"));
const inputPath = value("--final-proof");
const clips = [];
for (const clip of edl.timeline) {
  if (clip.segments) {
    for (const segment of clip.segments) clips.push({ id: clip.id + "-" + segment.id, inputPath, sourceStart: 0, duration: 1, truthLabel: clip.truthLabel });
  } else clips.push({ id: clip.id, inputPath, sourceStart: 0, duration: 1, truthLabel: clip.truthLabel });
}
if (outputPath && !outputPath.endsWith(".unverified.mp4")) {
  process.stderr.write("intentional post-promotion verification failure\\n");
  process.exit(9);
}
mkdirSync(dirname(planPath), { recursive: true });
writeFileSync(planPath, JSON.stringify({ schemaVersion: 1, clips }));
const output = outputPath ? { sha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex") } : null;
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify({ assemblyPlan: { sha256: "a".repeat(64) }, evidenceSet: { sha256: "b".repeat(64) }, output }));
`, "utf8");
  writeFileSync(fakeNode, `@echo off\r\n"${process.execPath}" "${fakeValidator}" %*\r\n`, "utf8");
  writeFileSync(fakeFfmpeg, `@echo off\r\nsetlocal\r\nset "last="\r\n:loop\r\nif "%~1"=="" goto done\r\nset "last=%~1"\r\nshift\r\ngoto loop\r\n:done\r\n> "%last%" echo replacement-candidate\r\nexit /b 0\r\n`, "utf8");

  const outputPath = join(outputDirectory, "nightshift-final.mp4");
  const reportPath = join(outputDirectory, "nightshift-final.evidence.json");
  const backupPath = join(outputDirectory, "nightshift-final.previous.mp4");
  const failedReplacementPath = join(outputDirectory, "nightshift-final.failed.mp4");
  const concatPath = join(outputDirectory, "concat.txt");
  const priorBytes = Buffer.from("PRIOR-VALID-FINAL-MP4\n");
  writeFileSync(outputPath, priorBytes);
  const sourceHashes = Object.fromEntries(Object.entries(fixture.sourceFiles).map(([name, path]) => [name, hash(path)]));
  const manifestHashes = Object.fromEntries(Object.entries(fixture.manifestFiles).map(([name, path]) => [name, hash(path)]));

  const result = spawnSync(powershell, [
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
    "-NodePath", fakeNode,
    "-FfmpegPath", fakeFfmpeg,
    "-FfprobePath", process.execPath,
    "-OutputPath", outputPath,
    "-EvidenceReportPath", reportPath
  ], { encoding: "utf8", windowsHide: true, timeout: 30000 });

  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /post-promotion evidence validation|intentional post-promotion verification failure/i);
  assert.deepEqual(readFileSync(outputPath), priorBytes, "the prior final MP4 must be restored byte-for-byte");
  assert.equal(existsSync(backupPath), false, "rollback backup should be consumed after restoration");
  assert.equal(existsSync(failedReplacementPath), false, "failed replacement quarantine should be removed after restoration");
  const concatBytes = readFileSync(concatPath);
  assert.notDeepEqual([...concatBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "concat list must be BOM-less UTF-8 for ffmpeg");
  assert.match(concatBytes.toString("utf8"), /^file '/);
  for (const [name, path] of Object.entries(fixture.sourceFiles)) assert.equal(hash(path), sourceHashes[name], `${name} media was modified`);
  for (const [name, path] of Object.entries(fixture.manifestFiles)) assert.equal(hash(path), manifestHashes[name], `${name} manifest was modified`);
});

function makeSuccessfulPromotionHarness(t, { priorOutput }) {
  const fixture = withFixture(t);
  const powershell = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const toolRoot = join(fixture.directory, "transaction-tools");
  const outputDirectory = join(fixture.directory, "transaction-output");
  mkdirSync(toolRoot);
  mkdirSync(outputDirectory);
  const fakeValidator = join(toolRoot, "fake-validator.mjs");
  const fakeNode = join(toolRoot, "fake-node.cmd");
  const fakeFfmpeg = join(toolRoot, "fake-ffmpeg.cmd");
  writeFileSync(fakeValidator, `
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const planPath = value("--plan");
const reportPath = value("--report");
const outputPath = value("--output");
const edl = JSON.parse(readFileSync(value("--edl"), "utf8"));
const inputPath = value("--final-proof");
const clips = [];
for (const clip of edl.timeline) {
  if (clip.segments) {
    for (const segment of clip.segments) clips.push({ id: clip.id + "-" + segment.id, inputPath, sourceStart: 0, duration: 1, truthLabel: clip.truthLabel });
  } else clips.push({ id: clip.id, inputPath, sourceStart: 0, duration: 1, truthLabel: clip.truthLabel });
}
mkdirSync(dirname(planPath), { recursive: true });
writeFileSync(planPath, JSON.stringify({ schemaVersion: 1, clips }));
const output = outputPath ? { sha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex") } : null;
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify({ assemblyPlan: { sha256: "a".repeat(64) }, evidenceSet: { sha256: "b".repeat(64) }, output }));
if (outputPath && !outputPath.endsWith(".unverified.mp4") && process.env.NIGHTSHIFT_FAKE_MODE === "poison-backup") {
  rmSync(process.env.NIGHTSHIFT_BACKUP_PATH, { force: true });
  mkdirSync(process.env.NIGHTSHIFT_BACKUP_PATH);
  writeFileSync(process.env.NIGHTSHIFT_BACKUP_PATH + "/blocker.txt", "force backup cleanup failure\\n");
}
`, "utf8");
  writeFileSync(fakeNode, `@echo off\r\n"${process.execPath}" "${fakeValidator}" %*\r\n`, "utf8");
  writeFileSync(fakeFfmpeg, `@echo off\r\nsetlocal\r\nset "last="\r\n:loop\r\nif "%~1"=="" goto done\r\nset "last=%~1"\r\nshift\r\ngoto loop\r\n:done\r\n> "%last%" echo replacement-candidate\r\nexit /b 0\r\n`, "utf8");

  const outputPath = join(outputDirectory, "nightshift-final.mp4");
  const reportPath = join(outputDirectory, "nightshift-final.evidence.json");
  const backupPath = join(outputDirectory, "nightshift-final.previous.mp4");
  const lockPath = join(outputDirectory, ".nightshift-demo-assembly.lock");
  const priorBytes = Buffer.from("PRIOR-VALID-FINAL-MP4\n");
  if (priorOutput) writeFileSync(outputPath, priorBytes);
  const scriptArgs = [
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
    "-NodePath", fakeNode,
    "-FfmpegPath", fakeFfmpeg,
    "-FfprobePath", process.execPath,
    "-OutputPath", outputPath,
    "-EvidenceReportPath", reportPath
  ];
  return {
    fixture,
    powershell,
    scriptArgs,
    outputDirectory,
    outputPath,
    reportPath,
    backupPath,
    lockPath,
    priorBytes,
    run(env = {}) {
      return spawnSync(powershell, [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve(root, "docs/demo-video/build-demo.ps1"),
        ...scriptArgs
      ], { encoding: "utf8", windowsHide: true, timeout: 30000, env: { ...process.env, ...env } });
    }
  };
}

test("a destination that appears before a new-output move is never deleted by this run", { skip: process.platform !== "win32" }, t => {
  const harness = makeSuccessfulPromotionHarness(t, { priorOutput: false });
  const builderPath = resolve(root, "docs/demo-video/build-demo.ps1");
  const builderLines = buildScript.split(/\r?\n/);
  const moveLine = builderLines.findIndex(line => line.includes("[System.IO.File]::Move($stagingOutput, $resolvedOutput)")) + 1;
  assert.ok(moveLine > 0, "new-output move line was not found");
  const wrapperPath = join(harness.fixture.directory, "race-wrapper.ps1");
  const psQuote = value => `'${String(value).replaceAll("'", "''")}'`;
  const parameterLines = [];
  for (let index = 0; index < harness.scriptArgs.length; index += 2) {
    parameterLines.push(`  ${harness.scriptArgs[index].slice(1)} = ${psQuote(harness.scriptArgs[index + 1])}`);
  }
  writeFileSync(wrapperPath, `
$ErrorActionPreference = "Stop"
$builder = ${psQuote(builderPath)}
$global:NightShiftRaceOutput = ${psQuote(harness.outputPath)}
Set-PSBreakpoint -Script $builder -Line ${moveLine} -Action {
  [System.IO.File]::WriteAllText($global:NightShiftRaceOutput, "CONCURRENT-DESTINATION")
} | Out-Null
$builderParameters = @{
${parameterLines.join("\n")}
}
& $builder @builderParameters
`, "utf8");

  const result = spawnSync(harness.powershell, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", wrapperPath
  ], { encoding: "utf8", windowsHide: true, timeout: 30000 });
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /already exists|destination file already exists/i);
  assert.equal(readFileSync(harness.outputPath, "utf8"), "CONCURRENT-DESTINATION");
  assert.equal(existsSync(harness.reportPath), false);
  assert.equal(existsSync(harness.lockPath), false);
});

test("backup cleanup failure retains a consistent verified output and staged report", { skip: process.platform !== "win32" }, t => {
  const harness = makeSuccessfulPromotionHarness(t, { priorOutput: true });
  const result = harness.run({
    NIGHTSHIFT_FAKE_MODE: "poison-backup",
    NIGHTSHIFT_BACKUP_PATH: harness.backupPath
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /backup cleanup failed/i);
  const report = JSON.parse(readFileSync(harness.reportPath, "utf8"));
  assert.equal(report.output.sha256, hash(harness.outputPath));
  assert.notDeepEqual(readFileSync(harness.outputPath), harness.priorBytes);
  assert.equal(existsSync(join(harness.outputDirectory, "assembly-postpromotion.evidence.json")), false);
  assert.equal(existsSync(harness.lockPath), false);
});

