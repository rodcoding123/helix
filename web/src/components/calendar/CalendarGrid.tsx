/**
 * Calendar Grid Component
 * Displays calendar in month/week/day views with event rendering
 */

import React from 'react';
import type { CalendarEvent } from '../../../../helix-runtime/src/types/calendar';

interface CalendarGridProps {
  events: CalendarEvent[];
  currentDate: Date;
  viewType: 'month' | 'week' | 'day';
  isLoading: boolean;
  onEventClick: (eventId: string) => void;
  onDateChange: (date: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  events,
  currentDate,
  viewType,
  isLoading,
  onEventClick,
  onDateChange,
}) => {
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventColor = (eventType?: string) => {
    const colors: Record<string, string> = {
      meeting: 'bg-blue-600',
      deadline: 'bg-red-600',
      birthday: 'bg-purple-600',
      holiday: 'bg-green-600',
      work: 'bg-yellow-600',
    };
    return colors[eventType || 'work'] || 'bg-blue-600';
  };

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="bg-slate-800/30 min-h-20 p-2"></div>
      );
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = events.filter(e => {
        const eDate = new Date(e.start_time);
        return eDate.toDateString() === date.toDateString();
      });

      days.push(
        <div
          key={day}
          className="bg-slate-800 border border-slate-700 min-h-20 p-2 cursor-pointer hover:bg-slate-750 transition-colors"
          onClick={() => onDateChange(date)}
        >
          <div className="text-sm font-semibold text-slate-300">{day}</div>
          <div className="mt-1 space-y-1">
            {dayEvents.slice(0, 2).map((event) => (
              <div
                key={event.id}
                className={`text-xs px-2 py-1 rounded ${getEventColor()} cursor-pointer hover:opacity-90 truncate`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event.id);
                }}
                title={event.title}
              >
                {event.title}
              </div>
            ))}
            {dayEvents.length > 2 && (
              <div className="text-xs text-slate-400 px-2">
                +{dayEvents.length - 2} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1 p-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center font-semibold text-slate-400 py-2">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    return (
      <div className="p-4 space-y-4">
        <div className="text-sm text-slate-400 mb-4">
          Week of {weekStart.toLocaleDateString()}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + dayOffset);
            const dayEvents = events.filter(e => {
              const eDate = new Date(e.start_time);
              return eDate.toDateString() === date.toDateString();
            });

            return (
              <div
                key={dayOffset}
                className="bg-slate-800 border border-slate-700 p-3 rounded cursor-pointer hover:bg-slate-750 transition-colors"
                onClick={() => onDateChange(date)}
              >
                <div className="font-semibold text-slate-300">
                  {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <div className="mt-2 space-y-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`text-xs px-2 py-1 rounded ${getEventColor()} cursor-pointer hover:opacity-90 truncate`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event.id);
                      }}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = events.filter(e => {
      const eDate = new Date(e.start_time);
      return eDate.toDateString() === currentDate.toDateString();
    });

    const hourSlots = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="p-4">
        <div className="text-sm text-slate-400 mb-4">
          {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="space-y-2">
          {hourSlots.map((hour) => {
            const hourEvents = dayEvents.filter(e => {
              const eHour = new Date(e.start_time).getHours();
              return eHour === hour;
            });

            return (
              <div key={hour} className="flex gap-2">
                <div className="w-16 text-right text-xs text-slate-400 pt-1">
                  {`${String(hour).padStart(2, '0')}:00`}
                </div>
                <div className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 min-h-12">
                  {hourEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`text-xs px-2 py-1 rounded ${getEventColor()} cursor-pointer hover:opacity-90 truncate mb-1`}
                      onClick={() => onEventClick(event.id)}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-400">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-slate-200">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const prev = new Date(currentDate);
              prev.setMonth(prev.getMonth() - 1);
              onDateChange(prev);
            }}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={() => onDateChange(new Date())}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => {
              const next = new Date(currentDate);
              next.setMonth(next.getMonth() + 1);
              onDateChange(next);
            }}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {viewType === 'month' && renderMonthView()}
      {viewType === 'week' && renderWeekView()}
      {viewType === 'day' && renderDayView()}
    </div>
  );
};
