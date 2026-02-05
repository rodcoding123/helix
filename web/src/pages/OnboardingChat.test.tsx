import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock useCloudChat hook
const mockSendMessage = vi.fn();
const mockClearError = vi.fn();
const mockReset = vi.fn();

const defaultCloudChat = {
  messages: [],
  sendMessage: mockSendMessage,
  isLoading: false,
  error: null,
  quota: { used: 0, limit: 10, remaining: 10 },
  quotaExceeded: false,
  upgradeInfo: null,
  onboardingReady: false,
  onboarding: null,
  clearError: mockClearError,
  reset: mockReset,
};

let cloudChatOverrides: Partial<typeof defaultCloudChat> = {};

vi.mock('@/hooks/useCloudChat', () => ({
  useCloudChat: vi.fn(() => ({
    ...defaultCloudChat,
    ...cloudChatOverrides,
  })),
}));

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false,
    signOut: vi.fn(),
  }),
}));

// Mock cloud-chat-client
vi.mock('@/lib/cloud-chat-client', () => ({
  getCloudChatClient: vi.fn(() => ({
    completeOnboarding: vi.fn().mockResolvedValue(undefined),
    getProfile: vi.fn().mockResolvedValue({
      displayName: null,
      onboardingCompleted: false,
      messagesToday: 0,
    }),
    sendMessage: vi.fn(),
  })),
  QuotaExceededError: class QuotaExceededError extends Error {
    quota: { used: number; limit: number; remaining: number };
    upgrade: { message: string; url: string } | null;
    constructor(data: { error: string; quota: { used: number; limit: number; remaining: number }; upgrade: { message: string; url: string } | null }) {
      super(data.error);
      this.name = 'QuotaExceededError';
      this.quota = data.quota;
      this.upgrade = data.upgrade;
    }
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div {...stripMotionProps(props)} ref={ref}>{children}</div>
      )),
      form: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <form {...stripMotionProps(props)} ref={ref}>{children}</form>
      )),
      button: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <button {...stripMotionProps(props)} ref={ref}>{children}</button>
      )),
      span: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <span {...stripMotionProps(props)} ref={ref}>{children}</span>
      )),
      h1: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <h1 {...stripMotionProps(props)} ref={ref}>{children}</h1>
      )),
      p: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <p {...stripMotionProps(props)} ref={ref}>{children}</p>
      )),
    },
  };
});

// Strip framer-motion-specific props that would cause React warnings on DOM elements
function stripMotionProps(props: Record<string, any>): Record<string, any> {
  const {
    initial, animate, exit, transition, variants, whileHover, whileTap,
    whileFocus, whileDrag, whileInView, layout, layoutId, drag, dragConstraints,
    onDragStart, onDragEnd, onAnimationStart, onAnimationComplete,
    ...domProps
  } = props;
  return domProps;
}

// Import component after mocks
import { OnboardingChat } from './OnboardingChat';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// Polyfill scrollIntoView for jsdom
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('OnboardingChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cloudChatOverrides = {};
  });

  it('renders welcome state when no messages', () => {
    renderWithRouter(<OnboardingChat />);

    expect(screen.getByText('Meet Helix')).toBeInTheDocument();
    expect(
      screen.getByText(/Say hello\. Ask a question\. Share what brought you here\./)
    ).toBeInTheDocument();
  });

  it('renders chat input with placeholder', () => {
    renderWithRouter(<OnboardingChat />);

    const input = screen.getByLabelText('Message input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Say something to Helix...');
  });

  it('shows messages when present', () => {
    cloudChatOverrides = {
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Hello Helix!',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'Welcome! Nice to meet you.',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    renderWithRouter(<OnboardingChat />);

    expect(screen.getByText('Hello Helix!')).toBeInTheDocument();
    expect(screen.getByText('Welcome! Nice to meet you.')).toBeInTheDocument();
  });

  it('shows typing indicator when loading', () => {
    cloudChatOverrides = {
      isLoading: true,
    };

    renderWithRouter(<OnboardingChat />);

    expect(screen.getByLabelText('Helix is typing')).toBeInTheDocument();
  });

  it('shows skip link', () => {
    renderWithRouter(<OnboardingChat />);

    const skipButton = screen.getByLabelText('Skip onboarding');
    expect(skipButton).toBeInTheDocument();
    expect(skipButton).toHaveTextContent('Skip');
  });

  it('shows continue button when onboarding profile is ready', () => {
    const messages = [
      { id: 'msg-0', role: 'user' as const, content: "I'm Alex", timestamp: new Date().toISOString() },
      { id: 'msg-1', role: 'assistant' as const, content: 'Nice to meet you Alex!', timestamp: new Date().toISOString() },
    ];

    cloudChatOverrides = {
      messages,
      onboardingReady: true,
      onboarding: { profileUpdated: true, displayName: 'Alex', step: 'chat' },
    };

    renderWithRouter(<OnboardingChat />);

    const continueButton = screen.getByLabelText('Continue to dashboard');
    expect(continueButton).toBeInTheDocument();
    expect(continueButton).toHaveTextContent('Continue to Dashboard');
  });

  it('does not show continue button when profile is not ready', () => {
    const messages = [
      { id: 'msg-0', role: 'user' as const, content: 'Hello!', timestamp: new Date().toISOString() },
      { id: 'msg-1', role: 'assistant' as const, content: 'Hi there!', timestamp: new Date().toISOString() },
    ];

    cloudChatOverrides = {
      messages,
      onboardingReady: false,
      onboarding: { profileUpdated: false, displayName: null, step: 'welcome' },
    };

    renderWithRouter(<OnboardingChat />);

    expect(screen.queryByLabelText('Continue to dashboard')).not.toBeInTheDocument();
  });

  it('shows error banner when error is present', () => {
    cloudChatOverrides = {
      error: 'Something went wrong',
    };

    renderWithRouter(<OnboardingChat />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows quota remaining text', () => {
    cloudChatOverrides = {
      quota: { used: 3, limit: 10, remaining: 7 },
    };

    renderWithRouter(<OnboardingChat />);

    expect(screen.getByText('7 messages remaining')).toBeInTheDocument();
  });

  it('navigates to dashboard when skip is clicked', () => {
    renderWithRouter(<OnboardingChat />);

    const skipButton = screen.getByLabelText('Skip onboarding');
    fireEvent.click(skipButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to dashboard if onboarding already completed', async () => {
    const { getCloudChatClient } = await import('@/lib/cloud-chat-client');
    vi.mocked(getCloudChatClient).mockReturnValueOnce({
      completeOnboarding: vi.fn().mockResolvedValue(undefined),
      getProfile: vi.fn().mockResolvedValue({
        displayName: 'Alex',
        onboardingCompleted: true,
        messagesToday: 5,
      }),
      sendMessage: vi.fn(),
      getEndpointUrl: vi.fn().mockReturnValue(''),
      updateProfile: vi.fn().mockResolvedValue(undefined),
    } as any);

    renderWithRouter(<OnboardingChat />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });
});
