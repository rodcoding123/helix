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
      h2: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <h2 {...stripMotionProps(props)} ref={ref}>{children}</h2>
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
import { CloudChat } from './CloudChat';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// Polyfill scrollIntoView for jsdom
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('CloudChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cloudChatOverrides = {};
  });

  it('renders empty state when no messages', () => {
    renderWithRouter(<CloudChat />);

    expect(screen.getByText('Start a conversation with Helix')).toBeInTheDocument();
    expect(
      screen.getByText(/Ask anything, brainstorm ideas, or let Helix help you think through/)
    ).toBeInTheDocument();
  });

  it('renders chat input with placeholder', () => {
    renderWithRouter(<CloudChat />);

    const input = screen.getByLabelText('Message input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Message Helix...');
  });

  it('shows messages when present', () => {
    cloudChatOverrides = {
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'What can you help me with?',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'I can help with many things!',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    renderWithRouter(<CloudChat />);

    expect(screen.getByText('What can you help me with?')).toBeInTheDocument();
    expect(screen.getByText('I can help with many things!')).toBeInTheDocument();
  });

  it('shows typing indicator when loading', () => {
    cloudChatOverrides = {
      isLoading: true,
    };

    renderWithRouter(<CloudChat />);

    expect(screen.getByLabelText('Helix is typing')).toBeInTheDocument();
  });

  it('shows quota info', () => {
    cloudChatOverrides = {
      quota: { used: 5, limit: 10, remaining: 5 },
    };

    renderWithRouter(<CloudChat />);

    // QuotaBar renders in both header (desktop) and footer (mobile), so multiple matches
    const quotaElements = screen.getAllByText('5/10 messages used today');
    expect(quotaElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error banner when error is present', () => {
    cloudChatOverrides = {
      error: 'Network connection lost',
    };

    renderWithRouter(<CloudChat />);

    expect(screen.getByText('Network connection lost')).toBeInTheDocument();
  });

  it('renders Cloud Chat heading', () => {
    renderWithRouter(<CloudChat />);

    expect(screen.getByText('Cloud Chat')).toBeInTheDocument();
    expect(screen.getByText('Powered by Helix Intelligence')).toBeInTheDocument();
  });

  it('hides empty state when messages are present', () => {
    cloudChatOverrides = {
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Hello',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    renderWithRouter(<CloudChat />);

    expect(screen.queryByText('Start a conversation with Helix')).not.toBeInTheDocument();
  });

  it('shows message limit reached when quota is exceeded', () => {
    cloudChatOverrides = {
      quotaExceeded: true,
      upgradeInfo: null,
    };

    renderWithRouter(<CloudChat />);

    // The h3 "Message limit reached" in the overlay and the placeholder both appear
    const limitElements = screen.getAllByText('Message limit reached');
    expect(limitElements.length).toBeGreaterThanOrEqual(1);
    // Also verify the quota exceeded overlay text is present
    expect(screen.getByText("You've used all your messages for today.")).toBeInTheDocument();
  });
});
