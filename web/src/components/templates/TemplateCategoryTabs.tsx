import type { AgentTemplateCategory } from '@/lib/types/agent-templates';

interface TemplateCategoryTabsProps {
  categories: AgentTemplateCategory[];
  selectedId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function TemplateCategoryTabs({
  categories,
  selectedId,
  onSelectCategory,
}: TemplateCategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {/* All button */}
      <button
        onClick={() => onSelectCategory(null)}
        className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
          selectedId === null
            ? 'bg-purple-600 text-white'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        All Templates
      </button>

      {/* Category buttons */}
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelectCategory(category.id)}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
            selectedId === category.id
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span>{category.icon}</span>
          <span>{category.name}</span>
        </button>
      ))}
    </div>
  );
}
