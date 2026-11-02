import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_TARGET = Object.freeze({
  container: "mp4",
  width: 1920,
  height: 1080,
  fps: 30,
  videoCodec: "h264",
  videoPixelFormat: "yuv420p",
  audioCodec: "aac",
  audioChannels: 2,
  audioSampleRate: 48000
});

const DECODED_AUDIO_ACCEPTANCE = Object.freeze({
  sampleRate: 48000,
  channels: 2,
  windowMilliseconds: 100,
  minimumDecodedCoverageSeconds: 24.9,
  minimumPeakAbsolute: 0.0001,
  minimumOverallRms: 0.00001,
  minimumNonSilentWindowRatio: 0.95,
  maximumTrailingSilenceSeconds: 1,
  nonSilentWindowRmsThreshold: 0.00001,
  clippingAbsoluteThreshold: 0.999
});

const REQUIRED_PROOF_ACCEPTANCE = [
  "uninterruptedVideoBytes",
  "tabAudioTrackPresent",
  "browserTabSurfaceSelected",
  "endingAudioTailVerified",
  "captionEventsObserved",
  "earnedHumaneEnding",
  "zeroDirectorFallbacks",
  "browserDiagnosticsAccountedFor",
  "gitCommandsSucceeded",
  "releaseCommitMatched",
  "runtimeSourceHashesReconciled",
  "cleanCommittedSource",
  "rehearsalProvenanceOnly"
];

const REQUIRED_ENDING_AUDIO_CHECKS = [
  "capturedStreamAnalyser",
  "runningAnalyser",
  "duration",
  "sampleCoverage",
  "nonSilentRatio",
  "terminalContinuity",
  "peak",
  "rmsPeak"
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path, label) {
  invariant(path && existsSync(path), `Missing ${label}: ${path || "(not supplied)"}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${label} ${path}: ${error.message}`);
  }
}

function sha256(path) {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const descriptor = openSync(path, "r");
  try {
    let bytesRead;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function sha256Json(value) {
  return createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`).digest("hex");
}

function parseRate(value) {
  if (typeof value === "number") return value;
  const [numerator, denominator = "1"] = String(value || "0").split("/").map(Number);
  return denominator ? numerator / denominator : 0;
}

function ffprobeMedia(path, ffprobePath) {
  const result = spawnSync(
    ffprobePath,
    [
      "-v", "error",
      "-show_entries", "format=duration,format_name:stream=index,codec_type,codec_name,width,height,avg_frame_rate,pix_fmt,channels,sample_rate",
      "-of", "json",
      path
    ],
    { encoding: "utf8", windowsHide: true }
  );
  invariant(!result.error, `Unable to run ffprobe for ${path}: ${result.error?.message || "unknown error"}`);
  invariant(result.status === 0, `ffprobe rejected ${path}: ${(result.stderr || "unknown ffprobe failure").trim()}`);
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`ffprobe returned invalid JSON for ${path}: ${error.message}`);
  }
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStreams = streams.filter(stream => stream.codec_type === "video");
  const audioStreams = streams.filter(stream => stream.codec_type === "audio");
  const video = videoStreams[0] || {};
  const audio = audioStreams[0] || {};
  return {
    durationSeconds: Number(parsed.format?.duration || 0),
    containerNames: String(parsed.format?.format_name || "").split(",").filter(Boolean),
    videoStreamCount: videoStreams.length,
    audioStreamCount: audioStreams.length,
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    fps: parseRate(video.avg_frame_rate),
    videoCodec: video.codec_name || null,
    videoPixelFormat: video.pix_fmt || null,
    audioCodec: audio.codec_name || null,
    audioChannels: Number(audio.channels || 0),
    audioSampleRate: Number(audio.sample_rate || 0)
  };
}

function amplitudeDbfs(value) {
  return value > 0 ? Number((20 * Math.log10(value)).toFixed(3)) : null;
}

export function analyzeDecodedPcm(pcm, { startSeconds = 0, durationSeconds = 0, label = "decoded audio" } = {}) {
  invariant(Buffer.isBuffer(pcm), `${label} PCM payload is not a Buffer`);
  const bytesPerSample = 4;
  const completeBytes = pcm.length - (pcm.length % bytesPerSample);
  const sampleCount = completeBytes / bytesPerSample;
  const frameCount = Math.floor(sampleCount / DECODED_AUDIO_ACCEPTANCE.channels);
  const samplesPerWindow = Math.max(
    DECODED_AUDIO_ACCEPTANCE.channels,
    Math.round(DECODED_AUDIO_ACCEPTANCE.sampleRate * DECODED_AUDIO_ACCEPTANCE.channels * DECODED_AUDIO_ACCEPTANCE.windowMilliseconds / 1000)
  );
  let peakAbsolute = 0;
  let sumSquares = 0;
  let clippedSampleCount = 0;
  let nonFiniteSampleCount = 0;
  let windowSquares = 0;
  let windowSamples = 0;
  const windowRmsValues = [];

  for (let offset = 0; offset < completeBytes; offset += bytesPerSample) {
    const sample = pcm.readFloatLE(offset);
    if (!Number.isFinite(sample)) {
      nonFiniteSampleCount++;
      continue;
    }
    const absolute = Math.abs(sample);
    peakAbsolute = Math.max(peakAbsolute, absolute);
    sumSquares += sample * sample;
    windowSquares += sample * sample;
    windowSamples++;
    if (absolute >= DECODED_AUDIO_ACCEPTANCE.clippingAbsoluteThreshold) clippedSampleCount++;
    if (windowSamples === samplesPerWindow) {
      windowRmsValues.push(Math.sqrt(windowSquares / windowSamples));
      windowSquares = 0;
      windowSamples = 0;
    }
  }
  if (windowSamples > 0) windowRmsValues.push(Math.sqrt(windowSquares / windowSamples));

  const nonSilentWindowCount = windowRmsValues.filter(value => value >= DECODED_AUDIO_ACCEPTANCE.nonSilentWindowRmsThreshold).length;
  let trailingSilentWindowCount = 0;
  for (let index = windowRmsValues.length - 1; index >= 0; index--) {
    if (windowRmsValues[index] >= DECODED_AUDIO_ACCEPTANCE.nonSilentWindowRmsThreshold) break;
    trailingSilentWindowCount++;
  }
  const overallRms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  const decodedDurationSeconds = frameCount / DECODED_AUDIO_ACCEPTANCE.sampleRate;
  const nonSilentWindowRatio = windowRmsValues.length > 0 ? nonSilentWindowCount / windowRmsValues.length : 0;
  const trailingSilenceSeconds = trailingSilentWindowCount * DECODED_AUDIO_ACCEPTANCE.windowMilliseconds / 1000;

  return {
    label,
    startSeconds: Number(startSeconds),
    requestedDurationSeconds: Number(durationSeconds),
    decodedDurationSeconds: Number(decodedDurationSeconds.toFixed(3)),
    sampleRate: DECODED_AUDIO_ACCEPTANCE.sampleRate,
    channels: DECODED_AUDIO_ACCEPTANCE.channels,
    sampleCount,
    frameCount,
    peakAbsolute: Number(peakAbsolute.toFixed(8)),
    peakDbfs: amplitudeDbfs(peakAbsolute),
    overallRms: Number(overallRms.toFixed(8)),
    overallRmsDbfs: amplitudeDbfs(overallRms),
    windowMilliseconds: DECODED_AUDIO_ACCEPTANCE.windowMilliseconds,
    windowCount: windowRmsValues.length,
    nonSilentWindowCount,
    nonSilentWindowRatio: Number(nonSilentWindowRatio.toFixed(6)),
    trailingSilentWindowCount,
    trailingSilenceSeconds: Number(trailingSilenceSeconds.toFixed(3)),
    clippedSampleCount,
    clippedSampleRatio: sampleCount > 0 ? Number((clippedSampleCount / sampleCount).toFixed(9)) : 0,
    nonFiniteSampleCount
  };
}

function decodeAudioWindow(path, ffmpegPath, { startSeconds, durationSeconds, label }) {
  const result = spawnSync(
    ffmpegPath,
    [
      "-hide_banner", "-loglevel", "error", "-nostdin",
      "-ss", Number(startSeconds).toFixed(3),
      "-t", Number(durationSeconds).toFixed(3),
      "-i", path,
      "-map", "0:a:0", "-vn", "-sn", "-dn",
      "-ac", String(DECODED_AUDIO_ACCEPTANCE.channels),
      "-ar", String(DECODED_AUDIO_ACCEPTANCE.sampleRate),
      "-c:a", "pcm_f32le", "-f", "f32le", "pipe:1"
    ],
    { encoding: null, maxBuffer: 64 * 1024 * 1024, windowsHide: true }
  );
  invariant(!result.error, `Unable to decode ${label} audio from ${path}: ${result.error?.message || "unknown error"}`);
  invariant(result.status === 0, `ffmpeg could not decode ${label} audio from ${path}: ${String(result.stderr || "unknown ffmpeg failure").trim()}`);

  const pcm = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout || "");
  return analyzeDecodedPcm(pcm, { startSeconds, durationSeconds, label });
}

function validateDecodedAudio(analysis, label) {
  invariant(analysis && typeof analysis === "object", `${label} decoded-audio analysis is missing`);
  invariant(analysis.decodedDurationSeconds >= DECODED_AUDIO_ACCEPTANCE.minimumDecodedCoverageSeconds, `${label} decoded audio covers only ${analysis.decodedDurationSeconds || 0} seconds`);
  invariant(analysis.nonFiniteSampleCount === 0, `${label} decoded audio contains non-finite samples`);
  invariant(analysis.peakAbsolute >= DECODED_AUDIO_ACCEPTANCE.minimumPeakAbsolute, `${label} decoded audio is digital zero or below the minimum peak`);
  invariant(analysis.overallRms >= DECODED_AUDIO_ACCEPTANCE.minimumOverallRms, `${label} decoded audio RMS is digital zero or below the minimum`);
  invariant(analysis.nonSilentWindowRatio >= DECODED_AUDIO_ACCEPTANCE.minimumNonSilentWindowRatio, `${label} decoded audio has too many silent windows`);
  invariant(analysis.trailingSilenceSeconds <= DECODED_AUDIO_ACCEPTANCE.maximumTrailingSilenceSeconds, `${label} decoded audio has ${analysis.trailingSilenceSeconds}s terminal silence`);
  invariant(analysis.clippedSampleCount === 0, `${label} decoded audio contains ${analysis.clippedSampleCount} clipped sample(s)`);
}

function validateEdl(edl) {
  invariant(edl.schemaVersion === 2, "Demo EDL must use schemaVersion 2");
  invariant(Number.isFinite(edl.targetDurationSeconds) && edl.targetDurationSeconds > 0, "EDL target duration is invalid");
  invariant(edl.targetDurationSeconds <= edl.rules?.maximumDurationSeconds, "EDL exceeds its maximum duration");
  invariant(edl.rules?.maximumDurationSeconds <= 180, "EDL maximum duration must not exceed 180 seconds");
  invariant(edl.rules?.allowSimulatedTwitchAsReal === false, "EDL must forbid simulated Twitch as real evidence");
  invariant(edl.rules?.allowBrowserOverlayAsNativeObs === false, "EDL must forbid a browser-only overlay as native OBS evidence");
  invariant(edl.rules?.youtubeVisibility === "public", "EDL must require a public judging video");
  invariant(edl.rules?.requireExactCommitForEverySource === true, "EDL must require exact-commit evidence");
  invariant(edl.rules?.requireBurnedTruthLabels === true, "EDL must require burned truth labels");
  for (const [key, expected] of Object.entries(REQUIRED_TARGET)) {
    invariant(edl.target?.[key] === expected, `EDL target ${key} must be ${expected}`);
  }
  invariant(Array.isArray(edl.sources) && edl.sources.length > 0, "EDL sources are missing");
  invariant(Array.isArray(edl.timeline) && edl.timeline.length > 0, "EDL timeline is missing");

  const sourceDefinitions = new Map();
  for (const source of edl.sources) {
    invariant(source.id && !sourceDefinitions.has(source.id), `Duplicate or missing EDL source id: ${source.id}`);
    invariant(source.truthLabel, `Source ${source.id} has no truth label`);
    invariant(["schema-v3-rehearsal-proof", "external-evidence"].includes(source.kind), `Unsupported source kind for ${source.id}`);
    if (source.kind === "external-evidence") {
      invariant(Array.isArray(source.requiredAssertions) && source.requiredAssertions.length > 0, `${source.id} has no required evidence assertions`);
      invariant(new Set(source.requiredAssertions).size === source.requiredAssertions.length, `${source.id} has duplicate evidence assertions`);
    }
    sourceDefinitions.set(source.id, source);
  }

  invariant(sourceDefinitions.get("final-proof")?.kind === "schema-v3-rehearsal-proof", "EDL must define final-proof as schema-v3 rehearsal evidence");
  invariant(sourceDefinitions.get("final-proof")?.requiredManifestStatus === "COMPLETE_REHEARSAL_PROOF", "EDL must require a complete schema-v3 rehearsal proof");
  invariant(sourceDefinitions.get("final-proof")?.truthLabel === "REHEARSAL / SIMULATED", "The rehearsal source must retain its explicit simulated truth label");

  let cursor = 0;
  const clipIds = new Set();
  const generatedClipIds = new Set();
  for (const clip of edl.timeline) {
    invariant(clip.id && sourceDefinitions.has(clip.source), `Timeline clip ${clip.id || "(unnamed)"} has an unknown source`);
    invariant(!clipIds.has(clip.id), `Duplicate timeline clip id: ${clip.id}`);
    clipIds.add(clip.id);
    invariant(Number(clip.finalStart) === cursor, `Timeline gap or overlap before ${clip.id}`);
    invariant(Number.isFinite(clip.duration) && clip.duration > 0, `Timeline clip ${clip.id} has an invalid duration`);
    invariant(clip.truthLabel === sourceDefinitions.get(clip.source).truthLabel, `${clip.id} truth label does not match its source definition`);
    if (clip.segments) {
      invariant(clip.source === "final-proof", `${clip.id} montage must use final-proof`);
      invariant(Array.isArray(clip.segments) && clip.segments.length > 0, `${clip.id} montage has no segments`);
      const segmentIds = new Set();
      for (const segment of clip.segments) {
        invariant(segment.id && !segmentIds.has(segment.id), `${clip.id} has a duplicate or missing segment id`);
        segmentIds.add(segment.id);
        const generatedClipId = `${clip.id}-${segment.id}`;
        invariant(!generatedClipIds.has(generatedClipId), `Duplicate generated clip id: ${generatedClipId}`);
        generatedClipIds.add(generatedClipId);
        invariant(typeof segment.startMilestone === "string" && segment.startMilestone.length > 0, `${clip.id}/${segment.id} has no proof milestone`);
        invariant(Number.isFinite(segment.duration) && segment.duration > 0, `${clip.id}/${segment.id} has an invalid duration`);
      }
      const segmentDuration = Number(clip.segments.reduce((sum, segment) => sum + Number(segment.duration || 0), 0).toFixed(3));
      invariant(segmentDuration === clip.duration, `${clip.id} montage segments do not equal its timeline duration`);
    } else if (clip.source === "final-proof") {
      invariant(!generatedClipIds.has(clip.id), `Duplicate generated clip id: ${clip.id}`);
      generatedClipIds.add(clip.id);
      invariant(typeof clip.startMilestone === "string" && clip.startMilestone.length > 0, `${clip.id} has no proof milestone`);
    } else {
      invariant(!generatedClipIds.has(clip.id), `Duplicate generated clip id: ${clip.id}`);
      generatedClipIds.add(clip.id);
      invariant(Number.isFinite(clip.sourceStart) && clip.sourceStart >= 0, `${clip.id} has an invalid external source start`);
    }
    cursor = Number((cursor + clip.duration).toFixed(3));
  }
  invariant(cursor === edl.targetDurationSeconds, `EDL ends at ${cursor}s instead of ${edl.targetDurationSeconds}s`);
  const audibleEndingClips = edl.timeline.filter(clip => clip.requiresAudibleEnding === true);
  invariant(audibleEndingClips.length === 1, "EDL must identify exactly one audible ending clip");
  invariant(audibleEndingClips[0].source === "final-proof" && audibleEndingClips[0].duration >= 25, "Audible ending clip must retain at least 25 seconds from final-proof");

  const externalSourceIds = [...sourceDefinitions.values()].filter(source => source.kind === "external-evidence").map(source => source.id).sort();
  const requiredExternalIds = (edl.requiredExternalAssets || []).map(asset => asset.id).sort();
  invariant(JSON.stringify(externalSourceIds) === JSON.stringify(requiredExternalIds), "Every external source must be declared as a required external asset");
  for (const sourceId of externalSourceIds) {
    const sourceClips = edl.timeline.filter(clip => clip.source === sourceId);
    invariant(sourceClips.length > 0 && sourceClips.every(clip => clip.requiredRealEvidence === true), `${sourceId} is not marked required real evidence on every cut`);
    const asset = edl.requiredExternalAssets.find(candidate => candidate.id === sourceId);
    const requiredSourceDuration = Math.max(...sourceClips
      .map(clip => Number(clip.sourceStart) + Number(clip.duration)));
    invariant(asset.durationSeconds === requiredSourceDuration, `${sourceId} required asset duration does not match its EDL cuts`);
  }
  const twitchClip = edl.timeline.find(clip => clip.source === "real-twitch");
  invariant(twitchClip && twitchClip.finalStart < edl.rules.requireRealTwitchBeforeSecond, "Real Twitch evidence appears too late in the edit");
  return sourceDefinitions;
}

function fileFacts(path, label) {
  invariant(path && existsSync(path), `Missing ${label}: ${path || "(not supplied)"}`);
  const stats = statSync(path);
  invariant(stats.isFile(), `${label} is not a file: ${path}`);
  invariant(stats.size > 0, `${label} is zero bytes: ${path}`);
  return {
    path: resolve(path),
    fileName: basename(path),
    bytes: stats.size,
    sha256: sha256(path),
    modifiedAt: stats.mtime.toISOString()
  };
}

function validateProofManifest(manifest, sourceDefinition, expectedCommit, proofFacts) {
  invariant(manifest.schemaVersion === 3, "Final rehearsal proof must use schemaVersion 3");
  invariant(manifest.status === sourceDefinition.requiredManifestStatus, `Final rehearsal proof status is ${manifest.status || "missing"}`);
  invariant(manifest.failure == null, "Final rehearsal proof contains a failure record");
  invariant(manifest.source?.commit === expectedCommit, `Final rehearsal proof commit ${manifest.source?.commit || "missing"} does not match ${expectedCommit}`);
  invariant(manifest.source?.expectedCommit === expectedCommit, `Final rehearsal proof expected commit ${manifest.source?.expectedCommit || "missing"} does not match ${expectedCommit}`);
  invariant(manifest.source?.worktree?.dirty === false, "Final rehearsal proof was captured from a dirty worktree");
  invariant(manifest.source?.integrity?.reconciliation?.verified === true, "Final rehearsal proof did not reconcile its initial and final source integrity");
  invariant(manifest.source?.integrity?.initial?.valid === true && manifest.source?.integrity?.final?.valid === true, "Final rehearsal proof source-integrity preflight or postflight failed");
  invariant(manifest.source?.integrity?.initial?.head === expectedCommit && manifest.source?.integrity?.final?.head === expectedCommit, "Final rehearsal proof changed commits during capture");
  invariant(/^[0-9a-f]{40}$/i.test(manifest.source?.sourceTree || ""), "Final rehearsal proof has no exact source-tree hash");
  invariant(/^[0-9a-f]{40}$/i.test(manifest.source?.runtimeTree || ""), "Final rehearsal proof has no exact runtime-tree hash");
  invariant(/^[0-9a-f]{64}$/i.test(manifest.source?.sourceManifestSha256 || ""), "Final rehearsal proof has no source-manifest SHA-256");
  invariant(/^[0-9a-f]{64}$/i.test(manifest.source?.runtimeManifestSha256 || ""), "Final rehearsal proof has no runtime-manifest SHA-256");
  invariant(manifest.provenance?.mode === "REHEARSAL_SIMULATED_INPUT", "Final proof provenance must remain rehearsal/simulated");
  invariant(manifest.provenance?.liveTwitch === false && manifest.provenance?.nativeObs === false, "Final proof must not claim Twitch or OBS provenance");
  invariant(manifest.recording?.bytes === proofFacts.bytes, "Final proof byte count does not match its manifest");
  invariant(String(manifest.recording?.sha256 || "").toLowerCase() === proofFacts.sha256, "Final proof SHA-256 does not match its manifest");
  invariant(basename(manifest.recording?.path || "") === proofFacts.fileName, "Final proof filename does not match its manifest");
  invariant(manifest.recording?.audioTrackCount >= 1, "Final proof manifest has no tab-audio track");
  invariant(manifest.recording?.videoTrackCount >= 1, "Final proof manifest has no video track");
  invariant(manifest.recording?.displaySurface === "browser", "Final proof was not captured from a browser tab");
  invariant(manifest.recording?.durationMs > 0, "Final proof manifest has no duration");
  invariant(manifest.recording?.endingAudioTail?.verified === true, "Final proof ending audio tail is not verified");
  invariant(manifest.recording.endingAudioTail.durationMs >= 25000, "Final proof ending audio tail is shorter than 25 seconds");
  invariant(manifest.recording.endingAudioTail.nonSilentRatio >= 0.95, "Final proof ending audio tail is too silent");
  invariant(manifest.recording.endingAudioTail.trailingSilenceMs <= 1000, "Final proof ending audio has more than one terminal second of silence");
  for (const check of REQUIRED_ENDING_AUDIO_CHECKS) {
    invariant(manifest.recording.endingAudioTail.checks?.[check] === true, `Final proof ending-audio check failed or is missing: ${check}`);
  }
  for (const key of REQUIRED_PROOF_ACCEPTANCE) {
    invariant(manifest.acceptance?.[key] === true, `Final proof acceptance gate failed: ${key}`);
  }
  invariant(manifest.diagnostics?.summary?.unresolvedCount === 0, "Final proof has unresolved browser diagnostics");
  invariant(manifest.diagnostics?.summary?.allIssuesAccountedFor === true, "Final proof diagnostics are not fully accounted for");
  invariant(manifest.automation?.ending === "MARA WALKS INTO DAWN", "Final proof did not earn the humane ending");
  invariant(manifest.automation?.recap?.includes("FALLBACKS0"), "Final proof ending used a director fallback");
  invariant(Array.isArray(manifest.milestones) && manifest.milestones.length > 0, "Final proof manifest has no milestones");
}

function validateExternalManifest(manifest, sourceDefinition, expectedCommit, facts) {
  invariant(manifest.schemaVersion === 1, `${sourceDefinition.id} sidecar must use schemaVersion 1`);
  invariant(manifest.kind === "NIGHTSHIFT_EXTERNAL_EVIDENCE", `${sourceDefinition.id} sidecar has the wrong kind`);
  invariant(manifest.sourceId === sourceDefinition.id, `${sourceDefinition.id} sidecar identifies ${manifest.sourceId || "no source"}`);
  invariant(manifest.status === "VERIFIED_EVIDENCE", `${sourceDefinition.id} sidecar is not VERIFIED_EVIDENCE`);
  invariant(manifest.source?.commit === expectedCommit, `${sourceDefinition.id} sidecar commit does not match ${expectedCommit}`);
  invariant(typeof manifest.verifiedBy === "string" && manifest.verifiedBy.trim().length > 0, `${sourceDefinition.id} sidecar has no verifier`);
  invariant(Number.isFinite(Date.parse(manifest.verifiedAt)), `${sourceDefinition.id} sidecar has an invalid verifiedAt timestamp`);
  invariant(manifest.artifact?.fileName === facts.fileName, `${sourceDefinition.id} filename does not match its sidecar`);
  invariant(manifest.artifact?.bytes === facts.bytes, `${sourceDefinition.id} byte count does not match its sidecar`);
  invariant(String(manifest.artifact?.sha256 || "").toLowerCase() === facts.sha256, `${sourceDefinition.id} SHA-256 does not match its sidecar`);
  invariant(Number.isFinite(manifest.artifact?.durationSeconds) && manifest.artifact.durationSeconds > 0, `${sourceDefinition.id} sidecar has an invalid duration`);
  for (const assertion of sourceDefinition.requiredAssertions) {
    invariant(manifest.assertions?.[assertion] === true, `${sourceDefinition.id} evidence assertion is not verified: ${assertion}`);
  }
}

function milestoneStart(manifest, label, offsetSeconds, clipId) {
  const matches = manifest.milestones.filter(milestone => milestone.label === label);
  invariant(matches.length === 1, `${clipId} requires exactly one proof milestone named ${label}`);
  const start = Number(matches[0].atMs) / 1000 + Number(offsetSeconds || 0);
  invariant(Number.isFinite(start) && start >= 0, `${clipId} resolves to an invalid source start`);
  return Number(start.toFixed(3));
}

function buildPlan(edl, proofManifest, sourceFiles) {
  const clips = [];
  for (const timelineClip of edl.timeline) {
    const shared = {
      timelineId: timelineClip.id,
      sourceId: timelineClip.source,
      inputPath: resolve(sourceFiles[timelineClip.source]),
      truthLabel: timelineClip.truthLabel,
      requiredRealEvidence: timelineClip.requiredRealEvidence === true
    };
    if (timelineClip.segments) {
      let finalStart = Number(timelineClip.finalStart);
      for (const segment of timelineClip.segments) {
        const sourceStart = milestoneStart(proofManifest, segment.startMilestone, segment.offsetSeconds, `${timelineClip.id}/${segment.id}`);
        clips.push({
          ...shared,
          id: `${timelineClip.id}-${segment.id}`,
          finalStart: Number(finalStart.toFixed(3)),
          duration: Number(segment.duration),
          sourceStart,
          startMilestone: segment.startMilestone
        });
        finalStart += Number(segment.duration);
      }
      continue;
    }
    const sourceStart = timelineClip.source === "final-proof"
      ? milestoneStart(proofManifest, timelineClip.startMilestone, timelineClip.offsetSeconds, timelineClip.id)
      : Number(timelineClip.sourceStart || 0);
    clips.push({
      ...shared,
      id: timelineClip.id,
      finalStart: Number(timelineClip.finalStart),
      duration: Number(timelineClip.duration),
      sourceStart,
      startMilestone: timelineClip.startMilestone || null,
      requiresAudibleEnding: timelineClip.requiresAudibleEnding === true
    });
  }
  invariant(new Set(clips.map(clip => clip.id)).size === clips.length, "Assembly plan contains duplicate generated clip IDs");
  return {
    schemaVersion: 1,
    targetDurationSeconds: edl.targetDurationSeconds,
    target: edl.target,
    clips
  };
}

function validateOutputMedia(media, target, maximumDuration, targetDuration) {
  invariant(media.videoStreamCount >= 1, "Final output has no video stream");
  invariant(media.audioStreamCount >= 1, "Final output has no audio stream");
  invariant(media.containerNames.includes(target.container), `Final output container is ${media.containerNames.join(",") || "unknown"}, expected ${target.container}`);
  invariant(media.videoCodec === target.videoCodec, `Final output video codec is ${media.videoCodec}, expected ${target.videoCodec}`);
  invariant(media.videoPixelFormat === target.videoPixelFormat, `Final output pixel format is ${media.videoPixelFormat}, expected ${target.videoPixelFormat}`);
  invariant(media.audioCodec === target.audioCodec, `Final output audio codec is ${media.audioCodec}, expected ${target.audioCodec}`);
  invariant(media.width === target.width && media.height === target.height, `Final output is ${media.width}x${media.height}, expected ${target.width}x${target.height}`);
  invariant(Math.abs(media.fps - target.fps) <= 0.05, `Final output is ${media.fps} fps, expected ${target.fps}`);
  invariant(media.audioChannels === target.audioChannels, `Final output has ${media.audioChannels} audio channels, expected ${target.audioChannels}`);
  invariant(media.audioSampleRate === target.audioSampleRate, `Final output sample rate is ${media.audioSampleRate}, expected ${target.audioSampleRate}`);
  invariant(media.durationSeconds <= maximumDuration + 0.05, `Final output exceeds ${maximumDuration} seconds`);
  invariant(Math.abs(media.durationSeconds - targetDuration) <= 0.75, `Final output duration ${media.durationSeconds}s does not match ${targetDuration}s`);
}

export function validateAssemblyEvidence({
  edlPath,
  expectedCommit,
  sourceFiles,
  manifestFiles,
  probeMedia,
  analyzeAudio = null,
  outputPath = null,
  expectedOutputSha256 = null,
  expectedPlanSha256 = null,
  expectedEvidenceSetSha256 = null
}) {
  invariant(/^[0-9a-f]{40}$/i.test(expectedCommit || ""), "Expected commit must be a full 40-character Git hash");
  const normalizedCommit = expectedCommit.toLowerCase();
  const edlFacts = fileFacts(edlPath, "demo EDL");
  const edl = readJson(edlPath, "demo EDL");
  const sourceDefinitions = validateEdl(edl);
  const proofFacts = fileFacts(sourceFiles["final-proof"], "final rehearsal proof");
  const proofManifestFacts = fileFacts(manifestFiles["final-proof"], "final rehearsal proof manifest");
  const proofManifest = readJson(proofManifestFacts.path, "final rehearsal proof manifest");
  validateProofManifest(proofManifest, sourceDefinitions.get("final-proof"), normalizedCommit, proofFacts);

  const plan = buildPlan(edl, proofManifest, sourceFiles);
  const planSha256 = sha256Json(plan);
  if (expectedPlanSha256) {
    invariant(planSha256 === expectedPlanSha256, `Assembly plan changed after preflight: expected ${expectedPlanSha256}, got ${planSha256}`);
  }
  const requiredDuration = new Map();
  for (const clip of plan.clips) {
    const end = Number((clip.sourceStart + clip.duration).toFixed(3));
    requiredDuration.set(clip.sourceId, Math.max(requiredDuration.get(clip.sourceId) || 0, end));
  }

  const sources = {};
  for (const [sourceId, definition] of sourceDefinitions) {
    const facts = sourceId === "final-proof" ? proofFacts : fileFacts(sourceFiles[sourceId], `${sourceId} footage`);
    const manifestFacts = sourceId === "final-proof" ? proofManifestFacts : fileFacts(manifestFiles[sourceId], `${sourceId} evidence sidecar`);
    const manifest = sourceId === "final-proof" ? proofManifest : readJson(manifestFacts.path, `${sourceId} evidence sidecar`);
    if (definition.kind === "external-evidence") validateExternalManifest(manifest, definition, normalizedCommit, facts);
    const media = probeMedia(facts.path);
    invariant(media && Number.isFinite(media.durationSeconds) && media.durationSeconds > 0, `${sourceId} has invalid ffprobe metadata`);
    invariant(media.videoStreamCount >= 1, `${sourceId} has no video stream`);
    invariant(media.audioStreamCount >= 1, `${sourceId} has no audio stream`);
    invariant(media.durationSeconds + 0.05 >= (requiredDuration.get(sourceId) || 0), `${sourceId} is too short for the EDL`);
    if (sourceId === "final-proof") {
      invariant(Math.abs(media.durationSeconds * 1000 - proofManifest.recording.durationMs) <= 1500, "Final proof ffprobe duration does not match its manifest");
    } else {
      invariant(Math.abs(media.durationSeconds - Number(manifest.artifact?.durationSeconds || 0)) <= 1, `${sourceId} ffprobe duration does not match its sidecar`);
    }
    sources[sourceId] = {
      kind: definition.kind,
      truthLabel: definition.truthLabel,
      artifact: facts,
      manifest: {
        path: manifestFacts.path,
        sha256: manifestFacts.sha256,
        status: manifest.status,
        verifiedBy: manifest.verifiedBy || null,
        verifiedAt: manifest.verifiedAt || null
      },
      media
    };
  }

  const evidenceSet = {
    expectedCommit: normalizedCommit,
    edlSha256: edlFacts.sha256,
    sources: Object.fromEntries(Object.entries(sources).map(([sourceId, source]) => [sourceId, {
      artifactSha256: source.artifact.sha256,
      manifestSha256: source.manifest.sha256
    }]))
  };
  const evidenceSetSha256 = sha256Json(evidenceSet);
  if (expectedEvidenceSetSha256) {
    invariant(evidenceSetSha256 === expectedEvidenceSetSha256, `Evidence set changed after preflight: expected ${expectedEvidenceSetSha256}, got ${evidenceSetSha256}`);
  }

  let output = null;
  if (outputPath) {
    const outputFacts = fileFacts(outputPath, "assembled demo output");
    if (expectedOutputSha256) {
      invariant(outputFacts.sha256 === expectedOutputSha256, `Assembled output changed after verification: expected ${expectedOutputSha256}, got ${outputFacts.sha256}`);
    }
    const outputMedia = probeMedia(outputFacts.path);
    validateOutputMedia(outputMedia, edl.target, edl.rules.maximumDurationSeconds, edl.targetDurationSeconds);
    invariant(typeof analyzeAudio === "function", "Decoded output-audio analysis is required before assembly verification");
    const humaneEndingClip = plan.clips.find(clip => clip.requiresAudibleEnding === true);
    invariant(humaneEndingClip, "Assembly plan has no audible humane-ending clip");
    const humaneEnding = analyzeAudio(outputFacts.path, {
      label: "humane-ending window",
      startSeconds: humaneEndingClip.finalStart,
      durationSeconds: 25
    });
    const finalTail = analyzeAudio(outputFacts.path, {
      label: "final 25-second tail",
      startSeconds: Math.max(0, outputMedia.durationSeconds - 25),
      durationSeconds: 25
    });
    validateDecodedAudio(humaneEnding, "Humane-ending window");
    validateDecodedAudio(finalTail, "Final 25-second tail");
    output = {
      ...outputFacts,
      media: outputMedia,
      decodedAudio: {
        acceptance: DECODED_AUDIO_ACCEPTANCE,
        humaneEnding,
        finalTail,
        limitation: "Digital continuity and sample-clipping gate only; headphones, speakers, stereo image, balance, and subjective mix quality still require human review."
      }
    };
  }

  return {
    plan,
    report: {
      schemaVersion: 1,
      title: "NightShift Live demo assembly evidence",
      status: output ? "ASSEMBLY_VERIFIED" : "PREASSEMBLY_EVIDENCE_VERIFIED",
      generatedAt: new Date().toISOString(),
      expectedCommit: normalizedCommit,
      edl: edlFacts,
      rules: edl.rules,
      target: edl.target,
      targetDurationSeconds: edl.targetDurationSeconds,
      assemblyPlan: { sha256: planSha256 },
      evidenceSet: { ...evidenceSet, sha256: evidenceSetSha256 },
      sources,
      timeline: plan.clips.map(clip => ({
        id: clip.id,
        sourceId: clip.sourceId,
        finalStart: clip.finalStart,
        sourceStart: clip.sourceStart,
        duration: clip.duration,
        truthLabel: clip.truthLabel,
        startMilestone: clip.startMilestone
      })),
      output,
      truthBoundary: "Rehearsal segments remain visibly labeled. External evidence is accepted only with an exact-commit VERIFIED_EVIDENCE sidecar and matching media hash."
    }
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    invariant(key?.startsWith("--") && index + 1 < argv.length, `Invalid CLI argument near ${key || "(end)"}`);
    args[key.slice(2)] = argv[index + 1];
  }
  return args;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const sourceFiles = {
    "final-proof": args["final-proof"],
    "real-twitch": args["real-twitch"],
    "native-obs": args["native-obs"],
    "codex-bts": args["codex-bts"],
    "accessibility-human-qa": args["accessibility-human-qa"],
    "closing-card": args["closing-card"]
  };
  const manifestFiles = {
    "final-proof": args["final-proof-manifest"],
    "real-twitch": args["real-twitch-manifest"],
    "native-obs": args["native-obs-manifest"],
    "codex-bts": args["codex-bts-manifest"],
    "accessibility-human-qa": args["accessibility-human-qa-manifest"],
    "closing-card": args["closing-card-manifest"]
  };
  invariant(args.edl, "--edl is required");
  invariant(args["expected-commit"], "--expected-commit is required");
  invariant(args.ffprobe, "--ffprobe is required");
  invariant(args.plan, "--plan is required");
  invariant(args.report, "--report is required");
  if (args.output) invariant(args.ffmpeg, "--ffmpeg is required when --output is supplied");
  const result = validateAssemblyEvidence({
    edlPath: resolve(args.edl),
    expectedCommit: args["expected-commit"],
    sourceFiles,
    manifestFiles,
    probeMedia: path => ffprobeMedia(path, args.ffprobe),
    analyzeAudio: args.output ? (path, window) => decodeAudioWindow(path, args.ffmpeg, window) : null,
    outputPath: args.output ? resolve(args.output) : null,
    expectedOutputSha256: args["expected-output-sha256"] || null,
    expectedPlanSha256: args["expected-plan-sha256"] || null,
    expectedEvidenceSetSha256: args["expected-evidence-set-sha256"] || null
  });
  writeJson(resolve(args.plan), result.plan);
  writeJson(resolve(args.report), result.report);
  process.stdout.write(`${result.report.status}: ${args.report}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Demo evidence validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

