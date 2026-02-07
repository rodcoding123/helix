/**
 * Gateway Methods: Policies
 *
 * Policy management endpoints for channel message filtering and authorization.
 * Three-tier scope resolution: Account-specific > Channel-specific > Global
 */

import { Type as T } from '@sinclair/typebox';
import { PolicyEngine } from '../../channels/policies/index.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  PolicyRule,
  PoliciesConfig,
  PolicyEvaluationResult,
  PolicyProfile,
} from '../../channels/policies/index.js';

// Initialize policy engine with default config
let policyEngine: PolicyEngine | null = null;

function getPolicyEngine(): PolicyEngine {
  if (!policyEngine) {
    const defaultConfig: PoliciesConfig = {
      version: '1.0.0',
      global: {
        dmPolicy: 'open',
        groupPolicy: 'open',
        rules: [],
      },
      channels: {},
      profiles: [],
      auditLog: [],
    };
    policyEngine = new PolicyEngine(defaultConfig);
  }
  return policyEngine;
}

/**
 * GET /api/policies
 * Get current policy configuration
 */
async function getPolicies(request: FastifyRequest, reply: FastifyReply) {
  const engine = getPolicyEngine();
  return reply.send({
    ok: true,
    config: engine.getConfig(),
  });
}

/**
 * GET /api/policies/evaluate/dm
 * Evaluate DM policy for a sender
 */
async function evaluateDmPolicy(
  request: FastifyRequest<{
    Querystring: { sender: string; channel: string; account?: string };
  }>,
  reply: FastifyReply
) {
  const { sender, channel, account } = request.query;
  const engine = getPolicyEngine();

  const result = engine.evaluateDmPolicy(sender, channel, account);
  return reply.send({ ok: true, result });
}

/**
 * GET /api/policies/evaluate/group
 * Evaluate group policy for a group
 */
async function evaluateGroupPolicy(
  request: FastifyRequest<{
    Querystring: { groupId: string; channel: string; account?: string };
  }>,
  reply: FastifyReply
) {
  const { groupId, channel, account } = request.query;
  const engine = getPolicyEngine();

  const result = engine.evaluateGroupPolicy(groupId, channel, account);
  return reply.send({ ok: true, result });
}

/**
 * POST /api/policies/rules
 * Create or update a policy rule
 */
async function upsertRule(
  request: FastifyRequest<{
    Body: PolicyRule;
  }>,
  reply: FastifyReply
) {
  const rule = request.body;
  const engine = getPolicyEngine();
  const config = engine.getConfig();

  // Validate scope
  if (rule.scope === 'channel' && !rule.channel) {
    return reply.status(400).send({
      ok: false,
      error: 'Channel required for channel-scoped rule',
    });
  }

  if (rule.scope === 'account' && !rule.account) {
    return reply.status(400).send({
      ok: false,
      error: 'Account required for account-scoped rule',
    });
  }

  // Add or update rule
  if (rule.scope === 'global') {
    const existing = config.global.rules.findIndex(r => r.id === rule.id);
    if (existing >= 0) {
      config.global.rules[existing] = rule;
    } else {
      config.global.rules.push(rule);
    }
  } else if (rule.scope === 'channel' && rule.channel) {
    if (!config.channels[rule.channel]) {
      config.channels[rule.channel] = {
        channel: rule.channel,
        account: rule.account,
        dmPolicy: { scope: 'channel', mode: 'open' },
        groupPolicy: { scope: 'channel', mode: 'open' },
        rules: [],
      };
    }

    const existing = config.channels[rule.channel].rules.findIndex(
      r => r.id === rule.id
    );
    if (existing >= 0) {
      config.channels[rule.channel].rules[existing] = rule;
    } else {
      config.channels[rule.channel].rules.push(rule);
    }
  }

  engine.updateConfig(config);

  return reply.send({ ok: true, rule });
}

/**
 * DELETE /api/policies/rules/:id
 * Delete a policy rule
 */
async function deleteRule(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const engine = getPolicyEngine();
  const config = engine.getConfig();

  // Remove from global rules
  config.global.rules = config.global.rules.filter(r => r.id !== id);

  // Remove from channel rules
  for (const channel of Object.values(config.channels)) {
    channel.rules = channel.rules.filter(r => r.id !== id);
  }

  engine.updateConfig(config);

  return reply.send({ ok: true });
}

/**
 * POST /api/policies/apply-profile
 * Apply a policy profile
 */
async function applyProfile(
  request: FastifyRequest<{
    Body: { profileId: string; channel?: string; account?: string };
  }>,
  reply: FastifyReply
) {
  const { profileId, channel, account } = request.body;
  const engine = getPolicyEngine();

  try {
    engine.applyProfile(profileId, channel, account);
    return reply.send({ ok: true, message: 'Profile applied' });
  } catch (error) {
    return reply.status(404).send({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Gateway method handlers
 */
export const policyMethods = {
  'policies.get': async (params: unknown) => {
    const engine = getPolicyEngine();
    return { ok: true, config: engine.getConfig() };
  },

  'policies.evaluate.dm': async (params: {
    sender: string;
    channel: string;
    account?: string;
  }) => {
    const engine = getPolicyEngine();
    const result = engine.evaluateDmPolicy(params.sender, params.channel, params.account);
    return { ok: true, result };
  },

  'policies.evaluate.group': async (params: {
    groupId: string;
    channel: string;
    account?: string;
  }) => {
    const engine = getPolicyEngine();
    const result = engine.evaluateGroupPolicy(
      params.groupId,
      params.channel,
      params.account
    );
    return { ok: true, result };
  },

  'policies.evaluate.rules': async (params: {
    sender: string;
    channel: string;
    message: string;
    account?: string;
  }) => {
    const engine = getPolicyEngine();
    const result = engine.evaluateRules(
      params.sender,
      params.channel,
      params.message,
      params.account
    );
    return { ok: true, result };
  },

  'policies.rule.upsert': async (params: { rule: PolicyRule }) => {
    const engine = getPolicyEngine();
    const config = engine.getConfig();

    if (params.rule.scope === 'channel' && !params.rule.channel) {
      throw new Error('Channel required for channel-scoped rule');
    }

    if (params.rule.scope === 'account' && !params.rule.account) {
      throw new Error('Account required for account-scoped rule');
    }

    // Add/update rule based on scope
    if (params.rule.scope === 'global') {
      const idx = config.global.rules.findIndex(r => r.id === params.rule.id);
      if (idx >= 0) {
        config.global.rules[idx] = params.rule;
      } else {
        config.global.rules.push(params.rule);
      }
    } else if (params.rule.scope === 'channel' && params.rule.channel) {
      if (!config.channels[params.rule.channel]) {
        config.channels[params.rule.channel] = {
          channel: params.rule.channel,
          account: params.rule.account,
          dmPolicy: { scope: 'channel', mode: 'open' },
          groupPolicy: { scope: 'channel', mode: 'open' },
          rules: [],
        };
      }
      const idx = config.channels[params.rule.channel].rules.findIndex(
        r => r.id === params.rule.id
      );
      if (idx >= 0) {
        config.channels[params.rule.channel].rules[idx] = params.rule;
      } else {
        config.channels[params.rule.channel].rules.push(params.rule);
      }
    }

    engine.updateConfig(config);
    return { ok: true, rule: params.rule };
  },

  'policies.rule.delete': async (params: { ruleId: string }) => {
    const engine = getPolicyEngine();
    const config = engine.getConfig();

    config.global.rules = config.global.rules.filter(r => r.id !== params.ruleId);
    for (const channel of Object.values(config.channels)) {
      channel.rules = channel.rules.filter(r => r.id !== params.ruleId);
    }

    engine.updateConfig(config);
    return { ok: true };
  },

  'policies.profile.apply': async (params: {
    profileId: string;
    channel?: string;
    account?: string;
  }) => {
    const engine = getPolicyEngine();
    engine.applyProfile(params.profileId, params.channel, params.account);
    return { ok: true };
  },
};

/**
 * Register policy routes with Fastify
 */
export async function registerPolicyRoutes(fastify: FastifyInstance) {
  fastify.get('/api/policies', getPolicies);
  fastify.get('/api/policies/evaluate/dm', evaluateDmPolicy);
  fastify.get('/api/policies/evaluate/group', evaluateGroupPolicy);
  fastify.post('/api/policies/rules', upsertRule);
  fastify.delete('/api/policies/rules/:id', deleteRule);
  fastify.post('/api/policies/apply-profile', applyProfile);
}
