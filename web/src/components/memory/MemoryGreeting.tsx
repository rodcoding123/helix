import { FC } from 'react';
import type { MemoryGreetingData } from '@/lib/types/memory';

interface MemoryGreetingProps {
  greeting: MemoryGreetingData | null;
  isLoading?: boolean;
}

export const MemoryGreeting: FC<MemoryGreetingProps> = ({
  greeting,
  isLoading = false
}) => {
  if (isLoading) {
    return <div>Loading greeting...</div>;
  }

  if (!greeting) {
    return null;
  }

  return (
    <div className="memory-greeting p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-2">I Remember You</h3>
      <p className="text-sm text-white/90 mb-3">{greeting.summary}</p>
      <div className="flex gap-2 flex-wrap">
        {greeting.topics.map((topic) => (
          <span
            key={topic}
            className="px-2 py-1 bg-white/20 rounded text-xs text-white"
          >
            {topic}
          </span>
        ))}
      </div>
      <p className="text-xs text-white/70 mt-2">{greeting.when}</p>
    </div>
  );
};
