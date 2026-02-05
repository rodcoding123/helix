import { useState, useRef, useEffect, ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';
import clsx from 'clsx';

interface HelpPopoverProps {
  /** Content to display in the popover */
  content: ReactNode;
  /** Optional title for the popover */
  title?: string;
  /** Optional link to documentation */
  docsUrl?: string;
  /** Position of the popover relative to the trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Size of the help icon */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Children to wrap (if provided, replaces default icon) */
  children?: ReactNode;
  /** Additional className for the wrapper */
  className?: string;
}

const ICON_SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const POSITION_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const ARROW_CLASSES = {
  top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-bg-tertiary border-l-transparent border-r-transparent border-b-transparent',
  bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-bg-tertiary border-l-transparent border-r-transparent border-t-transparent',
  left: 'right-[-6px] top-1/2 -translate-y-1/2 border-l-bg-tertiary border-t-transparent border-b-transparent border-r-transparent',
  right: 'left-[-6px] top-1/2 -translate-y-1/2 border-r-bg-tertiary border-t-transparent border-b-transparent border-l-transparent',
};

export function HelpPopover({
  content,
  title,
  docsUrl,
  position = 'top',
  iconSize = 'md',
  children,
  className,
}: HelpPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <span className={clsx('relative inline-flex items-center', className)}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-text-tertiary hover:text-text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-helix-500/50 rounded-full"
        aria-label="Help"
        aria-expanded={isOpen}
      >
        {children || <HelpCircle className={ICON_SIZES[iconSize]} />}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="tooltip"
          className={clsx(
            'absolute z-50 w-64 max-w-sm',
            POSITION_CLASSES[position]
          )}
        >
          {/* Arrow */}
          <div
            className={clsx(
              'absolute w-0 h-0 border-[6px]',
              ARROW_CLASSES[position]
            )}
          />

          {/* Content */}
          <div className="rounded-xl border border-white/10 bg-bg-tertiary shadow-xl overflow-hidden">
            {title && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-bg-secondary">
                <span className="text-sm font-medium text-white">{title}</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-text-tertiary hover:text-white transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="px-3 py-2 text-sm text-text-secondary">
              {content}
            </div>

            {docsUrl && (
              <div className="px-3 py-2 border-t border-white/10">
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-helix-400 hover:text-helix-300 transition-colors"
                >
                  Learn more in docs →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * Inline help text that appears next to a label
 */
interface HelpLabelProps {
  /** Label text */
  label: string;
  /** Help content */
  help: ReactNode;
  /** Optional docs link */
  docsUrl?: string;
  /** Additional className */
  className?: string;
}

export function HelpLabel({ label, help, docsUrl, className }: HelpLabelProps) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <span>{label}</span>
      <HelpPopover content={help} docsUrl={docsUrl} iconSize="sm" />
    </span>
  );
}
