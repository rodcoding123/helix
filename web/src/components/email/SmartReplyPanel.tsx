import React, { useEffect, useState } from 'react';
import {
  Lightbulb,
  Copy,
  Check,
  AlertCircle,
  Loader,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useEmailSmartReplyService, SmartReplySuggestion } from '../../services/email-smart-reply';

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  from_name?: string;
  body_text: string;
  body_html?: string;
  date_received: Date;
  content_preview?: string;
}

interface SmartReplyPanelProps {
  userId: string;
  email: EmailMessage;
  onSelectSuggestion: (suggestion: SmartReplySuggestion) => void;
  disabled?: boolean;
  compact?: boolean;
}

const StyleBadge: React.FC<{ style: string }> = ({ style }) => {
  const colors: Record<string, string> = {
    professional: 'bg-blue-100 text-blue-800',
    casual: 'bg-green-100 text-green-800',
    concise: 'bg-amber-100 text-amber-800',
  };

  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${colors[style] || 'bg-gray-100'}`}>
      {style}
    </span>
  );
};

export const SmartReplyPanel: React.FC<SmartReplyPanelProps> = ({
  userId,
  email,
  onSelectSuggestion,
  disabled = false,
  compact = false,
}) => {
  const [suggestions, setSuggestions] = useState<SmartReplySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);

  const smartReplyService = useEmailSmartReplyService(userId);

  // Load suggestions
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await smartReplyService.getSuggestions(email);
        setSuggestions(response.suggestions);
        setCacheHit(response.cacheHit);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
        // Set fallback suggestions on error
        setSuggestions([
          {
            id: 'professional',
            text: 'Thank you for your email. I will review this and get back to you shortly.',
            style: 'professional',
            confidence: 0.7,
            characterCount: 85,
          },
          {
            id: 'casual',
            text: 'Thanks for reaching out! I\'ll take a look at this and be in touch.',
            style: 'casual',
            confidence: 0.7,
            characterCount: 75,
          },
          {
            id: 'concise',
            text: 'Got it, will follow up soon.',
            style: 'concise',
            confidence: 0.7,
            characterCount: 28,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [userId, email, smartReplyService]);

  const handleCopySuggestion = (suggestion: SmartReplySuggestion) => {
    navigator.clipboard.writeText(suggestion.text);
    setCopiedId(suggestion.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelectSuggestion = (suggestion: SmartReplySuggestion) => {
    onSelectSuggestion(suggestion);
  };

  if (compact && !suggestions.length && !loading) {
    return null;
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-blue-200 bg-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb size={18} className="text-blue-600" />
          <h3 className="font-semibold text-blue-900">Smart Reply</h3>
          {cacheHit && (
            <span className="text-xs text-blue-600 px-2 py-0.5 bg-blue-200 rounded-full flex items-center gap-1">
              <TrendingUp size={12} />
              From cache
            </span>
          )}
        </div>
        {loading && (
          <div className="animate-spin">
            <Loader size={18} className="text-blue-600" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <div className="animate-spin mb-2 inline-block">
                <Loader size={24} className="text-blue-600" />
              </div>
              <p className="text-sm text-blue-700">Generating suggestions...</p>
            </div>
          </div>
        ) : error && !suggestions.length ? (
          <div className="flex items-start gap-3 py-4">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">{error}</p>
              <p className="text-xs text-amber-700 mt-1">Using fallback suggestions</p>
            </div>
          </div>
        ) : null}

        {/* Suggestions List */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className="p-3 bg-white border border-blue-200 rounded-lg hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StyleBadge style={suggestion.style} />
                    <span className="text-xs text-gray-500">
                      {suggestion.characterCount} characters
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${suggestion.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Text */}
                <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                  {suggestion.text}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    disabled={disabled}
                    className="flex-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-300 hover:border-blue-400"
                  >
                    Use this
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopySuggestion(suggestion)}
                    disabled={disabled}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copy to clipboard"
                  >
                    {copiedId === suggestion.id ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && suggestions.length === 0 && !error && (
          <div className="text-center py-6">
            <AlertCircle size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No suggestions available</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2 border-t border-blue-200 bg-blue-50 flex items-center justify-between text-xs text-blue-700">
          <span>{suggestions.length} suggestions generated</span>
          {/* <button
            type="button"
            onClick={handleRefresh}
            disabled={disabled || loading}
            className="p-1 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
            title="Regenerate suggestions"
          >
            <RefreshCw size={14} />
          </button> */}
        </div>
      )}
    </div>
  );
};

export default SmartReplyPanel;
