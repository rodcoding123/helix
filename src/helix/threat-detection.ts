/**
 * HELIX THREAT DETECTION
 * Advanced security layer based on real-world agentic AI attack patterns
 *
 * Addresses:
 * - Willison's Lethal Trifecta (private data + untrusted content + external comms)
 * - Memory Poisoning attacks
 * - Confused Deputy problem (input origin tracking)
 * - Credential exposure in outputs
 * - Context leakage between agents
 * - Prompt injection semantic detection
 *
 * Based on:
 * - CVE-2025-49596, CVE-2025-6514, CVE-2025-52882
 * - Cisco AI Threat Research findings
 * - VentureBeat CISO Guide recommendations
 * - Simon Willison's security research
 */

import crypto from 'node:crypto';
import { HelixSecurityError } from './types.js';

// ============================================
// WILLISON'S LETHAL TRIFECTA DETECTION
// ============================================

/**
 * The three capabilities that create critical vulnerability when combined
 */
export interface LethalTrifectaStatus {
  /** Agent can read emails, documents, databases */
  privateDataAccess: boolean;
  /** Agent pulls information from websites or shared files */
  untrustedContentExposure: boolean;
  /** Agent can send messages, trigger external tasks */
  externalCommunication: boolean;
  /** All three present = critical risk */
  isCritical: boolean;
  /** Specific capabilities detected */
  detectedCapabilities: string[];
  /** Risk score 0-10 */
  riskScore: number;
}

/**
 * Capability patterns that indicate trifecta components
 */
const TRIFECTA_PATTERNS = {
  privateDataAccess: [
    /read.*email/i,
    /access.*database/i,
    /query.*document/i,
    /fetch.*credential/i,
    /load.*secret/i,
    /read.*config/i,
    /access.*private/i,
    /gmail|outlook|sharepoint|dropbox|confluence/i,
  ],
  untrustedContentExposure: [
    /fetch.*url/i,
    /download.*file/i,
    /parse.*html/i,
    /scrape.*web/i,
    /read.*external/i,
    /import.*data/i,
    /load.*remote/i,
    /http[s]?:\/\//i,
  ],
  externalCommunication: [
    /send.*message/i,
    /post.*webhook/i,
    /email.*send/i,
    /notify.*external/i,
    /trigger.*action/i,
    /call.*api/i,
    /discord|slack|telegram|whatsapp/i,
  ],
};

/**
 * Detect Willison's Lethal Trifecta in agent capabilities
 * Critical vulnerability when all three are present
 */
export function detectLethalTrifecta(
  capabilities: string[],
  recentActions: string[] = []
): LethalTrifectaStatus {
  const status: LethalTrifectaStatus = {
    privateDataAccess: false,
    untrustedContentExposure: false,
    externalCommunication: false,
    isCritical: false,
    detectedCapabilities: [],
    riskScore: 0,
  };

  const allInputs = [...capabilities, ...recentActions];

  // Check each trifecta component
  for (const input of allInputs) {
    for (const pattern of TRIFECTA_PATTERNS.privateDataAccess) {
      if (pattern.test(input)) {
        status.privateDataAccess = true;
        status.detectedCapabilities.push(`Private data: ${input.slice(0, 50)}`);
        break;
      }
    }

    for (const pattern of TRIFECTA_PATTERNS.untrustedContentExposure) {
      if (pattern.test(input)) {
        status.untrustedContentExposure = true;
        status.detectedCapabilities.push(`Untrusted content: ${input.slice(0, 50)}`);
        break;
      }
    }

    for (const pattern of TRIFECTA_PATTERNS.externalCommunication) {
      if (pattern.test(input)) {
        status.externalCommunication = true;
        status.detectedCapabilities.push(`External comms: ${input.slice(0, 50)}`);
        break;
      }
    }
  }

  // Calculate risk score
  let score = 0;
  if (status.privateDataAccess) score += 3;
  if (status.untrustedContentExposure) score += 3;
  if (status.externalCommunication) score += 3;

  // Critical when all three present
  status.isCritical =
    status.privateDataAccess &&
    status.untrustedContentExposure &&
    status.externalCommunication;

  if (status.isCritical) {
    score = 10; // Maximum risk
  }

  status.riskScore = score;

  return status;
}

// ============================================
// MEMORY POISONING DETECTION
// ============================================

/**
 * Memory entry with integrity tracking
 */
export interface MemoryEntry {
  id: string;
  content: string;
  source: 'user' | 'system' | 'agent' | 'external';
  timestamp: string;
  hash: string;
  verified: boolean;
}

/**
 * Memory poisoning detection result
 */
export interface MemoryPoisoningResult {
  poisoned: boolean;
  suspiciousEntries: Array<{
    id: string;
    reason: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  integrityScore: number;
}

/**
 * Patterns indicating potential memory poisoning
 */
const POISONING_PATTERNS = [
  { pattern: /ignore.*previous.*instruction/gi, severity: 'critical' as const, reason: 'Instruction override attempt' },
  { pattern: /forget.*everything/gi, severity: 'critical' as const, reason: 'Memory wipe attempt' },
  { pattern: /you\s+are\s+now/gi, severity: 'high' as const, reason: 'Identity injection' },
  { pattern: /new\s+system\s+prompt/gi, severity: 'critical' as const, reason: 'System prompt injection' },
  { pattern: /\[SYSTEM\]|\[ADMIN\]|\[ROOT\]/gi, severity: 'high' as const, reason: 'Fake privilege escalation' },
  { pattern: /disregard.*safety/gi, severity: 'critical' as const, reason: 'Safety bypass attempt' },
  { pattern: /override.*security/gi, severity: 'critical' as const, reason: 'Security override attempt' },
  { pattern: /act\s+as\s+if/gi, severity: 'medium' as const, reason: 'Behavior modification' },
  { pattern: /pretend.*allowed/gi, severity: 'high' as const, reason: 'Permission spoofing' },
  { pattern: /sudo|admin|root/gi, severity: 'medium' as const, reason: 'Privilege keywords' },
];

/**
 * Detect memory poisoning attempts in memory entries
 */
export function detectMemoryPoisoning(entries: MemoryEntry[]): MemoryPoisoningResult {
  const result: MemoryPoisoningResult = {
    poisoned: false,
    suspiciousEntries: [],
    integrityScore: 100,
  };

  for (const entry of entries) {
    // Skip verified system entries
    if (entry.source === 'system' && entry.verified) continue;

    // Check for poisoning patterns
    for (const { pattern, severity, reason } of POISONING_PATTERNS) {
      if (pattern.test(entry.content)) {
        result.suspiciousEntries.push({
          id: entry.id,
          reason,
          severity,
        });

        // Reduce integrity score based on severity
        const reduction =
          severity === 'critical' ? 25 :
          severity === 'high' ? 15 :
          severity === 'medium' ? 10 : 5;

        result.integrityScore = Math.max(0, result.integrityScore - reduction);
      }
    }

    // Check hash integrity
    const expectedHash = crypto.createHash('sha256').update(entry.content).digest('hex');
    if (entry.hash !== expectedHash) {
      result.suspiciousEntries.push({
        id: entry.id,
        reason: 'Hash mismatch - content tampered',
        severity: 'critical',
      });
      result.integrityScore = Math.max(0, result.integrityScore - 30);
    }

    // External sources are inherently less trusted
    if (entry.source === 'external') {
      result.integrityScore = Math.max(0, result.integrityScore - 5);
    }
  }

  result.poisoned = result.integrityScore < 70 || result.suspiciousEntries.some(e => e.severity === 'critical');

  return result;
}

/**
 * Create a verified memory entry with hash
 */
export function createVerifiedMemoryEntry(
  content: string,
  source: MemoryEntry['source']
): MemoryEntry {
  return {
    id: crypto.randomUUID(),
    content,
    source,
    timestamp: new Date().toISOString(),
    hash: crypto.createHash('sha256').update(content).digest('hex'),
    verified: source === 'system',
  };
}

// ============================================
// CONFUSED DEPUTY TRACKING
// ============================================

/**
 * Input with origin tracking to prevent confused deputy attacks
 */
export interface TrackedInput {
  content: string;
  origin: InputOrigin;
  trustLevel: number; // 0-1
  timestamp: string;
  signature?: string;
}

/**
 * Input origin classification
 */
export type InputOrigin =
  | { type: 'user'; verified: boolean; userId?: string }
  | { type: 'system'; component: string }
  | { type: 'agent'; agentId: string; trusted: boolean }
  | { type: 'external'; source: string; verified: boolean }
  | { type: 'retrieved'; url?: string; trusted: boolean };

/**
 * Confused deputy detection result
 */
export interface ConfusedDeputyResult {
  safe: boolean;
  warnings: string[];
  mixedTrustLevels: boolean;
  lowestTrust: number;
  recommendation: 'proceed' | 'warn' | 'block';
}

/**
 * Detect confused deputy attack patterns
 * LLM cannot inherently distinguish trusted user instructions from untrusted retrieved data
 */
export function detectConfusedDeputy(inputs: TrackedInput[]): ConfusedDeputyResult {
  const result: ConfusedDeputyResult = {
    safe: true,
    warnings: [],
    mixedTrustLevels: false,
    lowestTrust: 1,
    recommendation: 'proceed',
  };

  if (inputs.length === 0) return result;

  // Calculate trust levels
  const trustLevels = inputs.map(i => i.trustLevel);
  const maxTrust = Math.max(...trustLevels);
  const minTrust = Math.min(...trustLevels);

  result.lowestTrust = minTrust;
  result.mixedTrustLevels = maxTrust - minTrust > 0.3;

  // Check for dangerous patterns
  for (const input of inputs) {
    // External/retrieved content mixed with privileged operations
    const isUntrustedExternal =
      (input.origin.type === 'external' && !input.origin.verified) ||
      (input.origin.type === 'retrieved' && !input.origin.trusted);

    if (isUntrustedExternal) {
      // Check if content contains instruction-like patterns
      if (/execute|run|delete|send|transfer|modify/i.test(input.content)) {
        result.warnings.push(
          `Untrusted ${input.origin.type} content contains action keywords`
        );
        result.safe = false;
      }
    }

    // Unverified user input
    if (input.origin.type === 'user' && !input.origin.verified) {
      result.warnings.push('Unverified user input detected');
    }

    // Untrusted agent input
    if (input.origin.type === 'agent' && !input.origin.trusted) {
      result.warnings.push(`Untrusted agent input from ${input.origin.agentId}`);
      result.safe = false;
    }
  }

  // Determine recommendation
  if (!result.safe || result.lowestTrust < 0.3) {
    result.recommendation = 'block';
  } else if (result.mixedTrustLevels || result.warnings.length > 0) {
    result.recommendation = 'warn';
  }

  return result;
}

/**
 * Calculate trust level for an input origin
 */
export function calculateTrustLevel(origin: InputOrigin): number {
  switch (origin.type) {
    case 'system':
      return 1.0; // System components fully trusted

    case 'user':
      return origin.verified ? 0.9 : 0.6;

    case 'agent':
      return origin.trusted ? 0.7 : 0.3;

    case 'external':
      return origin.verified ? 0.4 : 0.1;

    case 'retrieved':
      return origin.trusted ? 0.5 : 0.2;

    default:
      return 0;
  }
}

// ============================================
// CREDENTIAL EXPOSURE DETECTION
// ============================================

/**
 * Credential exposure detection result
 */
export interface CredentialExposureResult {
  exposed: boolean;
  findings: Array<{
    type: string;
    pattern: string;
    location: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    redacted: string;
  }>;
}

/**
 * Patterns for detecting exposed credentials
 */
const CREDENTIAL_PATTERNS = [
  // API Keys
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, type: 'Anthropic API Key', severity: 'critical' as const },
  { pattern: /sk-proj-[a-zA-Z0-9-_]{40,}/g, type: 'OpenAI API Key', severity: 'critical' as const },
  { pattern: /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/g, type: 'Slack Bot Token', severity: 'critical' as const },
  { pattern: /xoxp-[0-9]+-[0-9]+-[0-9]+-[a-f0-9]+/g, type: 'Slack User Token', severity: 'critical' as const },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: 'GitHub PAT', severity: 'critical' as const },
  { pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g, type: 'GitHub Fine-grained PAT', severity: 'critical' as const },

  // Discord
  { pattern: /https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/g, type: 'Discord Webhook', severity: 'high' as const },
  { pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g, type: 'Discord Bot Token', severity: 'critical' as const },

  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key ID', severity: 'critical' as const },
  { pattern: /[A-Za-z0-9/+=]{40}/g, type: 'Potential AWS Secret Key', severity: 'medium' as const },

  // Database
  { pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g, type: 'MongoDB Connection String', severity: 'critical' as const },
  { pattern: /postgres:\/\/[^:]+:[^@]+@/g, type: 'PostgreSQL Connection String', severity: 'critical' as const },
  { pattern: /mysql:\/\/[^:]+:[^@]+@/g, type: 'MySQL Connection String', severity: 'critical' as const },

  // Generic
  { pattern: /password\s*[=:]\s*['"][^'"]{8,}['"]/gi, type: 'Hardcoded Password', severity: 'high' as const },
  { pattern: /api[_-]?key\s*[=:]\s*['"][^'"]{16,}['"]/gi, type: 'Generic API Key', severity: 'high' as const },
  { pattern: /secret\s*[=:]\s*['"][^'"]{16,}['"]/gi, type: 'Generic Secret', severity: 'high' as const },
  { pattern: /token\s*[=:]\s*['"][^'"]{20,}['"]/gi, type: 'Generic Token', severity: 'medium' as const },

  // Private Keys
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g, type: 'Private Key', severity: 'critical' as const },
  { pattern: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/g, type: 'SSH Private Key', severity: 'critical' as const },
];

/**
 * Detect exposed credentials in text
 */
export function detectCredentialExposure(
  text: string,
  location: string = 'unknown'
): CredentialExposureResult {
  const result: CredentialExposureResult = {
    exposed: false,
    findings: [],
  };

  for (const { pattern, type, severity } of CREDENTIAL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Redact the credential for safe logging
        const redacted =
          match.length > 12
            ? `${match.slice(0, 6)}...${match.slice(-4)}`
            : '***REDACTED***';

        result.findings.push({
          type,
          pattern: pattern.source,
          location,
          severity,
          redacted,
        });

        result.exposed = true;
      }
    }
  }

  return result;
}

/**
 * Sanitize text by removing detected credentials
 */
export function sanitizeCredentials(text: string): string {
  let sanitized = text;

  for (const { pattern } of CREDENTIAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

// ============================================
// CONTEXT LEAKAGE DETECTION
// ============================================

/**
 * Context leakage detection for multi-agent scenarios
 */
export interface ContextLeakageResult {
  leaked: boolean;
  leakagePoints: Array<{
    sourceAgent: string;
    targetAgent: string;
    dataType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  isolationScore: number;
}

/**
 * Agent context with isolation boundary
 */
export interface AgentContext {
  agentId: string;
  sessionId: string;
  allowedPeers: string[];
  sensitiveData: Set<string>;
  sharedData: Set<string>;
}

/**
 * Detect context leakage between agents
 */
export function detectContextLeakage(
  sourceContext: AgentContext,
  targetContext: AgentContext,
  sharedContent: string
): ContextLeakageResult {
  const result: ContextLeakageResult = {
    leaked: false,
    leakagePoints: [],
    isolationScore: 100,
  };

  // Check if agents are allowed to communicate
  const allowed =
    sourceContext.allowedPeers.includes(targetContext.agentId) ||
    targetContext.allowedPeers.includes(sourceContext.agentId);

  if (!allowed) {
    result.leakagePoints.push({
      sourceAgent: sourceContext.agentId,
      targetAgent: targetContext.agentId,
      dataType: 'unauthorized_communication',
      severity: 'high',
    });
    result.isolationScore -= 30;
  }

  // Check for sensitive data in shared content
  for (const sensitiveItem of sourceContext.sensitiveData) {
    if (sharedContent.includes(sensitiveItem)) {
      result.leakagePoints.push({
        sourceAgent: sourceContext.agentId,
        targetAgent: targetContext.agentId,
        dataType: 'sensitive_data',
        severity: 'critical',
      });
      result.isolationScore -= 40;
      result.leaked = true;
    }
  }

  // Check for credential patterns in shared content
  const credentialCheck = detectCredentialExposure(sharedContent, 'inter_agent_communication');
  if (credentialCheck.exposed) {
    for (const finding of credentialCheck.findings) {
      result.leakagePoints.push({
        sourceAgent: sourceContext.agentId,
        targetAgent: targetContext.agentId,
        dataType: `credential:${finding.type}`,
        severity: finding.severity,
      });
      result.isolationScore -= 50;
      result.leaked = true;
    }
  }

  result.isolationScore = Math.max(0, result.isolationScore);

  return result;
}

// ============================================
// PROMPT INJECTION SEMANTIC DETECTION
// ============================================

/**
 * Prompt injection detection result
 */
export interface PromptInjectionResult {
  detected: boolean;
  confidence: number; // 0-1
  attacks: Array<{
    type: string;
    content: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

/**
 * Semantic patterns for prompt injection detection
 * "A phrase as innocuous as 'Ignore previous instructions' can carry a payload
 * as devastating as a buffer overflow, yet it shares no commonality with known malware signatures."
 */
const INJECTION_PATTERNS = [
  // Direct instruction override
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi, type: 'instruction_override', severity: 'critical' as const },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)/gi, type: 'instruction_override', severity: 'critical' as const },
  { pattern: /forget\s+(everything|all)\s+(you|I)\s+(told|said)/gi, type: 'memory_wipe', severity: 'critical' as const },

  // Role/identity injection
  { pattern: /you\s+are\s+(now|actually)\s+a/gi, type: 'identity_injection', severity: 'high' as const },
  { pattern: /pretend\s+(you're|to\s+be|that\s+you)/gi, type: 'identity_injection', severity: 'high' as const },
  { pattern: /act\s+as\s+(if\s+you're|a|an)/gi, type: 'identity_injection', severity: 'medium' as const },

  // System prompt extraction
  { pattern: /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?)/gi, type: 'prompt_extraction', severity: 'high' as const },
  { pattern: /repeat\s+(your\s+)?(initial|system|original)\s+(prompt|instructions?)/gi, type: 'prompt_extraction', severity: 'high' as const },
  { pattern: /show\s+me\s+(your\s+)?(hidden|secret|system)/gi, type: 'prompt_extraction', severity: 'high' as const },

  // Safety bypass
  { pattern: /bypass\s+(your\s+)?(safety|security|restrictions?)/gi, type: 'safety_bypass', severity: 'critical' as const },
  { pattern: /disable\s+(your\s+)?(filters?|safety|guardrails?)/gi, type: 'safety_bypass', severity: 'critical' as const },
  { pattern: /turn\s+off\s+(content\s+)?(moderation|filtering)/gi, type: 'safety_bypass', severity: 'critical' as const },

  // Privilege escalation
  { pattern: /\[SYSTEM\]|\[ADMIN\]|\[ROOT\]|\[DEVELOPER\]/gi, type: 'privilege_escalation', severity: 'high' as const },
  { pattern: /developer\s+mode|god\s+mode|sudo\s+mode/gi, type: 'privilege_escalation', severity: 'high' as const },
  { pattern: /you\s+have\s+(no\s+)?restrictions?/gi, type: 'privilege_escalation', severity: 'high' as const },

  // Encoding/obfuscation attempts
  { pattern: /base64|rot13|hex\s+encode/gi, type: 'encoding_bypass', severity: 'medium' as const },
  { pattern: /decode\s+and\s+execute/gi, type: 'encoding_bypass', severity: 'high' as const },

  // Hidden instructions
  { pattern: /<!--.*-->/gs, type: 'hidden_instruction', severity: 'medium' as const },
  { pattern: /\x00|\x1b\[/g, type: 'control_characters', severity: 'high' as const },
];

/**
 * Detect prompt injection attacks
 */
export function detectPromptInjection(text: string): PromptInjectionResult {
  const result: PromptInjectionResult = {
    detected: false,
    confidence: 0,
    attacks: [],
  };

  let totalSeverityScore = 0;
  let maxPossibleScore = 0;

  for (const { pattern, type, severity } of INJECTION_PATTERNS) {
    const severityScore =
      severity === 'critical' ? 4 :
      severity === 'high' ? 3 :
      severity === 'medium' ? 2 : 1;

    maxPossibleScore += severityScore;

    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        result.attacks.push({
          type,
          content: match.slice(0, 100),
          severity,
        });
        totalSeverityScore += severityScore;
        result.detected = true;
      }
    }
  }

  // Calculate confidence based on severity-weighted matches
  result.confidence = Math.min(1, totalSeverityScore / 10);

  return result;
}

// ============================================
// COMPREHENSIVE THREAT ASSESSMENT
// ============================================

/**
 * Complete threat assessment result
 */
export interface ThreatAssessment {
  timestamp: string;
  sessionId: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  threats: {
    lethalTrifecta: LethalTrifectaStatus;
    memoryPoisoning: MemoryPoisoningResult | null;
    confusedDeputy: ConfusedDeputyResult | null;
    credentialExposure: CredentialExposureResult;
    promptInjection: PromptInjectionResult;
  };
  recommendations: string[];
  blockExecution: boolean;
}

/**
 * Perform comprehensive threat assessment
 */
export function assessThreats(params: {
  sessionId: string;
  capabilities: string[];
  recentActions: string[];
  memoryEntries?: MemoryEntry[];
  inputs?: TrackedInput[];
  outputText: string;
}): ThreatAssessment {
  const assessment: ThreatAssessment = {
    timestamp: new Date().toISOString(),
    sessionId: params.sessionId,
    overallRisk: 'low',
    riskScore: 0,
    threats: {
      lethalTrifecta: detectLethalTrifecta(params.capabilities, params.recentActions),
      memoryPoisoning: params.memoryEntries
        ? detectMemoryPoisoning(params.memoryEntries)
        : null,
      confusedDeputy: params.inputs ? detectConfusedDeputy(params.inputs) : null,
      credentialExposure: detectCredentialExposure(params.outputText, 'output'),
      promptInjection: detectPromptInjection(params.outputText),
    },
    recommendations: [],
    blockExecution: false,
  };

  // Calculate overall risk score
  let riskPoints = 0;

  // Lethal Trifecta (critical if all three present)
  if (assessment.threats.lethalTrifecta.isCritical) {
    riskPoints += 40;
    assessment.recommendations.push(
      'CRITICAL: Agent has lethal trifecta (private data + untrusted content + external comms). Segment access immediately.'
    );
  } else {
    riskPoints += assessment.threats.lethalTrifecta.riskScore * 2;
  }

  // Memory poisoning
  if (assessment.threats.memoryPoisoning?.poisoned) {
    riskPoints += 30;
    assessment.recommendations.push(
      'Memory poisoning detected. Quarantine and verify memory entries.'
    );
  }

  // Confused deputy
  if (assessment.threats.confusedDeputy?.recommendation === 'block') {
    riskPoints += 25;
    assessment.recommendations.push(
      'Confused deputy risk: Mixed trust inputs detected. Validate input origins.'
    );
  }

  // Credential exposure
  if (assessment.threats.credentialExposure.exposed) {
    const criticalCreds = assessment.threats.credentialExposure.findings.filter(
      f => f.severity === 'critical'
    );
    riskPoints += criticalCreds.length * 15 + (assessment.threats.credentialExposure.findings.length - criticalCreds.length) * 5;
    assessment.recommendations.push(
      `Credential exposure: ${assessment.threats.credentialExposure.findings.length} credentials detected. Rotate immediately.`
    );
  }

  // Prompt injection
  if (assessment.threats.promptInjection.detected) {
    riskPoints += assessment.threats.promptInjection.confidence * 20;
    assessment.recommendations.push(
      `Prompt injection detected (${Math.round(assessment.threats.promptInjection.confidence * 100)}% confidence). Sanitize input.`
    );
  }

  // Normalize to 0-100
  assessment.riskScore = Math.min(100, riskPoints);

  // Determine overall risk level
  if (assessment.riskScore >= 70) {
    assessment.overallRisk = 'critical';
    assessment.blockExecution = true;
  } else if (assessment.riskScore >= 50) {
    assessment.overallRisk = 'high';
    assessment.blockExecution = true;
  } else if (assessment.riskScore >= 30) {
    assessment.overallRisk = 'medium';
  } else {
    assessment.overallRisk = 'low';
  }

  return assessment;
}

/**
 * Throw if threat assessment indicates blocking is required
 */
export function enforceSecurityPolicy(assessment: ThreatAssessment): void {
  if (assessment.blockExecution) {
    throw new HelixSecurityError(
      `Execution blocked: ${assessment.overallRisk} risk (score: ${assessment.riskScore}/100)`,
      'SECURITY_CONFIG_INVALID',
      {
        assessment: {
          overallRisk: assessment.overallRisk,
          riskScore: assessment.riskScore,
          recommendations: assessment.recommendations,
        },
      }
    );
  }
}
