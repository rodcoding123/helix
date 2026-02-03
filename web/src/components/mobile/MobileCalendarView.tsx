/**
 * Mobile Calendar View Component
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Touch-optimized calendar with event management
 */

import React from 'react';
import { CalendarEvent } from '../../types/calendar';

interface MobileCalendarViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateEvent: () => void;
}

export const MobileCalendarView: React.FC<MobileCalendarViewProps> = ({
  events,
  currentDate,
  onPreviousDay,
  onNextDay,
  onSelectEvent,
  onCreateEvent,
}) => {
  const dayEvents = events.filter((event) => {
    const eventDate = new Date(event.start_time);
    return (
      eventDate.getFullYear() === currentDate.getFullYear() &&
      eventDate.getMonth() === currentDate.getMonth() &&
      eventDate.getDate() === currentDate.getDate()
    );
  });

  const formatTime = (date: string): string => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-4">
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

      {/* Events List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 touch-pan-y">
        {dayEvents.length === 0 ? (
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
          <div className="space-y-3">
            {dayEvents
              .sort(
                (a, b) =>
                  new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
              )
              .map((event) => (
                <button
                  key={event.id}
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
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
