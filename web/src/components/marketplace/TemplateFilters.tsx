import { Search, ChevronDown } from 'lucide-react';
import type { AgentTemplateCategory } from '@/lib/types/agent-templates';

interface TemplateFiltersProps {
  categories: AgentTemplateCategory[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  sortBy: 'popularity' | 'newest' | 'rating';
  onSortChange: (sort: 'popularity' | 'newest' | 'rating') => void;
}

export function TemplateFilters({
  categories,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
}: TemplateFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500"
          size={20}
        />
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-4 py-2 text-slate-100 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {/* Category and Sort */}
      <div className="flex gap-4">
        {/* Category Dropdown */}
        <div className="relative flex-1">
          <select
            value={selectedCategory || ''}
            onChange={(e) => onCategoryChange(e.target.value || null)}
            className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 pr-8 text-slate-100 focus:border-purple-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"
            size={18}
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 pr-8 text-slate-100 focus:border-purple-500 focus:outline-none"
          >
            <option value="popularity">Most Popular</option>
            <option value="newest">Newest</option>
            <option value="rating">Highest Rated</option>
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"
            size={18}
          />
        </div>
      </div>
    </div>
  );
}
