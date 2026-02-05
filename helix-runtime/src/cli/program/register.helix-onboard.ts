import type { Command } from 'commander';
import { helixOnboardCommand } from '../../commands/helix-onboard.js';
import { defaultRuntime } from '../../runtime.js';
import { runCommandWithRuntime } from '../cli-utils.js';

export function registerHelixOnboard(program: Command): void {
  program
    .command('helix-onboard')
    .description('Generate Helix instance key and save to .env')
    .option('--force', 'Force regeneration even if key exists', false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await helixOnboardCommand(opts, defaultRuntime);
      });
    });
}
