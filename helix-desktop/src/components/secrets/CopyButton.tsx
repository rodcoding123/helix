import React, { useState, useCallback } from 'react';

interface CopyButtonProps {
  secretName: string;
  value: string;
}

type FeedbackState = 'idle' | 'copied' | 'error';

export const CopyButton: React.FC<CopyButtonProps> = ({ secretName, value }) => {
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  const handleCopy = useCallback(async () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    try {
      await navigator.clipboard.writeText(value);
      setFeedback('copied');

      const id = window.setTimeout(() => {
        setFeedback('idle');
      }, 10000);

      setTimeoutId(id as unknown as number);
    } catch (_err) {
      setFeedback('error');

      const id = window.setTimeout(() => {
        setFeedback('idle');
      }, 3000);

      setTimeoutId(id as unknown as number);
    }
  }, [value, timeoutId]);

  const feedbackText = {
    idle: '📋 Copy',
    copied: '✓ Copied!',
    error: '✗ Failed to copy',
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={`Copy ${secretName}`}
      aria-live="polite"
      aria-atomic="true"
      title={`Copy ${secretName} to clipboard`}
    >
      {feedbackText[feedback]}
    </button>
  );
};
