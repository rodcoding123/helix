/**
 * Phase 3 UI Polish Components
 * Reusable components for loading states, error messages, animations, and empty states
 *
 * Used across Custom Tools, Composite Skills, and Memory Synthesis pages
 */

import React, { FC, ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, Loader, Lightbulb, TrendingUp } from 'lucide-react';

/**
 * Loading Spinner with animated state
 */
export const LoadingSpinner: FC<{
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
}> = ({ size = 'md', message, fullScreen = false }) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const spinnerContent = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader className={`${sizeMap[size]} animate-spin text-blue-500`} />
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
};

/**
 * Skeleton Loading Animation
 */
export const SkeletonLoader: FC<{
  count?: number;
  height?: string;
  className?: string;
}> = ({ count = 3, height = 'h-12', className = '' }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className} animate-pulse`}
          style={{
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </>
  );
};

/**
 * Error Message with actionable guidance
 */
export const ErrorMessage: FC<{
  error: Error | string;
  title?: string;
  suggestions?: string[];
  onDismiss?: () => void;
  onRetry?: () => void;
}> = ({ error, title = 'Something went wrong', suggestions = [], onDismiss, onRetry }) => {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900">{title}</h3>
          <p className="text-sm text-red-800 mt-1">{message}</p>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="ml-8 space-y-2">
          <p className="text-xs font-semibold text-red-900">Suggestions:</p>
          <ul className="text-xs text-red-800 space-y-1">
            {suggestions.map((suggestion, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-red-500">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(onDismiss || onRetry) && (
        <div className="ml-8 flex gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs font-medium text-red-700 hover:text-red-900 px-2 py-1 rounded hover:bg-red-100 transition"
            >
              Try Again
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-xs font-medium text-red-700 hover:text-red-900 px-2 py-1 rounded hover:bg-red-100 transition"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Success Message with confirmation
 */
export const SuccessMessage: FC<{
  message: string;
  title?: string;
  onDismiss?: () => void;
  duration?: number;
}> = ({ message, title = 'Success!', onDismiss, duration = 5000 }) => {
  return (
    <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top">
      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="font-semibold text-green-900">{title}</h3>
        <p className="text-sm text-green-800 mt-1">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-100 transition"
        >
          Close
        </button>
      )}
    </div>
  );
};

/**
 * Info Message with helpful guidance
 */
export const InfoMessage: FC<{
  message: string;
  title?: string;
  icon?: ReactNode;
  onDismiss?: () => void;
}> = ({ message, title, icon = <Info className="w-5 h-5" />, onDismiss }) => {
  return (
    <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4 flex items-start gap-3">
      <div className="text-blue-600 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1">
        {title && <h3 className="font-semibold text-blue-900">{title}</h3>}
        <p className={`text-sm text-blue-800 ${title ? 'mt-1' : ''}`}>{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs font-medium text-blue-700 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-100 transition"
        >
          Close
        </button>
      )}
    </div>
  );
};

/**
 * Empty State - shown when no items exist
 */
export const EmptyState: FC<{
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}> = ({
  icon = <Lightbulb className="w-12 h-12" />,
  title,
  description,
  action,
  secondaryAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-gray-300 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 text-center max-w-md mb-6">{description}</p>
      <div className="flex gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Progress Indicator with percentage
 */
export const ProgressIndicator: FC<{
  current: number;
  total: number;
  label?: string;
  animated?: boolean;
}> = ({ current, total, label, animated = true }) => {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`bg-blue-600 h-full rounded-full transition-all duration-300 ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-600 text-right">
        {current} of {total} ({percentage}%)
      </p>
    </div>
  );
};

/**
 * Status Badge with animation
 */
export const StatusBadge: FC<{
  status: 'pending' | 'loading' | 'success' | 'error' | 'warning';
  label?: string;
  showIcon?: boolean;
}> = ({ status, label, showIcon = true }) => {
  const statusConfig = {
    pending: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: null,
    },
    loading: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: <Loader className="w-3 h-3 animate-spin" />,
    },
    success: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: <AlertCircle className="w-3 h-3" />,
    },
    warning: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      icon: <AlertCircle className="w-3 h-3" />,
    },
  };

  const config = statusConfig[status];
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {showIcon && config.icon}
      {displayLabel}
    </span>
  );
};

/**
 * Fade-in Animation Wrapper
 */
export const FadeInAnimation: FC<{
  children: ReactNode;
  delay?: number;
  duration?: number;
}> = ({ children, delay = 0, duration = 300 }) => {
  return (
    <div
      style={{
        animation: `fadeIn ${duration}ms ease-in-out ${delay}ms forwards`,
        opacity: 0,
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      {children}
    </div>
  );
};

/**
 * Slide-in Animation Wrapper
 */
export const SlideInAnimation: FC<{
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
}> = ({ children, direction = 'up', delay = 0, duration = 300 }) => {
  const directionMap = {
    up: 'translateY(20px)',
    down: 'translateY(-20px)',
    left: 'translateX(20px)',
    right: 'translateX(-20px)',
  };

  return (
    <div
      style={{
        animation: `slideIn ${duration}ms ease-out ${delay}ms forwards`,
        transform: directionMap[direction],
        opacity: 0,
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            transform: ${directionMap[direction]};
            opacity: 0;
          }
          to {
            transform: translateX(0) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      {children}
    </div>
  );
};

/**
 * Loading Card Skeleton
 */
export const CardSkeleton: FC<{
  count?: number;
}> = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 border border-gray-200 rounded-lg space-y-3">
          <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-5/6 animate-pulse" />
          </div>
          <div className="h-8 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </>
  );
};

/**
 * Tooltip with hover activation
 */
export const Tooltip: FC<{
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ content, children, position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  return (
    <div className="group relative inline-block">
      {children}
      <div
        className={`absolute ${positionClasses[position]} hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none`}
      >
        {content}
      </div>
    </div>
  );
};

/**
 * Expandable section with smooth animation
 */
export const ExpandableSection: FC<{
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}> = ({ title, children, defaultExpanded = false, onToggle }) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const handleToggle = () => {
    const newState = !expanded;
    setExpanded(newState);
    onToggle?.(newState);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
      >
        <span className="font-medium text-gray-900">{title}</span>
        <span
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>
      {expanded && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Quick Stats Display
 */
export const StatsCard: FC<{
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: 'up' | 'down';
  trendValue?: string;
}> = ({ icon, label, value, trend, trendValue }) => {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="text-gray-400">{icon}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? '↑' : '↓'}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
};
