/**
 * Smart Scheduling Panel - Phase 7 Track 3 UI
 * UI for selecting attendees and viewing suggested meeting times
 */

import { useState } from 'react';
import type { TimeSlot } from '../../services/automation.types';

interface SmartSchedulingPanelProps {
  userId: string;
  onDismiss?: () => void;
  onTimeSelected?: (timeSlot: TimeSlot) => void;
}

interface PanelState {
  attendeeEmails: string[];
  attendeeInput: string;
  duration: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  suggestions: TimeSlot[];
  isLoading: boolean;
  error: string | null;
  success: string | null;
}

export function SmartSchedulingPanel({
  onDismiss,
  onTimeSelected,
}: SmartSchedulingPanelProps) {
  const [state, setState] = useState<PanelState>({
    attendeeEmails: [],
    attendeeInput: '',
    duration: 60,
    dateRange: {
      start: new Date(),
      end: new Date(Date.now() + 604800000), // 7 days from now
    },
    suggestions: [],
    isLoading: false,
    error: null,
    success: null,
  });

  async function findBestTimes() {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null, success: null }));

      if (state.attendeeEmails.length === 0) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Please add at least one attendee',
        }));
        return;
      }

      const { getSmartSchedulingService } = await import(
        '../../services/automation-smart-scheduling'
      );
      const service = getSmartSchedulingService();

      const suggestion = await service.findBestMeetingTimes({
        attendeeEmails: state.attendeeEmails,
        duration: state.duration,
        dateRange: state.dateRange,
      });

      setState((prev) => ({
        ...prev,
        suggestions: (suggestion as any).suggestedTimes || [],
        isLoading: false,
        success: `Found ${((suggestion as any).suggestedTimes || []).length} suitable time slot(s)`,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: `Error finding times: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    }
  }

  function addAttendee() {
    const email = state.attendeeInput.trim();
    if (!email || !email.includes('@')) {
      setState((prev) => ({
        ...prev,
        error: 'Please enter a valid email address',
      }));
      return;
    }

    if (state.attendeeEmails.includes(email)) {
      setState((prev) => ({
        ...prev,
        error: 'This attendee is already added',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      attendeeEmails: [...prev.attendeeEmails, email],
      attendeeInput: '',
      error: null,
    }));
  }

  function removeAttendee(email: string) {
    setState((prev) => ({
      ...prev,
      attendeeEmails: prev.attendeeEmails.filter((e) => e !== email),
    }));
  }

  function selectTimeSlot(slot: TimeSlot) {
    onTimeSelected?.(slot);
    setState((prev) => ({
      ...prev,
      success: `Selected ${slot.start.toLocaleString()} - ${slot.end.toLocaleTimeString()}`,
    }));

    if (onDismiss) {
      setTimeout(onDismiss, 1500);
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-blue-100 text-blue-800';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }

  function getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  }

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-2xl max-h-96 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Smart Meeting Scheduling</h2>
        <button
          onClick={onDismiss}
          className="text-white hover:bg-purple-700 p-1 rounded-md transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {state.error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-red-700 text-sm">{state.error}</p>
          </div>
        )}

        {state.success && (
          <div className="p-4 bg-green-50 border-b border-green-200">
            <p className="text-green-700 text-sm">{state.success}</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Attendees input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Attendees
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={state.attendeeInput}
                onChange={(e) => setState((prev) => ({ ...prev, attendeeInput: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && addAttendee()}
                placeholder="john@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                disabled={state.isLoading}
              />
              <button
                onClick={addAttendee}
                disabled={state.isLoading}
                className="px-4 py-2 bg-purple-500 text-white rounded-md text-sm font-medium hover:bg-purple-600 transition-colors disabled:bg-gray-300"
              >
                Add
              </button>
            </div>

            {/* Attendee list */}
            {state.attendeeEmails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {state.attendeeEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                  >
                    {email}
                    <button
                      onClick={() => removeAttendee(email)}
                      className="text-purple-600 hover:text-purple-700"
                      disabled={state.isLoading}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Duration input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Duration (minutes)
            </label>
            <input
              type="number"
              value={state.duration}
              onChange={(e) => setState((prev) => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
              min="15"
              max="480"
              step="15"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              disabled={state.isLoading}
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={state.dateRange.start.toISOString().split('T')[0]}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    dateRange: {
                      ...prev.dateRange,
                      start: new Date(e.target.value),
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                disabled={state.isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={state.dateRange.end.toISOString().split('T')[0]}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    dateRange: {
                      ...prev.dateRange,
                      end: new Date(e.target.value),
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                disabled={state.isLoading}
              />
            </div>
          </div>

          {/* Suggested times */}
          {state.suggestions.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Suggested Times</h3>
              <div className="space-y-2">
                {state.suggestions.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => selectTimeSlot(slot)}
                    className="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-purple-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {slot.start.toLocaleDateString()} {slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {state.attendeeEmails.length} attendee{state.attendeeEmails.length !== 1 ? 's' : ''} available
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getScoreColor(slot.score)}`}
                      >
                        {getScoreLabel(slot.score)} ({Math.round(slot.score)}%)
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 p-3 flex gap-2">
        <button
          onClick={onDismiss}
          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          disabled={state.isLoading}
        >
          Cancel
        </button>
        <button
          onClick={findBestTimes}
          disabled={state.attendeeEmails.length === 0 || state.isLoading}
          className="flex-1 px-3 py-2 bg-purple-500 text-white rounded-md text-sm font-medium hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state.isLoading ? (
            <>
              <span className="animate-spin">⟳</span>
              Finding Times...
            </>
          ) : (
            'Find Best Times'
          )}
        </button>
      </div>
    </div>
  );
}

// Export as default for lazy loading
export default SmartSchedulingPanel;
