# Code Signing Setup for Helix Desktop

## Required GitHub Secrets

Add these secrets to your repository at: `Settings > Secrets and variables > Actions`

### Windows (EV Code Signing Certificate)

| Secret Name | Description |
|-------------|-------------|
| `WINDOWS_CERTIFICATE` | Base64-encoded .pfx certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the .pfx file |

**To encode your certificate:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Out-File -FilePath certificate-base64.txt
```

**Certificate providers:**
- DigiCert (~$400/year for EV)
- Sectigo (~$300/year for EV)
- SSL.com (~$250/year for EV)

### macOS (Apple Developer ID)

| Secret Name | Description |
|-------------|-------------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password (not your Apple ID password) |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID |

**To create app-specific password:**
1. Go to https://appleid.apple.com
2. Security > App-Specific Passwords > Generate

**To export certificate:**
1. Open Keychain Access
2. Find "Developer ID Application" certificate
3. Right-click > Export > Save as .p12

**To encode:**
```bash
base64 -i certificate.p12 -o certificate-base64.txt
```

### Linux

Linux packages don't require signing for distribution, but you can optionally sign with GPG:

| Secret Name | Description |
|-------------|-------------|
| `GPG_PRIVATE_KEY` | ASCII-armored GPG private key |
| `GPG_PASSPHRASE` | Passphrase for the GPG key |

## Tauri Updater Keys

For auto-updates, you need a signing keypair:

```bash
# Generate keys (run once, save securely)
npx @tauri-apps/cli signer generate -w ~/.tauri/helix.key
```

| Secret Name | Description |
|-------------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of ~/.tauri/helix.key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used when generating |

Add the public key to `tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

## Quick Start (No Signing)

For testing without code signing:

1. **Windows**: Builds will show "Unknown Publisher" warning
2. **macOS**: Users must right-click > Open to bypass Gatekeeper
3. **Linux**: Works without signing

To build unsigned:
```bash
npm run tauri build
```

## Verification

After setting secrets, verify they're available:
```yaml
# In your workflow
- name: Check Secrets
  run: |
    echo "Windows cert exists: ${{ secrets.WINDOWS_CERTIFICATE != '' }}"
    echo "Apple cert exists: ${{ secrets.APPLE_CERTIFICATE != '' }}"
```
