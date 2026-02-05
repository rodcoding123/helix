/**
 * Phase 11 Week 2: Invite Members Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    const roleSelect = screen.getByDisplayValue('member') as HTMLSelectElement;
    expect(roleSelect).toBeInTheDocument();

    const options = roleSelect.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].value).toBe('viewer');
    expect(options[1].value).toBe('member');
    expect(options[2].value).toBe('admin');
  });

  it('should show default role description for member', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    expect(screen.getByText('Can use all operations and see analytics')).toBeInTheDocument();
  });

  it('should update role description when role changes', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    const roleSelect = screen.getByDisplayValue('member') as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: 'viewer' } });

    expect(screen.getByText('Can view team operations and analytics')).toBeInTheDocument();
  });

  it('should disable submit button when email is empty', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when email is provided', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

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

    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const roleSelect = screen.getByDisplayValue('member') as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: 'admin' } });

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockInviteUser).toHaveBeenCalledWith(mockTenantId, 'test@example.com', 'admin');
    });
  });

  it('should show success message on successful invite', async () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invitation sent successfully!')).toBeInTheDocument();
      expect(screen.getByText('user@example.com will receive an invitation link')).toBeInTheDocument();
    });
  });

  it('should clear form after successful invite', async () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(submitButton);

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
    render(<InviteMembers tenantId={mockTenantId} onError={onError} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to send invitation')).toBeInTheDocument();
      expect(screen.getByText('User already invited')).toBeInTheDocument();
      expect(onError).toHaveBeenCalledWith('User already invited');
    });
  });

  it('should call onSuccess callback after successful invite', async () => {
    const onSuccess = vi.fn();
    render(<InviteMembers tenantId={mockTenantId} onSuccess={onSuccess} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(submitButton);

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

    render(<InviteMembers tenantId={mockTenantId} />);

    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(submitButton);

    // Button should change to "Sending..." state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeInTheDocument();
    });
  });

  it('should show 6-hour expiry info', () => {
    render(<InviteMembers tenantId={mockTenantId} />);

    expect(screen.getByText(/invitations expire in 6 hours/i)).toBeInTheDocument();
  });
});
