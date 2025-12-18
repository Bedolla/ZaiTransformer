#!/usr/bin/env bash

# StatusLine for Claude Code CLI
# Author: Bedolla
# Date: 2025-10-25
# Version: 1.0
# Requirements: bash 4.0+ or zsh 5.0+, Git installed
# Compatibility: macOS, Linux
#
# Description:
#   Displays useful information in 2 lines:
#   - Line 1: Path | Branch + Git Status | Model
#   - Line 2: Cost USD | Session Duration | Lines +/- (Net: N)

# ============================================================================
# CONFIGURATION
# ============================================================================

SHOW_DETAILED_GIT=true      # Show detailed git indicators (staged, modified, etc.)
SHOW_API_DURATION=false     # Show API call duration in addition to total session duration
MAX_PATH_LENGTH=50          # Maximum characters for path before truncation

# ============================================================================
# FUNCTIONS: GitStatus
# ============================================================================

# Function: get_git_status
# Description: Extracts Git repository status including branch name, file counts,
#              and commit synchronization state with remote.
# Parameters:
#   $1 - workspace_dir: Directory path to analyze
# Returns:
#   Pipe-separated string: branch|staged|modified|untracked|deleted|conflict|ahead|behind|clean
#   Example: "main|2|1|0|0|0|1|0|false"
get_git_status() {
  local workspace_dir="$1"
  
  # Initialize counters and status variables
  local branch=""
  local staged_files=0        # Files in staging area (git add)
  local modified_files=0      # Modified but not staged
  local untracked_files=0     # New files not tracked by git
  local deleted_files=0       # Deleted files
  local conflict_files=0      # Files with merge conflicts
  local commits_ahead=0       # Commits ahead of remote
  local commits_behind=0      # Commits behind remote
  local is_clean=true         # True if no pending changes
  
  # Save current directory to restore later
  local original_dir=$(pwd)
  
  # Change to workspace directory if it exists
  if [[ -n "$workspace_dir" && -d "$workspace_dir" ]]; then
    cd "$workspace_dir" 2>/dev/null || return
  fi
  
  # Execute git status with machine-readable format
  # --porcelain: Stable format for scripts
  # --branch: Include branch info in output
  local lines
  lines=$(git status --porcelain --branch 2>/dev/null)
  
  # Return to original directory
  cd "$original_dir"
  
  # If no output, not a git repository
  if [[ -z "$lines" ]]; then
    echo "No Git||||0|0|0|0|0|0|0|false"
    return
  fi
  
  # Extract branch information (line starting with ##)
  local branch_line=$(echo "$lines" | grep "^##" | head -n 1)
  
  if [[ -n "$branch_line" ]]; then
    # Extract branch name from line like: "## main...origin/main [ahead 1]"
    branch=$(echo "$branch_line" | sed -E 's/^## ([^.]+).*/\1/' | sed 's/^## //')
    
    # Extract commits ahead of remote (if any)
    # Uses BASH_REMATCH for bash, falls back to match for zsh
    if [[ "$branch_line" =~ ahead\ ([0-9]+) ]]; then
      commits_ahead=${BASH_REMATCH[1]:-${match[1]}}
    fi
    
    # Extract commits behind remote (if any)
    if [[ "$branch_line" =~ behind\ ([0-9]+) ]]; then
      commits_behind=${BASH_REMATCH[1]:-${match[1]}}
    fi
  fi
  
  # Process file status lines (exclude branch line)
  local file_lines=$(echo "$lines" | grep -v "^##")
  
  # Parse each file status line
  # Format: XY filename (X=staging, Y=working tree)
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    [[ ${#line} -lt 2 ]] && continue
    
    # Extract status codes (first two characters)
    local staging_code="${line:0:1}"     # Staging area status
    local working_code="${line:1:1}"     # Working tree status
    
    # Process staging area status (first column)
    # M=Modified, A=Added, R=Renamed, C=Copied, D=Deleted, U=Unmerged, ?=Untracked
    case "$staging_code" in
      M|A|R|C)
        ((staged_files++))              # Ready for commit
        ;;
      D)
        ((staged_files++))              # Deleted and staged
        ((deleted_files++))
        ;;
      U)
        ((conflict_files++))            # Merge conflict
        ;;
      \?)
        if [[ "$working_code" == "?" ]]; then
          ((untracked_files++))         # New file not tracked
        fi
        ;;
    esac
    
    # Process working tree status (second column)
    case "$working_code" in
      M)
        ((modified_files++))            # Modified but not staged
        ;;
      D)
        ((deleted_files++))             # Deleted but not staged
        ;;
      U)
        ((conflict_files++))            # Merge conflict
        ;;
    esac
  done <<< "$file_lines"
  
  # Determine if repository is clean (no pending changes)
  if [[ $staged_files -eq 0 && $modified_files -eq 0 && \
        $untracked_files -eq 0 && $deleted_files -eq 0 && \
        $conflict_files -eq 0 && $commits_ahead -eq 0 && \
        $commits_behind -eq 0 ]]; then
    is_clean=true
  else
    is_clean=false
  fi
  
  # Return pipe-separated values
  echo "$branch|$staged_files|$modified_files|$untracked_files|$deleted_files|$conflict_files|$commits_ahead|$commits_behind|$is_clean"
}

# Function: build_git_indicators
# Description: Builds a compact string with Git status indicators using emojis.
# Parameters:
#   $1 - branch: Branch name
#   $2 - staged: Number of staged files
#   $3 - modified: Number of modified files
#   $4 - untracked: Number of untracked files
#   $5 - deleted: Number of deleted files
#   $6 - conflict: Number of files with conflicts
#   $7 - ahead: Commits ahead of remote
#   $8 - behind: Commits behind remote
#   $9 - clean: Boolean indicating if repository is clean
# Returns:
#   String like "main ✅2 ✏️1 ⬆️1" or "main ✓" if clean
build_git_indicators() {
  local branch="$1"
  local staged="$2"
  local modified="$3"
  local untracked="$4"
  local deleted="$5"
  local conflict="$6"
  local ahead="$7"
  local behind="$8"
  local clean="$9"
  
  local indicators=""
  
  # Build indicator string with emoji + count for each status
  [[ $staged -gt 0 ]] && indicators+="✅$staged "         # ✅ Staged files
  [[ $modified -gt 0 ]] && indicators+="✏️ $modified "     # ✏️ Modified files
  [[ $untracked -gt 0 ]] && indicators+="📄$untracked "    # 📄 Untracked files
  [[ $deleted -gt 0 ]] && indicators+="🗑️ $deleted "       # 🗑️ Deleted files
  [[ $conflict -gt 0 ]] && indicators+="⚠️ $conflict "     # ⚠️ Conflicts
  [[ $ahead -gt 0 ]] && indicators+="⬆️ $ahead "           # ⬆️ Commits ahead
  [[ $behind -gt 0 ]] && indicators+="⬇️ $behind "         # ⬇️ Commits behind
  
  # Return formatted status
  if [[ -z "$indicators" && "$clean" == "true" ]]; then
    echo "$branch ✓"                    # Clean repository
  elif [[ -n "$indicators" ]]; then
    echo "$branch ${indicators% }"       # Branch with indicators
  else
    echo "$branch"                       # Just branch name
  fi
}

# ============================================================================
# FUNCTIONS: Formatting
# ============================================================================

# Function: format_duration
# Description: Converts milliseconds to human-readable duration.
# Parameters:
#   $1 - milliseconds: Duration in milliseconds
# Returns:
#   String like "2h 15m 30s", "5m 23s", or "45s"
format_duration() {
  local milliseconds=$1
  local total_seconds=$((milliseconds / 1000))
  
  # Calculate hours, minutes, seconds
  local hours=$((total_seconds / 3600))
  local minutes=$(((total_seconds % 3600) / 60))
  local seconds=$((total_seconds % 60))
  
  local result=""
  
  # Build result string (only include non-zero components)
  [[ $hours -gt 0 ]] && result+="${hours}h "
  [[ $minutes -gt 0 ]] && result+="${minutes}m "
  [[ $seconds -gt 0 || -z "$result" ]] && result+="${seconds}s"  # Always show seconds if nothing else
  
  # Remove trailing space
  echo "${result% }"
}

# Function: format_path
# Description: Formats and truncates file paths for display.
#              Replaces home directory with ~, truncates long paths with ...
# Parameters:
#   $1 - full_path: Complete file path
#   $2 - max_length: Maximum allowed length
# Returns:
#   Formatted path like "~/Projects/MyApp" or ".../src/components"
format_path() {
  local full_path="$1"
  local max_length=$2
  
  # Return "unknown" for empty paths
  [[ -z "$full_path" ]] && echo "unknown" && return
  
  local path="$full_path"
  
  # Replace home directory with ~ for brevity
  local home_dir="${HOME}"
  if [[ "$path" == "$home_dir"* ]]; then
    path="~${path#$home_dir}"
  fi
  
  # If path is short enough, return as-is
  if [[ ${#path} -le $max_length ]]; then
    echo "$path"
    return
  fi
  
  # Split path into parts
  IFS='/' read -ra parts <<< "$path"
  
  # Build truncated path from right to left (keep most recent directories)
  local final_parts=()
  local current_length=3  # Account for "..."
  
  # Iterate backwards through path components
  for ((i=${#parts[@]}; i>0; i--)); do
    local part="${parts[$i]}"
    local length_with_part=$((current_length + ${#part} + 1))  # +1 for separator
    
    # Add part if it fits within max length
    if [[ $length_with_part -le $max_length ]]; then
      final_parts=("$part" "${final_parts[@]}")
      current_length=$length_with_part
    else
      break  # Stop when we exceed max length
    fi
  done
  
  # Build final truncated path with "..." prefix
  local result=".../"
  for part in "${final_parts[@]}"; do
    result+="$part/"
  done
  
  # Remove trailing slash
  echo "${result%/}"
}

# Function: get_model_name
# Description: Formats model names for consistent display.
#              Applies title case and corrects known model names.
# Parameters:
#   $1 - name: Raw model name from API
# Returns:
#   Formatted name like "GLM 4.6", "Claude", "GPT", "DeepSeek R1"
get_model_name() {
  local name="$1"
  
  # Return "unknown" for empty names
  [[ -z "$name" ]] && echo "unknown" && return
  
  # Apply title case (capitalize first letter of each word)
  name=$(echo "$name" | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')
  
  # Apply specific corrections for known model names (ordered from most specific to most generic)
  name="${name//Glm-4.6-V/GLM 4.6 V}"
  name="${name//Glm-4.6/GLM 4.6}"
  name="${name//Glm-4.5-Air/GLM 4.5 Air}"
  name="${name//Glm-4.5-V/GLM 4.5 V}"
  name="${name//Glm-4.5/GLM 4.5}"
  name="${name//Glm-4/GLM 4}"
  
  echo "$name"
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================

# Function: main
# Description: Entry point. Reads JSON from stdin, parses it, and generates
#              a 2-line status display with directory, git, model, cost, and lines info.
# Input: JSON from stdin (Claude Code CLI format)
# Output: 2 lines of formatted status information
main() {
  # Read JSON input from stdin
  local json_input
  json_input=$(cat)
  
  # Exit if no input provided
  if [[ -z "$json_input" ]]; then
    echo "No input data"
    return
  fi
  
  # Extract values from JSON using jq
  local full_directory=$(echo "$json_input" | jq -r '.workspace.current_dir // "unknown"')
  local model_name=$(echo "$json_input" | jq -r '.model.display_name // "unknown"')
  local cost_usd=$(echo "$json_input" | jq -r '.cost.total_cost_usd // 0')
  local duration_ms=$(echo "$json_input" | jq -r '.cost.total_duration_ms // 0')
  local api_duration_ms=$(echo "$json_input" | jq -r '.cost.total_api_duration_ms // 0')
  local lines_added=$(echo "$json_input" | jq -r '.cost.total_lines_added // 0')
  local lines_removed=$(echo "$json_input" | jq -r '.cost.total_lines_removed // 0')
  
  # Format directory path with truncation
  local directory_path=$(format_path "$full_directory" $MAX_PATH_LENGTH)
  
  # Get Git status and parse results
  local git_status=$(get_git_status "$full_directory")
  IFS='|' read -r branch staged modified untracked deleted conflict ahead behind clean <<< "$git_status"
  
  # Build Git info string (detailed or simple)
  local git_info
  if [[ "$SHOW_DETAILED_GIT" == true ]]; then
    git_info=$(build_git_indicators "$branch" "$staged" "$modified" "$untracked" "$deleted" "$conflict" "$ahead" "$behind" "$clean")
  else
    git_info="$branch"  # Just branch name
  fi
  
  # Format model name
  local model=$(get_model_name "$model_name")
  
  # Format cost with 2 decimal places
  local formatted_cost=$(printf "\$%.2f USD" "$cost_usd")
  
  # Format session duration
  local session_duration=$(format_duration "$duration_ms")
  
  # Calculate net lines changed
  local net=$((lines_added - lines_removed))
  local lines_info="+${lines_added}/-${lines_removed} (Net: ${net})"
  
  # Choose Git emoji based on repository status
  local git_emoji
  if [[ "$branch" == "No Git" ]]; then
    git_emoji="📦"  # Package emoji for non-git directories
  else
    git_emoji="🍃"  # Leaf emoji for git repositories
  fi
  
  # LINE 1: Directory | Git Status | Model
  local line1="🗂️  ${directory_path} | ${git_emoji} ${git_info} | 🤖 ${model}"
  
  # LINE 2: Cost | Duration | Lines
  local line2="💵 ${formatted_cost} | ⏱️  ${session_duration}"
  
  # Optionally append API duration
  if [[ "$SHOW_API_DURATION" == true ]]; then
    local api_duration_sec=$(echo "scale=1; $api_duration_ms / 1000" | bc)
    line2+=" (API: ${api_duration_sec}s)"
  fi
  
  # Append lines info
  line2+=" | ✏️  ${lines_info}"
  
  # Output both lines
  echo "$line1"
  echo "$line2"
}

# Execute main function
main
