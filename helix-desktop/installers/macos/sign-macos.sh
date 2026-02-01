#!/bin/bash
# Helix Desktop - macOS Code Signing Script
#
# PREREQUISITES:
# 1. Apple Developer ID Application certificate
# 2. Xcode Command Line Tools installed
# 3. Certificate in Keychain or specified via environment
#
# USAGE:
#   ./sign-macos.sh /path/to/Helix.app
#   ./sign-macos.sh /path/to/Helix.app "Developer ID Application: Your Name (TEAMID)"
#
# ENVIRONMENT VARIABLES (for CI):
#   APPLE_SIGNING_IDENTITY - Certificate identity string
#   APPLE_CERTIFICATE - Base64 encoded P12 certificate
#   APPLE_CERTIFICATE_PASSWORD - P12 password
#   KEYCHAIN_PASSWORD - Keychain password for CI

set -e

APP_PATH="${1:-}"
IDENTITY="${2:-${APPLE_SIGNING_IDENTITY:-}}"
ENTITLEMENTS="${3:-$(dirname "$0")/../../src-tauri/entitlements.plist}"

echo "========================================"
echo "Helix macOS Code Signing"
echo "========================================"

# Verify app exists
if [ -z "$APP_PATH" ]; then
    echo "Usage: $0 <app-path> [signing-identity] [entitlements-path]"
    exit 1
fi

if [ ! -d "$APP_PATH" ]; then
    echo "Error: App bundle not found: $APP_PATH"
    exit 1
fi

echo "App to sign: $APP_PATH"

# Check entitlements
if [ ! -f "$ENTITLEMENTS" ]; then
    echo "Warning: Entitlements file not found: $ENTITLEMENTS"
    echo "Signing without entitlements..."
    ENTITLEMENTS=""
fi

# Setup keychain for CI (if certificate provided via env)
if [ -n "$APPLE_CERTIFICATE" ]; then
    echo "Setting up CI keychain..."

    KEYCHAIN_PATH="$HOME/Library/Keychains/build.keychain-db"
    KEYCHAIN_PASSWORD="${KEYCHAIN_PASSWORD:-build}"

    # Decode and import certificate
    echo "$APPLE_CERTIFICATE" | base64 --decode > /tmp/certificate.p12

    # Create keychain
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain || true
    security default-keychain -s build.keychain
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain

    # Import certificate
    security import /tmp/certificate.p12 \
        -k build.keychain \
        -P "$APPLE_CERTIFICATE_PASSWORD" \
        -T /usr/bin/codesign \
        -T /usr/bin/security

    # Allow codesign access
    security set-key-partition-list -S apple-tool:,apple:,codesign: \
        -s -k "$KEYCHAIN_PASSWORD" build.keychain

    # Cleanup
    rm -f /tmp/certificate.p12

    # Find identity if not specified
    if [ -z "$IDENTITY" ]; then
        IDENTITY=$(security find-identity -v -p codesigning build.keychain | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')
    fi
fi

# Check for identity
if [ -z "$IDENTITY" ]; then
    echo ""
    echo "========================================"
    echo "PLACEHOLDER MODE - No signing identity"
    echo "========================================"
    echo ""
    echo "To sign for real, provide one of:"
    echo "  - Second argument: signing identity string"
    echo "  - APPLE_SIGNING_IDENTITY environment variable"
    echo "  - APPLE_CERTIFICATE environment variable (base64 P12)"
    echo ""
    echo "Available identities:"
    security find-identity -v -p codesigning || true
    echo ""
    echo "Example command that would be run:"
    echo "  codesign --force --deep --options runtime \\"
    echo "    --sign \"Developer ID Application: Your Name (TEAMID)\" \\"
    echo "    --entitlements entitlements.plist \\"
    echo "    \"$APP_PATH\""
    echo ""
    exit 0
fi

echo "Signing identity: $IDENTITY"

# Build codesign arguments
CODESIGN_ARGS=(
    --force
    --deep
    --options runtime
    --sign "$IDENTITY"
)

if [ -n "$ENTITLEMENTS" ]; then
    echo "Entitlements: $ENTITLEMENTS"
    CODESIGN_ARGS+=(--entitlements "$ENTITLEMENTS")
fi

# Sign the app
echo ""
echo "Signing app bundle..."
codesign "${CODESIGN_ARGS[@]}" "$APP_PATH"

# Verify signature
echo ""
echo "Verifying signature..."
codesign --verify --verbose=2 "$APP_PATH"

# Check Gatekeeper
echo ""
echo "Checking Gatekeeper assessment..."
spctl --assess --verbose=4 "$APP_PATH" || {
    echo "Warning: Gatekeeper assessment failed (expected until notarized)"
}

echo ""
echo "========================================"
echo "Signing complete!"
echo "========================================"
echo ""
echo "Next step: Run notarize.sh to submit for notarization"
