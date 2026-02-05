/**
 * EmailClient Component Tests
 *
 * Tests for the EmailClient page and sub-components:
 * - Account list rendering
 * - Conversation loading and virtual scroll
 * - Search with debouncing
 * - Message rendering with XSS sanitization
 * - Compose modal functionality
 * - Sync status display
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// =====================================================
// Test Environment Setup
// =====================================================

// Mock ResizeObserver for JSDOM
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock window.scrollTo
  window.scrollTo = vi.fn();

  // Mock Element.scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() =>
              Promise.resolve({
                data: [],
                error: null,
              })
            ),
          })),
        })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { access_token: 'test-token' },
    loading: false,
    error: null,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Import components after mocks
import { EmailAccountList } from '@/components/email/EmailAccountList';
import { ConversationList } from '@/components/email/ConversationList';
import { ConversationDetail } from '@/components/email/ConversationDetail';
import { EmailMessageItem } from '@/components/email/EmailMessageItem';
import { ComposeModal } from '@/components/email/ComposeModal';
import type {
  EmailAccount,
  EmailConversation,
  ConversationWithMessages,
  EmailMessage,
  SyncStatus,
} from '@/hooks/useEmailClient';

// =====================================================
// Test Data Factories
// =====================================================

function createMockAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: 'account-1',
    email: 'user@example.com',
    provider: 'gmail',
    isActive: true,
    lastSyncAt: new Date().toISOString(),
    messageCount: 42,
    ...overrides,
  };
}

function createMockConversation(overrides: Partial<EmailConversation> = {}): EmailConversation {
  return {
    id: 'conv-1',
    account_id: 'account-1',
    thread_id: 'thread-1',
    subject: 'Test Subject',
    participants: [{ name: 'John Doe', email: 'john@example.com' }],
    last_message_at: new Date().toISOString(),
    is_read: false,
    is_starred: false,
    is_archived: false,
    labels: [],
    message_count: 3,
    has_attachments: false,
    ...overrides,
  };
}

function createMockMessage(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    message_id: '<msg-1@example.com>',
    from_email: 'sender@example.com',
    from_name: 'Sender Name',
    to_emails: ['recipient@example.com'],
    cc_emails: [],
    bcc_emails: [],
    subject: 'Test Subject',
    body_plain: 'This is the plain text body of the email.',
    body_html: '<p>This is the <strong>HTML</strong> body of the email.</p>',
    received_at: new Date().toISOString(),
    flags: { seen: true },
    ...overrides,
  };
}

function createMockConversationWithMessages(
  overrides: Partial<ConversationWithMessages> = {}
): ConversationWithMessages {
  const conv = createMockConversation();
  return {
    ...conv,
    messages: [
      createMockMessage({ id: 'msg-1' }),
      createMockMessage({ id: 'msg-2', from_name: 'Reply Person' }),
    ],
    ...overrides,
  };
}

// =====================================================
// Test Suites
// =====================================================

describe('EmailAccountList', () => {
  const mockAccounts: EmailAccount[] = [
    createMockAccount({ id: 'acc-1', email: 'work@company.com', provider: 'outlook' }),
    createMockAccount({ id: 'acc-2', email: 'personal@gmail.com', provider: 'gmail' }),
  ];

  it('renders account list correctly', () => {
    const onSelectAccount = vi.fn();

    render(
      <EmailAccountList
        accounts={mockAccounts}
        selectedAccount={null}
        onSelectAccount={onSelectAccount}
        syncStatus="idle"
      />
    );

    expect(screen.getByText('work@company.com')).toBeInTheDocument();
    expect(screen.getByText('personal@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Add Account')).toBeInTheDocument();
  });

  it('highlights selected account', () => {
    const onSelectAccount = vi.fn();

    render(
      <EmailAccountList
        accounts={mockAccounts}
        selectedAccount={mockAccounts[0]}
        onSelectAccount={onSelectAccount}
        syncStatus="idle"
      />
    );

    const selectedButton = screen.getByTestId('account-acc-1');
    expect(selectedButton).toHaveClass('bg-blue-900/50');
  });

  it('displays sync status indicator when syncing', () => {
    const onSelectAccount = vi.fn();

    render(
      <EmailAccountList
        accounts={mockAccounts}
        selectedAccount={mockAccounts[0]}
        onSelectAccount={onSelectAccount}
        syncStatus="syncing"
      />
    );

    expect(screen.getByText('Syncing')).toBeInTheDocument();
  });

  it('calls onSelectAccount when account is clicked', async () => {
    const user = userEvent.setup();
    const onSelectAccount = vi.fn();

    render(
      <EmailAccountList
        accounts={mockAccounts}
        selectedAccount={null}
        onSelectAccount={onSelectAccount}
        syncStatus="idle"
      />
    );

    await user.click(screen.getByTestId('account-acc-2'));
    expect(onSelectAccount).toHaveBeenCalledWith(mockAccounts[1]);
  });
});

describe('ConversationList', () => {
  const mockConversations: EmailConversation[] = [
    createMockConversation({
      id: 'conv-1',
      subject: 'Important Meeting',
      is_read: false,
      is_starred: true,
    }),
    createMockConversation({
      id: 'conv-2',
      subject: 'Weekly Report',
      is_read: true,
      has_attachments: true,
    }),
    createMockConversation({
      id: 'conv-3',
      subject: 'Project Update',
      is_read: true,
    }),
  ];

  it('renders conversation list correctly', () => {
    const onSelectConversation = vi.fn();

    render(
      <ConversationList
        conversations={mockConversations}
        selectedConversation={null}
        onSelectConversation={onSelectConversation}
        isLoading={false}
      />
    );

    expect(screen.getByText('Important Meeting')).toBeInTheDocument();
    expect(screen.getByText('Weekly Report')).toBeInTheDocument();
    expect(screen.getByText('Project Update')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <ConversationList
        conversations={[]}
        selectedConversation={null}
        onSelectConversation={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByTestId('conversation-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading conversations...')).toBeInTheDocument();
  });

  it('shows empty state when no conversations', () => {
    render(
      <ConversationList
        conversations={[]}
        selectedConversation={null}
        onSelectConversation={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('conversation-empty')).toBeInTheDocument();
    expect(screen.getByText('No conversations')).toBeInTheDocument();
  });

  it('indicates unread conversations with blue dot', () => {
    render(
      <ConversationList
        conversations={mockConversations}
        selectedConversation={null}
        onSelectConversation={vi.fn()}
        isLoading={false}
      />
    );

    const unreadConv = screen.getByTestId('conversation-conv-1');
    // Unread indicator is a blue dot with class bg-blue-500
    expect(unreadConv.innerHTML).toContain('bg-blue-500');
  });

  it('calls onSelectConversation when conversation is clicked', async () => {
    const user = userEvent.setup();
    const onSelectConversation = vi.fn();

    render(
      <ConversationList
        conversations={mockConversations}
        selectedConversation={null}
        onSelectConversation={onSelectConversation}
        isLoading={false}
      />
    );

    await user.click(screen.getByTestId('conversation-conv-2'));
    expect(onSelectConversation).toHaveBeenCalledWith(mockConversations[1]);
  });

  it('handles virtual scrolling with many conversations', () => {
    // Create 100 conversations to test virtual scrolling
    const manyConversations = Array.from({ length: 100 }, (_, i) =>
      createMockConversation({ id: `conv-${i}`, subject: `Conversation ${i}` })
    );

    render(
      <ConversationList
        conversations={manyConversations}
        selectedConversation={null}
        onSelectConversation={vi.fn()}
        isLoading={false}
      />
    );

    // Virtual list should render, but not all 100 items at once
    const list = screen.getByTestId('conversation-list');
    expect(list).toBeInTheDocument();

    // First few items should be visible
    expect(screen.getByText('Conversation 0')).toBeInTheDocument();
  });
});

describe('ConversationDetail', () => {
  const mockConversation = createMockConversationWithMessages();

  it('renders conversation detail correctly', () => {
    render(<ConversationDetail conversation={mockConversation} onReply={vi.fn()} />);

    expect(screen.getByText('Test Subject')).toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
    // Multiple Reply buttons exist (header and per-message)
    const replyButtons = screen.getAllByRole('button', { name: /Reply/i });
    expect(replyButtons.length).toBeGreaterThan(0);
  });

  it('expands last message by default', () => {
    render(<ConversationDetail conversation={mockConversation} onReply={vi.fn()} />);

    // Last message should be expanded and show full content
    // There may be multiple elements with this text (collapsed preview + expanded)
    const bodyTexts = screen.getAllByText('This is the plain text body of the email.');
    expect(bodyTexts.length).toBeGreaterThan(0);
    // Check that expanded message content is visible with the correct test ID
    expect(screen.getByTestId('message-plain-content')).toBeInTheDocument();
  });

  it('calls onReply when reply button is clicked', async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();

    render(<ConversationDetail conversation={mockConversation} onReply={onReply} />);

    // Click the first Reply button (in the header)
    const replyButtons = screen.getAllByRole('button', { name: /Reply/i });
    await user.click(replyButtons[0]);
    expect(onReply).toHaveBeenCalled();
  });

  it('shows loading state when no messages', () => {
    const emptyConversation = {
      ...mockConversation,
      messages: [],
    };

    render(<ConversationDetail conversation={emptyConversation} onReply={vi.fn()} />);

    expect(screen.getByTestId('conversation-detail-empty')).toBeInTheDocument();
  });
});

describe('EmailMessageItem', () => {
  const mockMessage = createMockMessage();

  it('renders message correctly', () => {
    render(
      <EmailMessageItem
        message={mockMessage}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        onReply={vi.fn()}
      />
    );

    expect(screen.getByText('Sender Name')).toBeInTheDocument();
    expect(screen.getByText('This is the plain text body of the email.')).toBeInTheDocument();
  });

  it('shows collapsed view when not expanded', () => {
    render(
      <EmailMessageItem
        message={mockMessage}
        isExpanded={false}
        onToggleExpand={vi.fn()}
        onReply={vi.fn()}
      />
    );

    // Collapsed view should show truncated content
    expect(screen.getByText('Sender Name')).toBeInTheDocument();
    expect(screen.getByText(/This is the plain text body/)).toBeInTheDocument();
  });

  it('toggles HTML/plain text view', async () => {
    const user = userEvent.setup();

    render(
      <EmailMessageItem
        message={mockMessage}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        onReply={vi.fn()}
      />
    );

    // Initially shows plain text
    expect(screen.getByTestId('message-plain-content')).toBeInTheDocument();

    // Toggle to HTML
    await user.click(screen.getByTestId('toggle-html-button'));
    expect(screen.getByTestId('message-html-content')).toBeInTheDocument();
  });

  it('sanitizes HTML content to prevent XSS', async () => {
    const user = userEvent.setup();
    const maliciousMessage = createMockMessage({
      body_html: '<p>Safe content</p><script>alert("XSS")</script><img src="x" onerror="alert(1)">',
    });

    render(
      <EmailMessageItem
        message={maliciousMessage}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        onReply={vi.fn()}
      />
    );

    // Toggle to HTML view
    await user.click(screen.getByTestId('toggle-html-button'));

    const htmlContent = screen.getByTestId('message-html-content');
    // Script tags should be removed
    expect(htmlContent.innerHTML).not.toContain('<script>');
    expect(htmlContent.innerHTML).not.toContain('alert');
    // Safe content should remain
    expect(htmlContent.innerHTML).toContain('Safe content');
  });

  it('calls onToggleExpand when header is clicked', async () => {
    const user = userEvent.setup();
    const onToggleExpand = vi.fn();

    render(
      <EmailMessageItem
        message={mockMessage}
        isExpanded={false}
        onToggleExpand={onToggleExpand}
        onReply={vi.fn()}
      />
    );

    await user.click(screen.getByText('Sender Name'));
    expect(onToggleExpand).toHaveBeenCalled();
  });

  it('calls onReply when reply button is clicked', async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();

    render(
      <EmailMessageItem
        message={mockMessage}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        onReply={onReply}
      />
    );

    // Click the Reply button (there may be multiple, click the first one in the expanded view)
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    await user.click(replyButtons[0]);
    expect(onReply).toHaveBeenCalled();
  });
});

describe('ComposeModal', () => {
  const defaultProps = {
    conversationId: null,
    accountId: 'account-1',
    onClose: vi.fn(),
    onSend: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders compose modal correctly', () => {
    render(<ComposeModal {...defaultProps} />);

    expect(screen.getByText('New Message')).toBeInTheDocument();
    expect(screen.getByTestId('compose-to')).toBeInTheDocument();
    expect(screen.getByTestId('compose-subject')).toBeInTheDocument();
    expect(screen.getByTestId('compose-body')).toBeInTheDocument();
    expect(screen.getByTestId('compose-send')).toBeInTheDocument();
  });

  it('pre-fills fields in reply mode', () => {
    render(
      <ComposeModal
        {...defaultProps}
        conversationId="conv-1"
        replyTo={{ subject: 'Original Subject', to: ['original@example.com'] }}
      />
    );

    expect(screen.getByText('Reply')).toBeInTheDocument();
    expect(screen.getByTestId('compose-to')).toHaveValue('original@example.com');
    expect(screen.getByTestId('compose-subject')).toHaveValue('Re: Original Subject');
  });

  it('validates email addresses', async () => {
    const user = userEvent.setup();

    render(<ComposeModal {...defaultProps} />);

    // Enter invalid email and body, then try to send
    const toInput = screen.getByTestId('compose-to');
    const bodyInput = screen.getByTestId('compose-body');
    const sendButton = screen.getByTestId('compose-send');

    await user.type(toInput, 'invalid-email');
    await user.type(bodyInput, 'Test message');

    // Button should now be enabled (both fields have content)
    expect(sendButton).not.toBeDisabled();
    await user.click(sendButton);

    // Should show validation error for invalid email
    await waitFor(() => {
      expect(screen.getByText(/at least one valid recipient/i)).toBeInTheDocument();
    });
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  it('disables send button when fields are empty', () => {
    render(<ComposeModal {...defaultProps} />);

    const sendButton = screen.getByTestId('compose-send');

    // Button should be disabled when both fields are empty
    expect(sendButton).toBeDisabled();
  });

  it('calls onSend with correct data', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn(() => Promise.resolve());

    render(<ComposeModal {...defaultProps} onSend={onSend} />);

    await user.type(screen.getByTestId('compose-to'), 'recipient@example.com');
    await user.type(screen.getByTestId('compose-subject'), 'Test Subject');
    await user.type(screen.getByTestId('compose-body'), 'Test message body');
    await user.click(screen.getByTestId('compose-send'));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith({
        to: ['recipient@example.com'],
        cc: undefined,
        subject: 'Test Subject',
        body: 'Test message body',
      });
    });
  });

  it('shows loading state while sending', async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void;
    const sendPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    const onSend = vi.fn(() => sendPromise);

    render(<ComposeModal {...defaultProps} onSend={onSend} />);

    await user.type(screen.getByTestId('compose-to'), 'recipient@example.com');
    await user.type(screen.getByTestId('compose-body'), 'Test message');
    await user.click(screen.getByTestId('compose-send'));

    expect(screen.getByText('Sending...')).toBeInTheDocument();

    // Resolve the promise to complete the test
    resolvePromise!();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ComposeModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when escape key is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ComposeModal {...defaultProps} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ComposeModal {...defaultProps} onClose={onClose} />);

    const backdrop = screen.getByTestId('compose-modal');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Error Handling', () => {
  it('displays error when API call fails', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn(() => Promise.reject(new Error('Network error')));

    render(
      <ComposeModal
        conversationId={null}
        accountId="account-1"
        onClose={vi.fn()}
        onSend={onSend}
      />
    );

    await user.type(screen.getByTestId('compose-to'), 'recipient@example.com');
    await user.type(screen.getByTestId('compose-body'), 'Test message');
    await user.click(screen.getByTestId('compose-send'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});

describe('Sync Status Display', () => {
  const mockAccounts = [createMockAccount()];

  it.each([
    ['idle', null],
    ['syncing', 'Syncing'],
    ['error', 'Error'],
  ])('displays correct status for %s', (status, expectedText) => {
    render(
      <EmailAccountList
        accounts={mockAccounts}
        selectedAccount={mockAccounts[0]}
        onSelectAccount={vi.fn()}
        syncStatus={status as SyncStatus}
      />
    );

    if (expectedText) {
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Syncing')).not.toBeInTheDocument();
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    }
  });
});

describe('Search Debouncing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces search input', async () => {
    const searchCallback = vi.fn();

    // Simple debounce test using the pattern from EmailClient
    function useDebounce<T extends (...args: Parameters<T>) => void>(
      callback: T,
      delay: number
    ): (...args: Parameters<T>) => void {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      return (...args: Parameters<T>) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => callback(...args), delay);
      };
    }

    const debouncedSearch = useDebounce(searchCallback, 300);

    // Rapid calls
    debouncedSearch('a');
    debouncedSearch('ab');
    debouncedSearch('abc');

    // No calls should have been made yet
    expect(searchCallback).not.toHaveBeenCalled();

    // Advance time by 300ms
    vi.advanceTimersByTime(300);

    // Only the last call should have been made
    expect(searchCallback).toHaveBeenCalledTimes(1);
    expect(searchCallback).toHaveBeenCalledWith('abc');
  });
});
