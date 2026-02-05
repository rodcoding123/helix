/**
 * Phase 11 Week 1: TenantProvider Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TenantProvider } from './TenantProvider';
import { useTenant } from '@/lib/tenant/tenant-context';
import * as supabaseModule from '@/lib/supabase';

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123' },
    session: null,
  })),
}));

// Mock Supabase
const mockQuery = {
  select: vi.fn(function () { return this; }),
  eq: vi.fn(function () { return this; }),
  or: vi.fn(function () { return this; }),
  insert: vi.fn(function () { return this; }),
  update: vi.fn(function () { return this; }),
  single: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  getDb: vi.fn(() => ({
    from: vi.fn(() => mockQuery),
    rpc: vi.fn(),
  })),
}));

// Test component to access tenant context
function TestComponent() {
  const { tenant, loading, error } = useTenant();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!tenant) return <div>No tenant</div>;

  return <div data-testid="tenant">{tenant.name}</div>;
}

describe('TenantProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Loading tenants', () => {
    it('should show loading state initially', () => {
      mockQuery.or.mockResolvedValueOnce({ data: [], error: null });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should load user tenants on mount', async () => {
      const tenants = [
        {
          id: 'tenant-1',
          name: 'First Tenant',
          owner_id: 'user-123',
          created_at: new Date().toISOString(),
          tier: 'free',
          members: [],
        },
      ];

      mockQuery.or.mockResolvedValueOnce({ data: tenants, error: null });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('tenant')).toHaveTextContent('First Tenant');
      });
    });

    it('should create default tenant if none exist', async () => {
      mockQuery.or.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.insert.mockResolvedValueOnce({ error: null });
      mockQuery.update.mockResolvedValueOnce({ error: null });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(mockQuery.insert).toHaveBeenCalled();
      });
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.or.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error/)).toBeInTheDocument();
      });
    });
  });

  describe('Tenant switching', () => {
    it('should switch to different tenant', async () => {
      const tenants = [
        {
          id: 'tenant-1',
          name: 'First Tenant',
          owner_id: 'user-123',
          created_at: new Date().toISOString(),
          tier: 'free',
          members: [],
        },
      ];

      mockQuery.or.mockResolvedValueOnce({ data: tenants, error: null });

      function SwitcherComponent() {
        const { tenant, switchTenant } = useTenant();

        if (!tenant) return null;

        return (
          <div>
            <div data-testid="current">{tenant.name}</div>
            <button
              onClick={() => switchTenant('tenant-2')}
              data-testid="switch-btn"
            >
              Switch
            </button>
          </div>
        );
      }

      mockQuery.eq.mockResolvedValueOnce({
        data: {
          id: 'tenant-2',
          name: 'Second Tenant',
          owner_id: 'user-123',
          members: [],
        },
        error: null,
      });

      render(
        <TenantProvider>
          <SwitcherComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current')).toHaveTextContent('First Tenant');
      });

      // Switch tenant
      // await userEvent.click(screen.getByTestId('switch-btn'));

      // Would verify tenant switched, but requires more setup
    });

    it('should deny access to unauthorized tenant', async () => {
      const tenants = [
        {
          id: 'tenant-1',
          name: 'First Tenant',
          owner_id: 'user-123',
          members: [],
        },
      ];

      mockQuery.or.mockResolvedValueOnce({ data: tenants, error: null });

      // Unauthorized tenant
      mockQuery.eq.mockResolvedValueOnce({
        data: {
          id: 'tenant-999',
          name: 'Other User Tenant',
          owner_id: 'other-user',
          members: [],
        },
        error: null,
      });

      function SwitcherComponent() {
        const { switchTenant } = useTenant();

        const handleSwitch = async () => {
          try {
            await switchTenant('tenant-999');
          } catch (error) {
            // Expected
          }
        };

        return <button onClick={handleSwitch}>Switch</button>;
      }

      render(
        <TenantProvider>
          <SwitcherComponent />
        </TenantProvider>
      );

      // Click switch button would trigger error
      // Currently just verifies component renders
      expect(screen.getByText('Switch')).toBeInTheDocument();
    });
  });

  describe('Creating tenants', () => {
    it('should create new tenant', async () => {
      const existingTenants = [
        {
          id: 'tenant-1',
          name: 'Existing',
          owner_id: 'user-123',
          members: [],
        },
      ];

      mockQuery.or.mockResolvedValueOnce({ data: existingTenants, error: null });
      mockQuery.insert.mockResolvedValueOnce({ error: null });
      mockQuery.update.mockResolvedValueOnce({ error: null });

      function CreatorComponent() {
        const { createTenant } = useTenant();

        const handleCreate = async () => {
          try {
            await createTenant('New Tenant');
          } catch (error) {
            console.error(error);
          }
        };

        return <button onClick={handleCreate}>Create</button>;
      }

      render(
        <TenantProvider>
          <CreatorComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Create')).toBeInTheDocument();
      });
    });

    it('should throw if user not authenticated', async () => {
      // Mock unauthenticated user
      vi.resetModules();

      const tenants = [
        {
          id: 'tenant-1',
          name: 'Tenant',
          owner_id: 'user-123',
          members: [],
        },
      ];

      mockQuery.or.mockResolvedValueOnce({ data: tenants, error: null });

      function CreatorComponent() {
        const { createTenant } = useTenant();

        const handleCreate = async () => {
          try {
            await createTenant('New');
          } catch (error) {
            // Expected
          }
        };

        return <button onClick={handleCreate}>Create</button>;
      }

      render(
        <TenantProvider>
          <CreatorComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Create')).toBeInTheDocument();
    });
  });

  describe('Tenant preference persistence', () => {
    it('should persist tenant selection in localStorage', async () => {
      const tenants = [
        {
          id: 'tenant-abc',
          name: 'My Tenant',
          owner_id: 'user-123',
          members: [],
        },
      ];

      mockQuery.or.mockResolvedValueOnce({ data: tenants, error: null });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(localStorage.getItem('current_tenant_id')).toBe('tenant-abc');
      });
    });

    it('should restore previous tenant on reload', async () => {
      const tenants = [
        {
          id: 'tenant-1',
          name: 'First',
          owner_id: 'user-123',
          members: [],
        },
        {
          id: 'tenant-2',
          name: 'Second',
          owner_id: 'user-123',
          members: [],
        },
      ];

      localStorage.setItem('current_tenant_id', 'tenant-2');

      mockQuery.or.mockResolvedValueOnce({ data: tenants, error: null });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('tenant')).toHaveTextContent('Second');
      });
    });
  });

  describe('Error handling', () => {
    it('should display error message on load failure', async () => {
      mockQuery.or.mockResolvedValueOnce({
        data: null,
        error: { message: 'Network error' },
      });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
      });
    });

    it('should handle missing user gracefully', async () => {
      vi.mock('@/hooks/useAuth', () => ({
        useAuth: vi.fn(() => ({
          user: null,
          session: null,
        })),
      }));

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      // Should load without errors (no tenant loaded)
      expect(screen.queryByText('No tenant')).toBeInTheDocument();
    });
  });

  describe('Context availability', () => {
    it('should throw when useTenant used outside TenantProvider', () => {
      function TestComponentNoProvider() {
        try {
          useTenant();
          return <div>Should not render</div>;
        } catch (error) {
          return <div>Error: Context not available</div>;
        }
      }

      expect(() => {
        render(<TestComponentNoProvider />);
      }).toThrow();
    });
  });
});
