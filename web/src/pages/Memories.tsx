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
  const [filters, setFilters] = useState({
    dateRange: { start: null as Date | null, end: null as Date | null },
    valence: null as number | null,
    salienceTier: null as string | null,
  });

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

  // Filter by date range
  if (filters.dateRange.start || filters.dateRange.end) {
    filteredMemories = filteredMemories.filter((m) => {
      const memoryDate = new Date(m.created_at);
      if (filters.dateRange.start && memoryDate < filters.dateRange.start) return false;
      if (filters.dateRange.end) {
        const endDate = new Date(filters.dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        if (memoryDate > endDate) return false;
      }
      return true;
    });
  }

  // Filter by emotional valence
  if (filters.valence !== null) {
    filteredMemories = filteredMemories.filter((m) => {
      return Math.abs(m.valence - (filters.valence as number)) <= 0.3;
    });
  }

  // Filter by salience tier
  if (filters.salienceTier) {
    filteredMemories = filteredMemories.filter((m) => {
      return m.salience_tier === filters.salienceTier;
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

      {/* Advanced Filters Panel */}
      <div className="flex gap-4 mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex-wrap">
        {/* Date Range */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date Range
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={
                filters.dateRange.start
                  ? filters.dateRange.start.toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: {
                    ...filters.dateRange,
                    start: e.target.value ? new Date(e.target.value) : null,
                  },
                })
              }
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white text-sm"
              placeholder="Start date"
            />
            <input
              type="date"
              value={
                filters.dateRange.end
                  ? filters.dateRange.end.toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: {
                    ...filters.dateRange,
                    end: e.target.value ? new Date(e.target.value) : null,
                  },
                })
              }
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white text-sm"
              placeholder="End date"
            />
          </div>
        </div>

        {/* Emotional Valence Slider */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Emotional Valence:{' '}
            <span className="font-semibold">
              {filters.valence !== null ? filters.valence.toFixed(1) : 'Any'}
            </span>
          </label>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.1"
            value={filters.valence ?? 0}
            onChange={(e) =>
              setFilters({
                ...filters,
                valence: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex justify-between">
            <span>Negative</span>
            <span>Neutral</span>
            <span>Positive</span>
          </div>
        </div>

        {/* Salience Tier */}
        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Importance
          </label>
          <select
            value={filters.salienceTier || ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                salienceTier: e.target.value || null,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white text-sm"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        <div className="flex items-end">
          <button
            onClick={() =>
              setFilters({
                dateRange: { start: null, end: null },
                valence: null,
                salienceTier: null,
              })
            }
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>

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
