import React, { useState, useRef, useEffect, useCallback } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  className?: string;
  children: React.ReactElement;
}

export function Tooltip({
  content,
  position = 'top',
  delay = 200,
  disabled = false,
  className = '',
  children,
}: TooltipProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - spacing;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + spacing;
        break;
    }

    // Keep tooltip within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 0) left = spacing;
    if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - spacing;
    }
    if (top < 0) top = spacing;
    if (top + tooltipRect.height > viewportHeight) {
      top = viewportHeight - tooltipRect.height - spacing;
    }

    setCoords({ top, left });
  }, [position]);

  const showTooltip = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const baseClass = 'tooltip';
  const positionClass = `tooltip--${position}`;
  const visibleClass = isVisible ? 'tooltip--visible' : '';
  const classes = [baseClass, positionClass, visibleClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        ref={triggerRef}
        className="tooltip__trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={classes}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
          }}
        >
          {content}
          <span className="tooltip__arrow" aria-hidden="true" />
        </div>
      )}
    </>
  );
}

export default Tooltip;
