/**
 * Message Filters Gateway Methods
 *
 * HTTP-like methods for managing message filters:
 * - filters.list - List all filters
 * - filters.create - Create new filter
 * - filters.update - Update existing filter
 * - filters.delete - Delete filter
 * - filters.test - Test filter against message
 */

import { loadConfig, writeConfigFile } from '../../config/config.js';
import { compileFilters, applyFilters } from '../../channels/filters/engine.js';
import type { MessageFilter } from '../../channels/policies/types.js';
import {
  ErrorCodes,
  errorShape,
} from '../protocol/index.js';
import type { GatewayRequestHandlers } from './types.js';

export const filtersHandlers: GatewayRequestHandlers = {
  'filters.list': ({ params, respond }) => {
    const cfg = loadConfig();
    const filters = (cfg as any).filters?.messages ?? [];

    respond(true, { filters }, undefined);
  },

  'filters.create': ({ params, respond }) => {
    if (!params || typeof params !== 'object') {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'params required'));
      return;
    }

    const { name, type, pattern, action, priority } = params as Partial<MessageFilter>;

    if (!name || !type || !pattern || !action) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          'name, type, pattern, and action required'
        )
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const filters = (cfg as any).filters?.messages ?? [];
      const id = `filter_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const newFilter: MessageFilter = {
        id,
        name,
        type: type as any,
        pattern,
        action: action as any,
        priority: priority ?? 0,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nextFilters = [...filters, newFilter];
      const nextCfg = {
        ...cfg,
        filters: {
          ...((cfg as any).filters ?? {}),
          messages: nextFilters,
        },
      };

      writeConfigFile(nextCfg);
      respond(true, { ok: true, id }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to create filter: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },

  'filters.update': ({ params, respond }) => {
    if (!params || typeof params !== 'object') {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'params required'));
      return;
    }

    const { id, updates } = params as {
      id: string;
      updates: Partial<MessageFilter>;
    };

    if (!id || !updates) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, 'id and updates required')
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const filters = ((cfg as any).filters?.messages ?? []).map((f: MessageFilter) => {
        if (f.id === id) {
          return {
            ...f,
            ...updates,
            updatedAt: Date.now(),
          };
        }
        return f;
      });

      const nextCfg = {
        ...cfg,
        filters: {
          ...((cfg as any).filters ?? {}),
          messages: filters,
        },
      };

      writeConfigFile(nextCfg);
      respond(true, { ok: true, updatedAt: Date.now() }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to update filter: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },

  'filters.delete': ({ params, respond }) => {
    if (!params || typeof params !== 'object') {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'params required'));
      return;
    }

    const { id } = params as { id: string };

    if (!id) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'id required'));
      return;
    }

    try {
      const cfg = loadConfig();
      const filters = ((cfg as any).filters?.messages ?? []).filter(
        (f: MessageFilter) => f.id !== id
      );

      const nextCfg = {
        ...cfg,
        filters: {
          ...((cfg as any).filters ?? {}),
          messages: filters,
        },
      };

      writeConfigFile(nextCfg);
      respond(true, { ok: true }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to delete filter: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },

  'filters.test': async ({ params, respond }) => {
    if (!params || typeof params !== 'object') {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'params required'));
      return;
    }

    const { message, filterId } = params as {
      message: string;
      filterId?: string;
    };

    if (!message) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'message required'));
      return;
    }

    try {
      const cfg = loadConfig();
      const allFilters = ((cfg as any).filters?.messages ?? []) as MessageFilter[];

      // Filter by ID if specified
      const filters = filterId
        ? allFilters.filter((f) => f.id === filterId)
        : allFilters;

      const compiled = compileFilters(filters);
      const result = await applyFilters(message, compiled, 100);

      respond(true, result, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to test filter: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },
};
