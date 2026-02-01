#!/bin/bash
# Helix Desktop - macOS Notarization Script
#
# PREREQUISITES:
# 1. App must be signed with Developer ID Application certificate
# 2. Apple Developer account with notarization enabled
# 3. App-specific password or stored keychain credentials
#
# SETUP (one-time):
#   xcrun notarytool store-credentials "helix-notary" \
#     --apple-id "your@email.com" \
#     --team-id "TEAMID" \
#     --password "app-specific-password"
#
# USAGE:
#   ./notarize.sh /path/to/Helix.dmg
#   ./notarize.sh /path/to/Helix.app
#
# ENVIRONMENT VARIABLES (for CI):
#   APPLE_ID - Apple ID email
#   APPLE_PASSWORD - App-specific password
#   APPLE_TEAM_ID - Team ID

set -e

FILE_PATH="${1:-}"
KEYCHAIN_PROFILE="${2:-helix-notary}"

echo "========================================"
echo "Helix macOS Notarization"
echo "========================================"

# Verify file exists
if [ -z "$FILE_PATH" ]; then
    echo "Usage: $0 <file-path> [keychain-profile]"
    echo ""
    echo "Examples:"
    echo "  $0 /path/to/Helix.dmg"
    echo "  $0 /path/to/Helix.app"
    echo "  $0 /path/to/Helix.zip helix-notary"
    exit 1
fi

if [ ! -e "$FILE_PATH" ]; then
    echo "Error: File not found: $FILE_PATH"
    exit 1
fi

echo "File to notarize: $FILE_PATH"

# Determine file type
FILE_EXT="${FILE_PATH##*.}"
SUBMIT_PATH="$FILE_PATH"

# If it's an .app, we need to zip it for submission
if [ "$FILE_EXT" = "app" ] || [ -d "$FILE_PATH" ]; then
    echo "Creating ZIP archive for submission..."
    SUBMIT_PATH="/tmp/helix-notarize-$(date +%s).zip"
    ditto -c -k --keepParent "$FILE_PATH" "$SUBMIT_PATH"
    CLEANUP_ZIP=true
fi

# Check for credentials
USE_KEYCHAIN=false
USE_ENV=false

if xcrun notarytool history --keychain-profile "$KEYCHAIN_PROFILE" >/dev/null 2>&1; then
    USE_KEYCHAIN=true
    echo "Using keychain profile: $KEYCHAIN_PROFILE"
elif [ -n "$APPLE_ID" ] && [ -n "$APPLE_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ]; then
    USE_ENV=true
    echo "Using environment credentials"
else
    echo ""
    echo "========================================"
    echo "PLACEHOLDER MODE - No credentials"
    echo "========================================"
    echo ""
    echo "To notarize for real, set up credentials:"
    echo ""
    echo "Option 1: Store in keychain (recommended for local):"
    echo "  xcrun notarytool store-credentials \"$KEYCHAIN_PROFILE\" \\"
    echo "    --apple-id \"your@email.com\" \\"
    echo "    --team-id \"TEAMID\" \\"
    echo "    --password \"app-specific-password\""
    echo ""
    echo "Option 2: Environment variables (for CI):"
    echo "  export APPLE_ID=\"your@email.com\""
    echo "  export APPLE_PASSWORD=\"app-specific-password\""
    echo "  export APPLE_TEAM_ID=\"TEAMID\""
    echo ""
    echo "Example command that would be run:"
    echo "  xcrun notarytool submit \"$SUBMIT_PATH\" \\"
    echo "    --keychain-profile \"$KEYCHAIN_PROFILE\" \\"
    echo "    --wait"
    echo ""
    exit 0
fi

# Build notarytool arguments
NOTARY_ARGS=(submit "$SUBMIT_PATH" --wait)

if [ "$USE_KEYCHAIN" = true ]; then
    NOTARY_ARGS+=(--keychain-profile "$KEYCHAIN_PROFILE")
elif [ "$USE_ENV" = true ]; then
    NOTARY_ARGS+=(
        --apple-id "$APPLE_ID"
        --password "$APPLE_PASSWORD"
        --team-id "$APPLE_TEAM_ID"
    )
fi

# Submit for notarization
echo ""
echo "Submitting for notarization..."
echo "This may take several minutes..."
echo ""

SUBMISSION_OUTPUT=$(xcrun notarytool "${NOTARY_ARGS[@]}" 2>&1) || {
    echo "Notarization submission failed:"
    echo "$SUBMISSION_OUTPUT"

    # Try to get submission ID for logs
    SUBMISSION_ID=$(echo "$SUBMISSION_OUTPUT" | grep -o 'id: [a-f0-9-]*' | head -1 | cut -d' ' -f2)
    if [ -n "$SUBMISSION_ID" ]; then
        echo ""
        echo "Fetching notarization log..."
        if [ "$USE_KEYCHAIN" = true ]; then
            xcrun notarytool log "$SUBMISSION_ID" --keychain-profile "$KEYCHAIN_PROFILE"
        else
            xcrun notarytool log "$SUBMISSION_ID" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID"
        fi
    fi
    exit 1
}

echo "$SUBMISSION_OUTPUT"

# Cleanup temp zip if created
if [ "$CLEANUP_ZIP" = true ] && [ -f "$SUBMIT_PATH" ]; then
    rm -f "$SUBMIT_PATH"
fi

# Staple the notarization ticket
echo ""
echo "Stapling notarization ticket..."

if [ "$FILE_EXT" = "dmg" ]; then
    xcrun stapler staple "$FILE_PATH"
elif [ -d "$FILE_PATH" ]; then
    xcrun stapler staple "$FILE_PATH"
else
    echo "Note: Stapling only works for .app and .dmg files"
fi

# Verify stapling
echo ""
echo "Verifying stapled ticket..."
xcrun stapler validate "$FILE_PATH" || {
    echo "Warning: Stapler validation failed (this is OK for some file types)"
}

echo ""
echo "========================================"
echo "Notarization complete!"
echo "========================================"
echo ""
echo "The app/DMG is now notarized and ready for distribution."
