import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyButton } from '../CopyButton';

describe('CopyButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render copy button', () => {
    render(<CopyButton secretName="API Key" value="secret123" />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('should show copied feedback on successful copy', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValueOnce(undefined);

    render(<CopyButton secretName="API Key" value="secret123" />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeTruthy();
    });
  });

  it('should display feedback text on click', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValueOnce(undefined);

    render(<CopyButton secretName="API Key" value="secret123" />);
    const button = screen.getByRole('button');

    expect(button.textContent).toMatch(/copy/i);
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeTruthy();
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
      expect(screen.getByText(/failed/i)).toBeTruthy();
    }, { timeout: 2000 });
  });
});
