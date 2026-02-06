/**
 * 1Password Audit System - Detect unusual access patterns
 *
 * Monitors 1Password vault for suspicious activity including:
 * - Excessive access rates (> 100/day)
 * - Rapid burst patterns (10+ accesses in 1 minute)
 * - Off-hours access (3am-5am)
 *
 * NOTE: Full 1Password audit API requires API token with audit read access.
 * This implementation provides basic pattern detection and framework for
 * integrating with 1Password Activity Logs API when available.
 */

import { execSync } from 'node:child_process';
import { logSecretOperation } from '../helix/hash-chain.js';

export interface OnePasswordAccessPattern {
  itemName: string;
  itemId: string;
  accessCount: number;
  lastAccess?: string;
  unusual: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Get list of all vault items
 * Returns item names and IDs for monitoring
 */
function getVaultItems(): Array<{ name: string; id: string }> {
  try {
    const output = execSync('op item list --vault "Helix" --format=json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    interface OpItem {
      title: string;
      id: string;
    }

    const items: OpItem[] = JSON.parse(output);
    return items.map(item => ({
      name: item.title,
      id: item.id,
    }));
  } catch (error) {
    console.error('[1Password Audit] Failed to list vault items:', error);
    return [];
  }
}

/**
 * Track access patterns in memory
 * In production, would integrate with 1Password Activity Logs API
 */
interface AccessRecord {
  timestamp: number;
  itemId: string;
}

const accessLog: AccessRecord[] = [];

/**
 * Record an access to an item
 * Called when secrets are loaded
 */
export function recordAccess(itemId: string): void {
  accessLog.push({
    timestamp: Date.now(),
    itemId,
  });

  // Keep only last 24 hours of logs to manage memory
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const i = accessLog.findIndex(r => r.timestamp > oneDayAgo);
  if (i > 0) {
    accessLog.splice(0, i);
  }
}

/**
 * Check if time is outside normal business hours (3am-5am is suspicious)
 */
function isOutsideNormalHours(timestamp: number): boolean {
  const hour = new Date(timestamp).getHours();
  // Flag 3am-5am as unusual
  return hour >= 3 && hour < 5;
}

/**
 * Detect rapid burst pattern (10+ accesses in 1 minute)
 */
function hasRapidBurstPattern(accesses: AccessRecord[]): boolean {
  if (accesses.length < 10) return false;

  for (let i = 0; i <= accesses.length - 10; i++) {
    const window = accesses.slice(i, i + 10);
    const timeSpan = window[window.length - 1].timestamp - window[0].timestamp;
    // 10 accesses in < 1 minute = burst
    if (timeSpan < 60 * 1000) {
      return true;
    }
  }

  return false;
}

/**
 * Analyze access patterns for unusual behavior
 */
export function analyzeAccessPatterns(): OnePasswordAccessPattern[] {
  const patterns: OnePasswordAccessPattern[] = [];
  const items = getVaultItems();

  if (items.length === 0) {
    console.warn('[1Password Audit] No vault items found');
    return [];
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Group accesses by item
  const accessesByItem = new Map<string, AccessRecord[]>();
  for (const access of accessLog) {
    if (access.timestamp < oneDayAgo) continue;
    if (!accessesByItem.has(access.itemId)) {
      accessesByItem.set(access.itemId, []);
    }
    accessesByItem.get(access.itemId)!.push(access);
  }

  // Analyze each item
  for (const item of items) {
    const accesses = accessesByItem.get(item.id) || [];
    let unusual = false;
    let reason = '';
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check 1: Excessive access rate (> 100/day)
    if (accesses.length > 100) {
      unusual = true;
      reason += `Excessive access rate: ${accesses.length}/day (> 100). `;
      riskLevel = 'high';
    }

    // Check 2: Rapid burst pattern
    if (hasRapidBurstPattern(accesses)) {
      unusual = true;
      reason += 'Detected rapid burst pattern (10+ accesses in 1 minute). ';
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }

    // Check 3: Off-hours access
    const offHoursAccesses = accesses.filter(a => isOutsideNormalHours(a.timestamp));
    if (offHoursAccesses.length > 0) {
      unusual = true;
      reason += `Off-hours access detected (${offHoursAccesses.length} times between 3am-5am). `;
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }

    const lastAccess =
      accesses.length > 0
        ? new Date(accesses[accesses.length - 1].timestamp).toISOString()
        : undefined;

    patterns.push({
      itemName: item.name,
      itemId: item.id,
      accessCount: accesses.length,
      lastAccess,
      unusual,
      reason: reason || undefined,
      riskLevel,
    });
  }

  return patterns;
}

/**
 * Start the 1Password audit scheduler
 * Runs every hour to check for suspicious patterns
 */
export async function startOnePasswordAuditScheduler(): Promise<NodeJS.Timeout> {
  console.log('[1Password Audit] Starting scheduler (checks every 60 minutes)');

  // Run initial audit
  await runAuditCheck();

  // Schedule hourly checks
  const intervalId = setInterval(
    () => {
      runAuditCheck().catch(err => {
        console.error('[1Password Audit] Scheduler error:', err);
      });
    },
    60 * 60 * 1000
  ); // 60 minutes

  return intervalId;
}

/**
 * Stop the 1Password audit scheduler
 */
export function stopOnePasswordAuditScheduler(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('[1Password Audit] Scheduler stopped');
}

/**
 * Run a single audit check
 */
async function runAuditCheck(): Promise<void> {
  try {
    const patterns = analyzeAccessPatterns();
    const unusualPatterns = patterns.filter(p => p.unusual);

    if (unusualPatterns.length === 0) {
      // All clear - log success
      await logSecretOperation({
        operation: 'preload', // Using preload as a generic "audit completed" operation
        source: '1password',
        success: true,
        timestamp: new Date().toISOString(),
        details: `1Password audit completed: ${patterns.length} items scanned, all normal`,
      }).catch(err => console.error('[1Password Audit] Failed to log audit result:', err));
      return;
    }

    // Alert on unusual patterns
    const alert = {
      title: '⚠️ 1Password Unusual Activity',
      color: 0xe74c3c, // Red
      description: `${unusualPatterns.length} items with unusual access patterns detected`,
      items: unusualPatterns.map(
        p => `- **${p.itemName}** (${p.accessCount} accesses): ${p.reason || 'Unknown'}`
      ),
    };

    console.warn('[1Password Audit] Unusual patterns detected:', {
      count: unusualPatterns.length,
      items: unusualPatterns.map(p => p.itemName),
    });

    // Log unusual activity to hash chain
    await logSecretOperation({
      operation: 'failure', // Using failure to indicate anomaly
      source: '1password',
      success: false,
      timestamp: new Date().toISOString(),
      details: `Audit alert: ${unusualPatterns.length} items with unusual access patterns`,
    }).catch(err => console.error('[1Password Audit] Failed to log alert:', err));

    // Try to send Discord alert if webhook available
    const discordWebhook = process.env.DISCORD_WEBHOOK_ALERTS;
    if (discordWebhook) {
      try {
        await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [
              {
                title: alert.title,
                color: alert.color,
                description: alert.description,
                fields: [
                  {
                    name: 'Affected Items',
                    value: alert.items.slice(0, 10).join('\n') || 'N/A',
                    inline: false,
                  },
                  {
                    name: 'Total Unusual',
                    value: `${unusualPatterns.length}/${patterns.length}`,
                    inline: true,
                  },
                  {
                    name: 'Max Risk Level',
                    value: unusualPatterns.some(p => p.riskLevel === 'high')
                      ? '🔴 HIGH'
                      : unusualPatterns.some(p => p.riskLevel === 'medium')
                        ? '🟠 MEDIUM'
                        : '🟡 LOW',
                    inline: true,
                  },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        }).catch(err => {
          console.error('[1Password Audit] Failed to send Discord alert:', err);
        });
      } catch (err) {
        console.error('[1Password Audit] Discord webhook error:', err);
      }
    }
  } catch (error) {
    console.error('[1Password Audit] Audit check failed:', error);
  }
}
