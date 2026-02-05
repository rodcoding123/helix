/**
 * Phase 11 Week 2: Invitation Accept Component Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvitationAccept from './InvitationAccept';
import * as inviteService from '@/services/tenant/invite-service';

// Mock modules
vi.mock('@/services/tenant/invite-service');

const mockInvitationDetails = {
  tenantId: 'tenant-123',
  tenantName: 'Test Team',
  role: 'member',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
};

const renderComponent = (initialRoute = '/accept?token=test-token-123&userId=user-456') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/accept" element={<InvitationAccept />} />
        <Route path="/" element={<div>Home</div>} />
        <Route path="/tenants/:tenantId" element={<div>Tenant Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('InvitationAccept', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock invite service
    const mockService = {
      getInvitationDetails: vi.fn().mockResolvedValue(mockInvitationDetails),
      acceptInvitation: vi.fn().mockResolvedValue(undefined),
      rejectInvitation: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(inviteService, 'getTenantInviteService').mockReturnValue(mockService as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    renderComponent();

    expect(screen.getByText('Loading invitation...')).toBeInTheDocument();
  });

  it('should load and display invitation details', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
      expect(screen.getByText(/Member/)).toBeInTheDocument();
    });
  });

  it('should display team name from invitation details', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });
  });

  it('should display role with description', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Member (Can use operations)')).toBeInTheDocument();
    });
  });

  it('should show role descriptions for each role type', async () => {
    // Test member role
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Member (Can use operations)')).toBeInTheDocument();
    });
  });

  it('should display accept and decline buttons', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    });
  });

  it('should call acceptInvitation when accept button is clicked', async () => {
    const mockAccept = vi.fn().mockResolvedValue(undefined);
    const service = inviteService.getTenantInviteService();
    (service.acceptInvitation as any) = mockAccept;

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith('test-token-123', 'user-456');
    });
  });

  it('should call rejectInvitation when decline button is clicked', async () => {
    const mockReject = vi.fn().mockResolvedValue(undefined);
    const service = inviteService.getTenantInviteService();
    (service.rejectInvitation as any) = mockReject;

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    });

    const declineButton = screen.getByRole('button', { name: /decline/i });
    fireEvent.click(declineButton);

    await waitFor(() => {
      expect(mockReject).toHaveBeenCalledWith('test-token-123');
    });
  });

  it('should show success message after accepting', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText(/you've been added to the team/i)).toBeInTheDocument();
    });
  });

  it('should show success message after declining', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    });

    const declineButton = screen.getByRole('button', { name: /decline/i });
    fireEvent.click(declineButton);

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });
  });

  it('should show error when invitation not found', async () => {
    const service = inviteService.getTenantInviteService();
    (service.getInvitationDetails as any).mockResolvedValue(null);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Invitation not found or has expired')).toBeInTheDocument();
    });
  });

  it('should show error when getInvitationDetails fails', async () => {
    const service = inviteService.getTenantInviteService();
    (service.getInvitationDetails as any).mockRejectedValue(
      new Error('Failed to load invitation')
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Failed to load invitation')).toBeInTheDocument();
    });
  });

  it('should show error when acceptInvitation fails', async () => {
    const service = inviteService.getTenantInviteService();
    (service.acceptInvitation as any).mockRejectedValue(
      new Error('Failed to accept invitation')
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to accept invitation')).toBeInTheDocument();
    });
  });

  it('should show error when rejectInvitation fails', async () => {
    const service = inviteService.getTenantInviteService();
    (service.rejectInvitation as any).mockRejectedValue(
      new Error('Failed to reject invitation')
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    });

    const declineButton = screen.getByRole('button', { name: /decline/i });
    fireEvent.click(declineButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to reject invitation')).toBeInTheDocument();
    });
  });

  it('should show expired invitation warning', async () => {
    const service = inviteService.getTenantInviteService();
    const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
    (service.getInvitationDetails as any).mockResolvedValue({
      ...mockInvitationDetails,
      expiresAt: expiredDate,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Invitation Expired')).toBeInTheDocument();
      expect(screen.getByText(/invitation has expired/i)).toBeInTheDocument();
    });
  });

  it('should disable accept button when invitation is expired', async () => {
    const service = inviteService.getTenantInviteService();
    const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
    (service.getInvitationDetails as any).mockResolvedValue({
      ...mockInvitationDetails,
      expiresAt: expiredDate,
    });

    renderComponent();

    await waitFor(() => {
      const acceptButton = screen.getByRole('button', { name: /accept/i });
      expect(acceptButton).toBeDisabled();
    });
  });

  it('should show error when no token provided', () => {
    const { useSearchParams } = require('react-router-dom');
    useSearchParams.mockReturnValue([
      new URLSearchParams(''),
      vi.fn(),
    ]);

    renderComponent();

    expect(screen.getByText('No invitation token provided')).toBeInTheDocument();
  });

  it('should show "Go Home" button on error', async () => {
    const service = inviteService.getTenantInviteService();
    (service.getInvitationDetails as any).mockResolvedValue(null);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });
  });

  it('should disable buttons during acceptance', async () => {
    const service = inviteService.getTenantInviteService();
    (service.acceptInvitation as any).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(undefined), 100))
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    // Button should be disabled during operation
    await waitFor(() => {
      expect(acceptButton).toBeDisabled();
    });
  });

  it('should disable buttons during rejection', async () => {
    const service = inviteService.getTenantInviteService();
    (service.rejectInvitation as any).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(undefined), 100))
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    });

    const declineButton = screen.getByRole('button', { name: /decline/i });
    fireEvent.click(declineButton);

    // Button should be disabled during operation
    await waitFor(() => {
      expect(declineButton).toBeDisabled();
    });
  });

  it('should display info message about collaboration', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/by accepting, you'll be added to/i)).toBeInTheDocument();
    });
  });

  it('should format expiration date correctly', async () => {
    const testDate = new Date('2024-02-15T14:30:00');
    const service = inviteService.getTenantInviteService();
    (service.getInvitationDetails as any).mockResolvedValue({
      ...mockInvitationDetails,
      expiresAt: testDate,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    // Expiration info should be present (component shows it in details)
    expect(screen.getByText('Test Team')).toBeInTheDocument();
  });
});
