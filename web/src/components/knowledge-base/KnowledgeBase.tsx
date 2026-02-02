import { FC, useState, useEffect } from 'react';
import { Search, ChevronRight, BookOpen, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface KnowledgeBaseGuide {
  id: string;
  title: string;
  category: 'core' | 'extended';
  path: string;
  description: string;
  icon: string;
}

const GUIDES: KnowledgeBaseGuide[] = [
  {
    id: 'agent-templates',
    title: 'Agent Templates',
    category: 'extended',
    path: '/extended/agent-templates.md',
    description: 'Discover, customize, and create AI agent templates',
    icon: '🤖',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    category: 'extended',
    path: '/extended/marketplace.md',
    description: 'Find, clone, and share resources with the community',
    icon: '🌟',
  },
  {
    id: 'custom-tools',
    title: 'Custom Tools',
    category: 'extended',
    path: '/extended/custom-tools.md',
    description: 'Create specialized AI functions without coding',
    icon: '🔧',
  },
  {
    id: 'skill-composition',
    title: 'Skill Composition',
    category: 'extended',
    path: '/extended/skill-composition.md',
    description: 'Build powerful multi-step workflows',
    icon: '⚙️',
  },
  {
    id: 'memory-synthesis',
    title: 'Memory Synthesis',
    category: 'extended',
    path: '/extended/memory-synthesis.md',
    description: 'Analyze patterns and get personalized insights',
    icon: '🧠',
  },
];

export const KnowledgeBase: FC = () => {
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [guideContent, setGuideContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredGuides, setFilteredGuides] = useState(GUIDES);

  // Load guide content when activeGuide changes
  useEffect(() => {
    if (activeGuide) {
      setIsLoading(true);
      // In production, this would fetch from your docs folder
      // For now, we'll load a placeholder
      const guide = GUIDES.find((g) => g.id === activeGuide);
      if (guide) {
        // Simulate loading content
        setTimeout(() => {
          setGuideContent(`# ${guide.title}\n\nGuide content loaded from ${guide.path}`);
          setIsLoading(false);
        }, 300);
      }
    }
  }, [activeGuide]);

  // Filter guides based on search
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    setFilteredGuides(
      GUIDES.filter(
        (guide) =>
          guide.title.toLowerCase().includes(query) ||
          guide.description.toLowerCase().includes(query)
      )
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <BookOpen size={28} className="text-blue-400" />
          <h1 className="text-3xl font-bold text-slate-100">Helix Knowledge Base</h1>
        </div>
        <p className="text-slate-400 mt-2 max-w-7xl mx-auto">
          Complete documentation for all Helix features
        </p>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar - Guides List */}
        <div
          className={`w-full md:w-80 border-r border-slate-700 bg-slate-900 flex flex-col transition-all ${
            activeGuide ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search */}
          <div className="p-6 border-b border-slate-700">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Guides List */}
          <div className="flex-1 overflow-y-auto">
            {filteredGuides.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No guides found matching "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {filteredGuides.map((guide) => (
                  <button
                    key={guide.id}
                    onClick={() => setActiveGuide(guide.id)}
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      activeGuide === guide.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-1">{guide.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-tight">
                          {guide.title}
                        </h3>
                        <p
                          className={`text-xs mt-1 leading-tight ${
                            activeGuide === guide.id
                              ? 'text-blue-100'
                              : 'text-slate-400'
                          }`}
                        >
                          {guide.description}
                        </p>
                      </div>
                      {activeGuide === guide.id && (
                        <ChevronRight size={16} className="flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeGuide ? (
            // Welcome View
            <div className="flex-1 overflow-auto p-8">
              <div className="max-w-4xl mx-auto">
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-slate-100 mb-4">
                    Welcome to the Helix Knowledge Base
                  </h2>
                  <p className="text-slate-300 text-lg mb-8">
                    Find comprehensive guides for all Helix features. Click on a guide
                    in the sidebar to get started.
                  </p>
                </div>

                {/* Quick Links */}
                <div className="mb-12">
                  <h3 className="text-xl font-bold text-slate-100 mb-6">
                    Most Popular
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {GUIDES.slice(0, 4).map((guide) => (
                      <button
                        key={guide.id}
                        onClick={() => setActiveGuide(guide.id)}
                        className="p-6 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-left"
                      >
                        <span className="text-4xl mb-3 block">{guide.icon}</span>
                        <h4 className="font-semibold text-slate-100 mb-2">
                          {guide.title}
                        </h4>
                        <p className="text-sm text-slate-400">{guide.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h3 className="text-xl font-bold text-slate-100 mb-6">
                    All Guides
                  </h3>
                  <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                    {GUIDES.map((guide, index) => (
                      <button
                        key={guide.id}
                        onClick={() => setActiveGuide(guide.id)}
                        className={`w-full p-4 text-left hover:bg-slate-700 transition-colors flex items-center justify-between ${
                          index !== GUIDES.length - 1
                            ? 'border-b border-slate-700'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{guide.icon}</span>
                          <div>
                            <h4 className="font-semibold text-slate-100">
                              {guide.title}
                            </h4>
                            <p className="text-sm text-slate-400">
                              {guide.description}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Guide View
            <div className="flex-1 overflow-auto">
              <div className="max-w-4xl mx-auto p-8">
                {/* Back Button */}
                <button
                  onClick={() => setActiveGuide(null)}
                  className="md:hidden mb-6 flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <X size={20} />
                  Back to Guides
                </button>

                {/* Guide Header */}
                {!isLoading && (
                  <div className="mb-8">
                    <div className="flex items-start gap-4 mb-4">
                      <span className="text-5xl">
                        {GUIDES.find((g) => g.id === activeGuide)?.icon}
                      </span>
                      <div>
                        <h1 className="text-4xl font-bold text-slate-100">
                          {GUIDES.find((g) => g.id === activeGuide)?.title}
                        </h1>
                        <p className="text-slate-400 mt-2">
                          {GUIDES.find((g) => g.id === activeGuide)?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin mb-4">
                        <BookOpen size={32} className="text-blue-400" />
                      </div>
                      <p className="text-slate-400">Loading guide...</p>
                    </div>
                  </div>
                ) : (
                  /* Content */
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({ ...props }) => (
                          <h1 className="text-3xl font-bold text-slate-100 mt-8 mb-4 first:mt-0">
                            {props.children}
                          </h1>
                        ),
                        h2: ({ ...props }) => (
                          <h2 className="text-2xl font-bold text-slate-100 mt-6 mb-3">
                            {props.children}
                          </h2>
                        ),
                        h3: ({ ...props }) => (
                          <h3 className="text-xl font-bold text-slate-100 mt-5 mb-2">
                            {props.children}
                          </h3>
                        ),
                        p: ({ ...props }) => (
                          <p className="text-slate-300 mb-4 leading-relaxed">
                            {props.children}
                          </p>
                        ),
                        ul: ({ ...props }) => (
                          <ul className="list-disc list-inside text-slate-300 mb-4 space-y-2">
                            {props.children}
                          </ul>
                        ),
                        ol: ({ ...props }) => (
                          <ol className="list-decimal list-inside text-slate-300 mb-4 space-y-2">
                            {props.children}
                          </ol>
                        ),
                        li: ({ ...props }) => (
                          <li className="text-slate-300">{props.children}</li>
                        ),
                        code: ({ ...props }) => (
                          <code className="bg-slate-800 text-slate-100 px-2 py-1 rounded text-sm font-mono">
                            {props.children}
                          </code>
                        ),
                        pre: ({ ...props }) => (
                          <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg mb-4 overflow-x-auto border border-slate-700">
                            <code>{props.children}</code>
                          </pre>
                        ),
                        blockquote: ({ ...props }) => (
                          <blockquote className="border-l-4 border-blue-500 pl-4 italic text-slate-300 my-4">
                            {props.children}
                          </blockquote>
                        ),
                      }}
                    >
                      {guideContent}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Navigation */}
                {!isLoading && (
                  <div className="mt-12 pt-8 border-t border-slate-700 flex gap-4">
                    <button
                      onClick={() => setActiveGuide(null)}
                      className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    >
                      ← Back to Guides
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
