export const ENDING_AUDIO_RMS_THRESHOLD = 0.00001;
export const ENDING_AUDIO_PEAK_THRESHOLD = 0.0001;

function parsedUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function classifyBrowserIssue({
  text = "",
  url = "",
  status = null,
  errorText = "",
  source = "",
  method = "",
  type = "",
} = {}, { appOrigin = "" } = {}) {
  const parsed = parsedUrl(url);
  const normalizedStatus = Number(status || 0);
  const sameAppOrigin = Boolean(parsed && appOrigin && parsed.origin === appOrigin);
  const expectedFavicon404 = sameAppOrigin
    && parsed.pathname === "/favicon.ico"
    && String(method).toUpperCase() === "GET"
    && ["Other", "Image"].includes(type)
    && normalizedStatus === 404
    && !errorText;

  if (expectedFavicon404) {
    return {
      code: "BENIGN_FAVICON_REQUEST",
      gameplayCritical: false,
      needsReview: false,
      explanation: "The local browser requested the optional legacy icon and received the expected 404; no gameplay asset was missing.",
    };
  }

  if (normalizedStatus >= 400 || errorText) {
    return {
      code: "RESOURCE_OR_NETWORK_FAILURE",
      gameplayCritical: true,
      needsReview: true,
      explanation: "A resource or network failure must be resolved or explicitly classified before this capture can pass.",
    };
  }

  const expectedPermissionWarning = source === "violation"
    && /^Permissions policy violation:\s*(?:microphone|camera) is not allowed(?: in this document)?\.?$/i.test(text.trim());
  if (expectedPermissionWarning) {
    return {
      code: "EXPECTED_MEDIA_PERMISSION_DENIAL",
      gameplayCritical: false,
      needsReview: false,
      explanation: "The site intentionally denies getUserMedia camera/microphone access; proof capture uses getDisplayMedia with tab audio instead.",
    };
  }

  if (/Failed to load resource/i.test(text)) {
    return {
      code: "RESOURCE_OR_NETWORK_FAILURE",
      gameplayCritical: true,
      needsReview: true,
      explanation: "A resource or network failure must be resolved or explicitly classified before this capture can pass.",
    };
  }

  return {
    code: "UNCLASSIFIED_BROWSER_ISSUE",
    gameplayCritical: true,
    needsReview: true,
    explanation: "This browser issue is not on the narrow expected-noise allowlist and requires review.",
  };
}

export function assessEndingAudioTail(telemetry, {
  minimumDurationMs = 25000,
  minimumCoverage = 0.7,
  minimumNonSilentRatio = 0.95,
  maximumTrailingSilenceMs = 1000,
  windowName = "humane-ending",
} = {}) {
  const window = telemetry?.windows?.[windowName] || null;
  const sampleIntervalMs = Number(telemetry?.sampleIntervalMs || 0);
  const durationMs = Number(window?.durationMs || 0);
  const sampleCount = Number(window?.sampleCount || 0);
  const nonSilentSampleCount = Number(window?.nonSilentSampleCount || 0);
  const trailingSilentSampleCount = Number(window?.trailingSilentSampleCount || 0);
  const peak = Number(window?.peak || 0);
  const rmsPeak = Number(window?.rmsPeak || 0);
  const expectedSamples = sampleIntervalMs > 0 ? Math.floor(minimumDurationMs / sampleIntervalMs) : 0;
  const requiredSamples = Math.max(1, Math.floor(expectedSamples * minimumCoverage));
  const nonSilentRatio = sampleCount > 0 ? nonSilentSampleCount / sampleCount : 0;
  const trailingSilenceMs = trailingSilentSampleCount * sampleIntervalMs;
  const checks = {
    capturedStreamAnalyser: telemetry?.source === "captured-display-stream" && telemetry?.available === true,
    runningAnalyser: telemetry?.contextState === "running",
    duration: durationMs >= minimumDurationMs,
    sampleCoverage: sampleCount >= requiredSamples,
    nonSilentRatio: nonSilentRatio >= minimumNonSilentRatio,
    terminalContinuity: trailingSilenceMs <= maximumTrailingSilenceMs,
    peak: peak >= ENDING_AUDIO_PEAK_THRESHOLD,
    rmsPeak: rmsPeak >= ENDING_AUDIO_RMS_THRESHOLD,
  };
  return {
    verified: Object.values(checks).every(Boolean),
    windowName,
    minimumDurationMs,
    minimumCoverage,
    minimumNonSilentRatio,
    maximumTrailingSilenceMs,
    expectedSamples,
    requiredSamples,
    durationMs,
    sampleCount,
    nonSilentSampleCount,
    nonSilentRatio,
    trailingSilentSampleCount,
    trailingSilenceMs,
    peak,
    rmsPeak,
    checks,
  };
}
