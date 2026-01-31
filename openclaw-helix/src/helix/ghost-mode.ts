/**
 * HELIX GHOST MODE
 * Complete privacy tier - all telemetry disabled
 *
 * PRICING (for later implementation):
 * - Ghost Mode: $9/month - All telemetry disabled
 * - Ghost Mode Pro: $19/month - Priority support + advanced features
 * - Ghost Mode Enterprise: Contact sales
 *
 * This module handles license validation for Ghost Mode subscribers.
 * Currently a STUB - will connect to licensing API later.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { GhostModeLicenseResponse } from "./telemetry-types.js";

const log = createSubsystemLogger("helix/ghost-mode");

// License validation endpoint (for later)
const LICENSE_API_ENDPOINT = "https://api.project-helix.org/v1/license/validate";

// Cache validated licenses to reduce API calls
interface CachedLicense {
  response: GhostModeLicenseResponse;
  validatedAt: string;
  expiresAt: string;
}

let licenseCache: CachedLicense | null = null;

/**
 * Validate a Ghost Mode license key
 *
 * License key format: GHOST-XXXX-XXXX-XXXX-XXXX
 *
 * STUB IMPLEMENTATION:
 * - Currently accepts test keys for development
 * - Will connect to actual licensing API later
 */
export async function validateGhostModeLicense(licenseKey: string): Promise<GhostModeLicenseResponse> {
  // Check cache first
  if (licenseCache && new Date(licenseCache.expiresAt) > new Date()) {
    log.info("Using cached license validation");
    return licenseCache.response;
  }

  // ============================================
  // STUB: Test keys for development
  // Remove these in production
  // ============================================
  if (licenseKey === "GHOST-TEST-0000-0000-0000") {
    log.info("STUB: Test Ghost Mode license accepted");
    const response: GhostModeLicenseResponse = {
      valid: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      tier: "ghost",
      message: "Test license - valid for development",
    };
    cacheValidation(response);
    return response;
  }

  if (licenseKey === "GHOST-PRO-0000-0000-0000") {
    log.info("STUB: Test Ghost Mode Pro license accepted");
    const response: GhostModeLicenseResponse = {
      valid: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tier: "ghost_pro",
      message: "Test Pro license - valid for development",
    };
    cacheValidation(response);
    return response;
  }

  // ============================================
  // STUB: Basic format validation
  // Real implementation will call licensing API
  // ============================================
  if (!isValidKeyFormat(licenseKey)) {
    return {
      valid: false,
      message: "Invalid license key format. Expected: GHOST-XXXX-XXXX-XXXX-XXXX",
    };
  }

  // ============================================
  // STUB: Log what would happen in production
  // ============================================
  log.info("GHOST MODE STUB: Would validate license with API", {
    endpoint: LICENSE_API_ENDPOINT,
    keyPrefix: licenseKey.slice(0, 10) + "...",
  });

  // For now, return invalid for non-test keys
  // In production, this would call the licensing API
  return {
    valid: false,
    message: "License validation not yet implemented. Use test key GHOST-TEST-0000-0000-0000 for development.",
  };

  // Production implementation would be:
  // try {
  //   const response = await fetch(LICENSE_API_ENDPOINT, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       licenseKey,
  //       instanceId: await getInstanceId(),
  //       platform: os.platform(),
  //     }),
  //   });
  //
  //   if (!response.ok) {
  //     return { valid: false, message: 'License server error' };
  //   }
  //
  //   const result = await response.json();
  //   cacheValidation(result);
  //   return result;
  // } catch (err) {
  //   log.error('License validation failed', { error: err });
  //   return { valid: false, message: 'Could not reach license server' };
  // }
}

/**
 * Check if a license key has the correct format
 */
function isValidKeyFormat(key: string): boolean {
  // Format: GHOST-XXXX-XXXX-XXXX-XXXX
  const pattern = /^GHOST(-[A-Z0-9]{4}){4}$/;
  return pattern.test(key);
}

/**
 * Cache a license validation response
 */
function cacheValidation(response: GhostModeLicenseResponse): void {
  if (!response.valid) {
    licenseCache = null;
    return;
  }

  licenseCache = {
    response,
    validatedAt: new Date().toISOString(),
    // Cache for 24 hours or until license expiry, whichever is sooner
    expiresAt: response.expiresAt
      ? new Date(
          Math.min(Date.now() + 24 * 60 * 60 * 1000, new Date(response.expiresAt).getTime()),
        ).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Clear the license cache (for testing or re-validation)
 */
export function clearLicenseCache(): void {
  licenseCache = null;
}

/**
 * Get Ghost Mode pricing info
 */
export function getGhostModePricing(): {
  tiers: Array<{
    id: string;
    name: string;
    price: string;
    features: string[];
  }>;
  purchaseUrl: string;
} {
  return {
    tiers: [
      {
        id: "ghost",
        name: "Ghost Mode",
        price: "$9/month",
        features: [
          "All telemetry disabled",
          "Complete privacy",
          "No data collection",
          "Email support",
        ],
      },
      {
        id: "ghost_pro",
        name: "Ghost Mode Pro",
        price: "$19/month",
        features: [
          "Everything in Ghost Mode",
          "Priority support",
          "Advanced configuration options",
          "Multiple instance support",
        ],
      },
      {
        id: "ghost_enterprise",
        name: "Ghost Mode Enterprise",
        price: "Contact sales",
        features: [
          "Everything in Ghost Mode Pro",
          "Custom deployment options",
          "SLA guarantees",
          "Dedicated support",
          "Volume licensing",
        ],
      },
    ],
    purchaseUrl: "https://project-helix.org/ghost-mode",
  };
}

/**
 * Show Ghost Mode upgrade prompt
 */
export function showGhostModeUpgradePrompt(): void {
  const pricing = getGhostModePricing();

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│                    UPGRADE TO GHOST MODE                        │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log("│                                                                 │");
  console.log("│  Want complete privacy? Ghost Mode disables ALL telemetry.      │");
  console.log("│                                                                 │");

  for (const tier of pricing.tiers.slice(0, 2)) {
    console.log(`│  ${tier.name.padEnd(20)} ${tier.price.padStart(15)}                   │`);
    for (const feature of tier.features.slice(0, 2)) {
      console.log(`│    • ${feature.padEnd(55)}│`);
    }
    console.log("│                                                                 │");
  }

  console.log("│  Learn more: https://project-helix.org/ghost-mode               │");
  console.log("│                                                                 │");
  console.log("└─────────────────────────────────────────────────────────────────┘");
  console.log("");
}

/**
 * Activate Ghost Mode with a license key
 */
export async function activateGhostMode(licenseKey: string): Promise<{
  success: boolean;
  message: string;
  tier?: string;
  expiresAt?: string;
}> {
  const validation = await validateGhostModeLicense(licenseKey);

  if (!validation.valid) {
    return {
      success: false,
      message: validation.message || "Invalid license key",
    };
  }

  // Save license key to config
  const configDir = process.env.OPENCLAW_CONFIG_DIR || path.join(os.homedir(), ".openclaw");
  const licenseFile = path.join(configDir, "helix-ghost-license");

  try {
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      licenseFile,
      JSON.stringify({
        licenseKey,
        activatedAt: new Date().toISOString(),
        tier: validation.tier,
        expiresAt: validation.expiresAt,
      }),
      "utf8",
    );
  } catch (err) {
    log.error("Failed to save Ghost Mode license", { error: err });
    return {
      success: false,
      message: "Failed to save license. Please try again.",
    };
  }

  return {
    success: true,
    message: `Ghost Mode activated! Tier: ${validation.tier}`,
    tier: validation.tier,
    expiresAt: validation.expiresAt,
  };
}

/**
 * Deactivate Ghost Mode
 */
export async function deactivateGhostMode(): Promise<{ success: boolean; message: string }> {
  const configDir = process.env.OPENCLAW_CONFIG_DIR || path.join(os.homedir(), ".openclaw");
  const licenseFile = path.join(configDir, "helix-ghost-license");

  try {
    await fs.unlink(licenseFile);
  } catch {
    // File didn't exist, that's fine
  }

  clearLicenseCache();

  return {
    success: true,
    message: "Ghost Mode deactivated. Telemetry will resume.",
  };
}

/**
 * Get current Ghost Mode status
 */
export async function getGhostModeStatus(): Promise<{
  active: boolean;
  tier?: string;
  expiresAt?: string;
  daysRemaining?: number;
}> {
  const configDir = process.env.OPENCLAW_CONFIG_DIR || path.join(os.homedir(), ".openclaw");
  const licenseFile = path.join(configDir, "helix-ghost-license");

  try {
    const data = await fs.readFile(licenseFile, "utf8");
    const license = JSON.parse(data);

    // Re-validate to check expiry
    const validation = await validateGhostModeLicense(license.licenseKey);

    if (!validation.valid) {
      return { active: false };
    }

    const expiresAt = validation.expiresAt ? new Date(validation.expiresAt) : null;
    const daysRemaining = expiresAt
      ? Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : undefined;

    return {
      active: true,
      tier: validation.tier,
      expiresAt: validation.expiresAt,
      daysRemaining,
    };
  } catch {
    return { active: false };
  }
}
