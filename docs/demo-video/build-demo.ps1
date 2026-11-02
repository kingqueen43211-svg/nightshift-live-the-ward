param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-fA-F]{40}$')][string]$ExpectedCommit,
  [Parameter(Mandatory=$true)][string]$FinalProof,
  [Parameter(Mandatory=$true)][string]$FinalProofManifest,
  [Parameter(Mandatory=$true)][string]$RealTwitch,
  [Parameter(Mandatory=$true)][string]$RealTwitchManifest,
  [Parameter(Mandatory=$true)][string]$NativeObs,
  [Parameter(Mandatory=$true)][string]$NativeObsManifest,
  [Parameter(Mandatory=$true)][string]$CodexBts,
  [Parameter(Mandatory=$true)][string]$CodexBtsManifest,
  [Parameter(Mandatory=$true)][string]$AccessibilityQa,
  [Parameter(Mandatory=$true)][string]$AccessibilityQaManifest,
  [Parameter(Mandatory=$true)][string]$ClosingCard,
  [Parameter(Mandatory=$true)][string]$ClosingCardManifest,
  [string]$EdlPath = "",
  [string]$NodePath = "node",
  [string]$FfmpegPath = "ffmpeg",
  [string]$FfprobePath = "ffprobe",
  [string]$OutputPath = ".\build\nightshift-live-hackathon-demo.mp4",
  [string]$EvidenceReportPath = ".\build\nightshift-live-hackathon-demo.evidence.json",
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot "..\.."))
$validatorPath = Join-Path $repoRoot "scripts\validate-demo-evidence.mjs"
if (-not $EdlPath) { $EdlPath = Join-Path $scriptRoot "demo-edl.json" }

function Resolve-RequiredFile([string]$Path, [string]$Label) {
  $resolved = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
  if (-not $resolved) { throw "Missing required $Label`: $Path" }
  $item = Get-Item -LiteralPath $resolved.Path
  if (-not $item.PSIsContainer -and $item.Length -le 0) { throw "$Label is zero bytes: $Path" }
  return $resolved.Path
}

function Resolve-OutputPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) { return [System.IO.Path]::GetFullPath($Path) }
  return [System.IO.Path]::GetFullPath((Join-Path $scriptRoot $Path))
}

function Require-Tool([string]$Path, [string]$Label) {
  if (Test-Path -LiteralPath $Path) { return (Resolve-Path -LiteralPath $Path).Path }
  $command = Get-Command $Path -ErrorAction SilentlyContinue
  if (-not $command) { throw "$Label is required but was not found. Supply its explicit path." }
  return $command.Source
}

function Escape-DrawText([string]$Text) {
  return $Text.Replace("\", "\\").Replace(":", "\:").Replace("'", "\'").Replace("%", "\%")
}

function Assert-NoPathCollisions([System.Collections.IDictionary]$Claims) {
  $seen = @{}
  foreach ($label in $Claims.Keys) {
    $fullPath = [System.IO.Path]::GetFullPath([string]$Claims[$label])
    if ($seen.ContainsKey($fullPath)) {
      throw "Path collision: $label and $($seen[$fullPath]) both resolve to $fullPath. Evidence inputs and assembly outputs must use distinct files."
    }
    $seen[$fullPath] = $label
  }
}

$node = Require-Tool $NodePath "Node.js"
$ffprobe = Require-Tool $FfprobePath "ffprobe"
$edl = Resolve-RequiredFile $EdlPath "demo EDL"
$validator = Resolve-RequiredFile $validatorPath "demo evidence validator"

$resolvedInputs = @{
  FinalProof = Resolve-RequiredFile $FinalProof "final exact-commit rehearsal"
  FinalProofManifest = Resolve-RequiredFile $FinalProofManifest "final rehearsal schema-v3 manifest"
  RealTwitch = Resolve-RequiredFile $RealTwitch "real Twitch footage"
  RealTwitchManifest = Resolve-RequiredFile $RealTwitchManifest "real Twitch evidence sidecar"
  NativeObs = Resolve-RequiredFile $NativeObs "native OBS footage"
  NativeObsManifest = Resolve-RequiredFile $NativeObsManifest "native OBS evidence sidecar"
  CodexBts = Resolve-RequiredFile $CodexBts "Codex development footage"
  CodexBtsManifest = Resolve-RequiredFile $CodexBtsManifest "Codex development evidence sidecar"
  AccessibilityQa = Resolve-RequiredFile $AccessibilityQa "accessibility and human-QA footage"
  AccessibilityQaManifest = Resolve-RequiredFile $AccessibilityQaManifest "accessibility and human-QA evidence sidecar"
  ClosingCard = Resolve-RequiredFile $ClosingCard "closing-card footage"
  ClosingCardManifest = Resolve-RequiredFile $ClosingCardManifest "closing-card evidence sidecar"
}

$resolvedOutput = Resolve-OutputPath $OutputPath
$resolvedEvidenceReport = Resolve-OutputPath $EvidenceReportPath
$buildRoot = Split-Path -Parent $resolvedOutput
$planPath = Join-Path $buildRoot "assembly-plan.json"
$preflightReportPath = Join-Path $buildRoot "assembly-preflight.evidence.json"
$prepublishReportPath = Join-Path $buildRoot "assembly-prepublish.evidence.json"
$outputDirectory = Split-Path -Parent $resolvedOutput
$stagingOutput = Join-Path $outputDirectory (([System.IO.Path]::GetFileNameWithoutExtension($resolvedOutput)) + ".unverified.mp4")

$pathClaims = [ordered]@{
  "output" = $resolvedOutput
  "final evidence report" = $resolvedEvidenceReport
  "assembly plan" = $planPath
  "preflight evidence report" = $preflightReportPath
  "prepublish evidence report" = $prepublishReportPath
  "staging output" = $stagingOutput
  "demo EDL" = $edl
  "demo evidence validator" = $validator
}
foreach ($key in $resolvedInputs.Keys) {
  $pathClaims["input or manifest: $key"] = [string]$resolvedInputs[$key]
}
Assert-NoPathCollisions $pathClaims

$validatorArguments = @(
  $validator,
  "--edl", $edl,
  "--expected-commit", $ExpectedCommit.ToLowerInvariant(),
  "--ffprobe", $ffprobe,
  "--final-proof", $resolvedInputs.FinalProof,
  "--final-proof-manifest", $resolvedInputs.FinalProofManifest,
  "--real-twitch", $resolvedInputs.RealTwitch,
  "--real-twitch-manifest", $resolvedInputs.RealTwitchManifest,
  "--native-obs", $resolvedInputs.NativeObs,
  "--native-obs-manifest", $resolvedInputs.NativeObsManifest,
  "--codex-bts", $resolvedInputs.CodexBts,
  "--codex-bts-manifest", $resolvedInputs.CodexBtsManifest,
  "--accessibility-human-qa", $resolvedInputs.AccessibilityQa,
  "--accessibility-human-qa-manifest", $resolvedInputs.AccessibilityQaManifest,
  "--closing-card", $resolvedInputs.ClosingCard,
  "--closing-card-manifest", $resolvedInputs.ClosingCardManifest,
  "--plan", $planPath
)

& $node @validatorArguments "--report" $preflightReportPath
if ($LASTEXITCODE -ne 0) { throw "Demo preflight evidence validation failed." }
$preflightReport = Get-Content -Raw -LiteralPath $preflightReportPath | ConvertFrom-Json
$snapshotArguments = @(
  "--expected-plan-sha256", [string]$preflightReport.assemblyPlan.sha256,
  "--expected-evidence-set-sha256", [string]$preflightReport.evidenceSet.sha256
)

if ($ValidateOnly) {
  Write-Host "Preflight evidence verified. No video was assembled."
  Write-Host "Plan: $planPath"
  Write-Host "Report: $preflightReportPath"
  return
}

$ffmpeg = Require-Tool $FfmpegPath "ffmpeg"
$outputValidationArguments = $snapshotArguments + @("--ffmpeg", $ffmpeg)
$plan = Get-Content -Raw -LiteralPath $planPath | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null

function New-NormalizedClip {
  param([object]$Clip, [int]$Index)
  $safeId = ([string]$Clip.id) -replace '[^a-zA-Z0-9._-]', '-'
  $target = Join-Path $buildRoot ("{0:D2}-{1}.mp4" -f $Index, $safeId)
  $label = Escape-DrawText ([string]$Clip.truthLabel)
  $videoFilter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30,drawtext=text='$label':fontcolor=white:fontsize=38:box=1:boxcolor=black@0.78:boxborderw=12:x=48:y=42,format=yuv420p"
  & $ffmpeg -hide_banner -loglevel error -y `
    -ss ([double]$Clip.sourceStart) -t ([double]$Clip.duration) -i ([string]$Clip.inputPath) `
    -map 0:v:0 -map 0:a:0 `
    -vf $videoFilter `
    -af "aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:LRA=9:TP=-1.5" `
    -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k -movflags +faststart $target
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while creating $($Clip.id)" }
  return $target
}

$clips = [System.Collections.Generic.List[string]]::new()
for ($index = 0; $index -lt $plan.clips.Count; $index++) {
  $clips.Add((New-NormalizedClip $plan.clips[$index] $index))
}

$concatPath = Join-Path $buildRoot "concat.txt"
$concatLines = $clips | ForEach-Object {
  if ($_ -match "'") { throw "Clip path contains an unsupported apostrophe: $_" }
  "file '$($_.Replace('\', '/'))'"
}
Set-Content -LiteralPath $concatPath -Value $concatLines -Encoding utf8

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
& $ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $concatPath -c copy -movflags +faststart $stagingOutput
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while concatenating the demo" }

& $node @validatorArguments @outputValidationArguments "--report" $prepublishReportPath "--output" $stagingOutput
if ($LASTEXITCODE -ne 0) { throw "Assembled demo failed format, duration, or evidence validation. The final output was not published." }

Move-Item -LiteralPath $stagingOutput -Destination $resolvedOutput -Force
& $node @validatorArguments @outputValidationArguments "--report" $resolvedEvidenceReport "--output" $resolvedOutput
if ($LASTEXITCODE -ne 0) { throw "Final output failed post-move evidence validation." }

Write-Host "Created verified demo: $resolvedOutput"
Write-Host "Assembly evidence: $resolvedEvidenceReport"
Write-Host "YouTube upload, logged-out playback, and Devpost submission remain separate external actions."
