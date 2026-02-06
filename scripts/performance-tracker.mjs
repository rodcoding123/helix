#!/usr/bin/env node

/**
 * Performance Baseline Tracker
 * Collects and analyzes performance metrics from test runs
 * Generates performance reports and alerts on regressions
 *
 * Usage:
 *   node scripts/performance-tracker.mjs <playwright-results.json>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_FILE = path.join(__dirname, '..', 'helix-desktop', 'performance-baselines.json');
const HISTORY_FILE = path.join(__dirname, '..', 'helix-desktop', 'performance-history.json');

interface PerformanceMetric {
  name: string;
  duration: number;
  browser: string;
  timestamp: string;
  category: 'load' | 'interaction' | 'memory' | 'other';
}

interface PerformanceBaseline {
  name: string;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  p95Duration: number;
  sampleCount: number;
  threshold: number; // 20% above average
  lastUpdated: string;
}

interface PerformanceReport {
  timestamp: string;
  metrics: PerformanceMetric[];
  baselines: Record<string, PerformanceBaseline>;
  regressions: string[];
  improvements: string[];
}

/**
 * Extract performance metrics from Playwright results
 */
function extractMetrics(filePath: string): PerformanceMetric[] {
  const metrics: PerformanceMetric[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    data.suites?.forEach((suite: any) => {
      suite.tests?.forEach((test: any) => {
        // Check for performance-related test names
        if (test.title.includes('load') || test.title.includes('performance')) {
          metrics.push({
            name: test.title,
            duration: test.duration || 0,
            browser: suite.project?.name || 'unknown',
            timestamp: new Date().toISOString(),
            category: categorizeTest(test.title),
          });
        }
      });
    });
  } catch (error) {
    console.error('[PERF-TRACKER] Failed to extract metrics:', error);
  }

  return metrics;
}

/**
 * Categorize test by name
 */
function categorizeTest(testName: string): 'load' | 'interaction' | 'memory' | 'other' {
  const name = testName.toLowerCase();
  if (name.includes('load') || name.includes('startup')) return 'load';
  if (name.includes('scroll') || name.includes('click') || name.includes('interaction'))
    return 'interaction';
  if (name.includes('memory') || name.includes('leak')) return 'memory';
  return 'other';
}

/**
 * Load or initialize baselines
 */
function loadBaselines(): Record<string, PerformanceBaseline> {
  if (fs.existsSync(BASELINE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'));
    } catch (error) {
      console.warn('[PERF-TRACKER] Failed to load baselines, starting fresh');
    }
  }
  return {};
}

/**
 * Update baselines with new metrics
 */
function updateBaselines(
  currentBaselines: Record<string, PerformanceBaseline>,
  newMetrics: PerformanceMetric[]
): Record<string, PerformanceBaseline> {
  const updated = { ...currentBaselines };

  newMetrics.forEach(metric => {
    const key = `${metric.name}`;

    if (!updated[key]) {
      updated[key] = {
        name: metric.name,
        avgDuration: metric.duration,
        maxDuration: metric.duration,
        minDuration: metric.duration,
        p95Duration: metric.duration,
        sampleCount: 1,
        threshold: metric.duration * 1.2, // 20% above baseline
        lastUpdated: new Date().toISOString(),
      };
    } else {
      const baseline = updated[key];
      const samples = [
        ...Array(baseline.sampleCount).fill(baseline.avgDuration),
        metric.duration,
      ];
      const sorted = samples.sort((a, b) => a - b);

      baseline.avgDuration = samples.reduce((a, b) => a + b, 0) / samples.length;
      baseline.maxDuration = Math.max(baseline.maxDuration, metric.duration);
      baseline.minDuration = Math.min(baseline.minDuration, metric.duration);
      baseline.p95Duration = sorted[Math.ceil(sorted.length * 0.95) - 1];
      baseline.threshold = baseline.avgDuration * 1.2;
      baseline.sampleCount++;
      baseline.lastUpdated = new Date().toISOString();
    }
  });

  return updated;
}

/**
 * Detect regressions
 */
function detectRegressions(
  currentBaselines: Record<string, PerformanceBaseline>,
  newMetrics: PerformanceMetric[]
): { regressions: string[]; improvements: string[] } {
  const regressions: string[] = [];
  const improvements: string[] = [];

  newMetrics.forEach(metric => {
    const key = `${metric.name}`;
    const baseline = currentBaselines[key];

    if (baseline) {
      const percentChange = ((metric.duration - baseline.avgDuration) / baseline.avgDuration) * 100;

      if (metric.duration > baseline.threshold) {
        regressions.push(
          `${metric.name}: ${metric.duration}ms (baseline: ${baseline.avgDuration.toFixed(0)}ms, +${percentChange.toFixed(1)}%)`
        );
      } else if (percentChange < -10) {
        improvements.push(
          `${metric.name}: ${metric.duration}ms (baseline: ${baseline.avgDuration.toFixed(0)}ms, ${percentChange.toFixed(1)}%)`
        );
      }
    }
  });

  return { regressions, improvements };
}

/**
 * Load history
 */
function loadHistory(): PerformanceReport[] {
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    } catch (error) {
      console.warn('[PERF-TRACKER] Failed to load history');
    }
  }
  return [];
}

/**
 * Save baselines and history
 */
function save(
  baselines: Record<string, PerformanceBaseline>,
  history: PerformanceReport[]
): void {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 2));
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log('[PERF-TRACKER] Baselines and history saved');
}

/**
 * Generate performance report
 */
function generateReport(
  metrics: PerformanceMetric[],
  baselines: Record<string, PerformanceBaseline>,
  regressions: string[],
  improvements: string[]
): string {
  const byCategory = metrics.reduce(
    (acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    },
    {} as Record<string, PerformanceMetric[]>
  );

  let report = '# Performance Metrics Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  report += '## Summary\n';
  report += `- Total Metrics: ${metrics.length}\n`;
  report += `- Regressions: ${regressions.length}\n`;
  report += `- Improvements: ${improvements.length}\n\n`;

  report += '## By Category\n';
  Object.entries(byCategory).forEach(([category, items]) => {
    const avgDuration = items.reduce((sum, m) => sum + m.duration, 0) / items.length;
    report += `\n### ${category}\n`;
    report += `- Average: ${avgDuration.toFixed(0)}ms\n`;
    report += `- Count: ${items.length}\n`;
    items.forEach(m => {
      report += `  - ${m.name} (${m.browser}): ${m.duration}ms\n`;
    });
  });

  if (regressions.length > 0) {
    report += '\n## 🔴 Regressions\n';
    regressions.forEach(r => {
      report += `- ${r}\n`;
    });
  }

  if (improvements.length > 0) {
    report += '\n## 🟢 Improvements\n';
    improvements.forEach(i => {
      report += `- ${i}\n`;
    });
  }

  return report;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('[PERF-TRACKER] Usage: node performance-tracker.mjs <playwright-results.json>');
    process.exit(1);
  }

  const resultsFile = args[0];

  if (!fs.existsSync(resultsFile)) {
    console.error(`[PERF-TRACKER] File not found: ${resultsFile}`);
    process.exit(1);
  }

  console.log(`[PERF-TRACKER] Processing performance metrics from: ${resultsFile}`);

  // Extract metrics
  const metrics = extractMetrics(resultsFile);
  console.log(`[PERF-TRACKER] Extracted ${metrics.length} performance metrics`);

  // Load baselines
  const currentBaselines = loadBaselines();
  console.log(`[PERF-TRACKER] Loaded ${Object.keys(currentBaselines).length} baselines`);

  // Detect regressions
  const { regressions, improvements } = detectRegressions(currentBaselines, metrics);

  if (regressions.length > 0) {
    console.warn('[PERF-TRACKER] ⚠️ Performance regressions detected:');
    regressions.forEach(r => console.warn(`  - ${r}`));
  }

  if (improvements.length > 0) {
    console.log('[PERF-TRACKER] ✅ Performance improvements detected:');
    improvements.forEach(i => console.log(`  - ${i}`));
  }

  // Update baselines
  const updatedBaselines = updateBaselines(currentBaselines, metrics);

  // Load history
  const history = loadHistory();

  // Add to history
  const report: PerformanceReport = {
    timestamp: new Date().toISOString(),
    metrics,
    baselines: updatedBaselines,
    regressions,
    improvements,
  };
  history.push(report);

  // Keep only last 30 days of history
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentHistory = history.filter(h => new Date(h.timestamp).getTime() > thirtyDaysAgo);

  // Save
  save(updatedBaselines, recentHistory);

  // Generate report
  const reportText = generateReport(metrics, updatedBaselines, regressions, improvements);
  const reportPath = path.join(path.dirname(resultsFile), 'performance-report.md');
  fs.writeFileSync(reportPath, reportText);
  console.log(`[PERF-TRACKER] Report saved to: ${reportPath}`);

  // Exit with error if regressions found
  if (regressions.length > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('[PERF-TRACKER] Fatal error:', error);
  process.exit(1);
});
