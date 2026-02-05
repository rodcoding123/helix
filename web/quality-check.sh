#!/bin/bash
# Comprehensive Quality Check Script for Helix Web
# Blocks deployment if ANY TypeScript errors exist

set -e  # Exit on first error

echo "🔍 Starting comprehensive quality checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# ============================================================================
# 1. TypeScript Compilation (STRICT - includes test files)
# ============================================================================
echo "📘 [1/5] TypeScript Compilation Check (strict mode + test files)..."
if npx tsc --noEmit --skipLibCheck false 2>&1 | tee /tmp/ts-errors.txt; then
  echo -e "${GREEN}✓ TypeScript compilation passed${NC}"
else
  echo -e "${RED}✗ TypeScript compilation FAILED${NC}"
  ERROR_COUNT=$(wc -l < /tmp/ts-errors.txt)
  echo -e "${RED}Found $ERROR_COUNT TypeScript errors${NC}"
  echo ""
  echo "First 20 errors:"
  head -20 /tmp/ts-errors.txt
  FAILED=1
fi
echo ""

# ============================================================================
# 2. ESLint
# ============================================================================
echo "🔧 [2/5] ESLint Check..."
if npm run lint 2>&1; then
  echo -e "${GREEN}✓ ESLint passed${NC}"
else
  echo -e "${RED}✗ ESLint FAILED${NC}"
  FAILED=1
fi
echo ""

# ============================================================================
# 3. Prettier Format Check
# ============================================================================
echo "💅 [3/5] Prettier Format Check..."
if npx prettier --check "src/**/*.{ts,tsx,js,jsx,json,css,md}" 2>&1; then
  echo -e "${GREEN}✓ Prettier check passed${NC}"
else
  echo -e "${YELLOW}⚠ Some files need formatting${NC}"
  echo "Run: npm run format"
  FAILED=1
fi
echo ""

# ============================================================================
# 4. Unused Exports Check
# ============================================================================
echo "🗑️  [4/5] Unused Exports Check..."
if npx ts-prune --error 2>&1 | grep -v "used in module" | head -20; then
  echo -e "${YELLOW}⚠ Found unused exports (review recommended)${NC}"
  # Don't fail on unused exports, just warn
else
  echo -e "${GREEN}✓ No critical unused exports${NC}"
fi
echo ""

# ============================================================================
# 5. Dependency Audit
# ============================================================================
echo "🔒 [5/5] Dependency Security Audit..."
if npm audit --audit-level=high 2>&1; then
  echo -e "${GREEN}✓ No high/critical vulnerabilities${NC}"
else
  echo -e "${RED}✗ Security vulnerabilities found${NC}"
  echo "Run: npm audit fix"
  FAILED=1
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ ALL QUALITY CHECKS PASSED${NC}"
  echo "Safe to deploy ✅"
  exit 0
else
  echo -e "${RED}✗ QUALITY CHECKS FAILED${NC}"
  echo "Fix errors before deploying 🚫"
  echo ""
  echo "Quick fixes:"
  echo "  - TypeScript errors: Review and fix type issues"
  echo "  - ESLint: npm run lint:fix"
  echo "  - Prettier: npm run format"
  echo "  - Security: npm audit fix"
  exit 1
fi
