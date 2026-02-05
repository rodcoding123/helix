# Quick Start Guide - Component Testing Patterns

A quick reference for writing and fixing component tests in Helix web.

## TL;DR - The 5-Step Testing Formula

### Step 1: Import Test Utilities

```typescript
import { render, screen, userEvent, vi } from '@/test/test-utils';
import { createMockUser, createMockTenant } from '@/test/test-utils';
```

### Step 2: Mock Dependencies

```typescript
vi.mock('@/services/my-service');
```

### Step 3: Setup Mocks in beforeEach

```typescript
beforeEach(() => {
  vi.clearAllMocks();

  const mockService = {
    myMethod: vi.fn().mockResolvedValue({ data: 'test' }),
  };
  vi.spyOn(myService, 'getMyService').mockReturnValue(mockService as any);
});
```

### Step 4: Write Test with Proper Async Handling

```typescript
it('should handle async operation', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  await user.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

### Step 5: Verify with Custom Matchers

```typescript
expect(screen.getByText('Success')).toBeInTheDocument();
expect(mockService.myMethod).toHaveBeenCalledWith('expected-arg');
```

## Common Component Test Templates

### Template 1: Form Component

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';
import MyForm from './MyForm';
import * as myService from '@/services/my-service';

vi.mock('@/services/my-service');

describe('MyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(myService, 'getMyService').mockReturnValue({
      submit: vi.fn().mockResolvedValue({ success: true })
    } as any);
  });

  it('should render form fields', () => {
    render(<MyForm />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should submit form with user input', async () => {
    const user = userEvent.setup();
    render(<MyForm />);

    const input = screen.getByPlaceholderText('Enter text');
    await user.type(input, 'test value');

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });

  it('should display errors on failure', async () => {
    const mockService = { submit: vi.fn().mockRejectedValue(new Error('API error')) };
    vi.spyOn(myService, 'getMyService').mockReturnValue(mockService as any);

    const user = userEvent.setup();
    render(<MyForm />);

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### Template 2: Provider/Context Component

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import MyProvider from './MyProvider';

describe('MyProvider', () => {
  it('should render children without errors', () => {
    render(
      <MyProvider>
        <div>Test Child</div>
      </MyProvider>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should handle multiple children', () => {
    render(
      <MyProvider>
        <div>First</div>
        <div>Second</div>
      </MyProvider>
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('should provide context to children', () => {
    const TestComponent = () => {
      const value = useMyContext(); // hook inside provider
      return <div>{value.name}</div>;
    };

    render(
      <MyProvider>
        <TestComponent />
      </MyProvider>
    );
    expect(screen.getByText('expected-name')).toBeInTheDocument();
  });
});
```

### Template 3: Interactive Component

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, userEvent, fireEvent, waitFor } from '@/test/test-utils';
import MyInteractiveComponent from './MyInteractiveComponent';

describe('MyInteractiveComponent', () => {
  it('should show/hide menu on click', async () => {
    render(<MyInteractiveComponent />);

    // Menu should be hidden initially
    expect(screen.queryByText('Menu Item')).not.toBeInTheDocument();

    // Click to open
    const menuBtn = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuBtn);

    // Menu should be visible
    expect(screen.getByText('Menu Item')).toBeInTheDocument();

    // Click to close
    fireEvent.click(menuBtn);

    // Menu should be hidden
    expect(screen.queryByText('Menu Item')).not.toBeInTheDocument();
  });

  it('should handle menu item selection', async () => {
    const onSelect = vi.fn();
    render(<MyInteractiveComponent onSelect={onSelect} />);

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuBtn);

    const item = screen.getByText('Menu Item');
    fireEvent.click(item);

    expect(onSelect).toHaveBeenCalledWith('menu-item-value');
  });
});
```

### Template 4: Data Fetching Component

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import MyDataComponent from './MyDataComponent';
import * as dataService from '@/services/data-service';

vi.mock('@/services/data-service');

describe('MyDataComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(dataService, 'getDataService').mockReturnValue({
      fetchData: vi.fn(() => new Promise(() => {})) // never resolves
    } as any);

    render(<MyDataComponent />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display data after loading', async () => {
    vi.spyOn(dataService, 'getDataService').mockReturnValue({
      fetchData: vi.fn().mockResolvedValue({
        items: [{ id: 1, name: 'Item 1' }]
      })
    } as any);

    render(<MyDataComponent />);

    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });
  });

  it('should display error message on failure', async () => {
    vi.spyOn(dataService, 'getDataService').mockReturnValue({
      fetchData: vi.fn().mockRejectedValue(new Error('API Error'))
    } as any);

    render(<MyDataComponent />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

## Quick Reference: Common Assertions

```typescript
// Text content
expect(screen.getByText('exact text')).toBeInTheDocument();
expect(screen.getByText(/partial|regex/)).toBeInTheDocument();
expect(screen.queryByText('text')).not.toBeInTheDocument();

// Elements
expect(screen.getByRole('button', { name: /text/i })).toBeInTheDocument();
expect(screen.getAllByRole('listitem')).toHaveLength(3);

// Form inputs
expect(screen.getByPlaceholderText('Enter email')).toHaveValue('');
const input = screen.getByDisplayValue('current value');
expect(input).toBeDisabled();

// Classes and attributes
expect(element).toHaveClass('active');
expect(element).toHaveAttribute('data-testid', 'value');

// Visibility
expect(element).toBeVisible();
expect(screen.queryByText('hidden')).not.toBeInTheDocument();

// Mock functions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(2);
```

## Quick Reference: Common userEvent Actions

```typescript
const user = userEvent.setup();

// Typing
await user.type(input, 'text to type');
await user.keyboard('{Backspace}{Backspace}');

// Clicking
await user.click(button);
await user.dblClick(element);

// Selection
await user.selectOptions(select, 'value');
await user.selectOptions(select, ['value1', 'value2']);

// Hovering
await user.hover(element);
await user.unhover(element);

// Tab navigation
await user.tab();
await user.tab({ shift: true });

// Pointer (advanced)
await user.pointer({ keys: '[MouseLeft>]', target: element });
```

## Quick Reference: Common waitFor Patterns

```typescript
// Wait for text to appear
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// Wait for element to be removed
await waitFor(() => {
  expect(screen.queryByText('Loading')).not.toBeInTheDocument();
});

// Wait for mock to be called
await waitFor(() => {
  expect(mockFn).toHaveBeenCalled();
});

// Wait with custom timeout
await waitFor(
  () => {
    expect(element).toBeInTheDocument();
  },
  { timeout: 5000 }
);

// Wait with custom interval
await waitFor(
  () => {
    expect(element).toBeInTheDocument();
  },
  { interval: 100 }
);
```

## Quick Reference: Mock Service Patterns

### Pattern 1: Basic Service Mock

```typescript
vi.mock('@/services/my-service');
vi.spyOn(myService, 'getMyService').mockReturnValue({
  method: vi.fn().mockResolvedValue({ data: 'test' }),
} as any);
```

### Pattern 2: Dynamic Response Based on Arguments

```typescript
const mockMethod = vi.fn((id: string) => {
  if (id === 'error-id') {
    return Promise.reject(new Error('Invalid ID'));
  }
  return Promise.resolve({ id, data: 'test' });
});
```

### Pattern 3: Multiple Calls with Different Responses

```typescript
const mockMethod = vi
  .fn()
  .mockResolvedValueOnce({ data: 'first' })
  .mockResolvedValueOnce({ data: 'second' })
  .mockRejectedValueOnce(new Error('error'));
```

### Pattern 4: Simulating Loading State

```typescript
const mockMethod = vi.fn(
  () => new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 100))
);
```

## Debugging Tips

### Print Rendered DOM

```typescript
render(<MyComponent />);
screen.debug(); // Print whole DOM
screen.debug(screen.getByRole('button')); // Print just one element
```

### Get All Elements Matching Selector

```typescript
const buttons = screen.getAllByRole('button');
console.log('Found', buttons.length, 'buttons');
```

### Check What's Actually in Document

```typescript
// When test fails with "can't find element"
screen.debug();
// This will show exactly what's in the DOM
```

### Use logTestingPlaygroundURL

```typescript
import { screen } from '@testing-library/react';

it('debug test', () => {
  render(<MyComponent />);
  screen.logTestingPlaygroundURL(); // Opens interactive debugger
});
```

## Running Tests

```bash
# Run all component tests
npm test -- run src/components

# Run specific test file
npm test -- run src/components/MyComponent.test.tsx

# Run tests matching pattern
npm test -- run --grep "form submission"

# Run in watch mode
npm test src/components/MyComponent.test.tsx

# Run with coverage
npm test -- run --coverage

# Run and update snapshots
npm test -- run -u
```

## Common Pitfalls & Solutions

### ❌ Forgetting async/await

```typescript
// WRONG
it('should load data', () => {
  render(<MyComponent />);
  expect(screen.getByText('Loaded')).toBeInTheDocument(); // Too fast!
});

// RIGHT
it('should load data', async () => {
  render(<MyComponent />);
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

### ❌ Not clearing mocks between tests

```typescript
// WRONG - mocks carry over to next test
beforeEach(() => {
  // No cleanup
});

// RIGHT
beforeEach(() => {
  vi.clearAllMocks();
});
```

### ❌ Using fireEvent for user input

```typescript
// LESS GOOD
fireEvent.change(input, { target: { value: 'text' } });

// BETTER
const user = userEvent.setup();
await user.type(input, 'text');
```

### ❌ Querying before element exists

```typescript
// WRONG
render(<MyComponent />);
const element = screen.getByText('Async Content'); // Not loaded yet!

// RIGHT
render(<MyComponent />);
await waitFor(() => {
  const element = screen.getByText('Async Content');
  expect(element).toBeInTheDocument();
});
```

### ❌ Not importing from test-utils

```typescript
// WRONG - missing providers
import { render } from '@testing-library/react';

// RIGHT - includes all providers
import { render } from '@/test/test-utils';
```

## Success Checklist for New Test

- [ ] Imports from `@/test/test-utils`
- [ ] Mocks setup in `beforeEach`
- [ ] `vi.clearAllMocks()` in `beforeEach`
- [ ] Async tests use `async/await`
- [ ] Async assertions wrapped in `waitFor`
- [ ] User interactions use `userEvent`
- [ ] Tests focus on user behavior
- [ ] Clear, descriptive test names
- [ ] Proper error handling tested
- [ ] Test passes locally before commit

---

**Last Updated:** 2026-02-05
**Test Framework:** Vitest + React Testing Library
**Target:** 90%+ component tests passing
