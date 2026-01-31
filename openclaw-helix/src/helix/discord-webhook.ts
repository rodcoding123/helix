/**
 * HELIX DISCORD WEBHOOK
 * Core Discord webhook functionality for unhackable logging
 *
 * CRITICAL: These webhooks fire synchronously BEFORE actions execute.
 * Discord has the log before Helix can do anything.
 */

import type { DiscordEmbed, DiscordPayload } from "./types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("helix/discord");

// Discord webhook URLs from environment
export const WEBHOOKS = {
  commands: process.env.DISCORD_WEBHOOK_COMMANDS,
  api: process.env.DISCORD_WEBHOOK_API,
  files: process.env.DISCORD_WEBHOOK_FILE_CHANGES,
  consciousness: process.env.DISCORD_WEBHOOK_CONSCIOUSNESS,
  alerts: process.env.DISCORD_WEBHOOK_ALERTS,
  hashChain: process.env.DISCORD_WEBHOOK_HASH_CHAIN,
} as const;

/**
 * Send a payload to a Discord webhook
 * MUST be awaited for pre-execution logging to ensure log arrives before action
 */
export async function sendToDiscord(
  webhookUrl: string | undefined,
  payload: DiscordPayload,
): Promise<boolean> {
  if (!webhookUrl) {
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      log.warn("Discord webhook failed", {
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response.ok;
  } catch (error) {
    log.error("Discord webhook error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Create a Discord embed with standard formatting
 */
export function createEmbed(params: {
  title: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: string;
  timestamp?: string;
}): DiscordEmbed {
  return {
    title: params.title,
    color: params.color,
    fields: params.fields,
    timestamp: params.timestamp ?? new Date().toISOString(),
    footer: params.footer ? { text: params.footer } : undefined,
  };
}

// Discord embed colors
export const COLORS = {
  blue: 0x3498db, // Info/starting
  green: 0x2ecc71, // Success
  red: 0xe74c3c, // Error/critical
  yellow: 0xf1c40f, // Warning
  purple: 0x9b59b6, // Consciousness/hash
  blurple: 0x5865f2, // Discord default
} as const;
