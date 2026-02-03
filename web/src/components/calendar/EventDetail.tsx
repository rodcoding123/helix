/**
 * Event Detail Component
 * Shows full event details with attendee information and action buttons
 */

import React from 'react';
import type { CalendarEvent } from '../../../../helix-runtime/src/types/calendar';

interface EventDetailProps {
  event: CalendarEvent;
  onEdit: (event: CalendarEvent) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export const EventDetail: React.FC<EventDetailProps> = ({
  event,
  onEdit,
  onDelete,
  isDeleting,
}) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAttendeeStatus = (status: string) => {
    const statusColors: Record<string, string> = {
      accepted: 'bg-green-900/50 text-green-100 border-green-700',
      pending: 'bg-yellow-900/50 text-yellow-100 border-yellow-700',
      declined: 'bg-red-900/50 text-red-100 border-red-700',
    };
    return statusColors[status] || 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const attendees = event.attendees || [];

  return (
    <div className="p-6">
      {/* Title and Type */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">{event.title}</h2>
        {event.description && (
          <p className="text-sm text-slate-400">{event.description}</p>
        )}
      </div>

      {/* Time */}
      <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🕒</div>
          <div>
            {event.is_all_day ? (
              <div className="font-medium text-slate-200">All Day Event</div>
            ) : (
              <>
                <div className="text-sm text-slate-400">Start</div>
                <div className="font-medium text-slate-200">{formatTime(event.start_time)}</div>
                <div className="text-sm text-slate-400 mt-2">End</div>
                <div className="font-medium text-slate-200">{formatTime(event.end_time)}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Location */}
      {event.location && (
        <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="text-xl">📍</div>
            <div>
              <div className="text-sm text-slate-400">Location</div>
              <div className="font-medium text-slate-200">{event.location}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recurrence */}
      {event.recurrence_rule && (
        <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="text-xl">🔄</div>
            <div>
              <div className="text-sm text-slate-400">Recurrence</div>
              <div className="font-medium text-slate-200">{event.recurrence_rule}</div>
            </div>
          </div>
        </div>
      )}

      {/* Attendees */}
      {attendees.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Attendees ({attendees.length})</h3>
          <div className="space-y-2">
            {attendees.map((attendee) => (
              <div
                key={attendee.email}
                className={`p-3 rounded-lg border ${getAttendeeStatus(attendee.status || 'pending')}`}
              >
                <div className="font-medium">{attendee.name || attendee.email}</div>
                <div className="text-xs opacity-75">{attendee.email}</div>
                <div className="text-xs mt-1 capitalize">{attendee.status || 'pending'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-slate-700">
        <button
          onClick={() => onEdit(event)}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
};
