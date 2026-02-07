#!/bin/bash
#
# HELIX EMERGENCY ROLLBACK SCRIPT
# Usage: ./scripts/deploy/emergency-rollback.sh [backend|web|all]
#
# Quickly rolls back to previous stable deployment
# < 5 minute recovery time
#

set -e

LOG_PREFIX="[ROLLBACK]"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[${TIMESTAMP}] ${LOG_PREFIX} $*"
}

error() {
    echo "[${TIMESTAMP}] ${LOG_PREFIX} ERROR: $*" >&2
    exit 1
}

success() {
    echo "[${TIMESTAMP}] ${LOG_PREFIX} SUCCESS: $*"
}

# Parse arguments
ROLLBACK_TARGET=${1:-all}

if [ "$ROLLBACK_TARGET" != "backend" ] && [ "$ROLLBACK_TARGET" != "web" ] && [ "$ROLLBACK_TARGET" != "all" ]; then
    error "Usage: $0 [backend|web|all]"
fi

log "Emergency Rollback Initiated: $ROLLBACK_TARGET"

# ====================
# BACKEND ROLLBACK
# ====================
rollback_backend() {
    log "Rolling back backend deployment..."

    if [ -z "$VPS_HOST" ]; then
        error "VPS_HOST not set in environment"
    fi

    if [ -z "$VPS_USER" ]; then
        VPS_USER="helix"
    fi

    log "Connecting to VPS: $VPS_USER@$VPS_HOST"

    # Get current and previous Docker image tags
    CURRENT_TAG=$(ssh -p 22 "${VPS_USER}@${VPS_HOST}" \
        'docker-compose -f ~/helix/docker-compose.production.yml images | grep helix | awk "{print \$2}" | head -1' 2>/dev/null || echo "")

    if [ -z "$CURRENT_TAG" ]; then
        log "Current image tag not found. Stopping containers..."
        ssh -p 22 "${VPS_USER}@${VPS_HOST}" 'cd ~/helix && docker-compose down'
    else
        log "Current image: $CURRENT_TAG"

        # Determine previous tag (assumes date-based tagging)
        PREVIOUS_DATE=$(date -d "1 day ago" +%Y%m%d)
        PREVIOUS_TAG="${PREVIOUS_DATE}"

        log "Rolling back to previous image: $PREVIOUS_TAG"

        # Update docker-compose.yml to use previous tag
        ssh -p 22 "${VPS_USER}@${VPS_HOST}" <<EOF
cd ~/helix
# Backup current docker-compose
cp docker-compose.production.yml docker-compose.production.yml.rollback

# Stop current containers
docker-compose down

# Update image tag
sed -i "s/helix:.*$/helix:${PREVIOUS_TAG}/" docker-compose.production.yml

# Start with previous image
docker-compose up -d

# Wait for health check
sleep 10
docker-compose ps

# Log rollback
curl -X POST \$DISCORD_WEBHOOK_ALERTS \
    -H "Content-Type: application/json" \
    -d '{"content":"[EMERGENCY] Backend rolled back to $PREVIOUS_TAG"}'
EOF
    fi

    log "Waiting for backend to stabilize..."
    sleep 15

    # Verify backend health
    HEALTH_STATUS=$(ssh -p 22 "${VPS_USER}@${VPS_HOST}" 'curl -s http://localhost:3000/health' 2>/dev/null || echo "")

    if [ "$HEALTH_STATUS" = "OK" ]; then
        success "Backend rolled back and healthy"
    else
        error "Backend health check failed after rollback"
    fi
}

# ====================
# WEB ROLLBACK
# ====================
rollback_web() {
    log "Rolling back web deployment..."

    # Check if using Vercel
    if command -v vercel &> /dev/null; then
        log "Detected Vercel CLI. Rolling back to previous production deployment..."

        # Get list of deployments
        PREVIOUS_DEPLOYMENT=$(vercel list --prod | head -2 | tail -1 | awk '{print $NF}')

        if [ -z "$PREVIOUS_DEPLOYMENT" ]; then
            error "Could not find previous Vercel deployment"
        fi

        log "Previous deployment: $PREVIOUS_DEPLOYMENT"

        # Promote previous deployment to production
        vercel promote "$PREVIOUS_DEPLOYMENT" --yes

        success "Web rolled back to Vercel deployment: $PREVIOUS_DEPLOYMENT"

        # Notify Discord
        curl -X POST "${DISCORD_WEBHOOK_ALERTS}" \
            -H "Content-Type: application/json" \
            -d "{\"content\":\"[EMERGENCY] Web rolled back to ${PREVIOUS_DEPLOYMENT}\"}"
    else
        # Check if using Netlify
        if command -v netlify &> /dev/null; then
            log "Detected Netlify CLI. Rolling back to previous production deployment..."

            # Get list of deployments
            PREVIOUS_DEPLOYMENT=$(netlify api list-site-deploys --json | jq -r '.[1].id' 2>/dev/null)

            if [ -z "$PREVIOUS_DEPLOYMENT" ]; then
                error "Could not find previous Netlify deployment"
            fi

            log "Previous deployment: $PREVIOUS_DEPLOYMENT"

            # Publish previous deployment
            netlify api publish-deploy --deployment-id "$PREVIOUS_DEPLOYMENT" --json

            success "Web rolled back to Netlify deployment: $PREVIOUS_DEPLOYMENT"

            # Notify Discord
            curl -X POST "${DISCORD_WEBHOOK_ALERTS}" \
                -H "Content-Type: application/json" \
                -d "{\"content\":\"[EMERGENCY] Web rolled back to ${PREVIOUS_DEPLOYMENT}\"}"
        else
            error "Neither Vercel nor Netlify CLI found. Cannot rollback web deployment."
        fi
    fi
}

# ====================
# MAIN LOGIC
# ====================

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          HELIX EMERGENCY ROLLBACK PROCEDURE               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

log "Target: $ROLLBACK_TARGET"
log "Time: $TIMESTAMP"
echo ""

# Confirm before proceeding
read -p "⚠️  This will rollback $ROLLBACK_TARGET deployment. Continue? (yes/no): " -r CONFIRM
echo ""

if [ "$CONFIRM" != "yes" ]; then
    log "Rollback cancelled"
    exit 0
fi

# Execute rollbacks
case "$ROLLBACK_TARGET" in
    backend)
        rollback_backend
        ;;
    web)
        rollback_web
        ;;
    all)
        rollback_backend
        rollback_web
        ;;
esac

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║               ✅ ROLLBACK COMPLETE                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
log "Rollback completed at $(date)"
log "Check Discord #helix-alerts for notifications"
log "Run: npm run health-check to verify system stability"
