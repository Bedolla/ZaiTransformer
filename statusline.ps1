#Requires -Version 7.0

<#
.SYNOPSIS
  StatusLine for Claude Code CLI.

.DESCRIPTION
  Displays useful information in 2 lines:
  - Line 1: Path | Branch + Git Status | Model
  - Line 2: Cost USD | Session Duration | Lines +/- (Net: N)

.NOTES
  Author: Bedolla
  Date: 2025-10-25
  Version: 1.0
  Requirements: PowerShell 7.0+, Git installed
  Compatibility: Windows, macOS, Linux
#>

# ============================================================================
# CONFIGURATION
# ============================================================================

[bool]$SHOW_DETAILED_GIT = $true      # Show detailed git indicators (staged, modified, etc.)
[bool]$SHOW_API_DURATION = $false     # Show API call duration in addition to total session duration
[int]$MAX_PATH_LENGTH = 50            # Maximum characters for path before truncation

# ============================================================================
# CLASS: GitStatus
# ============================================================================

class GitStatus {
  [string]$Branch
  [int]$StagedFiles
  [int]$ModifiedFiles
  [int]$UntrackedFiles
  [int]$DeletedFiles
  [int]$ConflictFiles
  [int]$CommitsAhead
  [int]$CommitsBehind
  [bool]$IsClean

  GitStatus() {
    # Initialize all counters and status variables
    $this.Branch = ""
    $this.StagedFiles = 0           # Files in staging area (git add)
    $this.ModifiedFiles = 0         # Modified but not staged
    $this.UntrackedFiles = 0        # New files not tracked by git
    $this.DeletedFiles = 0          # Deleted files
    $this.ConflictFiles = 0         # Files with merge conflicts
    $this.CommitsAhead = 0          # Commits ahead of remote
    $this.CommitsBehind = 0         # Commits behind remote
    $this.IsClean = $false          # True if no pending changes
  }

  # Method: Get Git status using git status --porcelain
  [void] GetStatus([string]$workspaceDir) {
    try {
      # Save current directory to restore later
      [string]$originalDir = Get-Location
    
      # Change to workspace directory if it exists
      if (-not [string]::IsNullOrWhiteSpace($workspaceDir) -and (Test-Path $workspaceDir)) {
        Set-Location $workspaceDir
      }

      # Execute git status with machine-readable format
      # --porcelain: Stable format for scripts
      # --branch: Include branch info in output
      [string[]]$lines = & git status --porcelain --branch 2>$null
    
      # Return to original directory
      Set-Location $originalDir
    
      # If no output, not a git repository
      if ($null -eq $lines -or $lines.Count -eq 0) {
        $this.Branch = "No Git"
        return
      }

      # Extract branch information (first line starting with ##)
      [string]$branchLine = $lines | Where-Object { $_.StartsWith("##") } | Select-Object -First 1
      if ($branchLine) {
        # Extract branch name from line like: "## main...origin/main [ahead 1]"
        if ($branchLine -match "^## ([^\\.]+)") {
          $this.Branch = $matches[1]
        }
        elseif ($branchLine -match "^## (.+)") {
          $this.Branch = $matches[1]
        }

        # Extract commits ahead/behind remote (if any)
        if ($branchLine -match "ahead (\\d+)") {
          $this.CommitsAhead = [int]$matches[1]
        }
        if ($branchLine -match "behind (\\d+)") {
          $this.CommitsBehind = [int]$matches[1]
        }
      }

      # Process file status lines (exclude branch line)
      [string[]]$fileLines = $lines | Where-Object { -not $_.StartsWith("##") }

      # Parse each file status line
      # Format: XY filename (X=staging, Y=working tree)
      foreach ($line in $fileLines) {
        if ($line.Length -lt 2) { continue }

        # Extract status codes (first two characters)
        [char]$stagingCode = $line[0]          # Staging area status
        [char]$workingTreeCode = $line[1]      # Working tree status

        # Process staging area status (first column)
        # M=Modified, A=Added, R=Renamed, C=Copied, D=Deleted, U=Unmerged, ?=Untracked
        if ($stagingCode -eq 'M' -or $stagingCode -eq 'A' -or $stagingCode -eq 'R' -or $stagingCode -eq 'C') {
          $this.StagedFiles++              # Ready for commit
        }
        if ($stagingCode -eq 'D') {
          $this.StagedFiles++              # Deleted and staged
          $this.DeletedFiles++
        }

        # Process working tree status (second column)
        if ($workingTreeCode -eq 'M') {
          $this.ModifiedFiles++            # Modified but not staged
        }
        if ($workingTreeCode -eq 'D') {
          $this.DeletedFiles++             # Deleted but not staged
        }

        # Untracked files - count individual files within folders
        if ($stagingCode -eq '?' -and $workingTreeCode -eq '?') {
          # If it's a folder (ends with /), count individual files inside
          if ($line.TrimEnd().EndsWith('/')) {
            [string]$folder = $line.Substring(3).TrimEnd('/')
            [string[]]$filesInFolder = & git ls-files --others --exclude-standard -- "$folder/" 2>$null
            if ($null -ne $filesInFolder -and $filesInFolder.Count -gt 0) {
              $this.UntrackedFiles += $filesInFolder.Count
            }
          }
          else {
            # It's an individual file
            $this.UntrackedFiles++         # New file not tracked
          }
        }

        # Detect merge conflicts (various patterns)
        if ($stagingCode -eq 'U' -or $workingTreeCode -eq 'U') {
          $this.ConflictFiles++            # Unmerged file
        }
        if ($stagingCode -eq 'A' -and $workingTreeCode -eq 'A') {
          $this.ConflictFiles++            # Both added
        }
        if ($stagingCode -eq 'D' -and $workingTreeCode -eq 'D') {
          $this.ConflictFiles++            # Both deleted
        }
      }

      # Determine if repository is clean (no pending changes)
      $this.IsClean = (
        $this.StagedFiles -eq 0 -and
        $this.ModifiedFiles -eq 0 -and
        $this.UntrackedFiles -eq 0 -and
        $this.DeletedFiles -eq 0 -and
        $this.ConflictFiles -eq 0 -and
        $this.CommitsAhead -eq 0 -and
        $this.CommitsBehind -eq 0
      )
    }
    catch {
      $this.Branch = "error"
    }
  }

  # Method: Build compact indicators string
  # Returns string with emoji indicators for each status type
  [string] BuildIndicators() {
    [System.Collections.Generic.List[string]]$indicators = @()

    if ($this.StagedFiles -gt 0) {
      # ✅ Staged files (ready for commit)
      $indicators.Add("$([char]::ConvertFromUtf32(0x2705)) $($this.StagedFiles)")  # ✅
    }
    if ($this.ModifiedFiles -gt 0) {
      # ✏️ Modified files (unstaged)
      $indicators.Add("$([char]::ConvertFromUtf32(0x270F))$([char]::ConvertFromUtf32(0xFE0F)) $($this.ModifiedFiles)")  # ✏️
    }
    if ($this.UntrackedFiles -gt 0) {
      # 📄 New files without tracking
      $indicators.Add("$([char]::ConvertFromUtf32(0x1F4C4)) $($this.UntrackedFiles)")  # 📄
    }
    if ($this.DeletedFiles -gt 0) {
      # 🗑️ Deleted files
      $indicators.Add("$([char]::ConvertFromUtf32(0x1F5D1))$([char]::ConvertFromUtf32(0xFE0F)) $($this.DeletedFiles)")  # 🗑️
    }
    if ($this.ConflictFiles -gt 0) {
      # ⚠️ Files with conflicts
      $indicators.Add("$([char]::ConvertFromUtf32(0x26A0))$([char]::ConvertFromUtf32(0xFE0F)) $($this.ConflictFiles)")  # ⚠️
    }
    if ($this.CommitsAhead -gt 0) {
      # ⬆️ Commits ahead of remote
      $indicators.Add("$([char]::ConvertFromUtf32(0x2B06))$([char]::ConvertFromUtf32(0xFE0F)) $($this.CommitsAhead)")  # ⬆️
    }
    if ($this.CommitsBehind -gt 0) {
      # ⬇️ Commits behind remote
      $indicators.Add("$([char]::ConvertFromUtf32(0x2B07))$([char]::ConvertFromUtf32(0xFE0F)) $($this.CommitsBehind)")  # ⬇️
    }

    # Return formatted status
    if ($indicators.Count -eq 0 -and $this.IsClean) {
      # ✓ Clean repository
      return "$([char]::ConvertFromUtf32(0x2713))"  # ✓
    }

    # Join all indicators with spaces
    return [string]::Join(" ", $indicators)
  }

  # Method: Get complete Git string (branch + indicators)
  # Returns branch name with status indicators
  [string] GetFullStatus() {
    [string]$indicators = $this.BuildIndicators()
    
    if ([string]::IsNullOrWhiteSpace($indicators)) {
      return $this.Branch                          # Just branch name
    }
    
    return "$($this.Branch) $indicators"           # Branch with indicators
  }
}

# ============================================================================
# CLASS: DurationFormatter
# ============================================================================

class DurationFormatter {
  # Static method: Format milliseconds to readable format (5m 23s, 2h 15m, etc.)
  static [string] FormatDuration([double]$milliseconds) {
    [int]$totalSeconds = [Math]::Floor($milliseconds / 1000)
    
    # Calculate hours, minutes, seconds
    [int]$hours = [Math]::Floor($totalSeconds / 3600)
    [int]$minutes = [Math]::Floor(($totalSeconds % 3600) / 60)
    [int]$seconds = $totalSeconds % 60

    [System.Collections.Generic.List[string]]$parts = @()

    # Build result string (only include non-zero components)
    if ($hours -gt 0) {
      $parts.Add("$($hours)h")
    }
    if ($minutes -gt 0) {
      $parts.Add("$($minutes)m")
    }
    if ($seconds -gt 0 -or $parts.Count -eq 0) {
      $parts.Add("$($seconds)s")          # Always show seconds if nothing else
    }

    return [string]::Join(" ", $parts)
  }
}

# ============================================================================
# CLASS: PathFormatter
# ============================================================================

class PathFormatter {
  # Static method: Format full path with truncation logic
  # Replaces home directory with ~, truncates long paths with ...
  static [string] FormatPath([string]$fullPath, [int]$maxLength) {
    # Return "unknown" for empty paths
    if ([string]::IsNullOrWhiteSpace($fullPath)) {
      return "unknown"
    }

    # Normalize path separators for current OS
    [string]$separator = [System.IO.Path]::DirectorySeparatorChar
    [string]$path = $fullPath.Replace('/', $separator).Replace('\\', $separator)

    # Replace home directory with ~ for brevity
    [string]$userProfile = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }
    if ($path.StartsWith($userProfile, [StringComparison]::OrdinalIgnoreCase)) {
      $path = "~" + $path.Substring($userProfile.Length)
    }

    # If path is short enough, return as-is
    if ($path.Length -le $maxLength) {
      return $path
    }

    # Split path into components
    [string[]]$parts = $path.Split([System.IO.Path]::DirectorySeparatorChar)
    
    # Build truncated path from right to left (keep most recent directories)
    [System.Collections.Generic.List[string]]$finalParts = @()
    [int]$currentLength = 3  # Account for "..."
    
    # Iterate backwards through path components
    for ([int]$i = $parts.Length - 1; $i -ge 0; $i--) {
      [string]$part = $parts[$i]
      [int]$lengthWithPart = $currentLength + $part.Length + 1  # +1 for separator
    
      # Add part if it fits within max length
      if ($lengthWithPart -le $maxLength) {
        $finalParts.Insert(0, $part)
        $currentLength = $lengthWithPart
      }
      else {
        break  # Stop when we exceed max length
      }
    }

    # Build final truncated path with "..." prefix
    return "..." + [System.IO.Path]::DirectorySeparatorChar + [string]::Join([System.IO.Path]::DirectorySeparatorChar, $finalParts)
  }
}

# ============================================================================
# CLASS: StatusLineRenderer
# ============================================================================

class StatusLineRenderer {
  [PSCustomObject]$InputData
  [bool]$ShowDetailedGit
  [bool]$ShowApiDuration
  [int]$MaxPathLength

  StatusLineRenderer([PSCustomObject]$data, [bool]$showGit, [bool]$showApi, [int]$maxLength) {
    $this.InputData = $data
    $this.ShowDetailedGit = $showGit
    $this.ShowApiDuration = $showApi
    $this.MaxPathLength = $maxLength
  }

  # Method: Get formatted directory path
  [string] GetDirectoryPath() {
    [string]$fullDirectory = $this.InputData.workspace.current_dir
    
    if ([string]::IsNullOrWhiteSpace($fullDirectory)) {
      return "unknown"
    }

    return [PathFormatter]::FormatPath($fullDirectory, $this.MaxPathLength)
  }

  # Method: Get Git information
  [string] GetGitInfo() {
    [string]$workspaceDir = $this.InputData.workspace.current_dir
    
    [GitStatus]$gitStatus = [GitStatus]::new()
    $gitStatus.GetStatus($workspaceDir)

    if ($this.ShowDetailedGit) {
      return $gitStatus.GetFullStatus()
    }
    else {
      return $gitStatus.Branch
    }
  }

  # Method: Get current model name
  # Formats model names for consistent display with title case and corrections
  [string] GetModelName() {
    [string]$modelName = $this.InputData.model.display_name
    
    # Return "unknown" for empty names
    if ([string]::IsNullOrWhiteSpace($modelName)) {
      return "unknown"
    }

    # Apply title case (capitalize first letter of each word)
    # Example: "glm-4.6" → "Glm-4.6", "claude-3.5-sonnet" → "Claude-3.5-Sonnet"
    $modelName = (Get-Culture).TextInfo.ToTitleCase($modelName.ToLower())
    
    # Apply specific corrections for known model names (ordered from most specific to most generic)
    $modelName = $modelName.Replace("Glm-4.6", "GLM 4.6")
    $modelName = $modelName.Replace("Glm-4.5-Air", "GLM 4.5 Air")
    $modelName = $modelName.Replace("Glm-4.5-V", "GLM 4.5 V")
    $modelName = $modelName.Replace("Glm-4.5", "GLM 4.5")
    $modelName = $modelName.Replace("Glm-4", "GLM 4")
    
    return $modelName
  }

  # Method: Get total cost in USD
  # Formats cost with 2 decimal places
  [string] GetCostUsd() {
    [double]$costUsd = 0.0
    
    if ($null -ne $this.InputData.cost.total_cost_usd) {
      $costUsd = [double]$this.InputData.cost.total_cost_usd
    }

    return "`$$($costUsd.ToString('F2')) USD"
  }

  # Method: Get formatted session duration
  [string] GetSessionDuration() {
    [double]$durationMs = 0.0
    
    if ($null -ne $this.InputData.cost.total_duration_ms) {
      $durationMs = [double]$this.InputData.cost.total_duration_ms
    }

    return [DurationFormatter]::FormatDuration($durationMs)
  }

  # Method: Get formatted API duration (optional)
  [string] GetApiDuration() {
    [double]$apiDurationMs = 0.0
    
    if ($null -ne $this.InputData.cost.total_api_duration_ms) {
      $apiDurationMs = [double]$this.InputData.cost.total_api_duration_ms
    }

    [double]$apiDurationSeconds = $apiDurationMs / 1000.0
    return "$($apiDurationSeconds.ToString('F1'))s"
  }

  # Method: Get code lines information
  # Returns formatted string with added/removed lines and net change
  [string] GetLinesInfo() {
    [int]$linesAdded = 0
    [int]$linesRemoved = 0

    if ($null -ne $this.InputData.cost.total_lines_added) {
      $linesAdded = [int]$this.InputData.cost.total_lines_added
    }
    if ($null -ne $this.InputData.cost.total_lines_removed) {
      $linesRemoved = [int]$this.InputData.cost.total_lines_removed
    }

    # Calculate net lines changed
    [int]$net = $linesAdded - $linesRemoved

    return "+$linesAdded/-$linesRemoved (Net: $net)"
  }

  # Method: Render complete StatusLine (2 lines)
  # Returns formatted 2-line status display
  [string] Render() {
    # Emojis with UTF-32 codes
    [string]$emojiFolder = [char]::ConvertFromUtf32(0x1F5C2)      # 🗂️
    [string]$emojiLeaf = [char]::ConvertFromUtf32(0x1F343)        # 🍃
    [string]$emojiPackage = [char]::ConvertFromUtf32(0x1F4E6)     # 📦
    [string]$emojiRobot = [char]::ConvertFromUtf32(0x1F916)       # 🤖
    [string]$emojiMoney = [char]::ConvertFromUtf32(0x1F4B5)       # 💵
    [string]$emojiClock = [char]::ConvertFromUtf32(0x23F1)        # ⏱️
    [string]$emojiPencil = [char]::ConvertFromUtf32(0x270F)       # ✏️

    # Gather all components for display
    [string]$directoryPath = $this.GetDirectoryPath()
    [string]$gitInfo = $this.GetGitInfo()
    [string]$modelName = $this.GetModelName()
    [string]$costUsd = $this.GetCostUsd()
    [string]$sessionDuration = $this.GetSessionDuration()
    [string]$linesInfo = $this.GetLinesInfo()

    # LINE 1: Directory | Git | Model
    # Choose Git emoji based on repository status
    [string]$gitEmoji = if ($gitInfo -eq "No Git") { $emojiPackage } else { $emojiLeaf }  # 📦 or 🍃
    
    # Build line 1 with extra space after folder emoji for visual separation
    [string]$line1 = "$emojiFolder  $directoryPath | $gitEmoji $gitInfo | $emojiRobot $modelName"

    # LINE 2: Cost | Duration | Lines
    # Build line 2 with extra space after clock and pencil emojis
    [string]$line2 = "$emojiMoney $costUsd | $emojiClock  $sessionDuration"
    
    # Optionally append API duration
    if ($this.ShowApiDuration) {
      [string]$apiDuration = $this.GetApiDuration()
      $line2 += " (API: $apiDuration)"
    }
    
    # Append lines info
    $line2 += " | $emojiPencil  $linesInfo"

    # Return 2 lines separated by newline
    return "$line1`n$line2"
  }
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================

# Main function: Entry point for the script
# Reads JSON from stdin, parses it, and generates 2-line status display
function Main {
  try {
    # Read JSON input from stdin (provided by Claude Code CLI)
    [string]$jsonInput = [Console]::In.ReadToEnd()
    
    # Exit if no input provided
    if ([string]::IsNullOrWhiteSpace($jsonInput)) {
      Write-Output "No input data"
      return
    }

    # Parse JSON into PowerShell object
    [PSCustomObject]$data = $jsonInput | ConvertFrom-Json

    # Create renderer with global configuration
    [StatusLineRenderer]$renderer = [StatusLineRenderer]::new(
      $data,
      $SHOW_DETAILED_GIT,
      $SHOW_API_DURATION,
      $MAX_PATH_LENGTH
    )

    # Render and display 2-line output
    [string]$output = $renderer.Render()
    Write-Output $output
  }
  catch {
    # In case of error, show simple message
    Write-Output "Error in StatusLine: $($_.Exception.Message)"
  }
}

# Execute main function
Main
