# HELIX PRODUCTION RUNBOOK

**Last Updated:** 2026-02-07
**Status:** 96% Production Ready (99.93% test pass rate)

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Lead Engineer | Rodrigo Specter | [PHONE] | [EMAIL] |
| DevOps | [NAME] | [PHONE] | [EMAIL] |
| Backend Support | [NAME] | [PHONE] | [EMAIL] |
| On-Call Escalation | [NAME] | [PHONE] | [EMAIL] |

---

## 🚨 CRITICAL: 5-MINUTE EMERGENCY RESPONSE

### If System is Down (Total Outage)

**Timeline: 0-5 minutes**

```bash
# 1. Check status
curl -s https://your-deployment-url/health

# 2. Check Discord for alerts
# Visit #helix-alerts immediately

# 3. If web is down but backend OK
# Revert to previous Vercel/Netlify deployment
# (2-minute rollback)

# 4. If backend is down
# Check container status
ssh user@vps-host
docker-compose -f docker-compose.production.yml ps
docker-compose logs -f helix | tail -20

# 5. Post status to Discord
# Notify stakeholders of incident (use DISCORD_WEBHOOK_ALERTS from .env)
```

### If API Errors Are Spiking

**Timeline: 0-2 minutes**

```bash
# Check Discord #helix-api for patterns
# Look for specific error codes or providers

# Check token usage
curl -s https://your-backend-url/api/operations/cost \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# If DeepSeek provider failing
# Switch to Gemini fallback manually
PROVIDER_OVERRIDE=gemini-flash node helix-runtime/openclaw.mjs

# Monitor for recovery in #helix-api
```

### If Webhooks Are Failing

**Timeline: 0-1 minute**

```bash
# Test webhook connectivity (from .env file)
curl -X POST $DISCORD_WEBHOOK_HASH_CHAIN \
  -H "Content-Type: application/json" \
  -d '{"content":"[EMERGENCY] Webhook test"}'

# If failing, check Discord server:
# 1. Verify webhook URLs still exist
# 2. Check if bot has permissions
# 3. Check rate limiting (5 msg/5sec limit)

# Switch to backup webhook if available
# Set DISCORD_WEBHOOK_BACKUP in .env
```

---

## 🟢 NORMAL OPERATIONS

### Daily Monitoring (Every 2 Hours)

```bash
# 1. Check Discord channels
# • #helix-api - API costs should be normal
# • #helix-alerts - Should be minimal errors
# • #helix-hash-chain - Should see periodic entries
# • #helix-commands - Should see command execution

# 2. Check system health
curl -s https://your-backend-url/health

# 3. Sample API latency
time curl -s https://your-api-url/status | jq

# 4. Check Supabase metrics
# Visit Supabase console > Status > Database
```

### Weekly Verification

```bash
# Monday 9am: Full system health check

# 1. Cost trending
SELECT DATE(created_at), COUNT(*) as requests, SUM(cost_usd) as daily_cost
FROM api_calls
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY created_at DESC;

# 2. Error trend
SELECT error_code, COUNT(*) as count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_code
ORDER BY count DESC;

# 3. Provider utilization
SELECT provider, COUNT(*) as calls, AVG(latency_ms) as avg_latency
FROM api_calls
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY provider;

# 4. User engagement
SELECT COUNT(DISTINCT user_id) as active_users,
       COUNT(*) as total_messages
FROM session_messages
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Monthly Maintenance (First Monday of Month)

```bash
# 1. Review cost analysis
# Expected: $35-86/month (Phase 1 analysis)

# 2. Database optimization
# Vacuum and reindex Supabase
VACUUM ANALYZE;

# 3. SSL certificate renewal check
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443

# 4. Backup verification
# Verify backups are running and accessible

# 5. Log rotation
# Ensure Docker logs don't exceed allocated space
docker system prune -a --volumes --force
```

---

## 🚨 INCIDENT RESPONSE

### API Response Time Degradation

**Symptoms:** API requests taking > 5 seconds

**Investigation (5 minutes):**

```bash
# 1. Check Supabase connection
SELECT extract(epoch from (NOW() - pg_postmaster_start_time())) as uptime_seconds;

# 2. Check database query performance
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 5;

# 3. Check Docker resource usage
docker stats helix

# 4. Check network connectivity
ping deepseek.com ping api.anthropic.com

# 5. Check error logs
docker-compose logs -f helix | grep -i error | tail -20
```

**Resolution Options:**

```bash
# Option 1: Increase Docker resources (if CPU/RAM maxed)
# Edit docker-compose.production.yml:
deploy:
  resources:
    limits:
      cpus: '4'      # Increase from 2
      memory: 2G     # Increase from 1G

docker-compose restart

# Option 2: Switch to faster provider (if Supabase slow)
# Temporarily switch to local cache
NODE_ENV=production DATABASE_CACHE=memory npx

# Option 3: Scale horizontally (if traffic spike)
# Deploy additional backend instance
docker-compose up -d --scale helix=2

# Option 4: Reduce provider timeout
MAX_API_TIMEOUT_MS=10000  # Reduce from 30000
```

### High Error Rate (> 1%)

**Symptoms:** Discord #helix-alerts showing many errors

**Triage (2 minutes):**

```bash
# 1. Check error distribution
docker-compose logs helix 2>&1 | grep ERROR | head -20

# 2. Identify error pattern
# Look for:
# - API key errors (DEEPSEEK_API_KEY missing?)
# - Database connection (Supabase down?)
# - Authentication (JWT expired?)
# - Rate limiting (hitting provider limits?)

# 3. Check Discord webhooks
curl -s $DISCORD_WEBHOOK_ALERTS -I

# 4. Get provider status
# • DeepSeek: https://status.deepseek.com/
# • Google Gemini: https://status.cloud.google.com/
# • Supabase: https://status.supabase.com/
```

**Recovery:**

```bash
# If API key error:
docker-compose stop helix
source .env
docker-compose up -d helix

# If Supabase connection error:
# Check SUPABASE_URL and credentials in .env
# Verify network connectivity to Supabase

# If rate limiting:
# Implement exponential backoff in router
# See: src/helix/ai-operations/router.ts
```

### Database Connection Pool Exhausted

**Symptoms:** "too many connections" errors

**Resolution (1 minute):**

```bash
# Check current connections
SELECT count(*) FROM pg_stat_activity;

# Kill idle connections
SELECT pid, usename, application_name, state, query_start
FROM pg_stat_activity
WHERE state = 'idle' AND query_start < NOW() - INTERVAL '30 minutes';

-- Kill long idle connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < NOW() - INTERVAL '30 minutes';

# Increase connection pool (short-term)
# In Supabase dashboard:
# Settings > Database > Connection Pooling
# Increase pool size to 100

# Long-term: Optimize connection usage in code
# Use connection pooling in router
```

### Webhook Spam/Rate Limiting

**Symptoms:** Discord shows rate limit errors

**Analysis:**

```bash
# Discord rate limits: 5 messages per 5 seconds
# Check webhook frequency in code
grep -r "logToDiscord" src/ | grep -c "await"

# Batch Discord messages instead of sending individually
# Combine related logs into single webhook POST
```

**Resolution:**

```typescript
// Instead of:
await logToDiscord({ content: "Event 1" });
await logToDiscord({ content: "Event 2" });
await logToDiscord({ content: "Event 3" });

// Do:
const batchContent = "Event 1\nEvent 2\nEvent 3";
await logToDiscord({ content: batchContent });
```

---

## 📊 MONITORING DASHBOARDS

### Key Metrics to Watch

| Metric | Healthy Range | Alert Threshold |
|--------|---------------|-----------------|
| API Response Time (p95) | < 1s | > 5s |
| Error Rate | < 0.1% | > 1% |
| Availability | > 99.9% | < 99.0% |
| Daily Cost | $35-86 | > $200 |
| Database Connections | < 50 | > 100 |
| Memory Usage | < 50% | > 80% |
| CPU Usage | < 50% | > 80% |
| Webhook Success Rate | > 99% | < 95% |

### Setting Up Monitoring

#### Datadog Integration (Optional)

```bash
# 1. Install Datadog agent on VPS
bash -c "$(curl -L https://raw.githubusercontent.com/DataDog/...)"

# 2. Enable Docker monitoring
# Edit datadog.yaml to monitor helix container

# 3. Create dashboard in Datadog
# Add widgets for:
# - Container CPU, Memory, Network
# - API response times
# - Error rates
# - Database connections
```

#### Discord-Based Monitoring (Built-in)

```bash
# Discord provides real-time alerts via webhooks
# Monitor these channels:
# • #helix-api - Cost and token usage
# • #helix-alerts - Errors and anomalies
# • #helix-hash-chain - Integrity records
# • #helix-commands - Execution logs

# Set up Discord notifications:
# 1. Enable @mention for critical messages
# 2. Create channel-specific rules
# 3. Setup mobile alerts for on-call
```

---

## 🔧 MAINTENANCE PROCEDURES

### Deploying an Update

```bash
# 1. Test changes locally
npm run quality

# 2. Build new Docker image
docker build -f Dockerfile.production -t helix:$(date +%Y%m%d) .

# 3. Tag for production
docker tag helix:$(date +%Y%m%d) helix:latest

# 4. Deploy with health check
docker-compose -f docker-compose.production.yml up -d

# 5. Monitor health
docker-compose logs -f helix | head -50

# 6. Verify in Discord
# Should see new deployment in #helix-hash-chain

# 7. Smoke test
curl -s https://your-api/health
curl -s https://your-api/api/operations/test
```

### Rolling Back a Deployment

```bash
# 1. Stop current containers
docker-compose down

# 2. Start previous image
docker run -d --name helix-previous helix:previous-tag

# 3. Verify health
docker logs helix-previous | tail -20

# 4. Update docker-compose.yml if needed
# Point to previous image tag

# 5. Restart normally
docker-compose up -d

# 6. Log incident to Discord
curl -X POST $DISCORD_WEBHOOK_ALERTS \
  -d '{"content":"Rollback to previous deployment - [REASON]"}'
```

### Database Backup & Restore

```bash
# Backup (manual)
pg_dump -h <supabase-host> -U postgres > backup-$(date +%Y%m%d).sql

# Restore from backup
psql -h <supabase-host> -U postgres < backup-20260207.sql

# Automated backups
# Supabase handles daily backups in dashboard
# Settings > Backup > View backups
```

---

## 📞 ESCALATION PATHS

### Tier 1: Automated (0-5 minutes)

- Discord webhooks send alerts
- Health checks run automatically
- Failover triggers if provider fails
- Error tracking logs to #helix-alerts

### Tier 2: First Response (5-30 minutes)

- On-call engineer reviews Discord alerts
- Checks system logs and metrics
- Determines if Tier 3 escalation needed
- Posts status update to #helix-alerts

### Tier 3: Full Team (30+ minutes)

- Page entire on-call team
- Initiate bridge/war room
- Investigate root cause
- Deploy emergency fix or rollback
- Post mortem meeting scheduled

### When to Page Tier 3

- Complete service outage (> 1 minute)
- Database unreachable
- Data corruption detected
- Security incident
- > 10% error rate sustained for > 5 minutes

---

## 🔐 SECURITY OPERATIONS

### Secret Rotation

```bash
# Monthly routine
# 1. Generate new API keys
# 2. Update .env file
# 3. Restart containers
# 4. Deactivate old keys after 24-hour overlap

# Steps:
./scripts/rotate-secrets.ts
git diff .env
# Review changes
source .env
docker-compose restart
```

### Incident Security Procedures

```bash
# If API keys might be compromised:
1. Immediately revoke compromised keys
2. Generate new keys
3. Update .env in Docker containers
4. Rotate all related credentials
5. Log incident with timestamps
6. Audit access logs for unusual activity
7. Monitor for unauthorized usage

# Commands:
./scripts/rotate-secrets.ts --emergency
docker-compose down
# Update .env with new keys
docker-compose up -d
```

---

## 📋 CHECKLISTS

### Daily Checklist (Start of Day)

- [ ] Check Discord #helix-alerts for overnight incidents
- [ ] Verify system health (curl /health)
- [ ] Check error rate in #helix-api
- [ ] Review previous day's cost in logs
- [ ] Confirm no backup/restore jobs failed

### Weekly Checklist (Monday Morning)

- [ ] Review 7-day cost trend ($35-86/month expected)
- [ ] Check error logs for patterns
- [ ] Verify all providers operational
- [ ] Confirm database health
- [ ] Review user engagement metrics
- [ ] Test failover scenarios
- [ ] Check SSL certificate expiry

### Monthly Checklist (1st of Month)

- [ ] Full cost analysis and breakdown
- [ ] Database optimization (VACUUM ANALYZE)
- [ ] SSL renewal check
- [ ] Backup/restore test
- [ ] Log rotation verification
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Team knowledge sharing session

### Pre-Launch Checklist (Before Going Live)

- [ ] All 5 deployment phases complete
- [ ] 7 manual test scenarios passing
- [ ] Load test at 100+ concurrent users passed
- [ ] Cost tracking verified and accurate
- [ ] Failover scenarios tested
- [ ] All Discord webhooks operational
- [ ] Emergency contacts list updated
- [ ] On-call rotation configured
- [ ] Runbook reviewed by team
- [ ] Alerting rules configured

---

## 🎯 SUCCESS METRICS

Production deployment is successful when:

| Metric | Target | Timeline |
|--------|--------|----------|
| Uptime | > 99.9% | After 30 days |
| Error Rate | < 0.1% | After 24 hours |
| API Latency (p95) | < 2 seconds | After 24 hours |
| Cost/Month | $35-86 | Verified on Day 7 |
| User Satisfaction | > 4.5/5 | After 30 days |
| Zero Security Incidents | 100% | Ongoing |

---

## 🔗 USEFUL LINKS

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Vercel Deployments**: https://vercel.com/dashboard
- **Docker Hub**: https://hub.docker.com/
- **DeepSeek API**: https://platform.deepseek.com/
- **Google Gemini**: https://aistudio.google.com/
- **Anthropic Console**: https://console.anthropic.com/
- **Discord Server**: [YOUR_DISCORD_SERVER_URL]

---

## 🚀 QUICK START COMMANDS

```bash
# Check system status
docker-compose ps
docker-compose logs -f helix

# Restart services
docker-compose restart helix

# Rebuild and restart
docker-compose up -d --build

# View real-time metrics
docker stats helix

# Test API
curl -s https://your-api/health | jq

# SSH to VPS
ssh -p 22 user@vps-host

# Access backend logs
docker-compose logs helix | tail -100
```

---

**Last Updated:** 2026-02-07
**Version:** 1.0
**Owner:** Rodrigo Specter
**Review Date:** Monthly (1st of month)
