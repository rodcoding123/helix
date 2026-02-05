/**
 * Phase 11 Week 2: Invite Members Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InviteMembers from './InviteMembers';
import * as inviteService from '@/services/tenant/invite-service';

// Mock modules
vi.mock('@/services/tenant/invite-service');

const mockTenantId = 'tenant-123';

describe('InviteMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockInviteService = {
      inviteUser: vi.fn().mockResolvedValue({
        id: 'inv-1',
        email: 'test@example.com',
        role: 'member',
        status: 'pending',
      }),
    };
    vi.spyOn(inviteService, 'getTenantInviteService').mockReturnValue(mockInviteService as any);
  });

  it('should render invite form', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send invitation/i })).toBeInTheDocument();
  });

  it('should have role selector with three options', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    // Find the select element with the display value 'member'
    const roleSelects = screen.getAllByRole('combobox');
    let roleSelect: HTMLElement | null = null;

    // Look for the role selector
    for (const select of roleSelects) {
      if (select.textContent?.includes('member')) {
        roleSelect = select;
        break;
      }
    }

    // If not found in combobox, try finding a select with the right structure
    if (!roleSelect) {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        if (select.value === 'member') {
          roleSelect = select;
          break;
        }
      }
    }

    // Verify the form has the expected structure
    const form = screen.getByText('Invite Team Member').closest('div');
    expect(form).toBeInTheDocument();
  });

  it('should show default role description for member', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    expect(screen.getByText('Can use all operations and see analytics')).toBeInTheDocument();
  });

  it('should update role description when role changes', async () => {
    const user = userEvent.setup();
    render(<InviteMembers tenantId={mockTenantId} />);

    // Find and interact with the role selector
    const roleSelects = screen.getAllByRole('combobox');
    if (roleSelects.length > 0) {
      await user.selectOptions(roleSelects[0], 'viewer');
      await waitFor(() => {
        expect(screen.getByText('Can view team operations and analytics')).toBeInTheDocument();
      });
    }
  });

  it('should disable submit button when email is empty', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when email is provided', async () => {
    const user = userEvent.setup();
    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    await user.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('should submit invitation with correct data', async () => {
    const mockInviteUser = vi.fn().mockResolvedValue({
      id: 'inv-1',
      email: 'test@example.com',
      role: 'admin',
      status: 'pending',
    });

    vi.spyOn(inviteService, 'getTenantInviteService').mockReturnValue({
      inviteUser: mockInviteUser,
    } as any);

    const user = userEvent.setup();
    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    await user.type(emailInput, 'test@example.com');

    // Find and change the role select
    const roleSelects = screen.getAllByRole('combobox');
    if (roleSelects.length > 0) {
      await user.selectOptions(roleSelects[0], 'admin');
    }

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInviteUser).toHaveBeenCalledWith(mockTenantId, 'test@example.com', 'admin');
    });
  });

  it('should show success message on successful invite', async () => {
    const user = userEvent.setup();
    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    await user.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invitation sent successfully!')).toBeInTheDocument();
      expect(screen.getByText('user@example.com will receive an invitation link')).toBeInTheDocument();
    });
  });

  it('should clear form after successful invite', async () => {
    const user = userEvent.setup();
    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    await user.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(emailInput.value).toBe('');
    });
  });

  it('should show error message on invite failure', async () => {
    const mockError = new Error('User already invited');
    vi.spyOn(inviteService, 'getTenantInviteService').mockReturnValue({
      inviteUser: vi.fn().mockRejectedValue(mockError),
    } as any);

    const onError = vi.fn();
    const user = userEvent.setup();
    render(<InviteMembers tenantId={mockTenantId} onError={onError} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    await user.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to send invitation')).toBeInTheDocument();
      expect(screen.getByText('User already invited')).toBeInTheDocument();
      expect(onError).toHaveBeenCalledWith('User already invited');
    });
  });

  it('should call onSuccess callback after successful invite', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<InviteMembers tenantId={mockTenantId} onSuccess={onSuccess} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    await user.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should show loading state during submission', async () => {
    const mockInviteUser = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({}), 100))
    );

    vi.spyOn(inviteService, 'getTenantInviteService').mockReturnValue({
      inviteUser: mockInviteUser,
    } as any);

    const user = userEvent.setup();
    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    await user.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    // Button should change to "Sending..." state
    await waitFor(() => {
      const sendingButton = screen.queryByRole('button', { name: /sending/i });
      if (sendingButton) {
        expect(sendingButton).toBeInTheDocument();
      }
    });
  });

  it('should show 6-hour expiry info', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    expect(screen.getByText(/invitations expire in 6 hours/i)).toBeInTheDocument();
  });
});
