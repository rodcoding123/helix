import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAgentsListParams,
  validateAgentsAddParams,
  validateAgentsDeleteParams,
  validateAgentsSetDefaultParams,
} from "../protocol/index.js";
import { listAgentsForGateway } from "../session-utils.js";
import { agentsAddCommand } from "../../commands/agents.commands.add.js";
import { agentsDeleteCommand } from "../../commands/agents.commands.delete.js";
import { defaultRuntime } from "../../runtime.js";
import { createQuietRuntime } from "../../commands/agents.command-shared.js";
import { findAgentEntryIndex, listAgentEntries } from "../../commands/agents.config.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { resolveAgentDir, resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import type { GatewayRequestHandlers } from "./types.js";

export const agentsHandlers: GatewayRequestHandlers = {
  "agents.list": ({ params, respond }) => {
    if (!validateAgentsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.list params: ${formatValidationErrors(validateAgentsListParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const result = listAgentsForGateway(cfg);
    respond(true, result, undefined);
  },

  "agents.add": async ({ params, respond }) => {
    if (!validateAgentsAddParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.add params: ${formatValidationErrors(validateAgentsAddParams.errors)}`,
        ),
      );
      return;
    }

    try {
      const quietRuntime = createQuietRuntime(defaultRuntime);
      await agentsAddCommand(
        {
          name: params.name,
          workspace: params.workspace,
          model: params.model,
          bind: params.bind,
          nonInteractive: true,
          json: true,
        },
        quietRuntime,
        { hasFlags: true },
      );

      const cfg = loadConfig();
      const agentId = normalizeAgentId(params.name);
      const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
      const agentDir = resolveAgentDir(cfg, agentId);

      respond(
        true,
        {
          agentId,
          name: params.name,
          workspace: workspaceDir,
          agentDir,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `agents.add failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  },

  "agents.delete": async ({ params, respond }) => {
    if (!validateAgentsDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.delete params: ${formatValidationErrors(validateAgentsDeleteParams.errors)}`,
        ),
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const workspaceDir = resolveAgentWorkspaceDir(cfg, params.id);
      const agentDir = resolveAgentDir(cfg, params.id);

      const quietRuntime = createQuietRuntime(defaultRuntime);
      await agentsDeleteCommand(
        {
          id: params.id,
          force: params.force ?? true,
          json: true,
        },
        quietRuntime,
      );

      respond(
        true,
        {
          agentId: params.id,
          workspace: workspaceDir,
          agentDir,
          sessionsDir: `~/.helix-state/sessions/${params.id}`,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `agents.delete failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  },

  "agents.setDefault": ({ params, respond }) => {
    if (!validateAgentsSetDefaultParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.setDefault params: ${formatValidationErrors(
            validateAgentsSetDefaultParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const agents = cfg.agents || {};
      const defaults = agents.defaults || {};

      // Get the current default ID (fallback to 'default')
      const previousId = typeof defaults === "object" && defaults !== null && "id" in defaults
        ? (defaults as any).id
        : "default";

      // Check if agent exists
      if (params.id !== "default" && findAgentEntryIndex(listAgentEntries(cfg), params.id) < 0) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Agent "${params.id}" not found`),
        );
        return;
      }

      // Update config - ensure we properly set the default ID
      const nextConfig = {
        ...cfg,
        agents: {
          ...agents,
          defaults: {
            ...(typeof defaults === "object" && defaults !== null ? defaults : {}),
            id: params.id,
          },
        },
      };

      writeConfigFile(nextConfig);

      respond(
        true,
        {
          defaultId: params.id,
          previousId,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `agents.setDefault failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  },
};
