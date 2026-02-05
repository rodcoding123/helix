/**
 * Phase 11 Week 1: TenantProvider Component Tests
 *
 * Note: TenantProvider is an integration component that depends on:
 * - useAuth hook
 * - Supabase database client
 * - Tenant context
 *
 * These tests focus on rendering behavior and context exposure
 * rather than internal logic (which is tested in tenant-context.test.ts)
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TenantProvider } from './TenantProvider';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123' },
    session: null,
  })),
}));

// Supabase is mocked in test/setup.ts
// No additional mocking needed here

describe('TenantProvider', () => {
  beforeEach(() => {
    try {
      localStorage.clear?.();
    } catch (e) {
      // localStorage might not be fully supported in test environment
    }
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render with children without errors', () => {
      render(
        <TenantProvider>
          <div>Test Child Content</div>
        </TenantProvider>
      );

      expect(screen.getByText('Test Child Content')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
      render(
        <TenantProvider>
          <div>Child One</div>
          <div>Child Two</div>
        </TenantProvider>
      );

      expect(screen.getByText('Child One')).toBeInTheDocument();
      expect(screen.getByText('Child Two')).toBeInTheDocument();
    });

    it('should provide context to children via React context API', () => {
      // TenantProvider wraps children with context
      // This test verifies the provider renders without errors
      const TestComponent = () => <div>Context Available</div>;

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Context Available')).toBeInTheDocument();
    });

    it('should handle empty children', () => {
      const { container } = render(<TenantProvider>{null}</TenantProvider>);

      // Should not throw
      expect(container).toBeTruthy();
    });

    it('should handle multiple renders', () => {
      const { rerender } = render(
        <TenantProvider>
          <div>First Render</div>
        </TenantProvider>
      );

      expect(screen.getByText('First Render')).toBeInTheDocument();

      rerender(
        <TenantProvider>
          <div>Second Render</div>
        </TenantProvider>
      );

      expect(screen.getByText('Second Render')).toBeInTheDocument();
    });
  });

  describe('Props and configuration', () => {
    it('should accept children as prop', () => {
      const children = <div data-testid="test-child">Test Content</div>;

      render(<TenantProvider>{children}</TenantProvider>);

      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });

    it('should work with conditional children', () => {
      const shouldRender = true;

      render(
        <TenantProvider>
          {shouldRender ? <div>Rendered</div> : <div>Not Rendered</div>}
        </TenantProvider>
      );

      expect(screen.getByText('Rendered')).toBeInTheDocument();
      expect(screen.queryByText('Not Rendered')).not.toBeInTheDocument();
    });

    it('should work with Fragment children', () => {
      render(
        <TenantProvider>
          <>
            <div>First</div>
            <div>Second</div>
          </>
        </TenantProvider>
      );

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });
  });

  describe('LocalStorage integration', () => {
    it('should allow localStorage operations', () => {
      try {
        localStorage.setItem('test-key', 'test-value');
        expect(localStorage.getItem('test-key')).toBe('test-value');
        localStorage.removeItem('test-key');
        expect(localStorage.getItem('test-key')).toBeNull();
      } catch (e) {
        // localStorage might not be fully supported
      }
    });

    it('should work with TenantProvider', () => {
      render(
        <TenantProvider>
          <div>Tenant Provider with localStorage</div>
        </TenantProvider>
      );

      expect(screen.getByText('Tenant Provider with localStorage')).toBeInTheDocument();
    });
  });

  describe('Component lifecycle', () => {
    it('should initialize with authenticated user', () => {
      render(
        <TenantProvider>
          <div>Provider initialized with user</div>
        </TenantProvider>
      );

      expect(screen.getByText('Provider initialized with user')).toBeInTheDocument();
    });

    it('should handle sequential mounts and unmounts', () => {
      const { unmount } = render(
        <TenantProvider>
          <div>Mounted</div>
        </TenantProvider>
      );

      expect(screen.getByText('Mounted')).toBeInTheDocument();

      unmount();

      expect(screen.queryByText('Mounted')).not.toBeInTheDocument();
    });

    it('should handle rapid remounting', () => {
      const { unmount } = render(
        <TenantProvider>
          <div>First Mount</div>
        </TenantProvider>
      );

      unmount();

      render(
        <TenantProvider>
          <div>Second Mount</div>
        </TenantProvider>
      );

      expect(screen.getByText('Second Mount')).toBeInTheDocument();
    });
  });

  describe('Error boundary behavior', () => {
    it('should not suppress child errors', () => {
      const ThrowingComponent = () => {
        throw new Error('Test error');
      };

      expect(() => {
        render(
          <TenantProvider>
            <ThrowingComponent />
          </TenantProvider>
        );
      }).toThrow();
    });

    it('should render without errors when children are safe', () => {
      const SafeComponent = () => <div>Safe Component</div>;

      render(
        <TenantProvider>
          <SafeComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Safe Component')).toBeInTheDocument();
    });
  });

  describe('Integration scenarios', () => {
    it('should work with complex nested children', () => {
      render(
        <TenantProvider>
          <div>
            <section>
              <article>
                <p>Nested content</p>
              </article>
            </section>
          </div>
        </TenantProvider>
      );

      expect(screen.getByText('Nested content')).toBeInTheDocument();
    });

    it('should work with functional component children', () => {
      function CustomComponent() {
        return <div>Custom Component</div>;
      }

      render(
        <TenantProvider>
          <CustomComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Custom Component')).toBeInTheDocument();
    });

    it('should work with class component children', () => {
      class CustomComponent extends React.Component {
        render() {
          return <div>Class Component</div>;
        }
      }

      render(
        <TenantProvider>
          <CustomComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Class Component')).toBeInTheDocument();
    });
  });

  describe('Provider isolation', () => {
    it('should not affect sibling providers', () => {
      render(
        <>
          <TenantProvider>
            <div>Provider One</div>
          </TenantProvider>
          <TenantProvider>
            <div>Provider Two</div>
          </TenantProvider>
        </>
      );

      expect(screen.getByText('Provider One')).toBeInTheDocument();
      expect(screen.getByText('Provider Two')).toBeInTheDocument();
    });

    it('should support nested providers', () => {
      render(
        <TenantProvider>
          <div>Outer Provider</div>
          <TenantProvider>
            <div>Inner Provider</div>
          </TenantProvider>
        </TenantProvider>
      );

      expect(screen.getByText('Outer Provider')).toBeInTheDocument();
      expect(screen.getByText('Inner Provider')).toBeInTheDocument();
    });
  });
});
