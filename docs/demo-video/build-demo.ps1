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

$script:IsWindowsPlatform = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if ($script:IsWindowsPlatform -and -not ("NightShift.FileIdentity" -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace NightShift {
  public static class FileIdentity {
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint FILE_SHARE_DELETE = 0x00000004;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;

    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime {
      public uint Low;
      public uint High;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ByHandleFileInformation {
      public uint FileAttributes;
      public FileTime CreationTime;
      public FileTime LastAccessTime;
      public FileTime LastWriteTime;
      public uint VolumeSerialNumber;
      public uint FileSizeHigh;
      public uint FileSizeLow;
      public uint NumberOfLinks;
      public uint FileIndexHigh;
      public uint FileIndexLow;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string fileName, uint desiredAccess, uint shareMode,
      IntPtr securityAttributes, uint creationDisposition, uint flagsAndAttributes, IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out ByHandleFileInformation information);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path,
      uint pathLength, uint flags);

    private static SafeFileHandle Open(string path) {
      SafeFileHandle handle = CreateFileW(path, 0, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, IntPtr.Zero);
      if (handle.IsInvalid) {
        int error = Marshal.GetLastWin32Error();
        handle.Dispose();
        throw new Win32Exception(error, "Cannot open path for identity: " + path);
      }
      return handle;
    }

    public static string GetIdentity(string path) {
      using (SafeFileHandle handle = Open(path)) {
        ByHandleFileInformation information;
        if (!GetFileInformationByHandle(handle, out information)) {
          throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot read path identity: " + path);
        }
        return information.VolumeSerialNumber.ToString("x8") + ":" +
          information.FileIndexHigh.ToString("x8") + information.FileIndexLow.ToString("x8");
      }
    }

    public static string GetFinalPath(string path) {
      using (SafeFileHandle handle = Open(path)) {
        StringBuilder buffer = new StringBuilder(1024);
        uint length = GetFinalPathNameByHandleW(handle, buffer, (uint)buffer.Capacity, 0);
        if (length == 0) throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot resolve final path: " + path);
        if (length >= buffer.Capacity) {
          buffer = new StringBuilder((int)length + 1);
          length = GetFinalPathNameByHandleW(handle, buffer, (uint)buffer.Capacity, 0);
          if (length == 0 || length >= buffer.Capacity) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot resolve final path: " + path);
          }
        }
        return buffer.ToString();
      }
    }
  }
}
"@
}

function Get-PathEntry([string]$Path) {
  try {
    return Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  } catch [System.Management.Automation.ItemNotFoundException] {
    return $null
  } catch {
    throw "Cannot inspect reserved path before assembly: $Path. $($_.Exception.Message)"
  }
}

function Get-ExistingPathFacts([string]$Path) {
  $entry = Get-PathEntry $Path
  if (-not $entry) { return $null }
  $resolved = [System.IO.Path]::GetFullPath($entry.FullName)
  if ($script:IsWindowsPlatform) {
    return [pscustomobject]@{
      Identity = [NightShift.FileIdentity]::GetIdentity($resolved)
      FinalPath = [NightShift.FileIdentity]::GetFinalPath($resolved).ToLowerInvariant()
    }
  }
  $finalPath = (Resolve-Path -LiteralPath $resolved).Path
  return [pscustomobject]@{ Identity = $finalPath; FinalPath = $finalPath }
}

function Get-FuturePathFacts([string]$Path) {
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $remaining = [System.Collections.Generic.List[string]]::new()
  $remaining.Insert(0, [System.IO.Path]::GetFileName($fullPath))
  $ancestor = Split-Path -Parent $fullPath
  while (-not (Get-PathEntry $ancestor)) {
    $leaf = [System.IO.Path]::GetFileName($ancestor)
    if (-not $leaf) { throw "Cannot resolve an existing parent for reserved path: $fullPath" }
    $remaining.Insert(0, $leaf)
    $nextAncestor = Split-Path -Parent $ancestor
    if (-not $nextAncestor -or $nextAncestor -eq $ancestor) { throw "Cannot resolve an existing parent for reserved path: $fullPath" }
    $ancestor = $nextAncestor
  }
  $ancestorEntry = Get-PathEntry $ancestor
  if (-not $ancestorEntry.PSIsContainer) { throw "Reserved path has a non-directory parent: $fullPath" }
  $ancestorFacts = Get-ExistingPathFacts $ancestorEntry.FullName
  $suffix = [string]::Join([System.IO.Path]::DirectorySeparatorChar, $remaining)
  if ($script:IsWindowsPlatform) { $suffix = $suffix.ToLowerInvariant() }
  return [pscustomobject]@{
    Identity = "$($ancestorFacts.Identity)|$suffix"
    FinalPath = "$($ancestorFacts.FinalPath)|$suffix"
  }
}

function Assert-NoPathCollisions([System.Collections.IDictionary]$Claims) {
  $seenLexical = @{}
  $seenIdentity = @{}
  $seenFinalPath = @{}
  foreach ($label in $Claims.Keys) {
    $fullPath = [System.IO.Path]::GetFullPath([string]$Claims[$label])
    if ($seenLexical.ContainsKey($fullPath)) {
      throw "Path collision: $label and $($seenLexical[$fullPath]) both resolve to $fullPath. Evidence inputs and assembly outputs must use distinct files."
    }
    $seenLexical[$fullPath] = $label

    $facts = Get-ExistingPathFacts $fullPath
    if (-not $facts) { $facts = Get-FuturePathFacts $fullPath }
    if ($seenIdentity.ContainsKey($facts.Identity)) {
      throw "Path collision: $label and $($seenIdentity[$facts.Identity]) share filesystem identity $($facts.Identity)."
    }
    if ($seenFinalPath.ContainsKey($facts.FinalPath)) {
      throw "Path collision: $label and $($seenFinalPath[$facts.FinalPath]) resolve to the same final OS path $($facts.FinalPath)."
    }
    $seenIdentity[$facts.Identity] = $label
    $seenFinalPath[$facts.FinalPath] = $label
  }
}

function Assert-WritablePathsAreFresh([System.Collections.IDictionary]$Claims) {
  foreach ($label in $Claims.Keys) {
    $fullPath = [System.IO.Path]::GetFullPath([string]$Claims[$label])
    if (Get-PathEntry $fullPath) {
      throw "Refusing to overwrite pre-existing writable assembly path for $label`: $fullPath. Preserve or remove it deliberately before assembling."
    }
  }
}

function Get-SafeClipId([string]$Id) {
  return $Id -replace '[^a-zA-Z0-9._-]', '-'
}

function Get-NormalizedClipPath([string]$Id, [int]$Index, [string]$Root) {
  return Join-Path $Root ("{0:D2}-{1}.mp4" -f $Index, (Get-SafeClipId $Id))
}

function Get-EdlClipReservations([string]$Path, [string]$Root) {
  $document = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  if (-not $document.timeline -or $document.timeline.Count -eq 0) { throw "Demo EDL contains no timeline clips: $Path" }
  $reservations = [System.Collections.Generic.List[object]]::new()
  $generatedIds = @{}
  foreach ($clip in $document.timeline) {
    if ($clip.segments -and $clip.segments.Count -gt 0) {
      foreach ($segment in $clip.segments) {
        $id = "$($clip.id)-$($segment.id)"
        if ($generatedIds.ContainsKey($id)) { throw "Duplicate generated clip id in demo EDL: $id" }
        $generatedIds[$id] = $true
        $index = $reservations.Count
        $reservations.Add([pscustomobject]@{ Index = $index; Id = $id; Path = Get-NormalizedClipPath $id $index $Root })
      }
    } else {
      $id = [string]$clip.id
      if ($generatedIds.ContainsKey($id)) { throw "Duplicate generated clip id in demo EDL: $id" }
      $generatedIds[$id] = $true
      $index = $reservations.Count
      $reservations.Add([pscustomobject]@{ Index = $index; Id = $id; Path = Get-NormalizedClipPath $id $index $Root })
    }
  }
  return $reservations
}

function Get-Sha256File([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return -join ($sha256.ComputeHash($stream) | ForEach-Object { $_.ToString("x2") })
  } finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

$node = Require-Tool $NodePath "Node.js"
$ffmpeg = Require-Tool $FfmpegPath "ffmpeg"
$ffprobe = Require-Tool $FfprobePath "ffprobe"
$builder = Resolve-RequiredFile $PSCommandPath "demo assembly builder"
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
$postPromotionReportPath = Join-Path $buildRoot "assembly-postpromotion.evidence.json"
$outputDirectory = Split-Path -Parent $resolvedOutput
$stagingOutput = Join-Path $outputDirectory (([System.IO.Path]::GetFileNameWithoutExtension($resolvedOutput)) + ".unverified.mp4")
$promotionBackup = Join-Path $outputDirectory (([System.IO.Path]::GetFileNameWithoutExtension($resolvedOutput)) + ".previous.mp4")
$failedReplacement = Join-Path $outputDirectory (([System.IO.Path]::GetFileNameWithoutExtension($resolvedOutput)) + ".failed.mp4")
$buildLockPath = Join-Path $buildRoot ".nightshift-demo-assembly.lock"
$concatPath = Join-Path $buildRoot "concat.txt"
$reservedClips = Get-EdlClipReservations $edl $buildRoot

$pathClaims = [ordered]@{
  "output" = $resolvedOutput
  "final evidence report" = $resolvedEvidenceReport
  "assembly plan" = $planPath
  "preflight evidence report" = $preflightReportPath
  "prepublish evidence report" = $prepublishReportPath
  "post-promotion evidence report" = $postPromotionReportPath
  "staging output" = $stagingOutput
  "promotion backup" = $promotionBackup
  "failed replacement quarantine" = $failedReplacement
  "exclusive build-directory lock" = $buildLockPath
  "concat list" = $concatPath
  "demo assembly builder" = $builder
  "demo EDL" = $edl
  "demo evidence validator" = $validator
  "Node.js executable" = $node
  "ffmpeg executable" = $ffmpeg
  "ffprobe executable" = $ffprobe
}
foreach ($key in $resolvedInputs.Keys) {
  $pathClaims["input or manifest: $key"] = [string]$resolvedInputs[$key]
}
foreach ($reservation in $reservedClips) {
  $pathClaims["normalized clip[$($reservation.Index)]: $($reservation.Id) -> $($reservation.Path)"] = [string]$reservation.Path
}
Assert-NoPathCollisions $pathClaims

$writablePathClaims = [ordered]@{
  "final evidence report" = $resolvedEvidenceReport
  "assembly plan" = $planPath
  "preflight evidence report" = $preflightReportPath
  "prepublish evidence report" = $prepublishReportPath
  "post-promotion evidence report" = $postPromotionReportPath
  "staging output" = $stagingOutput
  "promotion backup" = $promotionBackup
  "failed replacement quarantine" = $failedReplacement
  "exclusive build-directory lock" = $buildLockPath
  "concat list" = $concatPath
}
foreach ($reservation in $reservedClips) {
  $writablePathClaims["normalized clip[$($reservation.Index)]: $($reservation.Id) -> $($reservation.Path)"] = [string]$reservation.Path
}
Assert-WritablePathsAreFresh $writablePathClaims

$buildLockStream = $null
$buildLockOwnedByThisRun = $false
try {
  [System.IO.Directory]::CreateDirectory($buildRoot) | Out-Null
  try {
    $buildLockStream = [System.IO.File]::Open(
      $buildLockPath,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
    $buildLockOwnedByThisRun = $true
    $lockText = "pid=$PID started=$([DateTime]::UtcNow.ToString('o'))`n"
    $lockBytes = [System.Text.Encoding]::UTF8.GetBytes($lockText)
    $buildLockStream.Write($lockBytes, 0, $lockBytes.Length)
    $buildLockStream.Flush()
  } catch {
    throw "Another demo assembly owns the build directory lock $buildLockPath, or the lock could not be created. $($_.Exception.Message)"
  }

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

$outputValidationArguments = $snapshotArguments + @("--ffmpeg", $ffmpeg)
$plan = Get-Content -Raw -LiteralPath $planPath | ConvertFrom-Json
if ($plan.clips.Count -ne $reservedClips.Count) {
  throw "Validated assembly plan contains $($plan.clips.Count) clips, but the EDL reserved $($reservedClips.Count)."
}
for ($index = 0; $index -lt $plan.clips.Count; $index++) {
  $actualId = [string]$plan.clips[$index].id
  $actualPath = [System.IO.Path]::GetFullPath((Get-NormalizedClipPath $actualId $index $buildRoot))
  $reservedPath = [System.IO.Path]::GetFullPath([string]$reservedClips[$index].Path)
  if ($actualId -ne [string]$reservedClips[$index].Id -or $actualPath -ne $reservedPath) {
    throw "Validated assembly plan clip $index does not match its preflight reservation."
  }
}
New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null

function New-NormalizedClip {
  param([object]$Clip, [int]$Index)
  $target = Get-NormalizedClipPath ([string]$Clip.id) $Index $buildRoot
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

$concatLines = $clips | ForEach-Object {
  if ($_ -match "'") { throw "Clip path contains an unsupported apostrophe: $_" }
  "file '$($_.Replace('\', '/'))'"
}
[System.IO.File]::WriteAllLines($concatPath, [string[]]$concatLines, [System.Text.UTF8Encoding]::new($false))

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
& $ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $concatPath -c copy -movflags +faststart $stagingOutput
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while concatenating the demo" }

& $node @validatorArguments @outputValidationArguments "--report" $prepublishReportPath "--output" $stagingOutput
if ($LASTEXITCODE -ne 0) { throw "Assembled demo failed format, duration, or evidence validation. The final output was not published." }
$prepublishReport = Get-Content -Raw -LiteralPath $prepublishReportPath | ConvertFrom-Json
$stagingSha256 = [string]$prepublishReport.output.sha256
if ($stagingSha256 -notmatch '^[0-9a-f]{64}$') { throw "Prepublish report did not retain a valid staging-output SHA-256." }

$hadPreviousOutput = Test-Path -LiteralPath $resolvedOutput
$publishedByThisRun = $false
$reportPublishedByThisRun = $false
$publishedOutputGuard = $null
try {
  if ($hadPreviousOutput) {
    [System.IO.File]::Replace($stagingOutput, $resolvedOutput, $promotionBackup, $true)
  } else {
    [System.IO.File]::Move($stagingOutput, $resolvedOutput)
  }
  $publishedByThisRun = $true
  $publishedOutputGuard = [System.IO.File]::Open(
    $resolvedOutput,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::Read
  )

  $promotedSha256 = Get-Sha256File $resolvedOutput
  if ($promotedSha256 -ne $stagingSha256) { throw "Promoted output SHA-256 does not match the verified staging output." }
  $postPromotionArguments = $outputValidationArguments + @("--expected-output-sha256", $stagingSha256)
  & $node @validatorArguments @postPromotionArguments "--report" $postPromotionReportPath "--output" $resolvedOutput
  if ($LASTEXITCODE -ne 0) { throw "Final output failed post-promotion evidence validation." }
  $postPromotionReport = Get-Content -Raw -LiteralPath $postPromotionReportPath | ConvertFrom-Json
  if ([string]$postPromotionReport.output.sha256 -ne $stagingSha256) {
    throw "Post-promotion evidence report does not identify the verified output SHA-256."
  }
  [System.IO.File]::Move($postPromotionReportPath, $resolvedEvidenceReport)
  $reportPublishedByThisRun = $true
} catch {
  $promotionFailure = $_
  if ($publishedOutputGuard) {
    $publishedOutputGuard.Dispose()
    $publishedOutputGuard = $null
  }
  try {
    if ($publishedByThisRun) {
      $currentOutputExists = Test-Path -LiteralPath $resolvedOutput
      if ($currentOutputExists) {
        $currentOutputSha256 = Get-Sha256File $resolvedOutput
        if ($currentOutputSha256 -ne $stagingSha256) {
          throw "Published output no longer contains this run's verified bytes; refusing to overwrite or delete it during rollback."
        }
      }
      if ($hadPreviousOutput -and (Test-Path -LiteralPath $promotionBackup)) {
        if ($currentOutputExists) {
          [System.IO.File]::Replace($promotionBackup, $resolvedOutput, $failedReplacement, $true)
          try { Remove-Item -LiteralPath $failedReplacement -Force }
          catch { Write-Warning "Prior output was restored, but the failed replacement remains at $failedReplacement" }
        } else {
          [System.IO.File]::Move($promotionBackup, $resolvedOutput)
        }
      } elseif ($hadPreviousOutput) {
        throw "Promotion backup is missing; the prior output cannot be restored automatically."
      } elseif ($currentOutputExists) {
        Remove-Item -LiteralPath $resolvedOutput -Force
      }
    }
    if ($reportPublishedByThisRun -and (Test-Path -LiteralPath $resolvedEvidenceReport)) {
      Remove-Item -LiteralPath $resolvedEvidenceReport -Force
    }
  } catch {
    throw "Replacement failed and rollback could not restore the prior output. Promotion error: $($promotionFailure.Exception.Message). Rollback error: $($_.Exception.Message)"
  }
  throw $promotionFailure
}

if ($publishedOutputGuard) {
  $publishedOutputGuard.Dispose()
  $publishedOutputGuard = $null
}

if ($hadPreviousOutput -and (Test-Path -LiteralPath $promotionBackup)) {
  try { Remove-Item -LiteralPath $promotionBackup -Force }
  catch { Write-Warning "Verified output and evidence report were retained, but backup cleanup failed: $promotionBackup" }
}

Write-Host "Created verified demo: $resolvedOutput"
Write-Host "Assembly evidence: $resolvedEvidenceReport"
Write-Host "YouTube upload, logged-out playback, and Devpost submission remain separate external actions."
} finally {
  if ($buildLockStream) { $buildLockStream.Dispose() }
  if ($buildLockOwnedByThisRun -and (Test-Path -LiteralPath $buildLockPath)) {
    try { Remove-Item -LiteralPath $buildLockPath -Force }
    catch { Write-Warning "Verified assembly lock cleanup failed; remove deliberately before the next run: $buildLockPath" }
  }
}
