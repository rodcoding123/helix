import React, { useEffect, useState } from 'react';
import { ChevronDown, Zap, Plus } from 'lucide-react';
import { useEmailComposeService } from '../../services/email-compose';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category?: string;
  usage_count: number;
  created_at: Date;
}

interface TemplateSelectorProps {
  userId: string;
  onSelectTemplate: (template: EmailTemplate) => void;
  onCreateNew?: () => void;
  disabled?: boolean;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  userId,
  onSelectTemplate,
  onCreateNew,
  disabled = false,
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const composeService = useEmailComposeService(userId);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const loadedTemplates = await composeService.getTemplates(50);
        setTemplates(loadedTemplates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [userId, composeService]);

  // Filter templates based on search and category
  useEffect(() => {
    let filtered = templates;

    if (selectedCategory) {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.subject.toLowerCase().includes(query)
      );
    }

    // Sort by usage count (most used first)
    filtered.sort((a, b) => b.usage_count - a.usage_count);

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, selectedCategory]);

  // Extract unique categories
  const categories = Array.from(
    new Set(
      templates
        .filter((t) => t.category)
        .map((t) => t.category as string)
    )
  ).sort();

  const handleSelectTemplate = (template: EmailTemplate) => {
    onSelectTemplate(template);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          disabled || loading
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
        title="Insert email template"
      >
        <Zap size={18} className="text-blue-600" />
        <span className="text-sm font-medium">Templates</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    selectedCategory === null
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      setSelectedCategory(selectedCategory === category ? null : category)
                    }
                    className={`text-xs px-2 py-1 rounded transition-colors capitalize ${
                      selectedCategory === category
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">Loading templates...</div>
            ) : error ? (
              <div className="p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500 mb-3">
                  {templates.length === 0
                    ? 'No templates yet'
                    : 'No templates match your search'}
                </p>
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateNew();
                      setIsOpen(false);
                    }}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={14} />
                    Create new template
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{template.name}</p>
                        <p className="text-xs text-gray-600 truncate">{template.subject}</p>
                        {template.category && (
                          <p className="text-xs text-gray-500 mt-1 capitalize">
                            {template.category}
                          </p>
                        )}
                      </div>
                      {template.usage_count > 0 && (
                        <div className="text-xs text-gray-500 flex-shrink-0">
                          Used {template.usage_count}x
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && templates.length > 0 && onCreateNew && (
            <div className="p-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  onCreateNew();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded transition-colors"
              >
                <Plus size={14} />
                Create new template
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
