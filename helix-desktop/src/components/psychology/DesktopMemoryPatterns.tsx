/**
 * Desktop Memory Patterns Component
 * Tauri-based version of web MemoryPatterns page
 * Uses Tauri IPC for backend communication
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Brain, Heart, Users, Target, TrendingUp, Search, Filter, AlertCircle } from 'lucide-react';

interface Pattern {
  patternId: string;
  type:
    | 'emotional_trigger'
    | 'relational_pattern'
    | 'prospective_fear'
    | 'prospective_possibility'
    | 'transformation_trajectory'
    | 'purpose_alignment';
  description: string;
  confidence: number;
  salience: number;
  recommendations: string[];
  evidence: string[];
}

export const DesktopMemoryPatterns: React.FC = () => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'salience' | 'recent'>('salience');

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      setLoading(true);
      // Tauri IPC call to backend
      const data = await invoke<Pattern[]>('get_memory_patterns', {});
      setPatterns(data);
    } catch (error) {
      console.error('Failed to load patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPatternIcon = (type: Pattern['type']) => {
    const iconMap: Record<Pattern['type'], React.ReactNode> = {
      emotional_trigger: <Heart className="w-5 h-5 text-red-400" />,
      relational_pattern: <Users className="w-5 h-5 text-blue-400" />,
      prospective_fear: <AlertCircle className="w-5 h-5 text-orange-400" />,
      prospective_possibility: <Target className="w-5 h-5 text-green-400" />,
      transformation_trajectory: <TrendingUp className="w-5 h-5 text-purple-400" />,
      purpose_alignment: <Brain className="w-5 h-5 text-indigo-400" />,
    };
    return iconMap[type];
  };

  const getPatternColor = (type: Pattern['type']) => {
    const colorMap: Record<Pattern['type'], string> = {
      emotional_trigger: 'bg-red-500/10 border-red-500/20',
      relational_pattern: 'bg-blue-500/10 border-blue-500/20',
      prospective_fear: 'bg-orange-500/10 border-orange-500/20',
      prospective_possibility: 'bg-green-500/10 border-green-500/20',
      transformation_trajectory: 'bg-purple-500/10 border-purple-500/20',
      purpose_alignment: 'bg-indigo-500/10 border-indigo-500/20',
    };
    return colorMap[type];
  };

  const filteredPatterns = patterns
    .filter(p => !filterType || p.type === filterType)
    .filter(p => !searchQuery || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'salience':
          return b.salience - a.salience;
        case 'recent':
          return 0;
        default:
          return 0;
      }
    });

  const patternTypes = [
    { value: 'emotional_trigger', label: 'Emotional Triggers', icon: Heart },
    { value: 'relational_pattern', label: 'Relational Patterns', icon: Users },
    { value: 'prospective_fear', label: 'Fears', icon: AlertCircle },
    { value: 'prospective_possibility', label: 'Goals & Possibilities', icon: Target },
    { value: 'transformation_trajectory', label: 'Growth Trajectories', icon: TrendingUp },
    { value: 'purpose_alignment', label: 'Purpose Alignment', icon: Brain },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Brain className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Analyzing your memory patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/80 backdrop-blur border-b border-slate-700/50 p-6 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Brain className="w-8 h-8 text-purple-400" />
                Your Memory Patterns
              </h1>
              <p className="text-gray-400 mt-2">
                Insights from {patterns.length} detected patterns across your memories
              </p>
            </div>
            <button
              onClick={loadPatterns}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
            >
              Refresh
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search patterns..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Type Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterType(null)}
                className={`px-3 py-1 rounded-lg text-sm transition ${
                  filterType === null
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                All Types
              </button>
              {patternTypes.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterType(value)}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    filterType === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'confidence' | 'salience' | 'recent')}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                <option value="salience">Sort by Importance</option>
                <option value="confidence">Sort by Confidence</option>
                <option value="recent">Sort by Recent</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Patterns Grid */}
      <div className="max-w-6xl mx-auto p-6">
        {filteredPatterns.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No patterns detected yet. Keep creating memories!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPatterns.map(pattern => (
              <PatternCard
                key={pattern.patternId}
                pattern={pattern}
                icon={getPatternIcon(pattern.type)}
                color={getPatternColor(pattern.type)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface PatternCardProps {
  pattern: Pattern;
  icon: React.ReactNode;
  color: string;
}

const PatternCard: React.FC<PatternCardProps> = ({ pattern, icon, color }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg p-4 transition ${color}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {icon}
            <div>
              <h3 className="font-semibold text-white">{pattern.description}</h3>
              <p className="text-xs text-gray-400 mt-1">Pattern ID: {pattern.patternId}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-white transition"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {/* Metrics */}
      <div className="flex gap-4 mt-3 text-sm">
        <div>
          <p className="text-gray-400">Confidence</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${pattern.confidence * 100}%` }}
              />
            </div>
            <span className="text-white font-semibold">{(pattern.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div>
          <p className="text-gray-400">Importance</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${pattern.salience * 100}%` }}
              />
            </div>
            <span className="text-white font-semibold">{(pattern.salience * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-500/30">
          {/* Recommendations */}
          {pattern.recommendations.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-white mb-2">💡 Suggestions</h4>
              <ul className="space-y-2">
                {pattern.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-purple-400">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence */}
          {pattern.evidence.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-2">📚 Supporting Memories</h4>
              <p className="text-xs text-gray-400">Based on {pattern.evidence.length} memories</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DesktopMemoryPatterns;
