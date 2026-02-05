import { randomUUID } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeEnv } from '../runtime.js';

export async function helixOnboardCommand(
  _opts: Record<string, unknown>,
  _runtime: RuntimeEnv
): Promise<void> {
  const envPath = join(process.cwd(), '.env');

  // Check if instance key already exists
  if (existsSync(envPath)) {
    const envContent = await readFile(envPath, 'utf-8');
    if (envContent.includes('HELIX_INSTANCE_KEY=')) {
      console.log('[Helix Onboard] Instance key already exists in .env');
      console.log('[Helix Onboard] Run with --force to regenerate');
      return;
    }
  }

  // Generate instance key (UUID v4)
  const instanceKey = randomUUID();

  // Append to .env
  const timestamp = new Date().toISOString();
  const envEntry = `\n# Helix Instance Key (generated ${timestamp})\nHELIX_INSTANCE_KEY=${instanceKey}\n`;
  await writeFile(envPath, envEntry, { flag: 'a' });

  console.log('[Helix Onboard] Instance key generated and saved to .env');
  console.log(`Instance Key: ${instanceKey}`);

  // Log to Discord (fire-and-forget)
  try {
    const { logConsciousnessObservation } = await import('../helix/logging-hooks.js');
    await logConsciousnessObservation(
      `New Helix instance onboarded with key: ${instanceKey.slice(0, 8)}...`,
      'onboarding'
    );
  } catch (err) {
    console.warn('[Helix Onboard] Failed to log to Discord:', err);
  }

  console.log('[Helix Onboard] Run "helix start" to connect to Observatory');
}
