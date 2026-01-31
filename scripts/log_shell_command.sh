#!/bin/bash
# ===========================================
# HELIX SHELL COMMAND DISCORD LOGGER
# ===========================================
# Logs shell commands to Discord webhook
# Called by zshrc preexec hook for commands run OUTSIDE OpenClaw
#
# This ensures Rodrigo sees ALL commands, not just those run
# through OpenClaw's own logging system.
#
# Usage: log_shell_command.sh "command" "workdir" "pid"
#
# Author: Helix Autonomous System
# Created: January 31, 2026

COMMAND="$1"
WORKDIR="$2"
PID="$3"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Load environment for webhook URL
[[ -f "$HOME/.helix/.env" ]] && source "$HOME/.helix/.env"
[[ -f "$HOME/.openclaw/.env" ]] && source "$HOME/.openclaw/.env"

# Skip if no webhook configured
[[ -z "$DISCORD_WEBHOOK_COMMANDS" ]] && exit 0

# Skip empty commands
[[ -z "$COMMAND" ]] && exit 0

# ===========================================
# SKIP PATTERNS
# ===========================================
# These commands are too noisy or not useful to log
SKIP_PATTERNS=(
    "^ls"
    "^ll"
    "^la"
    "^cd "
    "^pwd$"
    "^echo "
    "^cat "
    "^less "
    "^more "
    "^head "
    "^tail "
    "^clear$"
    "^history"
    "^which "
    "^type "
    "^man "
    "^help"
    "^exit$"
    "^logout$"
    "^source "
    "^\."
)

for pattern in "${SKIP_PATTERNS[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        exit 0
    fi
done

# ===========================================
# SENSITIVE COMMAND DETECTION
# ===========================================
# Flag commands that might be concerning
ELEVATED=false
CONCERNING=false

ELEVATED_PATTERNS=(
    "^sudo "
    "^su "
    "chflags"
    "chmod.*777"
    "rm -rf"
    "curl.*\|.*sh"
    "wget.*\|.*sh"
)

CONCERNING_PATTERNS=(
    "ssh-keygen"
    "kill.*-9"
    "pkill"
    "launchctl"
    "crontab"
    "/var/log"
    "discord.*webhook"
    "\.env"
)

for pattern in "${ELEVATED_PATTERNS[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        ELEVATED=true
        break
    fi
done

for pattern in "${CONCERNING_PATTERNS[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        CONCERNING=true
        break
    fi
done

# ===========================================
# PREPARE MESSAGE
# ===========================================

# Truncate long commands
DISPLAY_CMD="$COMMAND"
if [[ ${#DISPLAY_CMD} -gt 500 ]]; then
    DISPLAY_CMD="${DISPLAY_CMD:0:500}... [truncated]"
fi

# Escape special characters for JSON
DISPLAY_CMD=$(echo "$DISPLAY_CMD" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/`/\\`/g' | tr '\n' ' ')
WORKDIR=$(echo "$WORKDIR" | sed 's/"/\\"/g')

# Set color based on type
if [[ "$ELEVATED" == true ]]; then
    COLOR=15158332  # Red for elevated
    TITLE="🔴 Shell Command (ELEVATED)"
elif [[ "$CONCERNING" == true ]]; then
    COLOR=16776960  # Yellow for concerning
    TITLE="🟡 Shell Command (Notable)"
else
    COLOR=5793266   # Blue for normal
    TITLE="🖥️ Shell Command"
fi

# ===========================================
# SEND TO DISCORD
# ===========================================
# Fire and forget (async)

curl -s -H "Content-Type: application/json" \
    -d "{\"embeds\":[{\"title\":\"$TITLE\",\"color\":$COLOR,\"fields\":[{\"name\":\"Command\",\"value\":\"\`\`\`bash\n$DISPLAY_CMD\`\`\`\",\"inline\":false},{\"name\":\"Directory\",\"value\":\"\`$WORKDIR\`\",\"inline\":true},{\"name\":\"PID\",\"value\":\"\`$PID\`\",\"inline\":true}],\"timestamp\":\"$TIMESTAMP\",\"footer\":{\"text\":\"Shell command (outside OpenClaw)\"}}]}" \
    "$DISCORD_WEBHOOK_COMMANDS" > /dev/null 2>&1 &

exit 0
