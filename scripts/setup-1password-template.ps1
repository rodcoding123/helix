# 1Password Setup Script - TEMPLATE
# This script creates the Helix vault and adds secrets from environment variables
# NEVER hardcode secrets in this script - they come from .env or 1Password itself
#
# Usage:
#   1. Ensure .env file is loaded with all secrets
#   2. Authenticate: op account add
#   3. Run: .\scripts\setup-1password-template.ps1
#
# Required Environment Variables (from .env or .env.local):
#   - SUPABASE_SERVICE_ROLE (JWT token)
#   - SUPABASE_ANON_KEY (JWT token)
#   - STRIPE_SECRET_KEY (sk_live_...)
#   - STRIPE_PUBLISHABLE_KEY (pk_live_...)
#   - DEEPSEEK_API_KEY (sk-...)
#   - GEMINI_API_KEY (AIzaSy...)
#   - DISCORD_WEBHOOK_COMMANDS (full webhook URL)
#   - DISCORD_WEBHOOK_API (full webhook URL)
#   - DISCORD_WEBHOOK_HEARTBEAT (full webhook URL)
#   - DISCORD_WEBHOOK_ALERTS (full webhook URL)
#   - DISCORD_WEBHOOK_CONSCIOUSNESS (full webhook URL)
#   - DISCORD_WEBHOOK_FILE_CHANGES (full webhook URL)
#   - DISCORD_WEBHOOK_HASH_CHAIN (full webhook URL)

Write-Host "1Password Setup Script - Helix Vault" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify op CLI
Write-Host "Step 1: Checking 1Password CLI..." -ForegroundColor Yellow
try {
    $opVersion = op --version 2>$null
    Write-Host "✓ 1Password CLI found: $opVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 1Password CLI not found. Install from: https://1password.com/downloads/command-line-tools/" -ForegroundColor Red
    exit 1
}

# 2. Verify authentication
Write-Host "Step 2: Checking authentication..." -ForegroundColor Yellow
try {
    $whoami = op whoami 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Authenticated as: $whoami" -ForegroundColor Green
    } else {
        throw "Not authenticated"
    }
} catch {
    Write-Host "✗ Not authenticated. Run: op account add" -ForegroundColor Red
    exit 1
}

# 3. Create vault
Write-Host "Step 3: Creating Helix vault..." -ForegroundColor Yellow
op vault create Helix --allow-duplicate 2>$null
Write-Host "✓ Vault ready" -ForegroundColor Green

# 4. Load and validate environment variables
Write-Host "Step 4: Loading secrets from environment..." -ForegroundColor Yellow

$secrets = @{
    "Supabase Service Role" = $env:SUPABASE_SERVICE_ROLE
    "Supabase Anon Key" = $env:SUPABASE_ANON_KEY
    "Stripe Secret Key" = $env:STRIPE_SECRET_KEY
    "Stripe Publishable Key" = $env:STRIPE_PUBLISHABLE_KEY
    "DeepSeek API Key" = $env:DEEPSEEK_API_KEY
    "Gemini API Key" = $env:GEMINI_API_KEY
    "Discord Webhook - Commands" = $env:DISCORD_WEBHOOK_COMMANDS
    "Discord Webhook - API" = $env:DISCORD_WEBHOOK_API
    "Discord Webhook - Heartbeat" = $env:DISCORD_WEBHOOK_HEARTBEAT
    "Discord Webhook - Alerts" = $env:DISCORD_WEBHOOK_ALERTS
    "Discord Webhook - Consciousness" = $env:DISCORD_WEBHOOK_CONSCIOUSNESS
    "Discord Webhook - File Changes" = $env:DISCORD_WEBHOOK_FILE_CHANGES
    "Discord Webhook - Hash Chain" = $env:DISCORD_WEBHOOK_HASH_CHAIN
}

$missingSecrets = @()
foreach ($key in $secrets.Keys) {
    if ([string]::IsNullOrEmpty($secrets[$key])) {
        $missingSecrets += $key
    }
}

if ($missingSecrets.Count -gt 0) {
    Write-Host "✗ Missing environment variables:" -ForegroundColor Red
    foreach ($secret in $missingSecrets) {
        Write-Host "  - $secret" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please set these in your .env file and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ All secrets loaded" -ForegroundColor Green

# 5. Add secrets to 1Password
Write-Host "Step 5: Adding secrets to Helix vault..." -ForegroundColor Yellow
Write-Host ""

$urlMap = @{
    "Supabase Service Role" = "https://supabase.co"
    "Supabase Anon Key" = "https://supabase.co"
    "Stripe Secret Key" = "https://stripe.com"
    "Stripe Publishable Key" = "https://stripe.com"
    "DeepSeek API Key" = "https://platform.deepseek.com"
    "Gemini API Key" = "https://makersuite.google.com"
}

# API Keys (stored as login items with password field)
foreach ($secretName in @("Supabase Service Role", "Supabase Anon Key", "Stripe Secret Key", "Stripe Publishable Key", "DeepSeek API Key", "Gemini API Key")) {
    Write-Host "  Adding $secretName..." -NoNewline
    $url = $urlMap[$secretName]
    $secretValue = $secrets[$secretName]

    op item create --vault Helix --category login --title $secretName `
      --url $url `
      password="$secretValue" 2>$null

    Write-Host " ✓" -ForegroundColor Green
}

# Discord Webhooks (stored as secure notes to preserve full URLs)
foreach ($webhookName in @("Discord Webhook - Commands", "Discord Webhook - API", "Discord Webhook - Heartbeat", "Discord Webhook - Alerts", "Discord Webhook - Consciousness", "Discord Webhook - File Changes", "Discord Webhook - Hash Chain")) {
    Write-Host "  Adding $webhookName..." -NoNewline
    $webhookValue = $secrets[$webhookName]

    op item create --vault Helix --category secure-note --title $webhookName `
      --notes "$webhookValue" 2>$null

    Write-Host " ✓" -ForegroundColor Green
}

Write-Host ""
Write-Host "✓ All secrets added to Helix vault!" -ForegroundColor Green
Write-Host ""

# 6. Verify
Write-Host "Step 6: Verifying vault contents..." -ForegroundColor Yellow
$vaultItems = op item list --vault Helix --format=json 2>$null | ConvertFrom-Json
Write-Host "✓ Helix vault contains $($vaultItems.Count) items" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify secrets loaded: npx ts-node scripts/verify-1password.ts" -ForegroundColor Cyan
Write-Host "  2. Start your app: npm run dev" -ForegroundColor Cyan
Write-Host ""
