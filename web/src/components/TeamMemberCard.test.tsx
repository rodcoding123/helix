/**
 * Phase 11 Week 2: Team Member Card Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeamMemberCard from './TeamMemberCard';
import type { TenantMember } from '@/services/tenant/invite-service';

const mockMember: TenantMember = {
  userId: 'user-123',
  email: 'member@example.com',
  role: 'member',
  joinedAt: new Date('2024-01-15'),
};

const mockOwner: TenantMember = {
  userId: 'owner-1',
  email: 'owner@example.com',
  role: 'owner',
  joinedAt: new Date('2024-01-01'),
};

const mockAdmin: TenantMember = {
  userId: 'admin-1',
  email: 'admin@example.com',
  role: 'admin',
  joinedAt: new Date('2024-01-10'),
};

describe('TeamMemberCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render member card with email and role', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    expect(screen.getByText('member@example.com')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText(/joined/i)).toBeInTheDocument();
  });

  it('should display role badges with correct colors', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    const { rerender } = render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    let roleBadge = screen.getByText('Member');
    expect(roleBadge.parentElement).toHaveClass('bg-green-100', 'text-green-800');

    // Test Admin role
    rerender(
      <TeamMemberCard
        member={mockAdmin}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    roleBadge = screen.getByText('Admin');
    expect(roleBadge.parentElement).toHaveClass('bg-blue-100', 'text-blue-800');

    // Test Owner role
    rerender(
      <TeamMemberCard
        member={mockOwner}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    roleBadge = screen.getByText('Owner');
    expect(roleBadge.parentElement).toHaveClass('bg-purple-100', 'text-purple-800');
  });

  it('should show "You" badge for current user', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        isCurrentUser={true}
        canManage={true}
      />
    );

    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('should show menu button when can manage', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    const menuButton = screen.getByRole('button');
    expect(menuButton).toBeInTheDocument();
  });

  it('should not show menu button when cannot manage', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={false}
      />
    );

    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('should not show menu button for owner even when can manage', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockOwner}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('should not show menu button for current user', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        isCurrentUser={true}
        canManage={true}
      />
    );

    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('should toggle menu visibility on button click', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    const menuButton = screen.getByRole('button');

    // Menu should not be visible initially
    expect(screen.queryByText('Change Role')).not.toBeInTheDocument();

    // Click to open menu
    fireEvent.click(menuButton);
    expect(screen.getByText('Change Role')).toBeInTheDocument();
    expect(screen.getByText('Remove Member')).toBeInTheDocument();

    // Click to close menu
    fireEvent.click(menuButton);
    expect(screen.queryByText('Change Role')).not.toBeInTheDocument();
  });

  it('should show role options in submenu', async () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    // Open menu
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    // Click Change Role
    const changeRoleButton = screen.getByText('Change Role');
    fireEvent.click(changeRoleButton);

    // All role options should be visible
    await waitFor(() => {
      expect(screen.getByText('Viewer')).toBeInTheDocument();
      expect(screen.getByText('Member')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });
  });

  it('should disable current role in role submenu', async () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    // Open menu
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    // Click Change Role
    const changeRoleButton = screen.getByText('Change Role');
    fireEvent.click(changeRoleButton);

    // Current role (Member) should be disabled - get all buttons and find the disabled one
    await waitFor(() => {
      const memberButtons = screen.getAllByText('Member');
      // The last one is in the submenu
      const submenuMemberButton = memberButtons[memberButtons.length - 1];
      expect(submenuMemberButton).toBeDisabled();
    });
  });

  it('should call onChangeRole when new role is selected', async () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn().mockResolvedValue(undefined);

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    // Open menu
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    // Click Change Role
    const changeRoleButton = screen.getByText('Change Role');
    fireEvent.click(changeRoleButton);

    // Click Admin role
    await waitFor(() => {
      const adminButton = screen.getAllByText('Admin')[0];
      fireEvent.click(adminButton);
    });

    // Verify callback was called
    await waitFor(() => {
      expect(mockChangeRole).toHaveBeenCalledWith('user-123', 'admin');
    });
  });

  it('should call onRemove when remove member is clicked', async () => {
    const mockRemove = vi.fn().mockResolvedValue(undefined);
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    // Open menu
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    // Click Remove Member
    const removeButton = screen.getByText('Remove Member');
    fireEvent.click(removeButton);

    // Verify callback was called
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith('user-123');
    });
  });

  it('should show loading state during action', async () => {
    const mockRemove = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(undefined), 100))
    );
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    // Open menu
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    // Click Remove Member
    const removeButton = screen.getByText('Remove Member');
    fireEvent.click(removeButton);

    // Button should be disabled during action
    await waitFor(() => {
      expect(menuButton).toBeDisabled();
    });
  });

  it('should format joined date correctly', () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn();
    const testDate = new Date('2024-01-15');
    const expectedDate = testDate.toLocaleDateString();

    const member: TenantMember = {
      ...mockMember,
      joinedAt: testDate,
    };

    render(
      <TeamMemberCard
        member={member}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    expect(screen.getByText(new RegExp(`Joined ${expectedDate}`))).toBeInTheDocument();
  });

  it('should close menu after role change', async () => {
    const mockRemove = vi.fn();
    const mockChangeRole = vi.fn().mockResolvedValue(undefined);

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    // Open menu
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    expect(screen.getByText('Change Role')).toBeInTheDocument();

    // Click Change Role
    const changeRoleButton = screen.getByText('Change Role');
    fireEvent.click(changeRoleButton);

    // Click new role
    await waitFor(() => {
      const adminButton = screen.getAllByText('Admin')[0];
      fireEvent.click(adminButton);
    });

    // Menu should close after action
    await waitFor(() => {
      expect(screen.queryByText('Change Role')).not.toBeInTheDocument();
    });
  });

  it('should close menu after remove', async () => {
    const mockRemove = vi.fn().mockResolvedValue(undefined);
    const mockChangeRole = vi.fn();

    render(
      <TeamMemberCard
        member={mockMember}
        onRemove={mockRemove}
        onChangeRole={mockChangeRole}
        canManage={true}
      />
    );

    // Open menu
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    expect(screen.getByText('Remove Member')).toBeInTheDocument();

    // Click Remove Member
    const removeButton = screen.getByText('Remove Member');
    fireEvent.click(removeButton);

    // Menu should close after action
    await waitFor(() => {
      expect(screen.queryByText('Remove Member')).not.toBeInTheDocument();
    });
  });
});
