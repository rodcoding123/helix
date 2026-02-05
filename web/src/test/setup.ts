import { afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// In-memory database for stateful test mocking
const testDatabases: Map<string, Map<string, any[]>> = new Map();

function getTestDatabase(clientId: string): Map<string, any[]> {
  if (!testDatabases.has(clientId)) {
    testDatabases.set(clientId, new Map());
  }
  return testDatabases.get(clientId)!;
}

function getTableData(db: Map<string, any[]>, tableName: string): any[] {
  if (!db.has(tableName)) {
    db.set(tableName, []);
  }
  return db.get(tableName)!;
}

const ensureId = (item: any) => {
  if (!item.id) {
    item.id = crypto.randomUUID();
  }
  return item;
};

const addTimestamps = (item: any) => {
  const now = new Date().toISOString();
  if (!item.created_at) item.created_at = now;
  if (!item.updated_at) item.updated_at = now;
  return item;
};

const applyFilters = (data: any[], filters: Array<{ field: string; operator: string; value: any }> = []) => {
  return data.filter(item => {
    return filters.every(f => {
      const itemValue = item[f.field];
      switch (f.operator) {
        case 'eq':
          return itemValue === f.value;
        case 'neq':
          return itemValue !== f.value;
        case 'gt':
          return itemValue > f.value;
        case 'gte':
          return itemValue >= f.value;
        case 'lt':
          return itemValue < f.value;
        case 'lte':
          return itemValue <= f.value;
        default:
          return true;
      }
    });
  });
};

const applyOrdering = (data: any[], order?: { field: string; ascending: boolean }) => {
  if (!order) return data;
  return [...data].sort((a, b) => {
    const aVal = a[order.field];
    const bVal = b[order.field];
    if (aVal < bVal) return order.ascending ? -1 : 1;
    if (aVal > bVal) return order.ascending ? 1 : -1;
    return 0;
  });
};

const applyRange = (data: any[], range?: { start: number; end: number }) => {
  if (!range) return data;
  return data.slice(range.start, range.end + 1);
};

// Mock Supabase client creation for all services
vi.mock('@supabase/supabase-js', () => {
  let clientCounter = 0;

  const createQueryBuilder = (db: Map<string, any[]>, tableName: string) => {
    const self: any = {};

    let state = {
      operation: 'select' as 'insert' | 'update' | 'select' | 'delete' | 'insert_then_select',
      insertData: [] as any[],
      updateData: {} as any,
      filters: [] as Array<{ field: string; operator: string; value: any }>,
      order: undefined as { field: string; ascending: boolean } | undefined,
      range: undefined as { start: number; end: number } | undefined,
    };

    const executeQuery = () => {
      const tableData = getTableData(db, tableName);

      // Handle INSERT
      if (state.operation === 'insert' || state.operation === 'insert_then_select') {
        const inserted = state.insertData.map(item => {
          const withId = ensureId(item);
          const withTimestamps = addTimestamps(withId);
          return withTimestamps;
        });
        tableData.push(...inserted);

        // If this was insert_then_select, we return the inserted records
        // Otherwise for insert alone, return empty (will be wrapped as array)
        if (state.operation === 'insert_then_select') {
          return inserted;
        }
        return inserted;
      }

      // Handle UPDATE
      if (state.operation === 'update') {
        const filtered = applyFilters(tableData, state.filters);
        filtered.forEach(item => {
          Object.assign(item, state.updateData);
          item.updated_at = new Date().toISOString();
        });
        return filtered.length > 0 ? filtered : null;
      }

      // Handle DELETE
      if (state.operation === 'delete') {
        const filtered = applyFilters(tableData, state.filters);
        const toDelete = filtered.map(item => item.id);
        const newData = tableData.filter(item => !toDelete.includes(item.id));
        db.set(tableName, newData);
        return null;
      }

      // Handle SELECT
      let results = applyFilters(tableData, state.filters);
      results = applyOrdering(results, state.order);
      results = applyRange(results, state.range);
      return results;
    };

    // SELECT operation
    self.select = vi.fn(function(columns: string = '*') {
      // If we just inserted, mark as insert_then_select
      if (state.operation === 'insert') {
        state.operation = 'insert_then_select';
      } else {
        state.operation = 'select';
      }
      return self;
    });

    // INSERT operation
    self.insert = vi.fn(function(data: any[]) {
      state.operation = 'insert';
      state.insertData = Array.isArray(data) ? data : [data];
      return self;
    });

    // UPDATE operation
    self.update = vi.fn(function(data: any) {
      state.operation = 'update';
      state.updateData = data;
      return self;
    });

    // DELETE operation
    self.delete = vi.fn(function() {
      state.operation = 'delete';
      return self;
    });

    // UPSERT operation
    self.upsert = vi.fn(function(data: any, options?: any) {
      state.operation = 'insert';
      state.insertData = Array.isArray(data) ? data : [data];
      return self;
    });

    // FILTER operations
    self.eq = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'eq', value });
      return self;
    });

    self.neq = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'neq', value });
      return self;
    });

    self.gt = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'gt', value });
      return self;
    });

    self.gte = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'gte', value });
      return self;
    });

    self.lt = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'lt', value });
      return self;
    });

    self.lte = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'lte', value });
      return self;
    });

    self.order = vi.fn(function(field: string, options?: { ascending?: boolean }) {
      state.order = { field, ascending: options?.ascending ?? true };
      return self;
    });

    self.limit = vi.fn(function(count: number) {
      if (!state.range) {
        state.range = { start: 0, end: count - 1 };
      } else {
        state.range.end = state.range.start + count - 1;
      }
      return self;
    });

    self.range = vi.fn(function(start: number, end: number) {
      state.range = { start, end };
      return self;
    });

    self.not = vi.fn(function() { return self; });
    self.or = vi.fn(function() { return self; });
    self.is = vi.fn(function() { return self; });
    self.filter = vi.fn(function() { return self; });
    self.match = vi.fn(function() { return self; });
    self.contains = vi.fn(function() { return self; });

    // Make the builder awaitable for calls without .single()
    self.then = vi.fn((resolve: (value: any) => any) => {
      const results = executeQuery();
      return resolve({ data: Array.isArray(results) ? results : [results || {}], error: null });
    });

    self.catch = vi.fn((reject: (reason?: any) => any) => {
      return self;
    });

    self.finally = vi.fn((onFinally?: () => void) => {
      return self;
    });

    // Terminal method for single record
    self.single = vi.fn(function() {
      return new Promise((resolve) => {
        const results = executeQuery();
        const data = Array.isArray(results) ? results[0] : results;
        resolve({
          data: data || null,
          error: null,
        });
      });
    });

    self.maybeSingle = vi.fn(function() {
      return new Promise((resolve) => {
        const results = executeQuery();
        const data = Array.isArray(results) ? results[0] : results;
        resolve({ data: data || null, error: null });
      });
    });

    return self;
  };

  return {
    createClient: vi.fn(() => {
      const clientId = `client-${clientCounter++}`;
      const db = getTestDatabase(clientId);

      const supabaseClient: any = {};
      supabaseClient.from = vi.fn((tableName: string) => createQueryBuilder(db, tableName));
      supabaseClient.rpc = vi.fn(async (funcName: string, params: any) => {
        if (funcName === 'semantic_search') {
          const tableData = getTableData(db, 'conversations');
          const filtered = tableData.filter(
            item => item.user_id === params.user_id_param && !item.is_deleted
          );
          return {
            data: filtered.slice(0, params.match_count || 5),
            error: null,
          };
        }
        return { data: null, error: null };
      });
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
  let browserClientCounter = 0;

  const createQueryBuilder = (db: Map<string, any[]>, tableName: string) => {
    const self: any = {};

    let state = {
      operation: 'select' as 'insert' | 'update' | 'select' | 'delete' | 'insert_then_select',
      insertData: [] as any[],
      updateData: {} as any,
      filters: [] as Array<{ field: string; operator: string; value: any }>,
      order: undefined as { field: string; ascending: boolean } | undefined,
      range: undefined as { start: number; end: number } | undefined,
    };

    const executeQuery = () => {
      const tableData = getTableData(db, tableName);

      if (state.operation === 'insert' || state.operation === 'insert_then_select') {
        const inserted = state.insertData.map(item => {
          const withId = ensureId(item);
          const withTimestamps = addTimestamps(withId);
          return withTimestamps;
        });
        tableData.push(...inserted);
        return inserted;
      }

      if (state.operation === 'update') {
        const filtered = applyFilters(tableData, state.filters);
        filtered.forEach(item => {
          Object.assign(item, state.updateData);
          item.updated_at = new Date().toISOString();
        });
        return filtered.length > 0 ? filtered : null;
      }

      if (state.operation === 'delete') {
        const filtered = applyFilters(tableData, state.filters);
        const toDelete = filtered.map(item => item.id);
        const newData = tableData.filter(item => !toDelete.includes(item.id));
        db.set(tableName, newData);
        return null;
      }

      let results = applyFilters(tableData, state.filters);
      results = applyOrdering(results, state.order);
      results = applyRange(results, state.range);
      return results;
    };

    self.select = vi.fn(function(columns: string = '*') {
      if (state.operation === 'insert') {
        state.operation = 'insert_then_select';
      } else {
        state.operation = 'select';
      }
      return self;
    });

    self.insert = vi.fn(function(data: any[]) {
      state.operation = 'insert';
      state.insertData = Array.isArray(data) ? data : [data];
      return self;
    });

    self.update = vi.fn(function(data: any) {
      state.operation = 'update';
      state.updateData = data;
      return self;
    });

    self.delete = vi.fn(function() {
      state.operation = 'delete';
      return self;
    });

    self.upsert = vi.fn(function(data: any, options?: any) {
      state.operation = 'insert';
      state.insertData = Array.isArray(data) ? data : [data];
      return self;
    });

    self.eq = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'eq', value });
      return self;
    });

    self.neq = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'neq', value });
      return self;
    });

    self.gt = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'gt', value });
      return self;
    });

    self.gte = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'gte', value });
      return self;
    });

    self.lt = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'lt', value });
      return self;
    });

    self.lte = vi.fn(function(field: string, value: any) {
      state.filters.push({ field, operator: 'lte', value });
      return self;
    });

    self.order = vi.fn(function(field: string, options?: { ascending?: boolean }) {
      state.order = { field, ascending: options?.ascending ?? true };
      return self;
    });

    self.limit = vi.fn(function(count: number) {
      if (!state.range) {
        state.range = { start: 0, end: count - 1 };
      } else {
        state.range.end = state.range.start + count - 1;
      }
      return self;
    });

    self.range = vi.fn(function(start: number, end: number) {
      state.range = { start, end };
      return self;
    });

    self.not = vi.fn(function() { return self; });
    self.or = vi.fn(function() { return self; });
    self.is = vi.fn(function() { return self; });
    self.filter = vi.fn(function() { return self; });
    self.match = vi.fn(function() { return self; });
    self.contains = vi.fn(function() { return self; });

    self.then = vi.fn((resolve: (value: any) => any) => {
      const results = executeQuery();
      return resolve({ data: Array.isArray(results) ? results : [results || {}], error: null });
    });

    self.catch = vi.fn((reject: (reason?: any) => any) => {
      return self;
    });

    self.finally = vi.fn((onFinally?: () => void) => {
      return self;
    });

    self.single = vi.fn(function() {
      return new Promise((resolve) => {
        const results = executeQuery();
        const data = Array.isArray(results) ? results[0] : results;
        resolve({
          data: data || null,
          error: null,
        });
      });
    });

    self.maybeSingle = vi.fn(function() {
      return new Promise((resolve) => {
        const results = executeQuery();
        const data = Array.isArray(results) ? results[0] : results;
        resolve({ data: data || null, error: null });
      });
    });

    return self;
  };

  return {
    getSupabaseBrowserClient: vi.fn(() => {
      const clientId = `browser-client-${browserClientCounter++}`;
      const db = getTestDatabase(clientId);

      const supabaseClient: any = {};
      supabaseClient.from = vi.fn((tableName: string) => createQueryBuilder(db, tableName));
      supabaseClient.rpc = vi.fn(async (funcName: string, params: any) => {
        if (funcName === 'semantic_search') {
          const tableData = getTableData(db, 'conversations');
          const filtered = tableData.filter(
            item => item.user_id === params.user_id_param && !item.is_deleted
          );
          return {
            data: filtered.slice(0, params.match_count || 5),
            error: null,
          };
        }
        return { data: null, error: null };
      });
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
  // Clear test databases
  testDatabases.clear();
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

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
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
