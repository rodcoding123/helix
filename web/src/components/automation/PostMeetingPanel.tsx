/**
 * Post-Meeting Panel - Phase 7 Track 2.2 UI
 * UI for entering meeting notes and extracting action items
 */

import { useState } from 'react';
import type { ActionItem } from '../../services/automation.types';

interface PostMeetingPanelProps {
  eventId: string;
  userId: string;
  onDismiss?: () => void;
  onFollowupCreated?: (taskIds: string[]) => void;
}

interface FormState {
  notes: string;
  transcript?: string;
  recordingUrl?: string;
  extractedItems: ActionItem[];
  isExtracting: boolean;
  isSubmitting: boolean;
  error: string | null;
  success: string | null;
}

export function PostMeetingPanel({
  eventId,
  userId,
  onDismiss,
  onFollowupCreated,
}: PostMeetingPanelProps) {
  const [state, setState] = useState<FormState>({
    notes: '',
    transcript: '',
    recordingUrl: '',
    extractedItems: [],
    isExtracting: false,
    isSubmitting: false,
    error: null,
    success: null,
  });

  async function extractActionItems() {
    try {
      setState((prev) => ({ ...prev, isExtracting: true, error: null, success: null }));

      const { getPostMeetingFollowupService } = await import(
        '../../services/automation-post-meeting'
      );
      const service = getPostMeetingFollowupService();

      const items = await (service as any).extractActionItemsFromText(
        state.notes + (state.transcript ? '\n' + state.transcript : '')
      );

      setState((prev) => ({
        ...prev,
        extractedItems: items,
        isExtracting: false,
        success: `Extracted ${items.length} action item(s)`,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isExtracting: false,
        error: `Error extracting action items: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    }
  }

  async function submitFollowup() {
    try {
      setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

      const { getPostMeetingFollowupService } = await import(
        '../../services/automation-post-meeting'
      );
      const service = getPostMeetingFollowupService();

      const taskIds = await service.createPostMeetingFollowup({
        eventId,
        userId,
        notes: state.notes,
        transcript: state.transcript,
        recordingUrl: state.recordingUrl,
      });

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        success: `Created ${taskIds.length} follow-up task(s)`,
        notes: '',
        transcript: '',
        recordingUrl: '',
        extractedItems: [],
      }));

      onFollowupCreated?.(taskIds);

      // Auto-dismiss after success
      if (onDismiss) {
        setTimeout(onDismiss, 2000);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: `Error creating follow-up: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    }
  }

  function updateExtractedItem(index: number, updates: Partial<ActionItem>) {
    setState((prev) => {
      const newItems = [...prev.extractedItems];
      newItems[index] = { ...newItems[index], ...updates };
      return { ...prev, extractedItems: newItems };
    });
  }

  function removeExtractedItem(index: number) {
    setState((prev) => ({
      ...prev,
      extractedItems: prev.extractedItems.filter((_, i) => i !== index),
    }));
  }

  const canExtract = state.notes.trim().length > 0 || (state.transcript?.trim() ?? '').length > 0;
  const canSubmit = state.extractedItems.length > 0;

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-2xl max-h-96 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Post-Meeting Follow-up</h2>
        <button
          onClick={onDismiss}
          className="text-white hover:bg-green-700 p-1 rounded-md transition-colors"
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
          {/* Notes input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Notes
            </label>
            <textarea
              value={state.notes}
              onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Enter meeting notes or action items..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              disabled={state.isSubmitting}
            />
          </div>

          {/* Transcript input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcript (optional)
            </label>
            <textarea
              value={state.transcript || ''}
              onChange={(e) => setState((prev) => ({ ...prev, transcript: e.target.value }))}
              placeholder="Paste meeting transcript here..."
              className="w-full h-16 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              disabled={state.isSubmitting}
            />
          </div>

          {/* Recording URL input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recording URL (optional)
            </label>
            <input
              type="url"
              value={state.recordingUrl || ''}
              onChange={(e) => setState((prev) => ({ ...prev, recordingUrl: e.target.value }))}
              placeholder="https://example.com/recording"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              disabled={state.isSubmitting}
            />
          </div>

          {/* Extract button */}
          {state.extractedItems.length === 0 && (
            <button
              onClick={extractActionItems}
              disabled={!canExtract || state.isExtracting}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {state.isExtracting ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Extracting Action Items...
                </>
              ) : (
                'Extract Action Items'
              )}
            </button>
          )}

          {/* Extracted items */}
          {state.extractedItems.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Extracted Action Items</h3>
              <div className="space-y-3">
                {state.extractedItems.map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateExtractedItem(index, { title: e.target.value })}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        disabled={state.isSubmitting}
                      />
                      <button
                        onClick={() => removeExtractedItem(index)}
                        className="text-red-500 hover:text-red-700 px-2 py-1"
                        disabled={state.isSubmitting}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Priority and assignee */}
                    <div className="mt-2 flex gap-2">
                      <select
                        value={item.priority || 'normal'}
                        onChange={(e) => updateExtractedItem(index, { priority: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        disabled={state.isSubmitting}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                      </select>

                      <input
                        type="text"
                        value={item.assigneeName || ''}
                        onChange={(e) => updateExtractedItem(index, { assigneeName: e.target.value })}
                        placeholder="Assignee (optional)"
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        disabled={state.isSubmitting}
                      />
                    </div>
                  </div>
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
          disabled={state.isSubmitting}
        >
          Cancel
        </button>
        <button
          onClick={submitFollowup}
          disabled={!canSubmit || state.isSubmitting}
          className="flex-1 px-3 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state.isSubmitting ? (
            <>
              <span className="animate-spin">⟳</span>
              Creating Tasks...
            </>
          ) : (
            `Create ${state.extractedItems.length} Task(s)`
          )}
        </button>
      </div>
    </div>
  );
}

// Export as default for lazy loading
export default PostMeetingPanel;
