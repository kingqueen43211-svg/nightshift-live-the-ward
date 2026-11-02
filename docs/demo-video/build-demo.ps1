param(
  [Parameter(Mandatory=$true)][string]$FinalProof,
  [Parameter(Mandatory=$true)][string]$RealTwitch,
  [Parameter(Mandatory=$true)][string]$NativeObs,
  [Parameter(Mandatory=$true)][string]$CodexBts,
  [Parameter(Mandatory=$true)][string]$AccessibilityQa,
  [Parameter(Mandatory=$true)][string]$ClosingCard,
  [string]$FfmpegPath = "ffmpeg",
  [string]$OutputPath = ".\build\nightshift-live-hackathon-demo.mp4"
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildRoot = Join-Path $scriptRoot "build"

function Resolve-RequiredFile([string]$Path, [string]$Label) {
  $resolved = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
  if (-not $resolved) { throw "Missing required $Label footage: $Path" }
  return $resolved.Path
}

function Require-Tool([string]$Path) {
  if (Test-Path -LiteralPath $Path) { return (Resolve-Path -LiteralPath $Path).Path }
  $command = Get-Command $Path -ErrorAction SilentlyContinue
  if (-not $command) { throw "ffmpeg is required but was not found. Supply -FfmpegPath with an existing ffmpeg.exe." }
  return $command.Source
}

$ffmpeg = Require-Tool $FfmpegPath
$proof = Resolve-RequiredFile $FinalProof "final exact-commit rehearsal"
$twitch = Resolve-RequiredFile $RealTwitch "real Twitch"
$obs = Resolve-RequiredFile $NativeObs "native OBS"
$codex = Resolve-RequiredFile $CodexBts "Codex development"
$accessibility = Resolve-RequiredFile $AccessibilityQa "accessibility/human QA"
$closing = Resolve-RequiredFile $ClosingCard "closing card"

if ($proof -match "02-33-43-114Z") {
  throw "The audited RC6 recording has a silent ending and commit mismatch. Supply the corrected exact-release proof instead."
}

New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null

function New-NormalizedClip {
  param([string]$InputPath, [double]$Start, [double]$Duration, [string]$Name)
  $target = Join-Path $buildRoot ("{0}.mp4" -f $Name)
  & $ffmpeg -hide_banner -loglevel error -y -ss $Start -t $Duration -i $InputPath `
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p" `
    -af "aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:LRA=9:TP=-1.5" `
    -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k -movflags +faststart $target
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while creating $Name" }
  return $target
}

$clips = [System.Collections.Generic.List[string]]::new()
function Add-Clip([string]$Path) { $clips.Add($Path) }

Add-Clip (New-NormalizedClip $proof 271.4 7 "00-cold-open")
Add-Clip (New-NormalizedClip $proof 0.0 5 "01-premise-a")
Add-Clip (New-NormalizedClip $proof 29.3 8 "02-premise-b")
Add-Clip (New-NormalizedClip $twitch 0 24 "03-real-twitch")
Add-Clip (New-NormalizedClip $obs 0 14 "04-native-obs")
Add-Clip (New-NormalizedClip $codex 0 12 "05-codex-bts")
Add-Clip (New-NormalizedClip $proof 61.0 5.7 "06-ward-vote")
Add-Clip (New-NormalizedClip $proof 87.4 7.1 "07-ward-clues")
Add-Clip (New-NormalizedClip $proof 116.2 4.2 "08-ward-door")
Add-Clip (New-NormalizedClip $proof 123.0 5 "09-theatre-vote")
Add-Clip (New-NormalizedClip $proof 147.8 5.7 "10-theatre-clues")
Add-Clip (New-NormalizedClip $proof 174.8 6.3 "11-theatre-warden")
Add-Clip (New-NormalizedClip $proof 181.2 3.8 "12-generator-arrival")
Add-Clip (New-NormalizedClip $proof 207.6 6.2 "13-generator-sequence")
Add-Clip (New-NormalizedClip $proof 213.8 4 "14-generator-consequence")

$montageStarts = @(2.8, 61.0, 122.1, 181.4, 215.6)
for ($index = 0; $index -lt $montageStarts.Count; $index++) {
  Add-Clip (New-NormalizedClip $proof $montageStarts[$index] 2 ("15-audience-{0}" -f $index))
}

Add-Clip (New-NormalizedClip $accessibility 0 11 "16-accessibility-human-qa")
Add-Clip (New-NormalizedClip $proof 266.8 25 "17-humane-ending")
Add-Clip (New-NormalizedClip $closing 0 8 "18-closing-card")

$concatPath = Join-Path $buildRoot "concat.txt"
$concatLines = $clips | ForEach-Object { "file '$($_.Replace("'", "''"))'" }
Set-Content -LiteralPath $concatPath -Value $concatLines -Encoding utf8

$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot $OutputPath))
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
& $ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $concatPath -c copy -movflags +faststart $resolvedOutput
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while concatenating the demo" }

Write-Host "Created $resolvedOutput"
Write-Host "Before upload: confirm <3:00 runtime, public YouTube, real Twitch/OBS, Codex evidence, audible ending, logged-out links, and no secrets."
