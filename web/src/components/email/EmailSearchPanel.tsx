import React, { useEffect, useState } from 'react';
import {
  Search,
  X,
  ChevronDown,
  Calendar,
  Paperclip,
  Star,
  Filter,
  History,
  Loader,
} from 'lucide-react';
import { useEmailSearchService, EmailSearchFilters } from '../../services/email-search';

interface EmailSearchPanelProps {
  userId: string;
  onSearch: (filters: EmailSearchFilters) => void;
  onClose?: () => void;
  disabled?: boolean;
}

export const EmailSearchPanel: React.FC<EmailSearchPanelProps> = ({
  userId,
  onSearch,
  onClose,
  disabled = false,
}) => {
  const searchService = useEmailSearchService(userId);

  // Search state
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Advanced filters
  const [from, setFrom] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasAttachments, setHasAttachments] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isUnread, setIsUnread] = useState(false);

  // UI state
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load search history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await searchService.getSearchHistory(5);
        setSearchHistory(history);
      } catch (err) {
        console.error('Error loading search history:', err);
      }
    };

    loadHistory();
  }, [userId, searchService]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() && !from && !dateFrom) {
      setError('Please enter a search query or filter');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const filters: EmailSearchFilters = {
        query: query || undefined,
        from: from ? [from] : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        hasAttachments: hasAttachments ? true : undefined,
        isStarred: isStarred ? true : undefined,
        isRead: isUnread ? false : undefined,
        limit: 50,
      };

      onSearch(filters);
      setShowHistory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (historicQuery: string) => {
    setQuery(historicQuery);
    setShowHistory(false);
  };

  const handleClear = () => {
    setQuery('');
    setFrom('');
    setDateFrom('');
    setDateTo('');
    setHasAttachments(false);
    setIsStarred(false);
    setIsUnread(false);
    setError(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
      <form onSubmit={handleSearch} className="space-y-4">
        {/* Main Search Input */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value && !showHistory) {
                  setShowHistory(true);
                }
              }}
              onFocus={() => {
                if (!query && searchHistory.length > 0) {
                  setShowHistory(true);
                }
              }}
              disabled={disabled}
              placeholder="Search emails by subject, content, sender..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={18} className="text-gray-600" />
              </button>
            )}
          </div>

          {/* Search History Dropdown */}
          {showHistory && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
              <div className="p-2">
                <div className="text-xs font-medium text-gray-600 px-2 py-1">
                  Recent Searches
                </div>
                {searchHistory.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleHistorySelect(item)}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
                  >
                    <History size={14} className="text-gray-400" />
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Filters Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <Filter size={16} />
          Advanced Filters
          <ChevronDown
            size={16}
            className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            {/* From */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                From
              </label>
              <input
                type="email"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={disabled}
                placeholder="sender@example.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar size={14} />
                  From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar size={14} />
                  To Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={hasAttachments}
                  onChange={(e) => setHasAttachments(e.target.checked)}
                  disabled={disabled}
                  className="rounded"
                />
                <Paperclip size={14} className="text-gray-600" />
                Has Attachments
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={isStarred}
                  onChange={(e) => setIsStarred(e.target.checked)}
                  disabled={disabled}
                  className="rounded"
                />
                <Star size={14} className="text-yellow-500" />
                Starred
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={isUnread}
                  onChange={(e) => setIsUnread(e.target.checked)}
                  disabled={disabled}
                  className="rounded"
                />
                <span>Unread Only</span>
              </label>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <X size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={disabled || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search size={18} />
                Search
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
          >
            Clear
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} className="text-gray-600" />
            </button>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-gray-500 text-center">
          Tip: Use quotes for exact phrases, e.g., "project deadline"
        </p>
      </form>
    </div>
  );
};

export default EmailSearchPanel;
