import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CopyButton } from '../CopyButton';

describe('CopyButton Component', () => {
  let clipboardMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock clipboard API before each test
    clipboardMock = vi.fn(() => Promise.resolve());
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        writeText: clipboardMock,
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  it('should render with secret name', () => {
    render(<CopyButton secretName="API Key" value="secret123" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Copy API Key');
  });

  it('should copy value to clipboard when clicked', async () => {
    const mockValue = 'secret-token-12345';

    render(<CopyButton secretName="API Key" value={mockValue} />);

    const button = screen.getByRole('button');

    await act(async () => {
      button.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(clipboardMock).toHaveBeenCalledWith(mockValue);
  });

  it('should show copied feedback for 10 seconds', async () => {
    vi.useFakeTimers();

    render(<CopyButton secretName="API Key" value="secret123" />);

    const button = screen.getByRole('button');

    await act(async () => {
      button.click();
      vi.advanceTimersByTime(0);
    });

    // Should show "Copied!" feedback
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    // After 9 seconds, feedback should still be showing
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    // After 10 seconds total, feedback should clear
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('should handle clipboard write errors gracefully', async () => {
    const errorMock = vi.fn(() =>
      Promise.reject(new Error('Clipboard denied')),
    );
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        writeText: errorMock,
      },
      configurable: true,
    });

    render(<CopyButton secretName="API Key" value="secret123" />);

    const button = screen.getByRole('button');

    await act(async () => {
      button.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Should show error message
    expect(screen.getByText(/failed to copy/i)).toBeInTheDocument();
  });

  it('should reset feedback when clicked again', async () => {
    vi.useFakeTimers();

    render(<CopyButton secretName="API Key" value="secret123" />);

    const button = screen.getByRole('button');

    // First click
    await act(async () => {
      button.click();
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    // Advance time partway (5 seconds)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Second click resets the timer
    await act(async () => {
      button.click();
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    // Advance another 5 seconds (total 10 from second click)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should still be showing because timer was reset
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    // Advance another 5 seconds (total 10 from second click)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Now it should be gone
    expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
