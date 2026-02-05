/**
 * Meeting Prep Panel - Phase 7 Track 2.1 UI
 * Displays meeting preparation checklist before the meeting starts
 */

import { useState, useEffect } from 'react';
import type { MeetingContext } from '../../services/automation.types';

interface MeetingPrepPanelProps {
  eventId: string;
  userId: string;
  onDismiss?: () => void;
  onTaskClick?: (taskId: string) => void;
}

interface PanelState {
  context: MeetingContext | null;
  checklist: ChecklistItem[];
  isLoading: boolean;
  error: string | null;
  dismissedItems: Set<string>;
}

interface ChecklistItem {
  id: string;
  title: string;
  type: 'email' | 'action-item' | 'prep-task';
  priority?: string;
  source?: string;
  completed?: boolean;
}

export function MeetingPrepPanel({
  eventId,
  userId,
  onDismiss,
  onTaskClick,
}: MeetingPrepPanelProps) {
  const [state, setState] = useState<PanelState>({
    context: null,
    checklist: [],
    isLoading: true,
    error: null,
    dismissedItems: new Set(),
  });

  // Load meeting context on mount
  useEffect(() => {
    loadMeetingContext();
  }, [eventId, userId]);

  async function loadMeetingContext() {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Import service dynamically
      const { getMeetingPrepService } = await import(
        '../../services/automation-meeting-prep'
      );
      const service = getMeetingPrepService();

      const context = await service.getMeetingContext(eventId, userId);

      if (!context) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Unable to load meeting preparation data',
        }));
        return;
      }

      // Build checklist from context
      const checklist: ChecklistItem[] = [];

      // Add relevant emails
      if (context.relevantEmails && context.relevantEmails.length > 0) {
        for (const email of context.relevantEmails) {
          checklist.push({
            id: `email-${email.id}`,
            title: `Email from ${email.from}: ${email.subject}`,
            type: 'email',
            source: email.from,
          });
        }
      }

      // Add action items
      if (context.actionItems && context.actionItems.length > 0) {
        for (const actionItem of context.actionItems) {
          checklist.push({
            id: `action-${actionItem.title}`,
            title: actionItem.title,
            type: 'action-item',
            priority: actionItem.priority,
          });
        }
      }

      // Add prep task
      if (context.prepTaskId) {
        checklist.push({
          id: `task-${context.prepTaskId}`,
          title: 'Prep task created',
          type: 'prep-task',
        });
      }

      setState((prev) => ({
        ...prev,
        context,
        checklist,
        isLoading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: `Error loading meeting context: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    }
  }

  function toggleItemDismissal(itemId: string) {
    setState((prev) => {
      const newDismissed = new Set(prev.dismissedItems);
      if (newDismissed.has(itemId)) {
        newDismissed.delete(itemId);
      } else {
        newDismissed.add(itemId);
      }
      return { ...prev, dismissedItems: newDismissed };
    });
  }

  function getPriorityColor(priority?: string): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'normal':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  function getItemIcon(type: ChecklistItem['type']): string {
    switch (type) {
      case 'email':
        return '✉️';
      case 'action-item':
        return '⚡';
      case 'prep-task':
        return '✓';
      default:
        return '•';
    }
  }

  const visibleChecklist = state.checklist.filter(
    (item) => !state.dismissedItems.has(item.id)
  );

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Meeting Preparation</h2>
        <button
          onClick={onDismiss}
          className="text-white hover:bg-blue-700 p-1 rounded-md transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {state.isLoading ? (
          // Loading state
          <div className="p-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading preparation data...</span>
          </div>
        ) : state.error ? (
          // Error state
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-red-700 text-sm">{state.error}</p>
            <button
              onClick={loadMeetingContext}
              className="mt-2 text-red-600 hover:text-red-700 underline text-sm"
            >
              Try again
            </button>
          </div>
        ) : visibleChecklist.length === 0 ? (
          // Empty state
          <div className="p-6 text-center">
            <p className="text-gray-500">No preparation items for this meeting</p>
          </div>
        ) : (
          // Checklist items
          <div className="divide-y divide-gray-200">
            {visibleChecklist.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-gray-300"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <span className="text-xl flex-shrink-0 mt-1">{getItemIcon(item.type)}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 break-words text-sm">
                      {item.title}
                    </p>
                    {item.source && (
                      <p className="text-xs text-gray-500 mt-1">{item.source}</p>
                    )}

                    {/* Priority badge */}
                    {item.priority && (
                      <span
                        className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(item.priority)}`}
                      >
                        {item.priority}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => toggleItemDismissal(item.id)}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1"
                    aria-label="Dismiss item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 p-3 flex gap-2">
        <button
          onClick={onDismiss}
          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={loadMeetingContext}
          className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

// Export as default for lazy loading
export default MeetingPrepPanel;
