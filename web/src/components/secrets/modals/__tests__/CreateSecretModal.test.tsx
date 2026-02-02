import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSecretModal } from '../CreateSecretModal';

describe('CreateSecretModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnCreate.mockClear();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <CreateSecretModal
        isOpen={false}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );
    // Dialog should not be in DOM when closed
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeInTheDocument();
  });

  it('should render modal when isOpen is true', () => {
    render(
      <CreateSecretModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );
    expect(screen.getByText(/create new secret/i)).toBeInTheDocument();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should validate required fields before submission', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    // Try to submit without filling form
    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    // Errors should appear for empty fields
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });

    // onCreate should NOT be called
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it('should call onCreate with form data when submitted', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    // Fill form
    const nameInput = screen.getByLabelText(/secret name/i);
    const typeSelect = screen.getByLabelText(/secret type/i);

    await user.type(nameInput, 'My API Key');
    await user.selectOption(typeSelect, 'stripe_key');

    // Submit
    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    // Verify onCreate was called with correct data
    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My API Key',
          secret_type: 'stripe_key',
        })
      );
    });
  });

  it('should reset form after successful creation', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CreateSecretModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    // Fill and submit
    const nameInput = screen.getByLabelText(/secret name/i) as HTMLInputElement;
    const typeSelect = screen.getByLabelText(/secret type/i) as HTMLSelectElement;

    await user.type(nameInput, 'My API Key');
    await user.selectOption(typeSelect, 'stripe_key');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalled();
    });

    // Reopen modal
    rerender(
      <CreateSecretModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    // Form should be reset
    expect((screen.getByLabelText(/secret name/i) as HTMLInputElement).value).toBe('');
  });

  it('should handle expiration date selection', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    // Fill required fields
    const nameInput = screen.getByLabelText(/secret name/i);
    const typeSelect = screen.getByLabelText(/secret type/i);
    const expiresInput = screen.getByLabelText(/expiration date/i);

    await user.type(nameInput, 'My API Key');
    await user.selectOption(typeSelect, 'api_key');
    await user.type(expiresInput, '2026-12-31');

    // Submit
    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    // Verify expiration date was included
    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          expires_at: expect.any(Date),
        })
      );
    });
  });
});
