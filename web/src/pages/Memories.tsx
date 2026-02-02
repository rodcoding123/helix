import { FC, useEffect, useState } from 'react';
import { useMemory } from '@/hooks/useMemory';
import { useAuth } from '@/hooks/useAuth';
import { MemoryGreeting } from '@/components/memory/MemoryGreeting';
import { MemoryCard } from '@/components/memory/MemoryCard';

type SortType = 'recent' | 'salience';
type EmotionFilter = 'all' | string;

export const MemoriesPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { memories, greeting, isLoading, getGreeting, getSummary } = useMemory();
  const [sortBy, setSortBy] = useState<SortType>('recent');
  const [emotionFilter, setEmotionFilter] = useState<EmotionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch greeting and memories when user is loaded
  useEffect(() => {
    if (user?.id) {
      getGreeting(user.id);
      getSummary(user.id);
    }
  }, [user?.id, getGreeting, getSummary]);

  // Filter memories based on emotion
  let filteredMemories = memories;
  if (emotionFilter !== 'all') {
    filteredMemories = memories.filter(
      (m) =>
        m.primary_emotion.toLowerCase() === emotionFilter.toLowerCase() ||
        m.secondary_emotions.some((e) => e.toLowerCase() === emotionFilter.toLowerCase())
    );
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredMemories = filteredMemories.filter((m) => {
      const matchesTopic = m.extracted_topics?.some((t) =>
        t.toLowerCase().includes(query)
      );
      const matchesContent = m.messages?.some((msg) =>
        msg.content.toLowerCase().includes(query)
      );
      return matchesTopic || matchesContent;
    });
  }

  // Sort memories
  const sortedMemories = [...filteredMemories].sort((a, b) => {
    if (sortBy === 'salience') {
      return b.emotional_salience - a.emotional_salience;
    }
    // 'recent' - sort by created_at descending
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  // Get unique emotions for filter dropdown
  const uniqueEmotions = Array.from(
    new Set(
      memories.flatMap((m) => [m.primary_emotion, ...m.secondary_emotions])
    )
  ).sort();

  if (authLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-600">Please sign in to view your memories.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold">My Memories</h1>
        <p className="text-gray-600">
          {memories.length} {memories.length === 1 ? 'memory' : 'memories'} saved
        </p>
      </div>

      {/* Day 2 Greeting */}
      <section className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
        <MemoryGreeting greeting={greeting} isLoading={isLoading} />
      </section>

      {/* Filters and Controls */}
      <div className="space-y-4">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search by topic or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Filter and Sort Controls */}
        <div className="flex gap-4 flex-wrap">
          {/* Emotion Filter */}
          <select
            value={emotionFilter}
            onChange={(e) => setEmotionFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Emotions</option>
            {uniqueEmotions.map((emotion) => (
              <option key={emotion} value={emotion}>
                {emotion}
              </option>
            ))}
          </select>

          {/* Sort Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('recent')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'recent'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Most Recent
            </button>
            <button
              onClick={() => setSortBy('salience')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'salience'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Most Important
            </button>
          </div>
        </div>
      </div>

      {/* Memories Grid */}
      <section>
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading memories...</p>
          </div>
        ) : sortedMemories.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              {memories.length === 0
                ? "No memories yet. Start a conversation to create memories!"
                : "No memories match your filters."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {sortedMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onMarkImportant={(id) => {
                  // TODO: Implement mark as important
                  console.log('Mark as important:', id);
                }}
                onDelete={(id) => {
                  // TODO: Implement soft delete
                  console.log('Delete memory:', id);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MemoriesPage;
