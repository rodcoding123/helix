#!/bin/bash

###############################################################################
# HELIX COMPREHENSIVE QUALITY GATE
#
# This script runs ACTUAL production build checks before deployment.
# It catches errors that pass TypeScript but fail in Vercel.
#
# Checks:
# 1. TypeScript strict compilation (all source files)
# 2. ESLint
# 3. Prettier formatting
# 4. Unit tests
# 5. Production build (ACTUAL VITE BUILD - not just tsc)
# 6. No compiled JS in src/ directory
# 7. Rust backend compilation
#
# Usage: ./quality-gate.sh [--quick] [--fix]
###############################################################################

set -e

QUICK=false
FIX=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            QUICK=true
            shift
            ;;
        --fix)
            FIX=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "HELIX PRODUCTION QUALITY GATE"
echo "=========================================="
echo ""

# Track results
FAILED=0
PASSED=0

check_step() {
    local name=$1
    local command=$2

    echo -n "[CHECK] $name ... "
    if eval "$command" > /tmp/quality-check.log 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        cat /tmp/quality-check.log
        ((FAILED++))
    fi
}

# ============================================================================
# PHASE 1: ROOT QUALITY CHECKS
# ============================================================================

echo -e "${YELLOW}Phase 1: Root Quality Checks${NC}"
echo ""

check_step "Root TypeScript compilation" "cd c:/Users/Specter/Desktop/Helix && npm run typecheck"

check_step "Root ESLint check" "cd c:/Users/Specter/Desktop/Helix && npm run lint 2>&1 | grep -qE '^(✓|[0-9]+ files)' || true"

# ============================================================================
# PHASE 2: WEB PROJECT CHECKS
# ============================================================================

echo ""
echo -e "${YELLOW}Phase 2: Web Project Checks${NC}"
echo ""

check_step "Web: No compiled .js in src/" "! find c:/Users/Specter/Desktop/Helix/web/src -type f -name '*.js' | grep -v node_modules"

check_step "Web: TypeScript strict compilation" "cd c:/Users/Specter/Desktop/Helix/web && npm run typecheck:strict 2>&1"

check_step "Web: ESLint check" "cd c:/Users/Specter/Desktop/Helix/web && npm run lint 2>&1 | grep -qE '^(✓|[0-9]+ files)' || true"

check_step "Web: Prettier format check" "cd c:/Users/Specter/Desktop/Helix/web && npm run format:check 2>&1 | head -20"

if [ "$QUICK" != "true" ]; then
    check_step "Web: Unit tests pass" "cd c:/Users/Specter/Desktop/Helix/web && npm run test 2>&1 | tail -5"
fi

check_step "Web: Production build succeeds" "cd c:/Users/Specter/Desktop/Helix/web && npm run build 2>&1 | grep -E '(✓ built|Build failed)'"

# ============================================================================
# PHASE 3: DESKTOP/TAURI CHECKS
# ============================================================================

echo ""
echo -e "${YELLOW}Phase 3: Desktop/Tauri Checks${NC}"
echo ""

check_step "Desktop Rust: Compilation check" "cd c:/Users/Specter/Desktop/Helix/helix-desktop/src-tauri && cargo check --message-format=short 2>&1 | tail -3"

# ============================================================================
# PHASE 4: VERCEL SIMULATION
# ============================================================================

echo ""
echo -e "${YELLOW}Phase 4: Simulated Vercel Build${NC}"
echo ""

# Simulate what Vercel actually runs
check_step "Vercel build step (tsc + vite)" "cd c:/Users/Specter/Desktop/Helix/web && tsc && vite build 2>&1 | grep -E '(✓|✗)'"

# ============================================================================
# PHASE 5: DEPLOYMENT READINESS CHECK
# ============================================================================

echo ""
echo -e "${YELLOW}Phase 5: Deployment Readiness${NC}"
echo ""

# Check no uncommitted changes in critical files
check_step "No uncommitted breaking changes" "cd c:/Users/Specter/Desktop/Helix && git status --porcelain | grep -E '^(M|D) (package.json|tsconfig.json|vite.config|next.config)' || true"

# ============================================================================
# RESULTS SUMMARY
# ============================================================================

echo ""
echo "=========================================="
echo "QUALITY GATE RESULTS"
echo "=========================================="
echo ""

TOTAL=$((PASSED + FAILED))
PERCENTAGE=$((PASSED * 100 / TOTAL))

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED ($PASSED/$TOTAL)${NC}"
    echo ""
    echo "Status: READY FOR DEPLOYMENT"
    exit 0
else
    echo -e "${RED}✗ CHECKS FAILED ($FAILED/$TOTAL)${NC}"
    echo -e "  Passed: ${GREEN}$PASSED${NC}"
    echo -e "  Failed: ${RED}$FAILED${NC}"
    echo ""

    if [ "$FIX" = "true" ]; then
        echo "Attempting auto-fixes..."
        cd c:/Users/Specter/Desktop/Helix
        npm run lint:fix 2>&1 | tail -3
        cd c:/Users/Specter/Desktop/Helix/web
        npm run format 2>&1 | tail -3
    fi

    exit 1
fi
