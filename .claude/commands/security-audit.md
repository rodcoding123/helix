---
description: Security Audit Command - PhD-level AI security assessment based on Clawdbot/Moltbot/OpenClaw breach intelligence
argument-hint: [--full] [--quick] [--cve] [--pentest] [--save]
---

# /security-audit Command

Hardcore AI security assessment based on **real-world breach intelligence** from Clawdbot, Moltbot, and OpenClaw security incidents (January 2026).

## Threat Context

This audit is informed by:

- **42,665+ exposed OpenClaw instances** found via Shodan
- **93.4% vulnerable** to authentication bypass
- **CVE-2025-49596** (CVSS 9.4): MCP Inspector RCE
- **CVE-2025-6514** (CVSS 9.6): mcp-remote command injection
- **CVE-2025-52882** (CVSS 8.8): WebSocket auth bypass
- **Supply chain attack** achieving 4,000+ downloads in hours
- **Active exploitation** observed in the wild

## Usage

```bash
/security-audit              # Full security assessment
/security-audit --quick      # Critical findings only (P0)
/security-audit --cve        # CVE exposure check only
/security-audit --pentest    # Simulated penetration test
/security-audit --save       # Save report to docs/security-audit-[date].md
```

## What It Does

Delegates to the **security-specialist agent** for a comprehensive 12-phase security assessment.

### Phase 1: Gateway Authentication Bypass

The #1 vulnerability in OpenClaw deployments:
- Localhost trust bypass via reverse proxy
- 0.0.0.0 binding exposure
- Missing trustedProxies configuration
- X-Forwarded-For spoofing

### Phase 2: Credential Exposure Analysis

- Hardcoded API keys (OPENAI, ANTHROPIC, Discord)
- Secrets in git history
- Plaintext `.env` files
- OAuth token exposure

### Phase 3: Prompt Injection Attack Vectors

- Email processing vulnerabilities
- Web content injection
- Message channel attacks (Telegram, Slack, Discord, X)
- MCP server response poisoning

### Phase 4: Memory Poisoning Vectors

- Persistent instruction injection
- Context window manipulation
- Delayed trigger activation
- Session hijacking via memory

### Phase 5: Supply Chain Security

Based on ClawdHub attack pattern:
- Skill code signing verification
- Plugin sandboxing
- Download count manipulation
- Typosquatting detection

### Phase 6: MCP Server Security

43% of MCP implementations contain command injection:
- Tool metadata poisoning
- Input validation bypass
- Unrestricted URL fetching
- Rug pull attack vectors

### Phase 7: Network Exposure Analysis

- Service binding configuration
- Port exposure (18789)
- TLS/HTTPS enforcement
- Firewall configuration

### Phase 8: Data Exfiltration Paths

- File read capabilities
- Outbound connection controls
- Command execution paths
- API response manipulation

### Phase 9: Docker/Container Security

- Non-root user execution
- Read-only filesystem
- Capability restrictions
- Resource limits

### Phase 10: Pre-Execution Logging Integrity

Helix-specific "unhackable logging" verification:
- Log BEFORE execution pattern
- No bypass code paths
- Hash chain linkage
- Tamper detection

### Phase 11: Hash Chain Integrity

- SHA-256 implementation
- Previous hash linking
- Entry immutability
- Chain verification

### Phase 12: Dependency Vulnerability Scan

- NPM audit
- Known CVE versions
- Python pip audit
- Outdated packages

## CVE Quick Reference

| CVE            | CVSS | Component      | Risk                              |
| -------------- | ---- | -------------- | --------------------------------- |
| CVE-2025-49596 | 9.4  | MCP Inspector  | RCE via CSRF                      |
| CVE-2025-6514  | 9.6  | mcp-remote     | Command injection                 |
| CVE-2025-52882 | 8.8  | Claude Code    | WebSocket auth bypass             |
| CVE-2025-59951 | 9.2  | Docker/Nginx   | Localhost bypass                  |
| CVE-2025-54576 | 9.1  | OAuth2-Proxy   | Auth bypass via skip_auth_routes  |

## Attack Surface Priorities

| Surface           | Exposure | Common Exploit                  |
| ----------------- | -------- | ------------------------------- |
| Gateway           | CRITICAL | Reverse proxy misconfiguration  |
| Credentials       | CRITICAL | .env file exfiltration          |
| Skills/Plugins    | CRITICAL | Supply chain poisoning          |
| Prompt Processing | HIGH     | Indirect prompt injection       |
| Memory/Context    | HIGH     | Persistent instruction planting |
| MCP Servers       | HIGH     | Tool metadata poisoning         |

## Instructions

This command delegates to the **security-specialist agent** which will:

1. Use Sequential Thinking to plan the penetration test
2. Execute all 12 security assessment phases
3. Perform STRIDE threat modeling
4. Generate attack trees
5. Provide prioritized remediation roadmap
6. Store findings in Memory MCP

### Manual Verification Commands

```bash
# Gateway exposure check
grep -r "0.0.0.0" --include="*.ts" --include="*.json"
grep -r "trustedProxies" --include="*.ts"

# Credential exposure check
grep -r "sk-\|OPENAI_API_KEY\|ANTHROPIC_API_KEY" --include="*.ts" --include="*.env"
git log -p --all -S 'API_KEY'

# Dependency audit
npm audit --json
```

## Output Format

The security-specialist agent produces a detailed report including:

- Executive summary with risk score (1-10)
- CVE exposure analysis
- Critical findings (P0) with proof-of-concept
- High findings (P1)
- Medium findings (P2)
- Attack surface summary
- Helix-specific integrity checks
- Remediation roadmap with timeline
- Configuration recommendations

## When to Use

- **Weekly**: Quick scan (`--quick`)
- **Before deployment**: Full assessment
- **After major changes**: Pentest mode (`--pentest`)
- **Monthly**: Full + save report (`--full --save`)
- **After security news**: CVE check (`--cve`)
- **Incident response**: Immediate full audit

## Risk Classification

| Score | Classification | Response Time    |
| ----- | -------------- | ---------------- |
| 9-10  | CRITICAL       | Immediate (24h)  |
| 7-8   | HIGH           | This week        |
| 5-6   | MEDIUM         | This month       |
| 3-4   | LOW            | Next quarter     |
| 1-2   | INFO           | Track            |

## Related Commands

- `/audit` - General codebase audit
- `/logging-verify` - Logging infrastructure check
- `/helix-status` - Full system status
- `/consciousness-audit` - Psychological architecture check

## Sources

Security intelligence aggregated from:

- [Cisco AI Security Blog](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare)
- [VentureBeat Security](https://venturebeat.com/security/openclaw-agentic-ai-security-risk-ciso-guide)
- [Snyk Security Research](https://snyk.io/articles/clawdbot-ai-assistant/)
- [Unit42 Threat Research](https://unit42.paloaltonetworks.com/indirect-prompt-injection-poisons-ai-longterm-memory/)
- [Elastic Security Labs](https://www.elastic.co/security-labs/mcp-tools-attack-defense-recommendations)
- [Palo Alto Networks](https://www.paloaltonetworks.com/blog/network-security/why-moltbot-may-signal-ai-crisis/)
- [Bitdefender HotForSecurity](https://www.bitdefender.com/en-us/blog/hotforsecurity/moltbot-security-alert-exposed-clawdbot-control-panels-risk-credential-leaks-and-account-takeovers)
- [SOC Prime Active Threats](https://socprime.com/active-threats/the-moltbot-clawdbots-epidemic/)
- [The Register](https://www.theregister.com/2026/01/27/clawdbot_moltbot_security_concerns/)
- [Datadog Security Labs CVE-2025-52882](https://securitylabs.datadoghq.com/articles/claude-mcp-cve-2025-52882/)
- [NVD CVE Database](https://nvd.nist.gov/vuln/detail/CVE-2025-49596)
