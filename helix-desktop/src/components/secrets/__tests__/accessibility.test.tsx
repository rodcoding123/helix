import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretsList } from '../SecretsList';
import { CreateSecretModal } from '../modals/CreateSecretModal';
import { CopyButton } from '../CopyButton';
import type { UserApiKey } from '../../../types/secrets';

describe('Accessibility Tests', () => {
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    name: 'Test Key',
    secret_type: 'STRIPE_SECRET_KEY' as const,
    source_type: 'manual' as const,
    created_at: new Date(),
    expires_at: null,
    is_active: true,
    key_version: 1,
    encryption_method: 'aes-256-gcm' as const,
  };

  describe('SecretsList', () => {
    it('should have proper ARIA labels on action buttons', () => {
      render(<SecretsList secrets={[mockSecret]} onRotate={() => {}} onDelete={() => {}} />);

      const rotateButton = screen.getByRole('button', { name: /rotate/i });
      expect(rotateButton).toHaveAttribute('aria-label');
    });

    it('should be keyboard navigable', () => {
      render(<SecretsList secrets={[mockSecret]} onRotate={() => {}} onDelete={() => {}} />);

      const rotateButton = screen.getByRole('button', { name: /rotate/i });
      rotateButton.focus();
      expect(document.activeElement).toBe(rotateButton);
    });
  });

  describe('CreateSecretModal', () => {
    it('should have proper labels for form fields', () => {
      render(
        <CreateSecretModal
          isOpen={true}
          onClose={() => {}}
          onCreate={() => {}}
        />
      );

      expect(screen.getByLabelText(/secret name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/secret type/i)).toBeInTheDocument();
    });

    it('should close on Escape key', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      render(
        <CreateSecretModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={() => {}}
        />
      );

      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have focus management', () => {
      render(
        <CreateSecretModal
          isOpen={true}
          onClose={() => {}}
          onCreate={() => {}}
        />
      );

      const nameInput = screen.getByLabelText(/secret name/i);
      expect(document.activeElement).toBe(nameInput);
    });
  });

  describe('CopyButton', () => {
    it('should have descriptive aria-label', () => {
      render(<CopyButton secretName="API Key" value="secret123" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Copy API Key');
    });

    it('should announce copy status to screen readers', async () => {
      const user = userEvent.setup();
      render(<CopyButton secretName="API Key" value="secret123" />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toHaveAttribute('aria-live', 'polite');
    });
  });
});
