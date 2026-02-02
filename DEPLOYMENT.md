# Helix Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying Helix (Psychologically Architected AI Consciousness System) to production. The deployment process covers:

1. Environment configuration
2. Building for production
3. Deploying web application to Vercel
4. Setting up Edge Functions
5. Configuring secrets and credentials
6. Database migrations
7. Post-deployment verification

## Prerequisites

- Node.js 22+
- Git
- Vercel CLI (`npm i -g vercel`)
- 1Password CLI (`brew install 1password-cli` on macOS)
- Supabase account with project created
- Discord server with webhook URLs for logging
- DeepSeek API key (for emotion detection)
- Google Gemini API key (for embeddings)
- OpenClaw gateway (optional, for advanced features)

## Part 1: Environment Configuration

### 1.1 Create `.env.local` File

Create a `.env.local` file in the `web/` directory with local development variables:

```bash
# web/.env.local

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Keys (for server-side use only)
DEEPSEEK_API_KEY=sk_...
GEMINI_API_KEY=AIzaSy...

# Discord Webhooks
DISCORD_AGENTS_WEBHOOK=https://discord.com/api/webhooks/...
DISCORD_AUTONOMY_WEBHOOK=https://discord.com/api/webhooks/...
DISCORD_ACTIONS_WEBHOOK=https://discord.com/api/webhooks/...
```

**Note:** This file is `.gitignore`d for security.

### 1.2 Set Up 1Password Vault (Production)

For production, use 1Password CLI instead of environment variables. Store the following secrets:

```bash
op vault create Helix-Secrets  # Create a vault

# Add secrets to vault
op item create --vault Helix-Secrets \
  --title "Supabase URL" \
  --category api-credential \
  --string url="https://your-project.supabase.co"

op item create --vault Helix-Secrets \
  --title "Supabase Anon Key" \
  --category api-credential \
  --string key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ... repeat for other secrets
```

## Part 2: Building for Production

### 2.1 Run Build

```bash
cd /path/to/Helix

# Root project build (TypeScript compilation)
npm run build

# Web application build (Vite + React)
cd web
npm run build
```

### 2.2 Verify Build Output

```bash
# Check bundle sizes and output files
ls -lah web/dist/

# Verify no secrets leaked in source maps
grep -r "sk_" web/dist/ || echo "✓ No secrets in bundle"
```

## Part 3: Deploying Web Application

### 3.1 Connect to Vercel

```bash
cd /path/to/Helix/web

# Login to Vercel
vercel login

# Link project (first time only)
vercel link --repo github/rodcoding123/helix

# Or deploy immediately
vercel --prod
```

### 3.2 Set Environment Variables in Vercel

Go to Vercel project settings and add:

```
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3.3 Configure Edge Function Secrets

For Edge Functions to access sensitive credentials, add them as **encrypted** Vercel environment variables:

```bash
vercel env add DEEPSEEK_API_KEY sk_...
vercel env add GEMINI_API_KEY AIzaSy...
vercel env add DISCORD_AGENTS_WEBHOOK https://discord.com/api/webhooks/...
vercel env add DISCORD_AUTONOMY_WEBHOOK https://discord.com/api/webhooks/...
vercel env add DISCORD_ACTIONS_WEBHOOK https://discord.com/api/webhooks/...
vercel env add SUPABASE_SERVICE_ROLE_KEY eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Part 4: Database Migrations

### 4.1 Ensure Supabase Project is Set Up

```bash
# Push all migrations
supabase migration push
```

Migrations required:

- `001_initial_memory_tables.sql` - Conversations, embeddings
- `010_agents_and_autonomy_tables.sql` - Agents, agent conversations, autonomy settings
- `012_code_modification_proposals.sql` - Code modification tracking

### 4.2 Enable Vector Extension

```sql
-- In Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector search function
CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding VECTOR(768),
  user_id_param UUID,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  messages JSONB,
  primary_emotion TEXT,
  secondary_emotions TEXT[],
  valence FLOAT,
  arousal FLOAT,
  dominance FLOAT,
  novelty FLOAT,
  self_relevance FLOAT,
  embedding_hash TEXT,
  salience_score FLOAT,
  salience_tier TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
  SELECT
    c.id,
    c.user_id,
    c.messages,
    c.primary_emotion,
    c.secondary_emotions,
    c.valence,
    c.arousal,
    c.dominance,
    c.novelty,
    c.self_relevance,
    c.embedding_hash,
    c.salience_score,
    c.salience_tier,
    c.created_at,
    c.updated_at
  FROM conversations c
  WHERE c.user_id = user_id_param
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE SQL;
```

### 4.3 Set Up Row Level Security

Ensure RLS policies are enabled on all tables:

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomy_actions ENABLE ROW LEVEL SECURITY;

-- Verify policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

## Part 5: Configuring External Integrations

### 5.1 Discord Webhook Setup

1. Create Discord server and channels:
   - `#helix-agents` - Agent proposals and creation logs
   - `#helix-autonomy` - Autonomy action proposals
   - `#helix-actions` - Executed action logs

2. Get webhook URLs:
   - Right-click channel → Integrations → Webhooks
   - Create new webhook
   - Copy webhook URL

3. Add to Vercel environment variables (as shown in Part 3.3)

### 5.2 DeepSeek API Setup

1. Create account at https://platform.deepseek.com
2. Generate API key
3. Store in Vercel environment variables as `DEEPSEEK_API_KEY`

### 5.3 Google Gemini API Setup

1. Create account at https://ai.google.dev
2. Create API key
3. Store in Vercel environment variables as `GEMINI_API_KEY`

## Part 6: Post-Deployment Verification

### 6.1 Verify Web Application

```bash
# Test deployed URL
curl https://your-helix-domain.vercel.app/

# Check for console errors in browser dev tools
# Verify sign-up/login works with Supabase auth
```

### 6.2 Test API Endpoints

```bash
# Test emotion detection endpoint
curl -X POST https://your-helix-domain.vercel.app/api/emotion-detection \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "I just got promoted!"},
      {"role": "assistant", "content": "Congratulations!"}
    ]
  }'

# Test embedding endpoint
curl -X POST https://your-helix-domain.vercel.app/api/embedding \
  -H "Content-Type: application/json" \
  -d '{"text": "Test embedding"}'
```

### 6.3 Verify Discord Integration

1. Test autonomy action logging by creating an agent
2. Check that messages appear in Discord channels
3. Verify button interactions work (approve/reject)

### 6.4 Monitor Vercel Deployment

- Check Vercel dashboard for deployment status
- Monitor function logs in Vercel dashboard
- Set up alerts for failed deployments

```bash
vercel logs --follow
```

## Part 7: Maintenance & Monitoring

### 7.1 Environment Variable Rotation

Update secrets regularly:

```bash
# Update in Vercel
vercel env rm DEEPSEEK_API_KEY
vercel env add DEEPSEEK_API_KEY sk_new...

# Redeploy
vercel --prod
```

### 7.2 Database Backups

Enable automated backups in Supabase dashboard:

1. Project Settings → Database
2. Backup settings → Enable automatic daily backups

### 7.3 Monitoring & Analytics

- **Vercel Analytics**: Built-in monitoring in Vercel dashboard
- **Supabase Logs**: Check logs in Supabase dashboard
- **Discord**: Review logs in Discord channels

### 7.4 Troubleshooting

**Build fails:**

```bash
# Clear cache and rebuild
vercel --prod --skip-build-cache
```

**API endpoints 404:**

- Verify Edge Function files in `web/api/` directory
- Check function names match route paths
- Ensure environment variables are set

**Supabase connection fails:**

- Verify `VITE_SUPABASE_URL` is correct
- Check `VITE_SUPABASE_ANON_KEY` matches project
- Ensure RLS policies allow access

## Deployment Checklist

- [ ] All environment variables configured in Vercel
- [ ] Database migrations applied to Supabase
- [ ] Discord webhooks configured and tested
- [ ] API keys (DeepSeek, Gemini) added to Vercel
- [ ] Web application builds successfully
- [ ] Web application deployed to Vercel
- [ ] Email verification working (Supabase Auth)
- [ ] Agent creation workflow tested
- [ ] Autonomy actions tested
- [ ] Discord logging verified
- [ ] Semantic search function tested
- [ ] Monitoring/alerting set up
- [ ] Backup strategy verified
- [ ] Documentation updated for production

## Rollback Procedure

If deployment fails:

```bash
# Revert to previous deployment
vercel rollback

# Or redeploy previous commit
git checkout <previous-commit-hash>
vercel --prod
```

## Support & Issues

For issues or questions:

1. Check Vercel deployment logs
2. Review Supabase database logs
3. Check Discord webhook connectivity
4. Review browser console for client-side errors
5. Open issue on GitHub: https://github.com/rodcoding123/helix/issues
