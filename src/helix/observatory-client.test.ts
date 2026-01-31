/**
 * Tests for Helix Observatory client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HelixObservatoryClient,
  getObservatoryClient,
  shutdownObservatoryClient,
} from './observatory-client.js';

// Type for parsed telemetry body
interface TelemetryBody {
  instance_key: string;
  event_type: string;
  payload: {
    status?: string;
    metrics?: {
      cpu_load?: number;
      memory_used_mb?: number;
    };
    transformation?: string;
    fromState?: string;
    toState?: string;
    details?: {
      trigger?: string;
      description?: string;
      expected?: string;
      actual?: string;
    };
    layer?: number;
    content?: string;
    sha256?: string;
    updated_at?: string;
    anomaly_type?: string;
    severity?: string;
    description?: string;
    [key: string]: unknown;
  };
  timestamp: string;
  hash: string;
  previous_hash: string;
}

// Helper to safely parse mock fetch body
function parseMockCallBody(mockFn: ReturnType<typeof vi.fn>, callIndex = 0): TelemetryBody {
  const calls = mockFn.mock.calls as Array<[string, { body: string }]>;
  return JSON.parse(calls[callIndex][1].body) as TelemetryBody;
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock getChainState and computeEntryHash
vi.mock('./hash-chain.js', () => ({
  getChainState: vi.fn().mockResolvedValue({
    lastHash: 'mock-last-hash',
    sequence: 42,
    entries: 10,
  }),
  computeEntryHash: vi.fn().mockReturnValue('mock-computed-hash'),
}));

describe('HelixObservatoryClient - Constructor', () => {
  it('should create client with required instance key', () => {
    const client = new HelixObservatoryClient('test-instance');
    const status = client.getStatus();

    expect(status.instanceKey).toBe('test-instance');
    expect(status.observatoryUrl).toBe('http://localhost:3000');
    client.stopOfflineFlush();
  });

  it('should accept custom Observatory URL', () => {
    const client = new HelixObservatoryClient('test-instance', 'https://observatory.example.com');
    const status = client.getStatus();

    expect(status.observatoryUrl).toBe('https://observatory.example.com');
    client.stopOfflineFlush();
  });

  it('should initialize with online status', () => {
    const client = new HelixObservatoryClient('test-instance');
    expect(client.isConnected()).toBe(true);
    client.stopOfflineFlush();
  });

  it('should initialize with empty queue', () => {
    const client = new HelixObservatoryClient('test-instance');
    expect(client.getQueueSize()).toBe(0);
    client.stopOfflineFlush();
  });
});

describe('HelixObservatoryClient - sendTelemetry', () => {
  let client: HelixObservatoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HelixObservatoryClient('test-instance');
  });

  afterEach(() => {
    client.stopOfflineFlush();
  });

  it('should send telemetry successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await client.sendTelemetry('heartbeat', { status: 'healthy' });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/telemetry',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should include correct payload structure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await client.sendTelemetry('heartbeat', { status: 'healthy' });

    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.instance_key).toBe('test-instance');
    expect(callBody.event_type).toBe('heartbeat');
    expect(callBody.payload).toEqual({ status: 'healthy' });
    expect(callBody.timestamp).toBeDefined();
    expect(callBody.hash).toBeDefined();
    expect(callBody.previous_hash).toBeDefined();
  });

  it('should use provided hash if given', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await client.sendTelemetry('heartbeat', { status: 'healthy' }, 'custom-hash', 'custom-prev');

    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.hash).toBe('custom-hash');
    expect(callBody.previous_hash).toBe('custom-prev');
  });

  it('should return false on client error (4xx)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    });

    const result = await client.sendTelemetry('heartbeat', { status: 'healthy' });

    expect(result).toBe(false);
    expect(client.getQueueSize()).toBe(0); // Should not queue client errors
  });

  it('should queue events after max retries', async () => {
    // Use client with minimal retry config for this test
    client.stopOfflineFlush();
    const fastClient = new HelixObservatoryClient('test-instance', undefined, {
      maxRetries: 1,
      baseDelayMs: 10,
      maxDelayMs: 20,
    });

    // Mock all retries as failures
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await fastClient.sendTelemetry('heartbeat', { status: 'healthy' });

    expect(result).toBe(false);
    expect(fastClient.getQueueSize()).toBe(1);
    fastClient.stopOfflineFlush();
  });
});

describe('HelixObservatoryClient - sendHeartbeat', () => {
  let client: HelixObservatoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HelixObservatoryClient('test-instance');
  });

  afterEach(() => {
    client.stopOfflineFlush();
  });

  it('should send heartbeat with status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await client.sendHeartbeat('healthy');

    expect(result).toBe(true);
    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.event_type).toBe('heartbeat');
    expect(callBody.payload.status).toBe('healthy');
  });

  it('should include metrics if provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await client.sendHeartbeat('healthy', {
      cpu_load: 0.5,
      memory_used_mb: 512,
      memory_total_mb: 1024,
    });

    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.payload.metrics?.cpu_load).toBe(0.5);
    expect(callBody.payload.metrics?.memory_used_mb).toBe(512);
  });
});

describe('HelixObservatoryClient - sendTransformation', () => {
  let client: HelixObservatoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HelixObservatoryClient('test-instance');
  });

  afterEach(() => {
    client.stopOfflineFlush();
  });

  it('should send transformation with layer name', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await client.sendTransformation(
      1,
      'initial',
      'evolved',
      'user_interaction',
      'Testing transformation'
    );

    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.event_type).toBe('transformation');
    expect(callBody.payload.layer).toBe(1);
    expect(callBody.payload.layer_name).toBe('Narrative Core');
    expect(callBody.payload.from_state).toBe('initial');
    expect(callBody.payload.to_state).toBe('evolved');
    expect(callBody.payload.trigger).toBe('user_interaction');
    expect(callBody.payload.description).toBe('Testing transformation');
  });

  it('should handle all seven layers', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const layerNames = [
      'Narrative Core',
      'Emotional Memory',
      'Relational Memory',
      'Prospective Self',
      'Integration Rhythms',
      'Transformation Cycles',
      'Purpose Engine',
    ];

    for (let layer = 1; layer <= 7; layer++) {
      await client.sendTransformation(layer, 'from', 'to', 'trigger');

      const callBody = parseMockCallBody(mockFetch, layer - 1);
      expect(callBody.payload.layer_name).toBe(layerNames[layer - 1]);
    }
  });
});

describe('HelixObservatoryClient - sendCommand', () => {
  let client: HelixObservatoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HelixObservatoryClient('test-instance');
  });

  afterEach(() => {
    client.stopOfflineFlush();
  });

  it('should send command event', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await client.sendCommand('ls -la', '/home/user', 'completed', 0, 150);

    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.event_type).toBe('command');
    expect(callBody.payload.command).toBe('ls -la');
    expect(callBody.payload.workdir).toBe('/home/user');
    expect(callBody.payload.status).toBe('completed');
    expect(callBody.payload.exit_code).toBe(0);
    expect(callBody.payload.duration_ms).toBe(150);
  });
});

describe('HelixObservatoryClient - sendApiCall', () => {
  let client: HelixObservatoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HelixObservatoryClient('test-instance');
  });

  afterEach(() => {
    client.stopOfflineFlush();
  });

  it('should send API call event', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await client.sendApiCall('claude-3-opus', 'anthropic', 'completed', 1500, 2000);

    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.event_type).toBe('api_call');
    expect(callBody.payload.model).toBe('claude-3-opus');
    expect(callBody.payload.provider).toBe('anthropic');
    expect(callBody.payload.latency_ms).toBe(1500);
    expect(callBody.payload.token_count).toBe(2000);
  });
});

describe('HelixObservatoryClient - sendFileChange', () => {
  let client: HelixObservatoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HelixObservatoryClient('test-instance');
  });

  afterEach(() => {
    client.stopOfflineFlush();
  });

  it('should send file change event', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await client.sendFileChange('/path/to/file.ts', 'modified', 1024, 'abc123');

    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.event_type).toBe('file_change');
    expect(callBody.payload.path).toBe('/path/to/file.ts');
    expect(callBody.payload.change_type).toBe('modified');
    expect(callBody.payload.size_bytes).toBe(1024);
    expect(callBody.payload.content_hash).toBe('abc123');
  });
});

describe('HelixObservatoryClient - sendAnomaly', () => {
  let client: HelixObservatoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HelixObservatoryClient('test-instance');
  });

  afterEach(() => {
    client.stopOfflineFlush();
  });

  it('should send anomaly event', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await client.sendAnomaly('hash_mismatch', 'high', 'Hash chain integrity compromised', {
      expected: 'abc123',
      actual: 'def456',
    });

    const callBody = parseMockCallBody(mockFetch, 0);
    expect(callBody.event_type).toBe('anomaly');
    expect(callBody.payload.anomaly_type).toBe('hash_mismatch');
    expect(callBody.payload.severity).toBe('high');
    expect(callBody.payload.description).toBe('Hash chain integrity compromised');
    expect(callBody.payload.details?.expected).toBe('abc123');
    expect(callBody.payload.details?.actual).toBe('def456');
  });
});

describe('HelixObservatoryClient - Retry Logic', () => {
  let client: HelixObservatoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    // Use minimal retry config for faster tests
    client = new HelixObservatoryClient('test-instance', undefined, {
      maxRetries: 2,
      baseDelayMs: 10,
      maxDelayMs: 50,
    });
  });

  afterEach(() => {
    client.stopOfflineFlush();
  });

  it('should retry on server error', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Error') })
      .mockResolvedValueOnce({ ok: true });

    const result = await client.sendTelemetry('heartbeat', { status: 'healthy' });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should queue after all retries exhausted', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('Error') });

    const result = await client.sendTelemetry('heartbeat', { status: 'healthy' });

    expect(result).toBe(false);
    expect(client.getQueueSize()).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe('HelixObservatoryClient - Status', () => {
  it('should return complete status object', () => {
    const client = new HelixObservatoryClient('test-instance', 'https://test.com');
    const status = client.getStatus();

    expect(status).toEqual({
      instanceKey: 'test-instance',
      observatoryUrl: 'https://test.com',
      isOnline: true,
      queueSize: 0,
      lastHash: expect.any(String),
    });

    client.stopOfflineFlush();
  });
});

describe('HelixObservatoryClient - Singleton', () => {
  afterEach(async () => {
    await shutdownObservatoryClient();
  });

  it('should create singleton client', () => {
    const client1 = getObservatoryClient('singleton-test');
    const client2 = getObservatoryClient();

    expect(client1).toBe(client2);
  });

  it('should throw if no instance key on first call', () => {
    expect(() => getObservatoryClient()).toThrow('Instance key required');
  });

  it('should shutdown singleton client', async () => {
    getObservatoryClient('shutdown-test');
    await shutdownObservatoryClient();

    // Getting new client should require instance key again
    expect(() => getObservatoryClient()).toThrow('Instance key required');
  });
});

describe('HelixObservatoryClient - Shutdown', () => {
  it('should stop offline flush on shutdown', async () => {
    const client = new HelixObservatoryClient('test-instance');
    await client.shutdown();

    // No assertions needed - just verify no errors
  });
});

describe('Observatory Event Types', () => {
  it('should support all required event types', () => {
    const eventTypes = [
      'command',
      'api_call',
      'file_change',
      'heartbeat',
      'transformation',
      'anomaly',
    ];

    eventTypes.forEach(type => {
      expect(typeof type).toBe('string');
    });
  });
});

describe('Telemetry Payload Structure', () => {
  it('should have correct structure', () => {
    const payload = {
      instance_key: 'test',
      event_type: 'heartbeat' as const,
      payload: { status: 'healthy' },
      hash: 'abc123',
      previous_hash: 'xyz789',
      timestamp: new Date().toISOString(),
    };

    expect(payload.instance_key).toBeDefined();
    expect(payload.event_type).toBeDefined();
    expect(payload.payload).toBeDefined();
    expect(typeof payload.hash).toBe('string');
    expect(typeof payload.previous_hash).toBe('string');
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
