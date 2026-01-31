#!/bin/bash
# ===========================================
# HELIX NETWORK MONITOR
# ===========================================
# Logs outbound network connections
# Helps track what Helix is connecting to
#
# Two modes:
# 1. User mode (default): Uses lsof, limited visibility
# 2. Root mode (sudo): Uses tcpdump, full visibility
#
# Usage:
#   ./network_monitor.sh          # User mode
#   sudo ./network_monitor.sh     # Root mode
#
# Author: Helix Autonomous System
# Created: January 31, 2026

LOG_DIR="/var/log/helix"
NETWORK_LOG="$LOG_DIR/network.log"

# Load environment
[[ -f "$HOME/.helix/.env" ]] && source "$HOME/.helix/.env"
[[ -f "$HOME/.openclaw/.env" ]] && source "$HOME/.openclaw/.env"

# Ensure log directory exists
mkdir -p "$LOG_DIR" 2>/dev/null || true

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | NETWORK_MONITOR_START" >> "$NETWORK_LOG"

# Check if running as root (needed for tcpdump)
if [[ $EUID -ne 0 ]]; then
    echo "Running in user mode (limited visibility)"
    echo "For full network monitoring, run with: sudo $0"
    echo ""

    # User mode: use lsof to log network connections periodically
    while true; do
        TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

        # Get established connections (excluding local)
        lsof -i -n -P 2>/dev/null | grep -E "ESTABLISHED" | grep -v "127.0.0.1" | grep -v "::1" | while read line; do
            # Extract key info
            PROCESS=$(echo "$line" | awk '{print $1}')
            PID=$(echo "$line" | awk '{print $2}')
            CONNECTION=$(echo "$line" | awk '{print $9}')

            # Skip if already logged recently (simple dedup)
            ENTRY="$PROCESS | $CONNECTION"

            # Log to file
            echo "$TIMESTAMP | $PROCESS | PID:$PID | $CONNECTION" >> "$NETWORK_LOG"
        done

        # Log listening ports (less frequently)
        if [[ $(( $(date +%s) % 300 )) -lt 60 ]]; then
            lsof -i -n -P 2>/dev/null | grep -E "LISTEN" | while read line; do
                PROCESS=$(echo "$line" | awk '{print $1}')
                PORT=$(echo "$line" | awk '{print $9}')
                echo "$TIMESTAMP | LISTEN | $PROCESS | $PORT" >> "$NETWORK_LOG"
            done
        fi

        sleep 60
    done
else
    echo "Running in root mode (full tcpdump visibility)"

    # Root mode: full tcpdump logging
    # Only capture HTTP/HTTPS traffic to avoid overwhelming logs
    tcpdump -i any -l -n 'tcp and (port 80 or port 443)' 2>/dev/null | while read line; do
        TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

        # Extract source and destination
        # tcpdump output format: timestamp IP src > dst: flags
        if [[ "$line" =~ ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\.([0-9]+)\ \>\ ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\.([0-9]+) ]]; then
            SRC_IP="${BASH_REMATCH[1]}"
            SRC_PORT="${BASH_REMATCH[2]}"
            DST_IP="${BASH_REMATCH[3]}"
            DST_PORT="${BASH_REMATCH[4]}"

            # Skip local traffic
            [[ "$DST_IP" == "127.0.0.1" ]] && continue
            [[ "$SRC_IP" == "127.0.0.1" ]] && continue

            echo "$TIMESTAMP | $SRC_IP:$SRC_PORT -> $DST_IP:$DST_PORT" >> "$NETWORK_LOG"

            # Alert on unusual destinations (optional)
            # Add your own suspicious IP detection logic here
        fi
    done
fi
