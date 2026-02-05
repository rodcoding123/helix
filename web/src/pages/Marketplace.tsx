import { FC, useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTemplateCategories } from '@/hooks/queries/useTemplateCategories';
import { useTemplates } from '@/hooks/queries/useTemplates';
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
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popularity' | 'newest' | 'rating'>('popularity');

  const { data: categories = [], isLoading: categoriesLoading } = useTemplateCategories();
  const { data: templates = [], isLoading: templatesLoading } = useTemplates({
    category_id: selectedCategory || undefined,
    search: searchQuery || undefined,
  });

  const isLoading = categoriesLoading || templatesLoading;

  const [selectedTemplate, setSelectedTemplate] = useState<EnrichedAgentTemplate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);

  const marketplaceService = new TemplateMarketplaceService();

  const cloneTemplateMutation = useMutation({
    mutationFn: (params: { userId: string; templateId: string; templateName: string }) =>
      marketplaceService.cloneTemplate(params.userId, params.templateId, params.templateName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['user-agents', user?.id] });
      handleCloseCloneModal();
    },
  });

  const rateTemplateMutation = useMutation({
    mutationFn: (params: { templateId: string; rating: number }) =>
      marketplaceService.rateTemplate(params.templateId, params.rating),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template', variables.templateId] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

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

      try {
        await cloneTemplateMutation.mutateAsync({
          userId: user.id,
          templateId: selectedTemplate.id,
          templateName,
        });
      } catch (error) {
        console.error('Failed to clone template:', error);
      }
    },
    [user?.id, selectedTemplate, cloneTemplateMutation]
  );

  const handleRateTemplate = useCallback(
    async (rating: number) => {
      if (!selectedTemplate) return;

      try {
        await rateTemplateMutation.mutateAsync({
          templateId: selectedTemplate.id,
          rating,
        });
      } catch (error) {
        console.error('Failed to rate template:', error);
      }
    },
    [selectedTemplate, rateTemplateMutation]
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
            isLoading={cloneTemplateMutation.isPending}
          />
        )}

        {/* Clone Modal */}
        {selectedTemplate && (
          <CloneTemplateModal
            template={selectedTemplate}
            isOpen={showCloneModal}
            onClose={handleCloseCloneModal}
            onConfirm={handleCloneTemplate}
            isLoading={cloneTemplateMutation.isPending}
          />
        )}
      </div>
    </div>
  );
};
