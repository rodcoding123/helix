# App Store & Google Play Release Guide

Complete guide for submitting OpenClaw to Apple App Store and Google Play Store.

## Prerequisites

### iOS

- Apple Developer Account ($99/year)
- Xcode 16.0+
- macOS 14+
- Fastlane installed: `sudo gem install fastlane -NV`

### Android

- Google Play Developer Account ($25 one-time)
- Android Studio 4.1+
- Java 17+
- Fastlane installed: `sudo gem install fastlane -NV`

## iOS Release Process

### Step 1: Prepare Credentials

Create App Store Connect API Key:

```bash
# Visit: https://appstoreconnect.apple.com/access/api
# Create new key with Admin role
# Download key and save to secure location
export ASC_KEY_PATH="/path/to/AuthKey_*.p8"
export ASC_KEY_ID="XXXXXXXXXX"
export ASC_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 2: Setup Fastlane

```bash
cd helix-runtime/apps/ios
bundle install
bundle exec fastlane ios sync_certificates
```

### Step 3: Run Tests

```bash
bundle exec fastlane ios test
```

Expected output:

```
Testing...
✅ Tests passed
```

### Step 4: Build Archive

```bash
bundle exec fastlane ios build_archive version:2026.1.30
```

Generates:

- `build/OpenClaw.xcarchive` - Xcode archive
- `build/OpenClaw.ipa` - iOS app package

### Step 5: Upload to TestFlight

```bash
bundle exec fastlane ios beta
```

This:

- Uploads IPA to TestFlight
- Sets version in App Store Connect
- Notifies internal testers

### Step 6: Internal Testing

1. Visit [App Store Connect](https://appstoreconnect.apple.com)
2. Select OpenClaw → TestFlight → Internal Testing
3. Monitor crash reports and logs
4. Test minimum 48 hours before submission

### Step 7: App Store Submission

When ready for production:

```bash
bundle exec fastlane ios release
```

This:

- Uploads IPA to App Store
- Sets metadata and screenshots
- Submits for review

Expected review time: 24-48 hours

### Step 8: Monitor Review Status

Check status in App Store Connect:

```
Apps → OpenClaw → App Store → Version Release
```

Status progression:

- **Waiting for Review** (0-24h)
- **In Review** (1-48h)
- **Approved** or **Rejected** (with feedback)

### Troubleshooting iOS

#### Certificate Expired

```bash
bundle exec fastlane ios sync_certificates
```

#### Build Failed

Check Xcode build log:

```bash
tail -100 build/Build.log
```

#### Upload Rejected

Check Transporter logs:

```bash
~/Library/Logs/Transporter/
```

Common rejection reasons:

- Missing privacy policy
- Crashes on startup
- Non-functional features
- Misleading screenshots

## Android Release Process

### Step 1: Prepare Signing Key

Create or use existing keystore:

```bash
keytool -genkey -v -keystore helix-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias helix
```

Store credentials securely:

```bash
export KEYSTORE_PATH="/path/to/helix-release.jks"
export KEYSTORE_PASSWORD="your-secure-password"
export KEY_ALIAS="helix"
export KEY_PASSWORD="your-secure-password"
```

### Step 2: Setup Fastlane

```bash
cd helix-runtime/apps/android
bundle install
bundle exec fastlane android setup
```

### Step 3: Run Tests

```bash
bundle exec fastlane android test
```

Expected output:

```
Testing...
✅ Tests passed
```

### Step 4: Build Release AAB

```bash
bundle exec fastlane android build_aab
```

Generates:

- `app/build/outputs/bundle/release/app-release.aab`

### Step 5: Upload to Internal Testing

```bash
bundle exec fastlane android internal_testing
```

### Step 6: Test in Google Play Console

1. Visit [Google Play Console](https://play.google.com/console)
2. Select OpenClaw → Releases → Internal testing
3. Invite testers by email
4. Monitor for crashes and feedback
5. Test minimum 48 hours

### Step 7: Upload to Beta Track

```bash
bundle exec fastlane android beta
```

For broader testing with real users.

### Step 8: Production Release

When ready:

```bash
bundle exec fastlane android production
```

This:

- Uploads to production track
- Sets release notes
- Stages for release

### Step 9: Monitor Rollout

In Google Play Console:

1. Apps → OpenClaw → Releases → Production
2. Check rollout percentage (typically 5% → 25% → 50% → 100%)
3. Monitor crash reports and ratings
4. Can pause rollout if issues detected

### Troubleshooting Android

#### Build Failed

Check Gradle output:

```bash
cd helix-runtime/apps/android
./gradlew bundleRelease --stacktrace
```

#### Upload Rejected

Common reasons:

- Duplicate APK version
- Signing key mismatch
- Content policy violation
- Permissions not justified

#### App Crashes

Check Google Play Console:

```
Statistics → Crashes & ANRs
```

## Release Checklist

### Before any release:

- [ ] All unit tests passing
- [ ] All E2E tests passing
- [ ] Performance benchmarks met
- [ ] Security audit complete
- [ ] Crash rate < 0.1%
- [ ] Memory usage < 150MB

### iOS Specific:

- [ ] Screenshots prepared (5+ per device)
- [ ] Metadata updated
- [ ] Privacy policy URL valid
- [ ] Support email configured
- [ ] Version number bumped
- [ ] Release notes written

### Android Specific:

- [ ] Google Play Store listing complete
- [ ] App icon and feature graphic created
- [ ] Screenshots prepared (4-8 per device)
- [ ] Privacy policy URL valid
- [ ] Version code incremented
- [ ] Release notes written

## Version Numbering

Format: `YYYY.RELEASE.PATCH`

Example: `2026.1.30`

- `2026` = year (2026)
- `1` = release cycle (1st release)
- `30` = patch number

## Release Notes Template

```
Version 2026.1.30 - February 3, 2026

What's New:
• Real-time cross-platform synchronization
• Offline access to emails, calendar, and tasks
• Advanced analytics dashboard
• Improved performance and battery efficiency

Bug Fixes:
• Fixed sync conflicts in concurrent edits
• Improved offline queue reliability
• Enhanced error handling

Improvements:
• Faster email list scrolling
• Better calendar conflict detection
• More detailed task analytics
```

## Security Checklist

- [ ] All secrets in environment variables
- [ ] No hardcoded API keys
- [ ] TLS 1.3 enforcement verified
- [ ] Certificate pinning active
- [ ] Crash reports anonymized
- [ ] User data encrypted at rest
- [ ] Compliance with App Store policies

## Post-Release Monitoring

Monitor for 24-48 hours:

- App Store Connect crash reports
- Google Play Console crash reports
- Ratings and reviews
- Support emails
- Analytics data

## Rollback Procedure

### iOS

If critical issues found:

1. App Store Connect → Version Release → Remove from Sale
2. Fix issue
3. Increment version number
4. Resubmit for review

### Android

1. Google Play Console → Production → Pause rollout
2. Fix issue
3. Increment version code
4. Upload new AAB
5. Resume/complete rollout

## Automation

Both iOS and Android releases can be automated via GitHub Actions:

```bash
# Tag a release
git tag ios/v2026.1.30
git push origin ios/v2026.1.30

# Automatically:
# 1. Runs tests
# 2. Builds archive
# 3. Uploads to TestFlight/Beta
# 4. Notifies team
```

See `.github/workflows/ios-release.yml` and `.github/workflows/android-release.yml`

## Support Contacts

- Apple App Store Review: developer.apple.com/support
- Google Play Support: support.google.com/googleplay
- Privacy & Data: see privacy policy
- Technical Issues: support@openclaw.ai
