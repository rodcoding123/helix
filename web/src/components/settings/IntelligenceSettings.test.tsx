/**
 * Intelligence Settings Tests - Phase 8 Web
 * Unit tests for IntelligenceSettings component
 * Tests: Toggle operations, Update budget, Save settings, Load operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntelligenceSettings } from './IntelligenceSettings';

// Mock fetch
global.fetch = vi.fn();

const mockOperations = [
  {
    id: 'email-compose',
    name: 'Email Compose',
    description: 'AI-powered email composition',
    primaryModel: 'deepseek-v3.2',
    fallbackModel: 'gemini-2.0-flash',
    costCriticality: 'LOW',
    estimatedCostUsd: 0.0015,
    enabled: true,
  },
  {
    id: 'calendar-prep',
    name: 'Calendar Prep',
    description: 'Meeting preparation assistance',
    primaryModel: 'deepseek-v3.2',
    fallbackModel: 'gemini-2.0-flash',
    costCriticality: 'MEDIUM',
    estimatedCostUsd: 0.0025,
    enabled: true,
  },
];

const mockSettings = {
  budget: {
    dailyLimitUsd: 50,
    monthlyLimitUsd: 1000,
    warningThreshold: 80,
  },
};

describe('IntelligenceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/llm-router/operations')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOperations),
        });
      }
      if (url.includes('/api/intelligence-settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSettings),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  describe('Rendering', () => {
    it('renders settings panel with header', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText('Intelligence Settings')).toBeInTheDocument();
      });
    });

    it('renders all three tabs', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText('Operations')).toBeInTheDocument();
        expect(screen.getByText('Budget')).toBeInTheDocument();
        expect(screen.getByText('Models')).toBeInTheDocument();
      });
    });

    it('loads and displays operations', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText('Email Compose')).toBeInTheDocument();
        expect(screen.getByText('Calendar Prep')).toBeInTheDocument();
      });
    });

    it('displays operation descriptions', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText('AI-powered email composition')).toBeInTheDocument();
        expect(screen.getByText('Meeting preparation assistance')).toBeInTheDocument();
      });
    });

    it('displays operation costs', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText(/\$0.0015/)).toBeInTheDocument();
        expect(screen.getByText(/\$0.0025/)).toBeInTheDocument();
      });
    });

    it('displays criticality levels', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText(/LOW/)).toBeInTheDocument();
        expect(screen.getByText(/MEDIUM/)).toBeInTheDocument();
      });
    });
  });

  describe('Operations Tab', () => {
    it('displays all operation categories', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText('Email Intelligence')).toBeInTheDocument();
        expect(screen.getByText('Calendar Intelligence')).toBeInTheDocument();
        expect(screen.getByText('Task Intelligence')).toBeInTheDocument();
        expect(screen.getByText('Analytics Intelligence')).toBeInTheDocument();
      });
    });

    it('toggles operation enabled status', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Email Compose')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(checkboxes[0]).not.toBeChecked();
      });
    });

    it('displays enabled state for all operations', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Budget Tab', () => {
    it('switches to budget tab', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const budgetTab = screen.getByText('Budget');
      await user.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByDisplayValue('50')).toBeInTheDocument();
      });
    });

    it('displays daily budget setting', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const budgetTab = screen.getByText('Budget');
      await user.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByText(/Daily Budget Limit/)).toBeInTheDocument();
        expect(screen.getByDisplayValue('50')).toBeInTheDocument();
      });
    });

    it('displays monthly budget setting', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const budgetTab = screen.getByText('Budget');
      await user.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByText(/Monthly Budget Limit/)).toBeInTheDocument();
        expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
      });
    });

    it('displays warning threshold setting', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const budgetTab = screen.getByText('Budget');
      await user.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByText(/Warning Threshold/)).toBeInTheDocument();
      });
    });

    it('updates daily budget value', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const budgetTab = screen.getByText('Budget');
      await user.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByDisplayValue('50')).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue('50') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '75');

      expect(input.value).toBe('75');
    });

    it('updates monthly budget value', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const budgetTab = screen.getByText('Budget');
      await user.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue('1000') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '2000');

      expect(input.value).toBe('2000');
    });

    it('displays current budget usage', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const budgetTab = screen.getByText('Budget');
      await user.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByText(/Current Usage/i)).toBeInTheDocument();
        expect(screen.getByText(/\$15\.40/)).toBeInTheDocument();
      });
    });
  });

  describe('Models Tab', () => {
    it('switches to models tab', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const modelsTab = screen.getByText('Models');
      await user.click(modelsTab);

      await waitFor(() => {
        expect(screen.getByText('Model Configuration')).toBeInTheDocument();
      });
    });

    it('displays model selection sections', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const modelsTab = screen.getByText('Models');
      await user.click(modelsTab);

      await waitFor(() => {
        expect(screen.getByText(/Email/)).toBeInTheDocument();
        expect(screen.getByText(/Calendar/)).toBeInTheDocument();
        expect(screen.getByText(/Task/)).toBeInTheDocument();
        expect(screen.getByText(/Analytics/)).toBeInTheDocument();
      });
    });

    it('displays model options', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      const modelsTab = screen.getByText('Models');
      await user.click(modelsTab);

      await waitFor(() => {
        expect(screen.getByText(/Claude Opus 4\.5/)).toBeInTheDocument();
        expect(screen.getByText(/DeepSeek v3\.2/)).toBeInTheDocument();
        expect(screen.getByText(/Gemini 2\.0 Flash/)).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    it('displays save button', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });
    });

    it('sends save request with operation and budget settings', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Settings');
      await user.click(saveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/intelligence-settings',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('disables save button while saving', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Settings') as HTMLButtonElement;
      await user.click(saveButton);

      // Button should be disabled temporarily
      await waitFor(
        () => {
          expect(saveButton).toBeDisabled();
        },
        { timeout: 100 }
      );
    });

    it('shows last saved timestamp', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Settings');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Last saved:/)).toBeInTheDocument();
      });
    });
  });

  describe('Reset Functionality', () => {
    it('displays reset button', async () => {
      render(<IntelligenceSettings />);
      await waitFor(() => {
        expect(screen.getByText('Reset')).toBeInTheDocument();
      });
    });

    it('reloads settings on reset', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Reset')).toBeInTheDocument();
      });

      const resetButton = screen.getByText('Reset');
      await user.click(resetButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/intelligence-settings');
      });
    });
  });

  describe('Error Handling', () => {
    it('handles fetch errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      render(<IntelligenceSettings />);

      // Component should still render even if fetch fails
      await waitFor(() => {
        expect(screen.getByText('Intelligence Settings')).toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(<IntelligenceSettings />);

      // Component should still render even if API returns error
      await waitFor(() => {
        expect(screen.getByText('Intelligence Settings')).toBeInTheDocument();
      });
    });
  });

  describe('Integration', () => {
    it('completes full workflow: load, modify, save', async () => {
      render(<IntelligenceSettings />);
      const user = userEvent.setup();

      // Wait for operations to load
      await waitFor(() => {
        expect(screen.getByText('Email Compose')).toBeInTheDocument();
      });

      // Toggle operation
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      // Switch to budget tab
      const budgetTab = screen.getByText('Budget');
      await user.click(budgetTab);

      // Modify budget
      await waitFor(() => {
        expect(screen.getByDisplayValue('50')).toBeInTheDocument();
      });

      const budgetInput = screen.getByDisplayValue('50') as HTMLInputElement;
      await user.clear(budgetInput);
      await user.type(budgetInput, '100');

      // Save settings
      const saveButton = screen.getByText('Save Settings');
      await user.click(saveButton);

      // Verify save was called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/intelligence-settings',
          expect.any(Object)
        );
      });
    });
  });
});
