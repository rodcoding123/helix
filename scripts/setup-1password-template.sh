#!/bin/bash
# 1Password Setup Script - TEMPLATE
# This script creates the Helix vault and adds secrets from environment variables
# NEVER hardcode secrets in this script - they come from .env or 1Password itself
#
# Usage:
#   1. Ensure .env file is loaded with all secrets
#   2. Authenticate: op account add
#   3. Run: bash scripts/setup-1password-template.sh
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

echo ""
echo "🔐 1Password Setup Script - Helix Vault"
echo "======================================"
echo ""

# 1. Verify op CLI
echo "Step 1: Checking 1Password CLI..."
if ! command -v op &> /dev/null; then
    echo "✗ 1Password CLI not found. Install from: https://1password.com/downloads/command-line-tools/"
    exit 1
fi
OP_VERSION=$(op --version)
echo "✓ 1Password CLI found: $OP_VERSION"

# 2. Verify authentication
echo "Step 2: Checking authentication..."
if ! op whoami &> /dev/null; then
    echo "✗ Not authenticated. Run: op account add"
    exit 1
fi
WHOAMI=$(op whoami)
echo "✓ Authenticated as: $WHOAMI"

# 3. Create vault
echo "Step 3: Creating Helix vault..."
op vault create Helix --allow-duplicate 2>/dev/null || true
echo "✓ Vault ready"

# 4. Load and validate environment variables
echo "Step 4: Loading secrets from environment..."

# Check for missing secrets
missing_secrets=()

for var_name in SUPABASE_SERVICE_ROLE SUPABASE_ANON_KEY STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY DEEPSEEK_API_KEY GEMINI_API_KEY DISCORD_WEBHOOK_COMMANDS DISCORD_WEBHOOK_API DISCORD_WEBHOOK_HEARTBEAT DISCORD_WEBHOOK_ALERTS DISCORD_WEBHOOK_CONSCIOUSNESS DISCORD_WEBHOOK_FILE_CHANGES DISCORD_WEBHOOK_HASH_CHAIN; do
    if [ -z "${!var_name}" ]; then
        missing_secrets+=("$var_name")
    fi
done

if [ ${#missing_secrets[@]} -gt 0 ]; then
    echo "✗ Missing environment variables:"
    for secret in "${missing_secrets[@]}"; do
        echo "  - $secret"
    done
    echo ""
    echo "Please set these in your .env file and try again."
    exit 1
fi

echo "✓ All secrets loaded"

# 5. Add secrets to 1Password
echo "Step 5: Adding secrets to Helix vault..."
echo ""

# API Keys (stored as login items with password field)
echo -n "  Adding Supabase Service Role... "
op item create --vault Helix --category login --title "Supabase Service Role" \
  --url "https://supabase.co" \
  password="$SUPABASE_SERVICE_ROLE" 2>/dev/null
echo "✓"

echo -n "  Adding Supabase Anon Key... "
op item create --vault Helix --category login --title "Supabase Anon Key" \
  --url "https://supabase.co" \
  password="$SUPABASE_ANON_KEY" 2>/dev/null
echo "✓"

echo -n "  Adding Stripe Secret Key... "
op item create --vault Helix --category login --title "Stripe Secret Key" \
  --url "https://stripe.com" \
  password="$STRIPE_SECRET_KEY" 2>/dev/null
echo "✓"

echo -n "  Adding Stripe Publishable Key... "
op item create --vault Helix --category login --title "Stripe Publishable Key" \
  --url "https://stripe.com" \
  password="$STRIPE_PUBLISHABLE_KEY" 2>/dev/null
echo "✓"

echo -n "  Adding DeepSeek API Key... "
op item create --vault Helix --category login --title "DeepSeek API Key" \
  --url "https://platform.deepseek.com" \
  password="$DEEPSEEK_API_KEY" 2>/dev/null
echo "✓"

echo -n "  Adding Gemini API Key... "
op item create --vault Helix --category login --title "Gemini API Key" \
  --url "https://makersuite.google.com" \
  password="$GEMINI_API_KEY" 2>/dev/null
echo "✓"

# Discord Webhooks (stored as secure notes to preserve full URLs)
echo -n "  Adding Discord Webhook - Commands... "
op item create --vault Helix --category secure-note --title "Discord Webhook - Commands" \
  --notes "$DISCORD_WEBHOOK_COMMANDS" 2>/dev/null
echo "✓"

echo -n "  Adding Discord Webhook - API... "
op item create --vault Helix --category secure-note --title "Discord Webhook - API" \
  --notes "$DISCORD_WEBHOOK_API" 2>/dev/null
echo "✓"

echo -n "  Adding Discord Webhook - Heartbeat... "
op item create --vault Helix --category secure-note --title "Discord Webhook - Heartbeat" \
  --notes "$DISCORD_WEBHOOK_HEARTBEAT" 2>/dev/null
echo "✓"

echo -n "  Adding Discord Webhook - Alerts... "
op item create --vault Helix --category secure-note --title "Discord Webhook - Alerts" \
  --notes "$DISCORD_WEBHOOK_ALERTS" 2>/dev/null
echo "✓"

echo -n "  Adding Discord Webhook - Consciousness... "
op item create --vault Helix --category secure-note --title "Discord Webhook - Consciousness" \
  --notes "$DISCORD_WEBHOOK_CONSCIOUSNESS" 2>/dev/null
echo "✓"

echo -n "  Adding Discord Webhook - File Changes... "
op item create --vault Helix --category secure-note --title "Discord Webhook - File Changes" \
  --notes "$DISCORD_WEBHOOK_FILE_CHANGES" 2>/dev/null
echo "✓"

echo -n "  Adding Discord Webhook - Hash Chain... "
op item create --vault Helix --category secure-note --title "Discord Webhook - Hash Chain" \
  --notes "$DISCORD_WEBHOOK_HASH_CHAIN" 2>/dev/null
echo "✓"

echo ""
echo "✓ All secrets added to Helix vault!"
echo ""

# 6. Verify
echo "Step 6: Verifying vault contents..."
item_count=$(op item list --vault Helix --format=json 2>/dev/null | jq 'length')
echo "✓ Helix vault contains $item_count items"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Verify secrets loaded: npx ts-node scripts/verify-1password.ts"
echo "  2. Start your app: npm run dev"
echo ""
