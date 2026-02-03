/**
 * Mobile Components Tests
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * 20 tests for mobile UI components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MobileEmailList } from '../components/mobile/MobileEmailList';
import { MobileEmailDetail } from '../components/mobile/MobileEmailDetail';
import { MobileCalendarView } from '../components/mobile/MobileCalendarView';
import { MobileVoiceMemos } from '../components/mobile/MobileVoiceMemos';
import { BottomSheet } from '../components/mobile/BottomSheet';
import { MobileNavigation } from '../components/mobile/MobileNavigation';

describe('Mobile Components', () => {
  describe('MobileEmailList', () => {
    const mockConversations = [
      {
        id: '1',
        subject: 'Test Email',
        preview: 'This is a test email',
        participants: [{ name: 'John Doe', email: 'john@example.com' }],
        is_read: false,
        last_message_at: new Date().toISOString(),
      },
    ];

    it('renders email list', () => {
      const { getByText } = render(
        <MobileEmailList
          conversations={mockConversations}
          isLoading={false}
          onSelectConversation={vi.fn()}
          onRefresh={vi.fn()}
        />
      );

      expect(getByText('Inbox')).toBeTruthy();
      expect(getByText('Test Email')).toBeTruthy();
    });

    it('displays loading state', () => {
      const { getByText } = render(
        <MobileEmailList
          conversations={[]}
          isLoading={true}
          onSelectConversation={vi.fn()}
          onRefresh={vi.fn()}
        />
      );

      expect(getByText('Loading emails...')).toBeTruthy();
    });

    it('handles conversation selection', () => {
      const onSelect = vi.fn();
      const { getByText } = render(
        <MobileEmailList
          conversations={mockConversations}
          isLoading={false}
          onSelectConversation={onSelect}
          onRefresh={vi.fn()}
        />
      );

      fireEvent.click(getByText('Test Email'));
      expect(onSelect).toHaveBeenCalledWith(mockConversations[0]);
    });

    it('displays unread indicator', () => {
      const { container } = render(
        <MobileEmailList
          conversations={mockConversations}
          isLoading={false}
          onSelectConversation={vi.fn()}
          onRefresh={vi.fn()}
        />
      );

      const indicator = container.querySelector('.bg-blue-500');
      expect(indicator).toBeTruthy();
    });

    it('handles refresh action', async () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      const { getByRole } = render(
        <MobileEmailList
          conversations={[]}
          isLoading={false}
          onSelectConversation={vi.fn()}
          onRefresh={onRefresh}
        />
      );

      const refreshButton = getByRole('button', { name: /↻|⟳/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('MobileEmailDetail', () => {
    const mockConversation = {
      id: '1',
      subject: 'Test Conversation',
      preview: 'Preview text',
      participants: [{ name: 'Jane Smith', email: 'jane@example.com' }],
      is_read: true,
      last_message_at: new Date().toISOString(),
    };

    const mockMessages = [
      {
        id: '1',
        from_name: 'Jane Smith',
        from_email: 'jane@example.com',
        body: 'Hello, this is a test message',
        created_at: new Date().toISOString(),
      },
    ];

    it('renders email detail view', () => {
      const { getByText, getAllByText } = render(
        <MobileEmailDetail
          conversation={mockConversation}
          messages={mockMessages}
          isLoading={false}
          onBack={vi.fn()}
          onReply={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(getByText('Test Conversation')).toBeTruthy();
      const janeSmithElements = getAllByText('Jane Smith');
      expect(janeSmithElements.length).toBeGreaterThan(0);
    });

    it('handles reply composition', () => {
      const onReply = vi.fn();
      const { getByText, getByPlaceholderText } = render(
        <MobileEmailDetail
          conversation={mockConversation}
          messages={mockMessages}
          isLoading={false}
          onBack={vi.fn()}
          onReply={onReply}
          onDelete={vi.fn()}
        />
      );

      fireEvent.click(getByText('Reply'));
      const textarea = getByPlaceholderText('Type your reply...');
      fireEvent.change(textarea, { target: { value: 'Test reply' } });
      fireEvent.click(getByText('Send'));

      expect(onReply).toHaveBeenCalledWith('Test reply');
    });

    it('handles delete action', () => {
      const onDelete = vi.fn();
      const { getByText } = render(
        <MobileEmailDetail
          conversation={mockConversation}
          messages={mockMessages}
          isLoading={false}
          onBack={vi.fn()}
          onReply={vi.fn()}
          onDelete={onDelete}
        />
      );

      fireEvent.click(getByText('🗑️'));
      expect(onDelete).toHaveBeenCalled();
    });
  });

  describe('MobileCalendarView', () => {
    const mockEvents = [
      {
        id: '1',
        title: 'Test Event',
        description: 'Test description',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        color: '#3b82f6',
        attendees: [{ name: 'John', email: 'john@example.com', status: 'accepted' }],
      },
    ];

    it('renders calendar view', () => {
      const { getByText } = render(
        <MobileCalendarView
          events={mockEvents}
          currentDate={new Date()}
          onPreviousDay={vi.fn()}
          onNextDay={vi.fn()}
          onSelectEvent={vi.fn()}
          onCreateEvent={vi.fn()}
        />
      );

      expect(getByText('Test Event')).toBeTruthy();
      expect(getByText('+ New Event')).toBeTruthy();
    });

    it('displays event details', () => {
      const { getByText } = render(
        <MobileCalendarView
          events={mockEvents}
          currentDate={new Date()}
          onPreviousDay={vi.fn()}
          onNextDay={vi.fn()}
          onSelectEvent={vi.fn()}
          onCreateEvent={vi.fn()}
        />
      );

      expect(getByText('👥 1 attendee')).toBeTruthy();
    });

    it('handles date navigation', () => {
      const onPrevious = vi.fn();
      const onNext = vi.fn();
      const { getAllByRole } = render(
        <MobileCalendarView
          events={[]}
          currentDate={new Date()}
          onPreviousDay={onPrevious}
          onNextDay={onNext}
          onSelectEvent={vi.fn()}
          onCreateEvent={vi.fn()}
        />
      );

      const buttons = getAllByRole('button');
      fireEvent.click(buttons[0]); // Previous
      expect(onPrevious).toHaveBeenCalled();

      fireEvent.click(buttons[1]); // Next
      expect(onNext).toHaveBeenCalled();
    });
  });

  describe('MobileVoiceMemos', () => {
    const mockMemos = [
      {
        id: '1',
        title: 'Test Memo',
        duration_ms: 5000,
        transcript: 'This is a test transcript',
        tags: ['test', 'voice'],
        created_at: new Date().toISOString(),
        audio_url: 'test.wav',
        user_id: 'user1',
      },
    ];

    it('renders voice memos list', () => {
      const { getByText } = render(
        <MobileVoiceMemos
          memos={mockMemos}
          isLoading={false}
          onSelectMemo={vi.fn()}
          onDeleteMemo={vi.fn()}
        />
      );

      expect(getByText('Voice Memos')).toBeTruthy();
      expect(getByText('Test Memo')).toBeTruthy();
    });

    it('displays memo tags', () => {
      const { getByText } = render(
        <MobileVoiceMemos
          memos={mockMemos}
          isLoading={false}
          onSelectMemo={vi.fn()}
          onDeleteMemo={vi.fn()}
        />
      );

      expect(getByText('#test')).toBeTruthy();
    });

    it('handles memo selection', () => {
      const onSelect = vi.fn();
      const { getByText } = render(
        <MobileVoiceMemos
          memos={mockMemos}
          isLoading={false}
          onSelectMemo={onSelect}
          onDeleteMemo={vi.fn()}
        />
      );

      fireEvent.click(getByText('Test Memo'));
      expect(onSelect).toHaveBeenCalledWith(mockMemos[0]);
    });

    it('shows record button', () => {
      const { getByText } = render(
        <MobileVoiceMemos
          memos={[]}
          isLoading={false}
          onSelectMemo={vi.fn()}
          onDeleteMemo={vi.fn()}
        />
      );

      expect(getByText('🎤 New Recording')).toBeTruthy();
    });
  });

  describe('BottomSheet', () => {
    it('renders when open', () => {
      const { getByText } = render(
        <BottomSheet
          isOpen={true}
          onClose={vi.fn()}
          title="Test Sheet"
        >
          <div>Content</div>
        </BottomSheet>
      );

      expect(getByText('Test Sheet')).toBeTruthy();
      expect(getByText('Content')).toBeTruthy();
    });

    it('does not render when closed', () => {
      const { queryByText } = render(
        <BottomSheet
          isOpen={false}
          onClose={vi.fn()}
          title="Test Sheet"
        >
          <div>Content</div>
        </BottomSheet>
      );

      expect(queryByText('Content')).toBeFalsy();
    });

    it('handles close action', () => {
      const onClose = vi.fn();
      const { container } = render(
        <BottomSheet
          isOpen={true}
          onClose={onClose}
          title="Test"
        >
          <div>Content</div>
        </BottomSheet>
      );

      const backdrop = container.querySelector('.bg-black\\/50');
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('MobileNavigation', () => {
    it('renders navigation tabs', () => {
      const { getByText } = render(
        <MobileNavigation
          activeTab="email"
          onTabChange={vi.fn()}
          unreadCount={0}
        />
      );

      expect(getByText('Email')).toBeTruthy();
      expect(getByText('Calendar')).toBeTruthy();
      expect(getByText('Voice')).toBeTruthy();
      expect(getByText('Settings')).toBeTruthy();
    });

    it('highlights active tab', () => {
      const { getByText } = render(
        <MobileNavigation
          activeTab="calendar"
          onTabChange={vi.fn()}
          unreadCount={0}
        />
      );

      const calendarTab = getByText('Calendar').closest('button');
      expect(calendarTab).toHaveClass('text-blue-400');
    });

    it('displays unread badge', () => {
      const { getByText } = render(
        <MobileNavigation
          activeTab="email"
          onTabChange={vi.fn()}
          unreadCount={5}
        />
      );

      expect(getByText('5')).toBeTruthy();
    });

    it('handles tab change', () => {
      const onChange = vi.fn();
      const { getByText } = render(
        <MobileNavigation
          activeTab="email"
          onTabChange={onChange}
          unreadCount={0}
        />
      );

      fireEvent.click(getByText('Calendar'));
      expect(onChange).toHaveBeenCalledWith('calendar');
    });
  });
});
