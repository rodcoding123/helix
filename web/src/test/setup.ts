import { afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

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
