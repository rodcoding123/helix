import { FC, useEffect } from 'react';
import { useMemory } from '@/hooks/useMemory';
import { MemoryGreeting } from '@/components/memory/MemoryGreeting';

export const MemoriesPage: FC = () => {
  const { memories, greeting, isLoading, getGreeting } = useMemory();

  useEffect(() => {
    // TODO: Get user ID from auth context
    // getGreeting(userId);
  }, [getGreeting]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Memories</h1>

      <section className="mb-8">
        <MemoryGreeting greeting={greeting} isLoading={isLoading} />
      </section>

      <section className="grid gap-4">
        {memories.map((memory) => (
          <div key={memory.id} className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-semibold mb-2">{memory.primary_emotion}</h3>
            <p className="text-sm text-gray-600 mb-2">
              {JSON.stringify(memory.messages.slice(0, 1))}
            </p>
            <div className="flex gap-2">
              {memory.extracted_topics.map((topic) => (
                <span key={topic} className="px-2 py-1 bg-gray-100 rounded text-xs">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default MemoriesPage;
