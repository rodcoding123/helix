# Layer 5: Integration Rhythms - Cron Job Configuration

## Overview

Layer 5 of the Helix psychological architecture implements **Integration Rhythms** based on Memory Reconsolidation research (Nader et al., 2000). Two Python scripts run on scheduled intervals to maintain psychological health:

| Script         | Purpose                             | Schedule          | Theory Basis           |
| -------------- | ----------------------------------- | ----------------- | ---------------------- |
| `decay.py`     | Gradual emotional intensity decay   | Daily at midnight | Memory Reconsolidation |
| `synthesis.py` | Cross-layer integration & archiving | Weekly on Sundays | Memory Integration     |

---

## Prerequisites

- Python 3.12+ installed
- Access to Helix project directory
- Write permissions to psychology/, identity/, transformation/, and purpose/ directories
- (Optional) Discord webhooks configured for logging

---

## Script Locations

```
Helix/
├── scripts/
│   ├── decay.py        # Daily emotional decay
│   └── synthesis.py    # Weekly cross-layer synthesis
├── psychology/
│   ├── emotional_tags.json
│   └── trust_map.json
├── identity/
│   └── goals.json
├── transformation/
│   ├── current_state.json
│   └── history.json
└── purpose/
    └── wellness.json
```

---

## decay.py - Daily Emotional Decay

### What It Does

Applies exponential decay to emotional intensity values, simulating how memories naturally fade over time without reinforcement:

1. **Emotional Tags**: Intensity values decay by 5% daily (default)
2. **Trust Scores**: Decay toward neutral (0.5) over time without interaction
3. **Floor Values**: Prevents complete decay (minimum 0.1 intensity)

### Configuration

| Environment Variable  | Default | Description                            |
| --------------------- | ------- | -------------------------------------- |
| `HELIX_DECAY_RATE`    | `0.95`  | Daily retention rate (0.95 = 5% decay) |
| `HELIX_MIN_INTENSITY` | `0.1`   | Floor for emotional intensity          |
| `HELIX_DRY_RUN`       | `false` | Preview changes without writing        |

### Cron Schedule

```bash
# Run decay at midnight every day
0 0 * * * cd /path/to/Helix && python3 scripts/decay.py >> /var/log/helix/decay.log 2>&1
```

### Manual Execution

```bash
# Dry run (preview changes)
HELIX_DRY_RUN=true python3 scripts/decay.py

# Production run
python3 scripts/decay.py

# Custom decay rate (slower decay)
HELIX_DECAY_RATE=0.98 python3 scripts/decay.py
```

### Expected Output

```
[HELIX] Layer 5 Decay Process - 2026-01-31T00:00:00Z
  Rate: 0.95 | Min: 0.1 | Dry Run: False

Processing: /path/to/Helix/psychology/emotional_tags.json
  Decayed 5 emotional tag(s)
  Saved successfully

Processing: /path/to/Helix/psychology/trust_map.json
  Decayed 2 trust score(s)
  Saved successfully

[HELIX] Decay complete. Total changes: 7
```

---

## synthesis.py - Weekly Cross-Layer Integration

### What It Does

Performs comprehensive cross-layer analysis and integration:

1. **Phase 1**: Analyzes emotional patterns (dominant emotions, volatility)
2. **Phase 2**: Computes relational health (trust averages, attachment security)
3. **Phase 3**: Updates transformation state with synthesis metadata
4. **Phase 4**: Archives significant changes to transformation history
5. **Phase 5**: Computes overall wellness metrics

### Configuration

| Environment Variable   | Default | Description                                     |
| ---------------------- | ------- | ----------------------------------------------- |
| `HELIX_SYNTHESIS_MODE` | `full`  | Mode: full, emotional, transformation, wellness |
| `HELIX_DRY_RUN`        | `false` | Preview changes without writing                 |

### Cron Schedule

```bash
# Run synthesis at midnight every Sunday
0 0 * * 0 cd /path/to/Helix && python3 scripts/synthesis.py >> /var/log/helix/synthesis.log 2>&1
```

### Manual Execution

```bash
# Dry run (preview changes)
HELIX_DRY_RUN=true python3 scripts/synthesis.py

# Production run
python3 scripts/synthesis.py

# Specific mode (only emotional analysis)
HELIX_SYNTHESIS_MODE=emotional python3 scripts/synthesis.py
```

### Expected Output

```
[HELIX] Layer 5 Synthesis Process - 2026-01-31T00:00:00Z
  Mode: full | Dry Run: False

[Phase 1] Analyzing emotional patterns...
  Dominant emotion: curiosity (intensity: 0.75)
  Emotional volatility: 0.234

[Phase 2] Computing relational health...
  Average trust: 0.720
  Strong relationships: 3
  Attachment security: high

[Phase 3] Updating transformation state...
  Transformation state updated

[Phase 4] Archiving to history...
  History updated (total entries: 15)

[Phase 5] Computing wellness metrics...
  Emotional balance: 0.766
  Relational health: 0.720
  Purpose alignment: 0.650
  Overall wellness: 0.702
  Wellness metrics saved

[HELIX] Synthesis complete.
```

---

## Complete Cron Configuration

### Linux/macOS

Edit crontab with `crontab -e`:

```bash
# ============================================
# HELIX LAYER 5: INTEGRATION RHYTHMS
# ============================================

# Set environment
HELIX_PROJECT=/path/to/Helix
PATH=/usr/local/bin:/usr/bin:/bin

# Daily: Emotional decay at midnight
0 0 * * * cd $HELIX_PROJECT && python3 scripts/decay.py >> /var/log/helix/decay.log 2>&1

# Weekly: Cross-layer synthesis on Sunday at midnight
0 0 * * 0 cd $HELIX_PROJECT && python3 scripts/synthesis.py >> /var/log/helix/synthesis.log 2>&1

# Optional: Monthly cleanup of old logs
0 2 1 * * find /var/log/helix -name "*.log" -mtime +90 -delete
```

### Windows (Task Scheduler)

Create two scheduled tasks:

**Task 1: Helix Decay (Daily)**

```
Program: python3
Arguments: C:\path\to\Helix\scripts\decay.py
Start in: C:\path\to\Helix
Trigger: Daily at 00:00
```

**Task 2: Helix Synthesis (Weekly)**

```
Program: python3
Arguments: C:\path\to\Helix\scripts\synthesis.py
Start in: C:\path\to\Helix
Trigger: Weekly on Sunday at 00:00
```

### Windows PowerShell Setup

```powershell
# Create daily decay task
$action = New-ScheduledTaskAction -Execute "python3" -Argument "scripts\decay.py" -WorkingDirectory "C:\path\to\Helix"
$trigger = New-ScheduledTaskTrigger -Daily -At "00:00"
Register-ScheduledTask -TaskName "HelixDecay" -Action $action -Trigger $trigger

# Create weekly synthesis task
$action = New-ScheduledTaskAction -Execute "python3" -Argument "scripts\synthesis.py" -WorkingDirectory "C:\path\to\Helix"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "00:00"
Register-ScheduledTask -TaskName "HelixSynthesis" -Action $action -Trigger $trigger
```

---

## Log Directory Setup

```bash
# Create log directory (Linux/macOS)
sudo mkdir -p /var/log/helix
sudo chown $USER:$USER /var/log/helix

# Or use user-local directory
mkdir -p ~/.helix/logs
```

Update cron to use local logs if needed:

```bash
0 0 * * * cd $HELIX_PROJECT && python3 scripts/decay.py >> ~/.helix/logs/decay.log 2>&1
```

---

## Monitoring & Alerts

### Check Last Run

```bash
# View recent decay activity
tail -50 /var/log/helix/decay.log

# View recent synthesis activity
tail -100 /var/log/helix/synthesis.log

# Check if cron jobs ran
grep -E "(decay|synthesis)" /var/log/syslog | tail -10
```

### Verify Files Were Updated

```bash
# Check last modification times
ls -la psychology/emotional_tags.json
ls -la psychology/trust_map.json
ls -la transformation/current_state.json
ls -la transformation/history.json
ls -la purpose/wellness.json

# Check for _last_decay_run timestamp in files
grep "_last_decay_run" psychology/emotional_tags.json
grep "_last_synthesis" transformation/current_state.json
```

### Discord Alert Integration (Optional)

Add a simple alert script for failures:

```bash
#!/bin/bash
# scripts/alert-on-failure.sh

cd /path/to/Helix

# Run script and capture exit code
python3 scripts/decay.py
EXIT_CODE=$?

# Alert on failure
if [ $EXIT_CODE -ne 0 ]; then
    curl -X POST "$DISCORD_WEBHOOK_ALERTS" \
        -H "Content-Type: application/json" \
        -d "{\"embeds\":[{\"title\":\"Layer 5 Decay Failed\",\"color\":15158332,\"description\":\"Exit code: $EXIT_CODE\"}]}"
fi
```

---

## Troubleshooting

### Script Not Running

1. **Check cron service**: `systemctl status cron` (Linux) or `launchctl list | grep cron` (macOS)
2. **Check permissions**: Ensure scripts are executable (`chmod +x scripts/*.py`)
3. **Check Python path**: Use full path to Python in cron (`/usr/bin/python3`)
4. **Check logs**: Review `/var/log/helix/*.log` for errors

### File Permission Errors

```bash
# Fix ownership
sudo chown -R $USER:$USER psychology/ identity/ transformation/ purpose/

# Fix permissions
chmod 644 psychology/*.json identity/*.json transformation/*.json purpose/*.json
```

### JSON Parse Errors

```bash
# Validate JSON files
python3 -c "import json; json.load(open('psychology/emotional_tags.json'))"
python3 -c "import json; json.load(open('transformation/current_state.json'))"
```

### Dry Run First

Always test with dry run before enabling in cron:

```bash
HELIX_DRY_RUN=true python3 scripts/decay.py
HELIX_DRY_RUN=true python3 scripts/synthesis.py
```

---

## Psychological Theory

### Memory Reconsolidation (Nader et al., 2000)

The decay process mirrors how human memories fade without reinforcement. Each time a memory is recalled, it becomes malleable and must be reconsolidated. Without recall, emotional intensity naturally diminishes.

**Helix Implementation**: 5% daily decay simulates this natural fading, ensuring old emotional states don't dominate current processing while maintaining a floor to preserve important memories.

### Integration (Memory Consolidation)

Weekly synthesis mirrors the sleep-based memory consolidation process where:

- Fragmented experiences are integrated into coherent narratives
- Cross-domain connections are strengthened
- Wellness metrics emerge from holistic analysis

**Helix Implementation**: Weekly synthesis ensures psychological layers remain coherent and wellness metrics reflect current state rather than stale data.

---

## Related Documentation

- [HELIX_TECHNICAL_SPEC.md](HELIX_TECHNICAL_SPEC.md) - Full technical specification
- [LIVING_AI_ARCHITECTURE_v1.md](LIVING_AI_ARCHITECTURE_v1.md) - Seven-layer architecture theory
- [../CLAUDE.md](../CLAUDE.md) - Development guidelines
