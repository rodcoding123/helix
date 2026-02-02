import React, { useState, useCallback } from 'react';

export interface CopyButtonProps {
  secretName: string;
  value: string;
}

type FeedbackState = 'idle' | 'copied' | 'error';

export const CopyButton: React.FC<CopyButtonProps> = ({
  secretName,
  value,
}) => {
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  const handleCopy = useCallback(async () => {
    // Clear any existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    try {
      await navigator.clipboard.writeText(value);
      setFeedback('copied');

      // Auto-clear feedback after 10 seconds
      const id = window.setTimeout(() => {
        setFeedback('idle');
      }, 10000);

      setTimeoutId(id as unknown as number);
    } catch (err) {
      setFeedback('error');

      // Auto-clear error after 3 seconds
      const id = window.setTimeout(() => {
        setFeedback('idle');
      }, 3000);

      setTimeoutId(id as unknown as number);
    }
  }, [value, timeoutId]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          feedback === 'copied'
            ? 'bg-green-100 text-green-700'
            : feedback === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
        }`}
        aria-label={`Copy ${secretName}`}
      >
        {feedback === 'idle' && (
          <>
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy
          </>
        )}
        {feedback === 'copied' && (
          <>
            <svg
              className="mr-2 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Copied!
          </>
        )}
        {feedback === 'error' && (
          <>
            <svg
              className="mr-2 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Failed to copy
          </>
        )}
      </button>
    </div>
  );
};
