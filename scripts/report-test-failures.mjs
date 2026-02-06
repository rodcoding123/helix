#!/usr/bin/env node

/**
 * Automated Test Failure Reporter
 * Sends test failures to Discord webhook with detailed analysis
 *
 * Usage:
 *   node scripts/report-test-failures.mjs <test-results-json>
 *
 * Environment:
 *   DISCORD_WEBHOOK_FAILURES - Discord webhook URL for failure reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TestResult {
  title: string;
  status: string;
  error?: {
    message: string;
    stack?: string;
  };
  duration: number;
  file: string;
  browser?: string;
}

interface FailureReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failureRate: number;
  failures: TestResult[];
  duration: number;
  timestamp: string;
}

/**
 * Parse Playwright JSON results
 */
function parsePlaywrightResults(filePath: string): FailureReport {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    const failures: TestResult[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // Parse suite results
    data.suites?.forEach((suite: any) => {
      suite.tests?.forEach((test: any) => {
        totalTests++;
        if (test.status === 'passed') {
          passedTests++;
        } else if (test.status === 'failed') {
          failedTests++;
          failures.push({
            title: test.title,
            status: test.status,
            error: test.error,
            duration: test.duration || 0,
            file: suite.file || 'unknown',
            browser: suite.project?.name || 'unknown',
          });
        }
      });
    });

    return {
      totalTests,
      passedTests,
      failedTests,
      failureRate: totalTests > 0 ? (failedTests / totalTests) * 100 : 0,
      failures: failures.slice(0, 10), // Top 10 failures
      duration: data.stats?.duration || 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[FAILURE-REPORTER] Failed to parse results:', error);
    throw error;
  }
}

/**
 * Format failure for Discord
 */
function formatFailureEmbed(failure: TestResult): string {
  const errorMsg = failure.error?.message || 'Unknown error';
  const truncated = errorMsg.length > 200 ? errorMsg.substring(0, 197) + '...' : errorMsg;

  return `
**${failure.title}**
File: \`${path.basename(failure.file)}\`
Browser: \`${failure.browser}\`
Duration: ${failure.duration}ms
Error: \`\`\`
${truncated}
\`\`\`
`;
}

/**
 * Send report to Discord
 */
async function sendDiscordReport(report: FailureReport): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_FAILURES;

  if (!webhookUrl) {
    console.warn('[FAILURE-REPORTER] No Discord webhook configured, skipping notification');
    return;
  }

  // Determine color based on failure rate
  let color = 0x00ff00; // Green
  if (report.failureRate > 0 && report.failureRate < 10) color = 0xffff00; // Yellow
  if (report.failureRate >= 10) color = 0xff0000; // Red

  const embed = {
    title: '🔴 Test Failure Report',
    description: `${report.failedTests}/${report.totalTests} tests failed (${report.failureRate.toFixed(1)}%)`,
    color,
    fields: [
      {
        name: 'Summary',
        value: `
Passed: ${report.passedTests}
Failed: ${report.failedTests}
Duration: ${(report.duration / 1000).toFixed(2)}s
`,
        inline: true,
      },
      {
        name: 'Top Failures',
        value:
          report.failures.length > 0
            ? report.failures.map(f => `• ${f.title} (${f.browser})`).join('\n')
            : 'No failures',
        inline: false,
      },
    ],
    timestamp: report.timestamp,
    footer: {
      text: 'Helix Desktop Test Suite',
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
        username: 'Helix Test Reporter',
        avatar_url:
          'https://raw.githubusercontent.com/anthropics/anthropic-sdk-python/main/README.md',
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.statusText}`);
    }

    console.log('[FAILURE-REPORTER] Discord notification sent successfully');
  } catch (error) {
    console.error('[FAILURE-REPORTER] Failed to send Discord notification:', error);
    throw error;
  }
}

/**
 * Generate HTML report
 */
function generateHtmlReport(report: FailureReport): string {
  const failureHtml = report.failures
    .map(
      f => `
    <tr>
      <td>${f.title}</td>
      <td>${f.browser}</td>
      <td>${f.file}</td>
      <td>${f.duration}ms</td>
      <td><code>${(f.error?.message || 'Unknown').substring(0, 100)}</code></td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Failure Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .summary.failed { background: #ffe6e6; border-left: 4px solid #ff0000; }
    .summary.warning { background: #fff4e6; border-left: 4px solid #ffff00; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; font-weight: bold; }
    tr:hover { background: #f9f9f9; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
    .timestamp { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Test Failure Report</h1>
  <div class="summary ${report.failureRate >= 10 ? 'failed' : report.failureRate > 0 ? 'warning' : ''}">
    <h2>${report.failedTests} / ${report.totalTests} tests failed (${report.failureRate.toFixed(1)}%)</h2>
    <p>Total Duration: ${(report.duration / 1000).toFixed(2)}s</p>
    <p class="timestamp">Generated: ${new Date(report.timestamp).toLocaleString()}</p>
  </div>

  <h2>Failure Details</h2>
  <table>
    <thead>
      <tr>
        <th>Test Title</th>
        <th>Browser</th>
        <th>File</th>
        <th>Duration</th>
        <th>Error Message</th>
      </tr>
    </thead>
    <tbody>
      ${failureHtml}
    </tbody>
  </table>
</body>
</html>
  `;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('[FAILURE-REPORTER] Usage: node report-test-failures.mjs <results.json>');
    process.exit(1);
  }

  const resultsFile = args[0];

  if (!fs.existsSync(resultsFile)) {
    console.error(`[FAILURE-REPORTER] File not found: ${resultsFile}`);
    process.exit(1);
  }

  console.log(`[FAILURE-REPORTER] Parsing test results from: ${resultsFile}`);

  const report = parsePlaywrightResults(resultsFile);

  console.log(
    `[FAILURE-REPORTER] Found ${report.failedTests} failures out of ${report.totalTests} tests`
  );

  if (report.failedTests > 0) {
    // Send Discord notification
    await sendDiscordReport(report);

    // Generate HTML report
    const htmlReport = generateHtmlReport(report);
    const reportPath = path.join(path.dirname(resultsFile), 'failure-report.html');
    fs.writeFileSync(reportPath, htmlReport);
    console.log(`[FAILURE-REPORTER] HTML report saved to: ${reportPath}`);
  } else {
    console.log('[FAILURE-REPORTER] All tests passed! ✅');
  }
}

main().catch(error => {
  console.error('[FAILURE-REPORTER] Fatal error:', error);
  process.exit(1);
});
