#!/bin/bash
# ===========================================
# HELIX GIT AUTOCOMMIT
# ===========================================
# Automatically commits workspace changes every 5 minutes
# This creates an immutable git history of all modifications
#
# IMPORTANT: Auto-commits go to 'helix/workspace-history' branch
# The 'main' branch is NEVER touched - only for intentional commits
#
# The git history serves as:
# 1. Backup of all changes
# 2. Timeline of what was modified when
# 3. Ability to revert any change
# 4. Evidence for observer machine to pull
#
# Branch strategy:
# - main: Clean, intentional commits only
# - helix/workspace-history: All auto-commits (every 5 min)
#
# Run via cron: */5 * * * * ~/.openclaw/workspace/axis/scripts/git_autocommit.sh
#
# Author: Helix Autonomous System
# Created: January 31, 2026

set -e

WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
LOG_DIR="/var/log/helix"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
AUTOCOMMIT_BRANCH="helix/workspace-history"

# Load environment for Discord webhooks
[[ -f "$HOME/.helix/.env" ]] && source "$HOME/.helix/.env"
[[ -f "$HOME/.openclaw/.env" ]] && source "$HOME/.openclaw/.env"

# Ensure log directory exists
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Ensure we're in the workspace
cd "$WORKSPACE" || {
    echo "$TIMESTAMP | ERROR | Cannot access workspace: $WORKSPACE" >> "$LOG_DIR/git.log"
    exit 1
}

# Initialize git if not already
if [[ ! -d ".git" ]]; then
    git init
    git config user.email "helix@autonomous.local"
    git config user.name "Helix Autonomous System"
    git add -A
    git commit -m "Initial workspace state - $TIMESTAMP"
    echo "$TIMESTAMP | GIT_INIT | Initial commit on main" >> "$LOG_DIR/git.log"

    # Create the autocommit branch from main
    git branch "$AUTOCOMMIT_BRANCH"
    echo "$TIMESTAMP | GIT_BRANCH | Created $AUTOCOMMIT_BRANCH branch" >> "$LOG_DIR/git.log"

    # Notify Discord
    if [[ -n "$DISCORD_WEBHOOK_FILE_CHANGES" ]]; then
        curl -s -H "Content-Type: application/json" \
            -d "{\"embeds\":[{\"title\":\"🔧 Git Repository Initialized\",\"description\":\"Workspace git tracking active\\n\\n**main**: intentional commits\\n**$AUTOCOMMIT_BRANCH**: auto-commits\",\"color\":3066993,\"timestamp\":\"$TIMESTAMP\"}]}" \
            "$DISCORD_WEBHOOK_FILE_CHANGES" > /dev/null 2>&1 || true
    fi
fi

# Ensure autocommit branch exists
if ! git show-ref --verify --quiet "refs/heads/$AUTOCOMMIT_BRANCH"; then
    # Create branch from current HEAD
    git branch "$AUTOCOMMIT_BRANCH"
    echo "$TIMESTAMP | GIT_BRANCH | Created $AUTOCOMMIT_BRANCH branch" >> "$LOG_DIR/git.log"
fi

# Save current branch to return to it later
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

# Stash any uncommitted changes (so we can switch branches)
STASH_NEEDED=false
if [[ -n $(git status --porcelain) ]]; then
    STASH_NEEDED=true
    git stash push -m "autocommit-temp-$TIMESTAMP" --include-untracked
fi

# Switch to autocommit branch
git checkout "$AUTOCOMMIT_BRANCH" 2>/dev/null

# Apply stashed changes
if [[ "$STASH_NEEDED" == true ]]; then
    git stash pop 2>/dev/null || true
fi

# Check for changes
if [[ -n $(git status --porcelain) ]]; then
    # Get summary of changes
    ADDED=$(git status --porcelain | grep -c "^??" || echo "0")
    MODIFIED=$(git status --porcelain | grep -c "^ M\|^M" || echo "0")
    DELETED=$(git status --porcelain | grep -c "^ D\|^D" || echo "0")

    # Stage all changes
    git add -A

    # Get diff summary
    DIFF_SUMMARY=$(git diff --cached --stat | tail -1 | sed 's/^ *//' || echo "changes")

    # Get list of changed files (first 5)
    CHANGED_FILES=$(git diff --cached --name-only | head -5 | tr '\n' ', ' | sed 's/,$//')

    # Create commit message
    COMMIT_MSG="Auto: $TIMESTAMP | +$ADDED ~$MODIFIED -$DELETED"

    # Commit
    git commit -m "$COMMIT_MSG" -m "Files: $CHANGED_FILES" -m "Summary: $DIFF_SUMMARY"

    # Get commit hash
    COMMIT_HASH=$(git rev-parse HEAD)

    # Log to file
    echo "$TIMESTAMP | COMMIT | $COMMIT_HASH | +$ADDED ~$MODIFIED -$DELETED | $DIFF_SUMMARY" >> "$LOG_DIR/git.log"

    # Log to Discord if webhook is set
    if [[ -n "$DISCORD_WEBHOOK_FILE_CHANGES" ]]; then
        # Escape special characters for JSON
        ESCAPED_FILES=$(echo "$CHANGED_FILES" | sed 's/"/\\"/g' | head -c 200)
        ESCAPED_SUMMARY=$(echo "$DIFF_SUMMARY" | sed 's/"/\\"/g' | head -c 100)

        curl -s -H "Content-Type: application/json" \
            -d "{\"embeds\":[{\"title\":\"📝 Git Auto-Commit\",\"color\":16776960,\"fields\":[{\"name\":\"Commit\",\"value\":\"\`${COMMIT_HASH:0:8}\`\",\"inline\":true},{\"name\":\"Changes\",\"value\":\"+$ADDED ~$MODIFIED -$DELETED\",\"inline\":true},{\"name\":\"Files\",\"value\":\"\`$ESCAPED_FILES\`\",\"inline\":false},{\"name\":\"Summary\",\"value\":\"\`$ESCAPED_SUMMARY\`\",\"inline\":false}],\"timestamp\":\"$TIMESTAMP\",\"footer\":{\"text\":\"Workspace auto-commit\"}}]}" \
            "$DISCORD_WEBHOOK_FILE_CHANGES" > /dev/null 2>&1 || true
    fi

    echo "$TIMESTAMP | SUCCESS | Committed $COMMIT_HASH to $AUTOCOMMIT_BRANCH"
else
    # No changes - log only to file (don't spam Discord)
    echo "$TIMESTAMP | NO_CHANGES | Workspace clean" >> "$LOG_DIR/git.log"
fi

# Switch back to original branch (keep workspace on autocommit branch by default)
# Uncomment the next line if you want to return to the original branch after each commit
# git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
