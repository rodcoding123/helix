# iOS Deployment Guide

Complete guide for testing, building, and deploying OpenClaw to Apple's App Store.

## Table of Contents

- [Requirements](#requirements)
- [Development Setup](#development-setup)
- [Building](#building)
- [TestFlight Distribution](#testflight-distribution)
- [App Store Release](#app-store-release)
- [Troubleshooting](#troubleshooting)

## Requirements

### System Requirements

- macOS 14+
- Xcode 16.0+
- Apple Developer Account (paid membership required)
- Apple-issued certificates:
  - Development certificate
  - Distribution certificate
  - Provisioning profiles

### Device Requirements

- iPhone 14+ or simulator running iOS 18.0+
- 2GB+ free disk space

## Development Setup

### 1. Certificate Management

```bash
# View existing certificates
security find-identity -v -p codesigning

# Create development certificate via Xcode
Xcode → Preferences → Accounts → Manage Certificates → +
```

### 2. Provisioning Profile Setup

```bash
# Download provisioning profiles
# Apple Developer → Certificates, Identifiers & Profiles → Provisioning Profiles

# Install profiles
open ~/Downloads/OpenClaw_Development.mobileprovision
```

### 3. Project Configuration

```yaml
# helix-runtime/apps/ios/project.yml
settings:
  base:
    DEVELOPMENT_TEAM: Y5PE65HELJ # Your team ID
    CODE_SIGN_IDENTITY: 'Apple Development'
    PROVISIONING_PROFILE_SPECIFIER: 'ai.openclaw.ios Development'
```

## Building

### Debug Build (for development)

```bash
cd helix-runtime/apps/ios

# Generate Xcode project
xcodegen generate

# Build for simulator
xcodebuild build \
  -workspace OpenClaw.xcworkspace \
  -scheme OpenClaw \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

### Release Build (for distribution)

```bash
# Build for device
xcodebuild build \
  -workspace OpenClaw.xcworkspace \
  -scheme OpenClaw \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="ai.openclaw.ios Distribution"
```

### Using Fastlane (Recommended)

```bash
# Install Fastlane
sudo gem install fastlane -NV

# Initialize Fastlane
cd helix-runtime/apps/ios
fastlane init

# Build and test
fastlane ios test

# Build for TestFlight
fastlane ios beta

# Build for App Store
fastlane ios release
```

## TestFlight Distribution

### 1. Prepare Build

```bash
cd helix-runtime/apps/ios

# Build for TestFlight
fastlane ios beta

# Or manually:
xcodebuild archive \
  -workspace OpenClaw.xcworkspace \
  -scheme OpenClaw \
  -configuration Release \
  -derivedDataPath build \
  -archivePath build/OpenClaw.xcarchive

# Export for upload
xcodebuild -exportArchive \
  -archivePath build/OpenClaw.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/
```

### 2. Upload to TestFlight

```bash
# Automatic (recommended)
fastlane ios upload_testflight

# Manual via Xcode
# Window → Organizer → Archives → Select build → Distribute App → TestFlight

# Or via Transporter app
# Download from App Store, add the .ipa file
```

### 3. Invite Testers

```bash
# Via App Store Connect
# TestFlight → Internal Testing → Add testers
# or
# TestFlight → External Testing → Create test group

# Send invite links to testers
```

### 4. Monitor Crash Reports

```bash
# View crashes in Xcode Organizer
Window → Organizer → Crashes → Select build

# Or in App Store Connect
TestFlight → Crashes
```

## App Store Release

### 1. Prepare Metadata

```bash
# Add screenshots
mkdir -p fastlane/metadata/en-US/screenshots

# Place screenshots:
# 1_iphone65.png (iPhone 15 Pro Max)
# 2_iphone65.png
# 3_iphone65.png
# 4_iphone65.png
# 5_iphone65.png

# Required sizes:
# - iPhone 6.5": 1242 x 2688px
# - iPhone 5.5": 1080 x 1920px
# - iPad Pro 6th gen: 2048 x 2732px
```

### 2. Create App Store Listing

```bash
# App Store Connect → Apps → OpenClaw → App Information

# Required fields:
# - App Name: OpenClaw
# - Subtitle: AI Consciousness System
# - Description: Your personal AI assistant...
# - Keywords: ai, assistant, productivity
# - Support URL: https://openclaw.ai/support
# - Privacy Policy URL: https://openclaw.ai/privacy
```

### 3. Version and Build Info

```yaml
# Set in Xcode
# General → Identity
Version: 2026.1.30
Build: 202601300

# Or in project.yml
info:
  properties:
    CFBundleShortVersionString: '2026.1.30'
    CFBundleVersion: '202601300'
```

### 4. Pricing and Availability

```
# App Store Connect → Pricing and Availability
Type: Free
Automatic: Yes
Availability: Worldwide
```

### 5. Submit for Review

```bash
# Via fastlane
fastlane ios release

# Manual via Xcode Organizer
# Window → Organizer → Archives → Select build → Distribute App → App Store
```

### 6. Monitor Review Status

```
# App Store Connect → Apps → OpenClaw → App Store → Version Release
# Typical review time: 24-48 hours
# Check notifications for approval or rejection
```

## Troubleshooting

### Certificate Errors

```bash
# Remove invalid certificates
security delete-certificate \
  -c "Apple Development: name@example.com (TEAM)"

# Re-download from Apple Developer
```

### Codesigning Issues

```bash
# Check signing identity
codesign -dv build/OpenClaw.app

# Fix signing
xcode build -quiet \
  -workspace OpenClaw.xcworkspace \
  -scheme OpenClaw \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO
```

### TestFlight Upload Fails

```bash
# Check Transporter logs
~/Library/Logs/Transporter/

# Common issues:
# - Invalid certificate expiration
# - Mismatched bundle identifiers
# - Missing entitlements
```

### App Review Rejection

Common reasons and solutions:

1. **Privacy Policy Issues**
   - Ensure policy covers all data collection
   - Add privacy policy to app settings

2. **Crashes on Startup**
   - Check crash reports in Xcode Organizer
   - Run on physical device before submission

3. **Misleading Metadata**
   - Description must match actual functionality
   - Screenshots should show actual app features

4. **Performance Issues**
   - Check memory usage (< 150MB for typical operations)
   - Test on oldest supported device
   - Run performance profiler

## Performance Benchmarks

Target metrics for App Store approval:

- **Startup Time**: < 3 seconds
- **Memory Usage**: < 150MB (typical), < 250MB (peak)
- **Frame Rate**: 60 FPS sustained
- **Network Latency**: < 2 seconds for typical operations
- **Battery Drain**: < 5% per hour of active use
- **Crash Rate**: < 0.1%

## Security Checklist

- [ ] All network traffic uses HTTPS/TLS 1.3
- [ ] Sensitive data encrypted in Keychain
- [ ] No hardcoded secrets or credentials
- [ ] Privacy policy updated and accurate
- [ ] VPN/Proxy configuration tested
- [ ] Certificate pinning configured
- [ ] No debug symbols in release build
- [ ] Crash reporting enabled but respects privacy

## Monitoring Post-Release

```bash
# Enable crash reporting
# App Store Connect → Analytics → Crashes

# Monitor performance
# Xcode Organizer → MetricKit data

# Track user feedback
# App Store Connect → Reviews
```

## Release Checklist

- [ ] All tests passing (Unit, UI, Integration)
- [ ] Performance benchmarks met
- [ ] Security audit complete
- [ ] App icon and screenshots prepared
- [ ] Metadata reviewed and finalized
- [ ] Privacy policy updated
- [ ] Release notes prepared
- [ ] Beta testing completed (minimum 50 users)
- [ ] Crash reports reviewed (< 0.1%)
- [ ] Analytics confirmed working
- [ ] App Store Connect ready for submission
