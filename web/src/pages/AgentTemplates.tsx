import { FC, useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAgentTemplates } from '@/hooks/useAgentTemplates';
import type { EnrichedAgentTemplate } from '@/lib/types/agent-templates';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplatePreviewModal } from '@/components/templates/TemplatePreviewModal';
import { TemplateCategoryTabs } from '@/components/templates/TemplateCategoryTabs';

/**
 * Agent Templates Page: Browse and use pre-built agent templates
 * Allows users to discover templates, customize them, and create agents
 */
export const AgentTemplatesPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { categories, templates, isLoading, loadCategories, loadTemplates, toggleFavorite } =
    useAgentTemplates();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EnrichedAgentTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load categories and templates on mount
  useEffect(() => {
    loadCategories();
    loadTemplates();
  }, [loadCategories, loadTemplates]);

  // Refetch templates when filters change
  useEffect(() => {
    loadTemplates({
      category_id: selectedCategoryId || undefined,
      search: searchQuery || undefined,
    });
  }, [searchQuery, selectedCategoryId, loadTemplates]);

  const handlePreviewTemplate = useCallback((template: EnrichedAgentTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setSelectedTemplate(null);
  }, []);

  const handleCreateFromTemplate = useCallback(
    async (agentName: string, customPersonality?: Record<string, number>) => {
      if (!user?.id || !selectedTemplate) return;

      setIsCreating(true);
      try {
        // This would typically be handled by the agent service
        // For now, we just show success and close modal
        console.log('Creating agent:', { agentName, customPersonality });

        // TODO: Call agent service to create agent from template
        handleClosePreview();
      } catch (error) {
        console.error('Failed to create agent:', error);
      } finally {
        setIsCreating(false);
      }
    },
    [user?.id, selectedTemplate, handleClosePreview]
  );

  const handleToggleFavorite = useCallback(
    async (templateId: string) => {
      if (!user?.id) return;

      try {
        await toggleFavorite(user.id, templateId);
        setFavorites((prev) => {
          const next = new Set(prev);
          if (next.has(templateId)) {
            next.delete(templateId);
          } else {
            next.add(templateId);
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to toggle favorite:', error);
      }
    },
    [user?.id, toggleFavorite]
  );

  if (authLoading) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Please sign in to view templates</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Agent Templates</h1>
          <p className="text-slate-400">
            Browse pre-built agent templates and create custom agents in seconds
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-4 py-2 text-slate-100 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-8">
          <TemplateCategoryTabs
            categories={categories}
            selectedId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-700 bg-slate-900 p-4 animate-pulse"
              >
                <div className="h-6 bg-slate-800 rounded mb-2" />
                <div className="h-4 bg-slate-800 rounded mb-4 w-3/4" />
                <div className="space-y-2">
                  <div className="h-3 bg-slate-800 rounded" />
                  <div className="h-3 bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-slate-400 mb-2">No templates found</p>
            <p className="text-sm text-slate-500">
              Try adjusting your search filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={handlePreviewTemplate}
                onFavorite={handleToggleFavorite}
                isFavorite={favorites.has(template.id)}
              />
            ))}
          </div>
        )}

        {/* Preview Modal */}
        {selectedTemplate && (
          <TemplatePreviewModal
            template={selectedTemplate}
            isOpen={isPreviewOpen}
            onClose={handleClosePreview}
            onConfirm={handleCreateFromTemplate}
            isLoading={isCreating}
          />
        )}
      </div>
    </div>
  );
};
