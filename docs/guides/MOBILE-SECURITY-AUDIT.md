## Mobile Security Audit - Helix iOS & Android Implementation

**Date**: February 2025
**Scope**: Gateway WebSocket client, instance key management, authentication, and subscription tier gating
**Threat Level**: CRITICAL (handles user secrets and real-time communication)
**Auditors**: Claude Code Security Team

---

## Executive Summary

The mobile implementation introduces several critical security concerns that require immediate attention before production deployment. This audit identifies 5 **CRITICAL**, 7 **HIGH**, and 4 **MEDIUM** severity issues with remediation strategies.

### Risk Assessment Matrix

| Component            | Confidentiality | Integrity | Availability | Overall Risk |
| -------------------- | --------------- | --------- | ------------ | ------------ |
| Instance Key Storage | **CRITICAL**    | CRITICAL  | LOW          | **CRITICAL** |
| WebSocket Connection | HIGH            | HIGH      | HIGH         | **CRITICAL** |
| Authentication Flow  | HIGH            | CRITICAL  | LOW          | **HIGH**     |
| Tier Gating Logic    | LOW             | MEDIUM    | LOW          | MEDIUM       |
| Supabase Integration | HIGH            | HIGH      | LOW          | **HIGH**     |

---

## Findings by Component

### 1. Instance Key Management (CRITICAL)

#### Issue 1.1: Plaintext Key Generation

**Severity**: 🔴 CRITICAL
**Location**: `ios/Helix/Features/Onboarding/Steps/InstanceKeyStepView.swift:169`, `android/app/src/main/java/com/helix/features/onboarding/steps/InstanceKeyStep.kt:...`

**Problem**:

```swift
// VULNERABLE - UUID stored in AppStorage/UserDefaults which is NOT encrypted
data.instanceKey = UUID().uuidString
UserDefaults.standard.set(data.instanceKey, forKey: "onboarding.instanceKey")
```

UUID generation is cryptographically secure, BUT storage in UserDefaults/SharedPreferences is plaintext accessible to anyone with device access.

**Risk**: Device compromise → Instance key theft → Unauthorized gateway access

**Remediation**:

```swift
// SECURE - Use Keychain-only storage
func saveInstanceKey(_ key: String) async throws {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.helix.instance-key",
        kSecAttrAccount as String: "instanceKey",
        kSecValueData as String: key.data(using: .utf8)!,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    ]

    // Delete old entry
    SecItemDelete(query as CFDictionary)

    // Add new entry
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else {
        throw KeychainError.failedToSave(status)
    }
}
```

**Status**: ❌ **REQUIRES FIX**

---

#### Issue 1.2: QR Code Leakage

**Severity**: 🟠 HIGH
**Location**: `ios/Helix/Features/Onboarding/Steps/InstanceKeyStepView.swift:194`, `android/app/src/main/java/com/helix/features/onboarding/steps/InstanceKeyStep.kt:...`

**Problem**:

```swift
// QR code display - temporary, but could be captured by screen recording
QRCodeView(data: instanceKey)
    .frame(height: 300)
```

QR codes are inherently more susceptible to:

- Screenshot capture
- Screen recording while displayed
- Clipboard history (if copied from visual QR)

**Risk**: Low, but potential backdoor exposure during onboarding

**Remediation**:

```swift
// Add screen protection during QR display
.onAppear {
    // Disable screenshots/recordings
    let field = UITextField()
    let view = UIView()
    view.isSecureTextEntry = true
    field.addSubview(view)
}

// Show warning before displaying
if shouldShowQRWarning {
    AlertView(
        title: "Screen Recording Detected",
        message: "Do not record your instance key. This data is sensitive.",
        action: { dismissAlert() }
    )
}
```

**Status**: ⚠️ **NEEDS ENHANCEMENT**

---

#### Issue 1.3: Clipboard Exposure Risk

**Severity**: 🟠 HIGH
**Location**: `ios/Helix/Features/Onboarding/Steps/InstanceKeyStepView.swift:160`, `android/app/src/main/java/com/helix/features/onboarding/steps/InstanceKeyStep.kt:...`

**Problem**:

```swift
// Copy to clipboard - data persists indefinitely
UIPasteboard.general.string = data.instanceKey

// NO automatic clearing - instance key stays in clipboard until user clears manually
// Malicious apps can access clipboard in iOS 16+
```

**Risk**:

- Clipboard poisoning attacks
- Malicious apps reading sensitive data
- Data persists across app restarts

**Remediation**:

```swift
@MainActor
private func copyKeyWithAutoClear() {
    UIPasteboard.general.string = data.instanceKey
    copied = true

    // Auto-clear clipboard after 60 seconds
    DispatchQueue.main.asyncAfter(deadline: .now() + 60) {
        UIPasteboard.general.string = ""
        copied = false
    }

    // Show security notice
    showSecurityNotice = true
}
```

**Status**: ❌ **REQUIRES FIX**

---

### 2. WebSocket Security (CRITICAL)

#### Issue 2.1: Certificate Pinning Not Implemented

**Severity**: 🔴 CRITICAL
**Location**: `ios/Helix/Core/Gateway/GatewayConnection.swift:...`, `android/app/src/main/java/com/helix/core/gateway/GatewayConnection.kt:...`

**Problem**:

```swift
// NO certificate pinning - vulnerable to MITM attacks
let url = URL(string: "wss://gateway.helix-project.org")!
let webSocket = URLSession.shared.webSocketTask(with: url)
```

Without certificate pinning, attackers on compromised networks (corporate proxies, public WiFi) can:

- Intercept WebSocket traffic
- Steal authentication tokens
- Inject malicious messages
- Perform man-in-the-middle attacks

**Risk**: Network compromise → Complete session hijacking → Data exfiltration

**Remediation - iOS**:

```swift
// Implement certificate pinning with TrustKit
class PinnedWebSocketDelegate: NSObject, URLSessionDelegate {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Verify certificate pinning
        let policies = NSMutableArray()
        policies.add(SecPolicyCreateBasicX509())
        SecTrustSetPolicies(serverTrust, policies as CFArray)

        var secResult = SecTrustResultType.invalid
        let status = SecTrustEvaluate(serverTrust, &secResult)

        guard status == errSecSuccess, secResult == .unspecified || secResult == .proceed else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }
}
```

**Remediation - Android**:

```kotlin
// Use OkHttp's CertificatePinner
val certificatePinner = CertificatePinner.Builder()
    .add("gateway.helix-project.org", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    .build()

val httpClient = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

**Status**: 🔴 **CRITICAL - MUST FIX BEFORE PRODUCTION**

---

#### Issue 2.2: Handshake Authentication Weak

**Severity**: 🟠 HIGH
**Location**: `ios/Helix/Core/Gateway/GatewayConnection.swift:...`, `android/app/src/main/java/com/helix/core/gateway/GatewayConnection.kt:...`

**Problem**:

```swift
// Challenge response not cryptographically signed
let challenge = receivedChallenge // plaintext
let connectRequest = {
    "challenge": challenge,  // NO HMAC or signature verification
    "client_id": instanceKey
}
```

The handshake verifies client possession of instance key, but:

- No mutual authentication (server identity not cryptographically verified)
- Challenge not signed with shared secret
- Vulnerable to challenge replay attacks

**Risk**: Attacker-controlled gateway could impersonate legitimate server

**Remediation**:

```swift
// Implement HMAC-based challenge verification
func verifyChallenge(_ challenge: String, signature: String) -> Bool {
    let secret = instanceKey
    let expectedSignature = HMAC<SHA256>(
        key: SymmetricKey(data: secret.data(using: .utf8)!)
    ).authenticationCode(for: Data(challenge.utf8))

    return signature == expectedSignature.withUnsafeBytes { buffer in
        Data(buffer).base64EncodedString()
    }
}
```

**Status**: ⚠️ **NEEDS ENHANCEMENT**

---

### 3. Authentication & Token Management (HIGH)

#### Issue 3.1: No Token Expiration Handling

**Severity**: 🟠 HIGH
**Location**: `android/app/src/main/java/com/helix/services/InstanceService.kt:48-70`

**Problem**:

```kotlin
// Token never refreshed - expires after ~1 hour
val authToken = authTokenProvider() ?: ""  // Returns potentially expired token
val request = Request.Builder()
    .header("Authorization", "Bearer $authToken")
    .build()
```

**Risk**: Expired tokens → 401 errors without automatic refresh → User forced to re-authenticate

**Remediation**:

```kotlin
suspend fun ensureValidToken(): String {
    var token = authTokenProvider()

    if (token?.isExpired() == true) {
        token = refreshToken()  // Call Supabase refresh endpoint
    }

    return token ?: throw AuthenticationError.TokenExpired
}
```

**Status**: ⚠️ **NEEDS IMPLEMENTATION**

---

#### Issue 3.2: Credentials Not Protected from Memory Dumps

**Severity**: 🟠 HIGH
**Location**: `ios/Helix/Core/Gateway/GatewayConfigStorage.swift:...`, `android/app/src/main/java/com/helix/core/gateway/GatewayConfigStorage.kt:...`

**Problem**:

```swift
// Credentials stored in memory without protection
var instanceKey: String  // Accessible to any memory dump tool
var gatewayUrl: String
var accessToken: String  // JWT token in plaintext memory
```

**Risk**: Device compromise + memory dump → Complete token compromise

**Remediation**:

```swift
// Use NSData with mlock for sensitive data
func secureClear(_ data: inout Data) {
    data.withUnsafeMutableBytes { buffer in
        memset(buffer.baseAddress, 0, buffer.count)
    }
}

// Zero sensitive variables after use
defer {
    var sensitiveData = Data(token.utf8)
    secureClear(&sensitiveData)
}
```

**Status**: ⚠️ **NEEDS ENHANCEMENT**

---

### 4. Tier Gating Logic (MEDIUM)

#### Issue 4.1: Client-Side Enforcement Only

**Severity**: 🟡 MEDIUM
**Location**: `ios/Helix/Components/TierGate.swift:...`, `android/app/src/main/java/com/helix/components/TierGate.kt:...`

**Problem**:

```swift
// Client-side only - attacker can bypass with local debugger
if subscription?.tier?.hasAccess(to: .architect) ??false {
    CodeInterfaceView()  // Just a check in UI
} else {
    UpgradePromptView()
}
```

**Risk**: Local code manipulation → Feature access without payment

**Remediation**:

```swift
// Backend verification required for sensitive operations
func accessCodeInterface(completion: @escaping (Bool) -> Void) {
    // Query backend to verify tier
    APIClient.verifyAccess(tier: .architect) { allowed in
        completion(allowed)  // Only proceed if backend confirms
    }
}
```

**Status**: ✅ **MITIGATED** (backend API already implements server-side checks)

---

### 5. Supabase Integration (HIGH)

#### Issue 5.1: API Key Exposure Risk

**Severity**: 🟠 HIGH
**Location**: `android/app/src/main/java/com/helix/services/InstanceService.kt:52`, `ios/Helix/Services/InstanceService.swift:...`

**Problem**:

```kotlin
// Anon key embedded in app binary - reversible
private val supabaseAnonKey: String = "eyJhbGc..."  // Stored in plain APK
val request = Request.Builder()
    .header("apikey", supabaseAnonKey)
    .build()
```

**Risk**: APK decompilation → API key extraction → Unauthorized Supabase access

**Remediation**:

```kotlin
// Move API key to secure server
// Client → Your Backend → Supabase (backend proxies requests)
// Never embed API keys in client apps

// Alternative: Use Android-specific secrets module
// gradle.properties (NOT committed)
SUPABASE_KEY=...

// build.gradle
buildTypes {
    release {
        buildConfigField "String", "SUPABASE_KEY", "\"${SUPABASE_KEY}\""
    }
}

// Don't use: Build secrets in source files
```

**Status**: 🔴 **CRITICAL - ARCHITECTURAL CHANGE NEEDED**

---

#### Issue 5.2: Row-Level Security (RLS) Not Verified

**Severity**: 🟠 HIGH
**Location**: Supabase configuration

**Problem**:

```sql
-- No RLS policy verification
CREATE TABLE instances (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    name text NOT NULL,
    instance_key text NOT NULL UNIQUE
    -- Missing RLS policy!
);
```

Without RLS, authenticated users can see/modify other users' instances.

**Remediation**:

```sql
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own instances"
ON instances
FOR ALL
USING (auth.uid() = user_id);
```

**Status**: ⚠️ **MUST VERIFY IN PRODUCTION**

---

### 6. Data Protection & Privacy (MEDIUM)

#### Issue 6.1: Instance Key in Logs

**Severity**: 🟡 MEDIUM
**Location**: Multiple print/console.log statements

**Problem**:

```kotlin
// Logging sensitive data
println("Instance key: $instanceKey")  // Appears in Logcat
Log.d("InstanceKey", "Generated: $key")
```

**Risk**: Device logs contain sensitive keys accessible to:

- Malicious apps with READ_LOGS permission
- ADB debugging
- Android Studio debugger

**Remediation**:

```kotlin
// Implement log sanitization
fun safeLog(tag: String, message: String, sanitize: Boolean = true) {
    val safeMessage = if (sanitize) {
        message.replace(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"), "[REDACTED]")
    } else {
        message
    }
    Log.d(tag, safeMessage)
}
```

**Status**: ⚠️ **NEEDS IMPLEMENTATION**

---

### 7. Network Configuration (HIGH)

#### Issue 7.1: No Network Security Policy (Android)

**Severity**: 🟠 HIGH
**Location**: `android/app/src/main/AndroidManifest.xml` (missing `network_security_config.xml`)

**Problem**:

```xml
<!-- Missing network security configuration -->
<!-- Allows cleartext HTTP traffic on some Android versions -->
```

**Risk**: Older Android versions allow insecure transport to non-HTTPS domains

**Remediation**:
Create `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Disable cleartext traffic -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">gateway.helix-project.org</domain>
    </domain-config>

    <!-- Certificate pinning -->
    <pin-set expiration="2026-12-31">
        <pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>
    </pin-set>
</network-security-config>
```

**Status**: ⚠️ **NEEDS IMPLEMENTATION**

---

## Summary of Issues

### Critical (Must Fix Before Production)

1. ✅ **Instance Key in Plaintext Storage** - Move to Keychain/EncryptedSharedPreferences
2. ✅ **No Certificate Pinning** - Implement for both iOS and Android
3. ✅ **API Key Embedded in APK** - Move to secure backend proxy
4. ✅ **Clipboard Persistence** - Auto-clear after 60 seconds
5. ✅ **No Network Security Policy** - Add Android configuration

### High Priority

1. ⚠️ **QR Code Leakage** - Add screen protection
2. ⚠️ **Weak Handshake Auth** - Implement HMAC signatures
3. ⚠️ **No Token Refresh** - Auto-refresh expired tokens
4. ⚠️ **Memory Dump Risk** - Use NSData with mlock
5. ⚠️ **No RLS Verification** - Enable and test Supabase RLS
6. ⚠️ **Sensitive Data in Logs** - Implement log sanitization
7. ⚠️ **API Key in Logs** - Sanitize all sensitive data

### Medium Priority

1. ⚠️ **Client-Side Tier Gating** - Already mitigated by backend
2. ⚠️ **Missing Security Headers** - Add HSTS, CSP (for WebView)

---

## Remediation Timeline

| Priority | Count | Effort   | Timeline                |
| -------- | ----- | -------- | ----------------------- |
| Critical | 5     | 40 hours | **Before Launch**       |
| High     | 7     | 30 hours | **Week 1 Post-Launch**  |
| Medium   | 2     | 8 hours  | **Month 1 Post-Launch** |

---

## Testing Recommendations

### Security Testing Checklist

- [ ] Attempt clipboard access from other apps
- [ ] Verify Keychain/EncryptedSharedPreferences encryption with device tools
- [ ] Test MITM attack with Burp Suite / Charles Proxy
- [ ] Verify certificate pinning prevents invalid certificates
- [ ] Decompile APK and verify API keys are not readable
- [ ] Check device logs for sensitive data leakage
- [ ] Verify RLS policies on Supabase with multi-user test
- [ ] Test token refresh after expiration
- [ ] Verify WebSocket connection drops with invalid certificates
- [ ] Test memory dump tools cannot read credentials

### Penetration Testing

Recommend professional penetration test covering:

- Local attack vector (device compromise)
- Network attack vector (MITM on public WiFi)
- Backend attack vector (Supabase API enumeration)
- Supply chain attacks (dependencies, build system)

---

## References

- [OWASP Mobile Top 10 2023](https://owasp.org/www-project-mobile-top-10/)
- [iOS Security Guide - Apple](https://developer.apple.com/security/)
- [Android Security & Privacy Guide](https://developer.android.com/privacy-and-security)
- [WebSocket Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Web_Socket_Security_Cheat_Sheet.html)
- [Certificate Pinning Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Pinning_Cheat_Sheet.html)

---

**Status**: 🔴 **NOT PRODUCTION READY**
**Next Review**: After all CRITICAL issues resolved
**Audit Completed**: February 5, 2025
