/**
 * Mobile Calendar View Component
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Touch-optimized calendar with event management
 *
 * Performance optimization: Virtualized list with memoized sorting
 * - Uses react-window FixedSizeList for large daily event lists
 * - Memoizes event sorting to O(1) after initial sort
 * - Reduces re-renders when parent props change
 */

import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { CalendarEvent } from '../../types/calendar';

interface MobileCalendarViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateEvent: () => void;
}

/**
 * Virtualized row renderer for calendar events
 * Item height: 140px (includes event details, description, and padding)
 */
const EventRow: React.FC<{
  index: number;
  style: React.CSSProperties;
  sortedEvents: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}> = ({ index, style, sortedEvents, onSelectEvent }) => {
  const event = sortedEvents[index];

  const formatTime = (date: string): string => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={style} className="px-4 py-3">
      <button
        onClick={() => onSelectEvent(event)}
        className="w-full text-left bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-blue-600 active:bg-slate-800 transition-colors touch-target"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-100 text-sm">
              {event.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {formatTime(event.start_time)} -{' '}
              {formatTime(event.end_time)}
            </p>
            {event.description && (
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                {event.description}
              </p>
            )}
          </div>

          {/* Color indicator */}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
            style={{
              backgroundColor: event.color || '#3b82f6',
            }}
          />
        </div>

        {/* Attendees count */}
        {event.attendees && event.attendees.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            👥 {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
          </p>
        )}
      </button>
    </div>
  );
};

export const MobileCalendarView: React.FC<MobileCalendarViewProps> = ({
  events,
  currentDate,
  onPreviousDay,
  onNextDay,
  onSelectEvent,
  onCreateEvent,
}) => {
  // Memoize day events filtering to avoid recalculating when parent re-renders
  const dayEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return (
        eventDate.getFullYear() === currentDate.getFullYear() &&
        eventDate.getMonth() === currentDate.getMonth() &&
        eventDate.getDate() === currentDate.getDate()
      );
    });
  }, [events, currentDate]);

  // Memoize sorted events to avoid re-sorting on every render
  // Performance impact: O(n log n) sort only when dayEvents changes, not on every render
  const sortedEvents = useMemo(() => {
    return dayEvents.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [dayEvents]);

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onPreviousDay}
            className="p-2 hover:bg-slate-800 rounded-lg"
          >
            ←
          </button>

          <div className="text-center flex-1">
            <h2 className="text-lg font-bold text-slate-100">
              {currentDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </h2>
            <p className="text-xs text-slate-400">
              {currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
              })}
            </p>
          </div>

          <button
            onClick={onNextDay}
            className="p-2 hover:bg-slate-800 rounded-lg"
          >
            →
          </button>
        </div>

        <button
          onClick={onCreateEvent}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white text-sm touch-target"
        >
          + New Event
        </button>
      </div>

      {/* Events List - Virtualized */}
      <div className="flex-1 overflow-hidden touch-pan-y">
        {sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <p className="mb-4">No events scheduled</p>
            <button
              onClick={onCreateEvent}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
            >
              Create one
            </button>
          </div>
        ) : (
          <List
            height={window.innerHeight - 200}
            itemCount={sortedEvents.length}
            itemSize={140}
            width="100%"
          >
            {({ index, style }) => (
              <EventRow
                index={index}
                style={style}
                sortedEvents={sortedEvents}
                onSelectEvent={onSelectEvent}
              />
            )}
          </List>
        )}
      </div>
    </div>
  );
};
