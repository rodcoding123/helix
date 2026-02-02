import { FC, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAgentTemplates } from '@/hooks/useAgentTemplates';
import type { EnrichedAgentTemplate } from '@/lib/types/agent-templates';
import { TemplateMarketplaceService } from '@/services/template-marketplace';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplateFilters } from '@/components/marketplace/TemplateFilters';
import { TemplateDetailModal } from '@/components/marketplace/TemplateDetailModal';
import { CloneTemplateModal } from '@/components/marketplace/CloneTemplateModal';

/**
 * Marketplace Page: Browse and discover public agent templates
 * Users can view templates, clone them to customize, and rate them
 */
export const MarketplacePage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { categories, loadCategories } = useAgentTemplates();

  const [templates, setTemplates] = useState<EnrichedAgentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popularity' | 'newest' | 'rating'>('popularity');

  const [selectedTemplate, setSelectedTemplate] = useState<EnrichedAgentTemplate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const marketplaceService = new TemplateMarketplaceService();

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Load templates with filters
  useEffect(() => {
    loadTemplates();
  }, [searchQuery, selectedCategory, sortBy]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await marketplaceService.getPublicTemplates({
        category_id: selectedCategory || undefined,
        search: searchQuery || undefined,
        sortBy,
      });
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTemplate = useCallback((template: EnrichedAgentTemplate) => {
    setSelectedTemplate(template);
    setShowDetailModal(true);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setShowDetailModal(false);
    setSelectedTemplate(null);
  }, []);

  const handleOpenCloneModal = useCallback(() => {
    setShowDetailModal(false);
    setShowCloneModal(true);
  }, []);

  const handleCloseCloneModal = useCallback(() => {
    setShowCloneModal(false);
  }, []);

  const handleCloneTemplate = useCallback(
    async (templateName: string) => {
      if (!user?.id || !selectedTemplate) return;

      setIsCloning(true);
      try {
        await marketplaceService.cloneTemplate(user.id, selectedTemplate.id, templateName);
        handleCloseCloneModal();
        // Show success message (would integrate with toast notification system)
        console.log('Template cloned successfully');
      } catch (error) {
        console.error('Failed to clone template:', error);
      } finally {
        setIsCloning(false);
      }
    },
    [user?.id, selectedTemplate, handleCloseCloneModal]
  );

  const handleRateTemplate = useCallback(
    async (rating: number) => {
      if (!selectedTemplate) return;

      try {
        await marketplaceService.rateTemplate(selectedTemplate.id, rating);
        console.log('Template rated successfully');
      } catch (error) {
        console.error('Failed to rate template:', error);
      }
    },
    [selectedTemplate]
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
        <p className="text-slate-400">Please sign in to access the marketplace</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Agent Marketplace</h1>
          <p className="text-slate-400">
            Discover and clone templates created by the community
          </p>
        </div>

        {/* Stats Banner */}
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg border border-purple-500/20">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-400">Total Templates</p>
              <p className="text-2xl font-bold text-slate-100">{templates.length}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Categories</p>
              <p className="text-2xl font-bold text-slate-100">{categories.length}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Clones</p>
              <p className="text-2xl font-bold text-slate-100">
                {templates.reduce((acc, t) => acc + t.clone_count, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <TemplateFilters
            categories={categories}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sortBy={sortBy}
            onSortChange={setSortBy}
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
                onPreview={handleViewTemplate}
              />
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedTemplate && (
          <TemplateDetailModal
            template={selectedTemplate}
            isOpen={showDetailModal}
            onClose={handleCloseDetailModal}
            onClone={handleOpenCloneModal}
            onRate={handleRateTemplate}
            isLoading={isCloning}
          />
        )}

        {/* Clone Modal */}
        {selectedTemplate && (
          <CloneTemplateModal
            template={selectedTemplate}
            isOpen={showCloneModal}
            onClose={handleCloseCloneModal}
            onConfirm={handleCloneTemplate}
            isLoading={isCloning}
          />
        )}
      </div>
    </div>
  );
};
