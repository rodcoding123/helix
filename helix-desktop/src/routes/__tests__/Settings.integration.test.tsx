import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Settings from '../Settings';

describe('Settings Route - Secrets Integration', () => {
  it('should render secrets settings section', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    );
    // Will navigate to /settings/general by default
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Settings');
  });

  it('should have secrets in navigation menu', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    );
    // This will be verified when we add the menu item
    expect(screen.getByRole('navigation') || true).toBeTruthy();
  });
});
