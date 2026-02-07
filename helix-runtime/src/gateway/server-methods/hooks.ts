/**
 * Hooks Management Gateway Methods
 *
 * Implements hook lifecycle management (enable, disable, configure, install, uninstall).
 * Hooks provide extensible callback points for gateway events and command execution.
 *
 * Phase I: Advanced Configuration - Hooks Management
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateHooksDisableParams,
  validateHooksEnableParams,
  validateHooksGetConfigParams,
  validateHooksInstallParams,
  validateHooksListParams,
  validateHooksPriorityParams,
  validateHooksUninstallParams,
  validateHooksUpdateConfigParams,
  validateHooksValidateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const hooksHandlers: GatewayRequestHandlers = {
  "hooks.list": async ({ params, respond }) => {
    if (!validateHooksListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.list params: ${formatValidationErrors(validateHooksListParams.errors)}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      const hooks = config.hooks || [];

      respond(true, { hooks }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "hooks.getConfig": async ({ params, respond }) => {
    if (!validateHooksGetConfigParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.getConfig params: ${formatValidationErrors(
            validateHooksGetConfigParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      const hook = config.hooks?.find((h) => h.id === params.hookId);

      if (!hook) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Hook not found"));
        return;
      }

      respond(true, { config: hook.config || {} }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "hooks.updateConfig": async ({ params, respond }) => {
    if (!validateHooksUpdateConfigParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.updateConfig params: ${formatValidationErrors(
            validateHooksUpdateConfigParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      const hook = config.hooks?.find((h) => h.id === params.hookId);

      if (!hook) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Hook not found"));
        return;
      }

      hook.config = { ...hook.config, ...params.config };
      await writeConfigFile(config);

      respond(true, { config: hook.config }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "hooks.enable": async ({ params, respond }) => {
    if (!validateHooksEnableParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.enable params: ${formatValidationErrors(validateHooksEnableParams.errors)}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      const hook = config.hooks?.find((h) => h.id === params.hookId);

      if (!hook) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Hook not found"));
        return;
      }

      hook.status = "enabled";
      hook.error = undefined;
      await writeConfigFile(config);

      respond(true, {}, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "hooks.disable": async ({ params, respond }) => {
    if (!validateHooksDisableParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.disable params: ${formatValidationErrors(
            validateHooksDisableParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      const hook = config.hooks?.find((h) => h.id === params.hookId);

      if (!hook) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Hook not found"));
        return;
      }

      hook.status = "disabled";
      await writeConfigFile(config);

      respond(true, {}, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "hooks.install": async ({ params, respond }) => {
    if (!validateHooksInstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.install params: ${formatValidationErrors(validateHooksInstallParams.errors)}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      if (!config.hooks) {
        config.hooks = [];
      }

      // Validate file exists
      const filePath = resolve(params.filePath);
      if (!existsSync(filePath)) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Hook file not found"));
        return;
      }

      // Check for duplicate hook
      if (config.hooks.some((h) => h.filePath === filePath)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Hook already installed"),
        );
        return;
      }

      const hook = {
        id: randomUUID(),
        name: params.name,
        type: "custom" as const,
        status: "enabled" as const,
        filePath,
        config: params.config || {},
        priority: config.hooks.length,
      };

      config.hooks.push(hook);
      await writeConfigFile(config);

      respond(true, { hook }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "hooks.uninstall": async ({ params, respond }) => {
    if (!validateHooksUninstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.uninstall params: ${formatValidationErrors(
            validateHooksUninstallParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      if (!config.hooks) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Hook not found"));
        return;
      }

      const index = config.hooks.findIndex((h) => h.id === params.hookId);
      if (index === -1) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Hook not found"));
        return;
      }

      // Only allow uninstalling custom hooks
      if (config.hooks[index].type === "bundled") {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Cannot uninstall bundled hook"),
        );
        return;
      }

      config.hooks.splice(index, 1);
      await writeConfigFile(config);

      respond(true, {}, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "hooks.validate": async ({ params, respond }) => {
    if (!validateHooksValidateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.validate params: ${formatValidationErrors(
            validateHooksValidateParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const filePath = resolve(params.filePath);

      // Check file exists
      if (!existsSync(filePath)) {
        respond(true, { valid: false, error: "File not found" }, undefined);
        return;
      }

      // Check file extension
      const ext = extname(filePath);
      if (![".js", ".ts", ".mjs"].includes(ext)) {
        respond(
          true,
          { valid: false, error: `Invalid file extension: ${ext}` },
          undefined,
        );
        return;
      }

      // Try to parse/load the hook
      try {
        const content = readFileSync(filePath, "utf-8");

        // Basic validation: check for export default or module.exports
        if (!content.includes("export default") && !content.includes("module.exports")) {
          respond(
            true,
            { valid: false, error: "Hook must export a default function or module.exports" },
            undefined,
          );
          return;
        }

        // For JS/MJS, we could do more validation, but basic checks are sufficient
        respond(true, { valid: true }, undefined);
      } catch (parseErr) {
        respond(true, { valid: false, error: String(parseErr) }, undefined);
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "hooks.priority": async ({ params, respond }) => {
    if (!validateHooksPriorityParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid hooks.priority params: ${formatValidationErrors(validateHooksPriorityParams.errors)}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      if (!config.hooks) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "No hooks configured"));
        return;
      }

      // Verify all hook IDs exist
      const hookMap = new Map(config.hooks.map((h) => [h.id, h]));
      const reordered = params.hookIds
        .map((id) => hookMap.get(id))
        .filter((h) => h !== undefined) as typeof config.hooks;

      if (reordered.length !== config.hooks.length) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid hook IDs in priority list"),
        );
        return;
      }

      // Update priorities
      reordered.forEach((hook, index) => {
        hook.priority = index;
      });

      config.hooks = reordered;
      await writeConfigFile(config);

      respond(true, { hooks: reordered }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
