import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyButton } from '../CopyButton';

describe('CopyButton Component', () => {
  it('should render copy button', () => {
    render(<CopyButton secretName="API Key" value="secret123" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show copied feedback on successful copy', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValueOnce(undefined);

    render(<CopyButton secretName="API Key" value="secret123" />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
    });
  });

  it('should display feedback text on click', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValueOnce(undefined);

    render(<CopyButton secretName="API Key" value="secret123" />);
    const button = screen.getByRole('button');

    expect(button).toHaveTextContent(/copy/i);
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
    });
  });

  it('should show error feedback on clipboard error', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(
      new Error('Clipboard denied')
    );

    render(<CopyButton secretName="API Key" value="secret123" />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});
