/**
 * Test utilities with comprehensive provider setup
 * Provides render function that wraps components with all required providers and mocks
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Mock implementations for common hooks and contexts
 */

// Mock Auth hook
const mockUseAuth = () => ({
  user: { id: 'test-user-123', email: 'test@example.com' },
  session: { access_token: 'test-token' },
  loading: false,
  error: null,
});

// Mock Tenant context
const TenantContext = React.createContext<any>(null);

interface TenantProviderProps {
  children: React.ReactNode;
}

const MockTenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const [tenant, setTenant] = React.useState({
    id: 'tenant-123',
    name: 'Test Tenant',
    owner_id: 'test-user-123',
    tier: 'free',
    members: [],
    created_at: new Date().toISOString(),
  });

  const contextValue = {
    tenant,
    setTenant,
    loading: false,
    error: null,
    switchTenant: vi.fn().mockResolvedValue(undefined),
    createTenant: vi.fn().mockResolvedValue(undefined),
  };

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
};

// Mock Auth Provider
const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Mock React Router Provider
const MockRouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Mock Query Client Provider
const MockQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

/**
 * AllProviders wrapper that applies all necessary providers
 */
const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MockAuthProvider>
      <MockRouterProvider>
        <MockQueryProvider>
          <MockTenantProvider>
            {children}
          </MockTenantProvider>
        </MockQueryProvider>
      </MockRouterProvider>
    </MockAuthProvider>
  );
};

/**
 * Custom render function that wraps components with all providers
 */
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, {
    wrapper: AllProviders,
    ...options,
  });
};

/**
 * Mock data factories for testing
 */
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  ...overrides,
});

export const createMockTenant = (overrides = {}) => ({
  id: 'tenant-123',
  name: 'Test Tenant',
  owner_id: 'test-user-123',
  tier: 'free' as const,
  members: [],
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockMember = (overrides = {}) => ({
  userId: 'user-456',
  email: 'member@example.com',
  role: 'member' as const,
  joinedAt: new Date('2024-01-15'),
  ...overrides,
});

export const createMockInvitation = (overrides = {}) => ({
  id: 'inv-1',
  email: 'invited@example.com',
  role: 'member' as const,
  status: 'pending' as const,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

/**
 * Mock service factories
 */
export const createMockInviteService = (overrides = {}) => ({
  inviteUser: vi.fn().mockResolvedValue(createMockInvitation()),
  getInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

export const createMockTenantService = (overrides = {}) => ({
  getTenants: vi.fn().mockResolvedValue([createMockTenant()]),
  createTenant: vi.fn().mockResolvedValue(createMockTenant()),
  updateTenant: vi.fn().mockResolvedValue(createMockTenant()),
  deleteTenant: vi.fn().mockResolvedValue(undefined),
  getMembers: vi.fn().mockResolvedValue([createMockMember()]),
  ...overrides,
});

/**
 * Navigation mock utilities
 */
export const createMockNavigate = () => vi.fn();

export const createMockUseNavigate = () => vi.fn().mockReturnValue(vi.fn());

export const createMockUseParams = () => vi.fn().mockReturnValue({ tenantId: 'tenant-123' });

export const createMockUseLocation = () => vi.fn().mockReturnValue({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default',
});

/**
 * React Query mock utilities
 */
export const createMockUseQuery = () => vi.fn().mockReturnValue({
  data: null,
  error: null,
  isLoading: false,
  isError: false,
  isSuccess: false,
  isFetching: false,
  status: 'idle' as const,
  fetchStatus: 'idle' as const,
  isPending: false,
});

export const createMockUseMutation = () => vi.fn().mockReturnValue({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isLoading: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: null,
  status: 'idle' as const,
  reset: vi.fn(),
});

/**
 * Setup hooks for consistent test mocking
 */
export const setupAuthMocks = () => {
  vi.mock('@/hooks/useAuth', () => ({
    useAuth: vi.fn(() => mockUseAuth()),
  }));
};

export const setupTenantMocks = () => {
  vi.mock('@/lib/tenant/tenant-context', () => ({
    TenantContext,
    useTenant: vi.fn(() => ({
      tenant: createMockTenant(),
      setTenant: vi.fn(),
      loading: false,
      error: null,
      switchTenant: vi.fn(),
      createTenant: vi.fn(),
    })),
    setCurrentTenantId: vi.fn(),
    getCurrentTenantId: vi.fn(),
  }));
};

export const setupNavigationMocks = () => {
  vi.mock('react-router-dom', () => ({
    useNavigate: createMockUseNavigate(),
    useParams: createMockUseParams(),
    useLocation: createMockUseLocation(),
    useSearchParams: vi.fn().mockReturnValue([new URLSearchParams(), vi.fn()]),
  }));
};

export const setupQueryMocks = () => {
  vi.mock('@tanstack/react-query', () => ({
    useQuery: createMockUseQuery(),
    useMutation: createMockUseMutation(),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
    })),
  }));
};

/**
 * Export test utilities
 */
export * from '@testing-library/react';
export { customRender as render };

// Re-export commonly used testing functions
export { vi } from 'vitest';
export { default as userEvent } from '@testing-library/user-event';
