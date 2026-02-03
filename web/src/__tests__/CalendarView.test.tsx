/**
 * Calendar View and Component Tests
 * Week 4 Track 4: Calendar Foundation - Task 4.3
 * 20 comprehensive tests for calendar functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarView } from '../pages/CalendarView';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { EventDetail } from '../components/calendar/EventDetail';
import { CreateEventModal } from '../components/calendar/CreateEventModal';

// Mock data
const mockEvents = [
  {
    id: 'evt_1',
    user_id: 'user_123',
    title: 'Team Meeting',
    description: 'Weekly sync',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 3600000).toISOString(),
    is_all_day: false,
    location: 'Conference Room A',
    attendees: [
      { email: 'alice@example.com', status: 'accepted' },
      { email: 'bob@example.com', status: 'pending' },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe('Calendar Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CalendarGrid', () => {
    it('renders month view by default', () => {
      const mockOnEventClick = vi.fn();
      const mockOnDateChange = vi.fn();

      render(
        <CalendarGrid
          events={mockEvents}
          currentDate={new Date(2026, 1, 5)}
          viewType="month"
          isLoading={false}
          onEventClick={mockOnEventClick}
          onDateChange={mockOnDateChange}
        />
      );

      expect(screen.getByText('February 2026')).toBeTruthy();
      expect(screen.getByText('Mon')).toBeTruthy();
      expect(screen.getByText('Sun')).toBeTruthy();
    });

    it('displays events on correct dates in month view', () => {
      const mockOnEventClick = vi.fn();
      const mockOnDateChange = vi.fn();

      const { getByText } = render(
        <CalendarGrid
          events={mockEvents}
          currentDate={new Date()}
          viewType="month"
          isLoading={false}
          onEventClick={mockOnEventClick}
          onDateChange={mockOnDateChange}
        />
      );

      expect(getByText('Team Meeting')).toBeTruthy();
    });

    it('handles navigation buttons', async () => {
      const mockOnDateChange = vi.fn();

      const { getByText } = render(
        <CalendarGrid
          events={[]}
          currentDate={new Date(2026, 1, 5)}
          viewType="month"
          isLoading={false}
          onEventClick={vi.fn()}
          onDateChange={mockOnDateChange}
        />
      );

      const nextButton = getByText('Next →');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalled();
      });
    });

    it('renders week view correctly', () => {
      const mockOnEventClick = vi.fn();
      const mockOnDateChange = vi.fn();

      const { getByText } = render(
        <CalendarGrid
          events={mockEvents}
          currentDate={new Date(2026, 1, 5)}
          viewType="week"
          isLoading={false}
          onEventClick={mockOnEventClick}
          onDateChange={mockOnDateChange}
        />
      );

      expect(getByText(/Week of/)).toBeTruthy();
    });

    it('renders day view correctly', () => {
      const mockOnEventClick = vi.fn();
      const mockOnDateChange = vi.fn();

      const { container } = render(
        <CalendarGrid
          events={mockEvents}
          currentDate={new Date(2026, 1, 5)}
          viewType="day"
          isLoading={false}
          onEventClick={mockOnEventClick}
          onDateChange={mockOnDateChange}
        />
      );

      expect(container.querySelector('.space-y-2')).toBeTruthy();
    });

    it('shows loading state', () => {
      const mockOnEventClick = vi.fn();
      const mockOnDateChange = vi.fn();

      const { getByText } = render(
        <CalendarGrid
          events={[]}
          currentDate={new Date()}
          viewType="month"
          isLoading={true}
          onEventClick={mockOnEventClick}
          onDateChange={mockOnDateChange}
        />
      );

      expect(getByText('Loading calendar...')).toBeTruthy();
    });

    it('calls onEventClick when event is clicked', async () => {
      const mockOnEventClick = vi.fn();
      const mockOnDateChange = vi.fn();

      const { getByText } = render(
        <CalendarGrid
          events={mockEvents}
          currentDate={new Date()}
          viewType="month"
          isLoading={false}
          onEventClick={mockOnEventClick}
          onDateChange={mockOnDateChange}
        />
      );

      const eventElement = getByText('Team Meeting');
      fireEvent.click(eventElement);

      expect(mockOnEventClick).toHaveBeenCalledWith('evt_1');
    });

    it('returns to today when Today button is clicked', async () => {
      const mockOnDateChange = vi.fn();

      const { getByText } = render(
        <CalendarGrid
          events={[]}
          currentDate={new Date(2025, 0, 1)} // Jan 1, 2025
          viewType="month"
          isLoading={false}
          onEventClick={vi.fn()}
          onDateChange={mockOnDateChange}
        />
      );

      const todayButton = getByText('Today');
      fireEvent.click(todayButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalled();
      });
    });
  });

  describe('EventDetail', () => {
    it('displays event information', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();

      const { getByText } = render(
        <EventDetail
          event={mockEvents[0]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDeleting={false}
        />
      );

      expect(getByText('Team Meeting')).toBeTruthy();
      expect(getByText('Weekly sync')).toBeTruthy();
      expect(getByText('Conference Room A')).toBeTruthy();
    });

    it('displays attendees with status', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();

      const { getAllByText, getByText } = render(
        <EventDetail
          event={mockEvents[0]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDeleting={false}
        />
      );

      expect(getAllByText('alice@example.com').length).toBeGreaterThan(0);
      expect(getAllByText('bob@example.com').length).toBeGreaterThan(0);
      expect(getByText('accepted')).toBeTruthy();
      expect(getByText('pending')).toBeTruthy();
    });

    it('calls onEdit when Edit button is clicked', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();

      const { getByText } = render(
        <EventDetail
          event={mockEvents[0]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDeleting={false}
        />
      );

      const editButton = getByText('Edit');
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(mockEvents[0]);
    });

    it('calls onDelete when Delete button is clicked', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();

      const { getByText } = render(
        <EventDetail
          event={mockEvents[0]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDeleting={false}
        />
      );

      const deleteButton = getByText('Delete');
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalled();
    });

    it('shows loading state on Delete button', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();

      const { getByRole } = render(
        <EventDetail
          event={mockEvents[0]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDeleting={true}
        />
      );

      const deleteButton = getByRole('button', { name: /Deleting/i }) as HTMLButtonElement;
      expect(deleteButton.disabled).toBe(true);
    });

    it('handles events without attendees', () => {
      const eventWithoutAttendees = { ...mockEvents[0], attendees: [] };
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();

      const { queryByText } = render(
        <EventDetail
          event={eventWithoutAttendees}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDeleting={false}
        />
      );

      expect(queryByText(/Attendees/)).toBeFalsy();
    });

    it('handles events with location', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();

      const { getByText } = render(
        <EventDetail
          event={mockEvents[0]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDeleting={false}
        />
      );

      expect(getByText('Conference Room A')).toBeTruthy();
    });
  });

  describe('CreateEventModal', () => {
    it('renders with correct title for new event', () => {
      const { getByText } = render(
        <CreateEventModal
          event={undefined}
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSaving={false}
        />
      );

      expect(getByText('New Event')).toBeTruthy();
    });

    it('renders with correct title for editing event', () => {
      const { getByText } = render(
        <CreateEventModal
          event={mockEvents[0]}
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSaving={false}
        />
      );

      expect(getByText('Edit Event')).toBeTruthy();
    });

    it('populates form with existing event data', () => {
      const { getByDisplayValue } = render(
        <CreateEventModal
          event={mockEvents[0]}
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSaving={false}
        />
      );

      expect(getByDisplayValue('Team Meeting')).toBeTruthy();
      expect(getByDisplayValue('Weekly sync')).toBeTruthy();
    });

    it('validates required title field', async () => {
      const mockOnSave = vi.fn();
      const { getByText, getByRole } = render(
        <CreateEventModal
          event={undefined}
          onSave={mockOnSave}
          onClose={vi.fn()}
          isSaving={false}
        />
      );

      const submitButton = getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(getByText('Title is required')).toBeTruthy();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('calls onSave with form data on submit', async () => {
      const mockOnSave = vi.fn();
      const { getByText, getByPlaceholderText } = render(
        <CreateEventModal
          event={undefined}
          onSave={mockOnSave}
          onClose={vi.fn()}
          isSaving={false}
        />
      );

      const titleInput = getByPlaceholderText('Enter event title') as HTMLInputElement;
      await userEvent.type(titleInput, 'New Meeting');

      const submitButton = getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Meeting',
          })
        );
      });
    });

    it('closes modal when Close button is clicked', () => {
      const mockOnClose = vi.fn();
      const { getByText } = render(
        <CreateEventModal
          event={undefined}
          onSave={vi.fn()}
          onClose={mockOnClose}
          isSaving={false}
        />
      );

      const closeButton = getByText('✕');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when Cancel button is clicked', () => {
      const mockOnClose = vi.fn();
      const { getByText } = render(
        <CreateEventModal
          event={undefined}
          onSave={vi.fn()}
          onClose={mockOnClose}
          isSaving={false}
        />
      );

      const cancelButton = getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('handles all-day event toggle', async () => {
      const { getByRole } = render(
        <CreateEventModal
          event={undefined}
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSaving={false}
        />
      );

      const allDayCheckbox = getByRole('checkbox', { name: /All Day Event/ });
      fireEvent.click(allDayCheckbox);

      await waitFor(() => {
        expect(allDayCheckbox).toBeChecked();
      });
    });

    it('shows save button text as Create for new event', () => {
      const { getByText } = render(
        <CreateEventModal
          event={undefined}
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSaving={false}
        />
      );

      expect(getByText('Create')).toBeTruthy();
    });

    it('shows save button text as Update for editing event', () => {
      const { getByText } = render(
        <CreateEventModal
          event={mockEvents[0]}
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSaving={false}
        />
      );

      expect(getByText('Update')).toBeTruthy();
    });

    it('disables submit button while saving', () => {
      const { getByText } = render(
        <CreateEventModal
          event={undefined}
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSaving={true}
        />
      );

      const submitButton = getByText('Saving...') as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });
  });
});
