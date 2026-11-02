import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessEndingAudioTail,
  classifyBrowserIssue,
  ENDING_AUDIO_PEAK_THRESHOLD,
  ENDING_AUDIO_RMS_THRESHOLD,
} from "../scripts/capture-proof-diagnostics.mjs";

const appOrigin = "http://127.0.0.1:4173";
const captureSource = readFileSync(new URL("../scripts/capture-proof.mjs", import.meta.url), "utf8");

test("proof diagnostics are attached before the first app navigation", () => {
  const blankLaunch = captureSource.indexOf('"about:blank"');
  const networkHandler = captureSource.indexOf('cdp.on("Network.requestWillBeSent"');
  const consoleHandler = captureSource.indexOf('cdp.on("Runtime.consoleAPICalled"');
  const networkEnable = captureSource.indexOf('cdp.send("Network.enable"');
  const appNavigation = captureSource.indexOf('cdp.send("Page.navigate"');
  assert.ok(blankLaunch >= 0);
  assert.ok(consoleHandler > blankLaunch);
  assert.ok(networkHandler > blankLaunch);
  assert.ok(networkEnable > networkHandler);
  assert.ok(appNavigation > networkEnable);
});

test("complete proof uses measured shared-stream samples rather than scheduled game nodes", () => {
  assert.match(captureSource, /createMediaStreamSource\(monitorStream\)/);
  assert.match(captureSource, /getFloatTimeDomainData\(samples\)/);
  assert.match(captureSource, /sinkNode\.gain\.setValueAtTime\(0, context\.currentTime\)/,
    "the analyser graph must be pulled through a zero-gain sink without echoing captured audio");
  assert.match(captureSource, /beginAudioTailWindow\?\.\("humane-ending"\)/);
  assert.match(captureSource, /const endingAudioTailVerified = endingAudioTail\.verified/);
  assert.match(captureSource, /complete = [^;]*endingAudioTailVerified/);
});

test("complete proof is gated by initial/final Git, commit, tree, and runtime reconciliation", () => {
  assert.match(captureSource, /const initialSourceIntegrity = inspectSourceIntegrity\(\)/);
  assert.match(captureSource, /const finalSourceIntegrity = inspectSourceIntegrity\(\)/);
  assert.match(captureSource, /const sourceIntegrity = reconcileSourceIntegrity\(initialSourceIntegrity, finalSourceIntegrity\)/);
  assert.match(captureSource, /complete = [^;]*sourceIntegrity\.verified/);
  assert.match(captureSource, /releaseCommitMatched:/);
  assert.match(captureSource, /runtimeSourceHashesReconciled:/);
  assert.match(captureSource, /cleanCommittedSource: sourceIntegrity\.checks\.cleanWorktree/);
});

test("only the exact same-origin legacy favicon 404 is noncritical", () => {
  const expected = classifyBrowserIssue({
    source: "network",
    url: `${appOrigin}/favicon.ico`,
    method: "GET",
    type: "Other",
    status: 404,
  }, { appOrigin });
  assert.equal(expected.code, "BENIGN_FAVICON_REQUEST");
  assert.equal(expected.needsReview, false);

  for (const issue of [
    { source: "network", url: "https://example.com/favicon.ico", method: "GET", type: "Other", status: 404 },
    { source: "network", url: `${appOrigin}/favicon.ico`, method: "GET", type: "Other", status: 500 },
    { source: "network", url: `${appOrigin}/favicon.ico`, method: "POST", type: "Fetch", status: 404 },
  ]) {
    assert.equal(classifyBrowserIssue(issue, { appOrigin }).needsReview, true);
  }
});

test("permission warnings require an exact violation-source entry and cannot mask a network failure", () => {
  const text = "Permissions policy violation: microphone is not allowed in this document.";
  assert.equal(classifyBrowserIssue({ source: "violation", text }, { appOrigin }).code, "EXPECTED_MEDIA_PERMISSION_DENIAL");
  assert.equal(classifyBrowserIssue({ source: "console", text }, { appOrigin }).needsReview, true);
  assert.equal(classifyBrowserIssue({ source: "violation", text, errorText: "net::ERR_FAILED" }, { appOrigin }).code, "RESOURCE_OR_NETWORK_FAILURE");
});

function telemetryWindow(overrides = {}) {
  return {
    source: "captured-display-stream",
    available: true,
    contextState: "running",
    sampleIntervalMs: 100,
    windows: {
      "humane-ending": {
        durationMs: 25500,
        sampleCount: 250,
        nonSilentSampleCount: 248,
        trailingSilentSampleCount: 0,
        peak: ENDING_AUDIO_PEAK_THRESHOLD * 10,
        rmsPeak: ENDING_AUDIO_RMS_THRESHOLD * 10,
        ...overrides,
      },
    },
  };
}

test("ending-tail assessment accepts covered captured-stream samples and rejects a digital-zero tail", () => {
  const audible = assessEndingAudioTail(telemetryWindow());
  assert.equal(audible.verified, true);
  assert.equal(audible.checks.capturedStreamAnalyser, true);

  const digitalZero = assessEndingAudioTail(telemetryWindow({
    nonSilentSampleCount: 0,
    peak: 0,
    rmsPeak: 0,
  }));
  assert.equal(digitalZero.verified, false);
  assert.equal(digitalZero.checks.nonSilentRatio, false);
  assert.equal(digitalZero.checks.peak, false);
  assert.equal(digitalZero.checks.rmsPeak, false);

  const zeroAtTheEnd = assessEndingAudioTail(telemetryWindow({
    nonSilentSampleCount: 240,
    trailingSilentSampleCount: 20,
  }));
  assert.equal(zeroAtTheEnd.verified, false);
  assert.equal(zeroAtTheEnd.checks.nonSilentRatio, true);
  assert.equal(zeroAtTheEnd.checks.terminalContinuity, false);
});

test("ending-tail assessment fails closed on short, sparse, or scheduled-only evidence", () => {
  assert.equal(assessEndingAudioTail(telemetryWindow({ durationMs: 24999 })).verified, false);
  assert.equal(assessEndingAudioTail(telemetryWindow({ sampleCount: 10, nonSilentSampleCount: 10 })).verified, false);
  assert.equal(assessEndingAudioTail({
    source: "scheduled-web-audio-nodes",
    available: true,
    contextState: "running",
    sampleIntervalMs: 100,
    windows: telemetryWindow().windows,
  }).verified, false);
});
