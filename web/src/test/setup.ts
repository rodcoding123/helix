import { afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Supabase client creation for all services
vi.mock('@supabase/supabase-js', () => {
  const createQueryBuilder = () => {
    const self: any = {};

    // Create chainable methods that return self and are also awaitable
    const chainMethods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'range', 'not', 'or', 'is', 'filter', 'match', 'contains'];
    chainMethods.forEach(method => {
      self[method] = vi.fn(function(...args: any[]) {
        return self;
      });
    });

    // Make the builder awaitable for calls without .single()
    self.then = vi.fn((resolve: (value: any) => any) => {
      // Return a promise that resolves to { data: [...], error: null }
      return resolve({ data: [{ id: 'test-id', created_at: new Date(), updated_at: new Date() }], error: null });
    });

    self.catch = vi.fn((reject: (reason?: any) => any) => {
      return self;
    });

    self.finally = vi.fn((onFinally?: () => void) => {
      return self;
    });

    // Terminal methods that return promises
    self.single = vi.fn().mockResolvedValue({ data: { id: 'test-id', created_at: new Date(), updated_at: new Date() }, error: null });
    self.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    return self;
  };

  return {
    createClient: vi.fn(() => {
      const supabaseClient: any = {};
      supabaseClient.from = vi.fn((_table: string) => createQueryBuilder());
      supabaseClient.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
      supabaseClient.on = vi.fn();
      supabaseClient.auth = {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(),
      };
      return supabaseClient;
    }),
  };
});

// Mock logging service for tests (prevents fetch errors to /api/discord-log)
vi.mock('@/services/logging', () => ({
  logToDiscord: vi.fn().mockResolvedValue(undefined),
}));

// Mock supabase-browser for repository classes
vi.mock('@/lib/supabase-browser', () => {
  const createQueryBuilder = () => {
    const self: any = {};

    // Create chainable methods that return self and are also awaitable
    const chainMethods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'range', 'not', 'or', 'is', 'filter', 'match', 'contains'];
    chainMethods.forEach(method => {
      self[method] = vi.fn(function(...args: any[]) {
        return self;
      });
    });

    // Make the builder awaitable for calls without .single()
    self.then = vi.fn((resolve: (value: any) => any) => {
      // Return a promise that resolves to { data: [...], error: null }
      return resolve({ data: [{ id: 'test-id', created_at: new Date(), updated_at: new Date() }], error: null });
    });

    self.catch = vi.fn((reject: (reason?: any) => any) => {
      return self;
    });

    self.finally = vi.fn((onFinally?: () => void) => {
      return self;
    });

    // Terminal methods that return promises
    self.single = vi.fn().mockResolvedValue({ data: { id: 'test-id', created_at: new Date(), updated_at: new Date() }, error: null });
    self.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    return self;
  };

  return {
    getSupabaseBrowserClient: vi.fn(() => {
      const supabaseClient: any = {};
      supabaseClient.from = vi.fn((_table: string) => createQueryBuilder());
      supabaseClient.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
      supabaseClient.on = vi.fn();
      supabaseClient.auth = {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(),
      };
      return supabaseClient;
    }),
  };
});

// Mock secrets-loader for tests (execSync won't work in jsdom)
vi.mock('@/lib/secrets-loader', () => ({
  loadSecret: vi.fn(async (itemName: string) => {
    const mockSecrets: Record<string, string> = {
      'Gemini API Key': 'test-gemini-key',
      'Supabase URL': 'http://localhost:54321',
      'Supabase Anon Key': 'test-anon-key',
      'Supabase Service Role': 'test-service-role-key',
    };
    return mockSecrets[itemName] || `test-key-for-${itemName}`;
  }),
  clearCache: vi.fn(),
  loadAllSecrets: vi.fn(),
  verifySecrets: vi.fn(),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables for testing
beforeAll(() => {
  // Supabase (VITE variables for client-side)
  vi.stubEnv('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL || 'http://localhost:54321');
  vi.stubEnv('VITE_SUPABASE_KEY', process.env.VITE_SUPABASE_KEY || 'test-anon-key');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key');

  // Supabase (REACT_APP variables for services that use them)
  vi.stubEnv('REACT_APP_SUPABASE_URL', process.env.REACT_APP_SUPABASE_URL || 'http://localhost:54321');
  vi.stubEnv('REACT_APP_SUPABASE_ANON_KEY', process.env.REACT_APP_SUPABASE_ANON_KEY || 'test-anon-key');
  vi.stubEnv('REACT_APP_SUPABASE_KEY', process.env.REACT_APP_SUPABASE_KEY || 'test-anon-key');

  // OAuth/Email configuration (needed for email services)
  vi.stubEnv('REACT_APP_GMAIL_CLIENT_ID', process.env.REACT_APP_GMAIL_CLIENT_ID || 'test-gmail-client-id');
  vi.stubEnv('REACT_APP_GMAIL_CLIENT_SECRET', process.env.REACT_APP_GMAIL_CLIENT_SECRET || 'test-gmail-secret');
  vi.stubEnv('REACT_APP_OUTLOOK_CLIENT_ID', process.env.REACT_APP_OUTLOOK_CLIENT_ID || 'test-outlook-client-id');
  vi.stubEnv('REACT_APP_OUTLOOK_CLIENT_SECRET', process.env.REACT_APP_OUTLOOK_CLIENT_SECRET || 'test-outlook-secret');

  // API Keys (non-VITE variables, load from .env if available)
  vi.stubEnv('DEEPSEEK_API_KEY', process.env.DEEPSEEK_API_KEY || 'test-deepseek-key');
  vi.stubEnv('GEMINI_API_KEY', process.env.GEMINI_API_KEY || 'test-gemini-key');
});

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Suppress console errors in tests (can be re-enabled per test)
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn((...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  });
});
