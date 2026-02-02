import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SwipePanelsProps {
  panels: {
    id: string;
    content: ReactNode;
    label: string;
  }[];
  activeIndex?: number;
  onPanelChange?: (index: number) => void;
  className?: string;
}

export function SwipePanels({
  panels,
  activeIndex = 0,
  onPanelChange,
  className,
}: SwipePanelsProps) {
  const [currentIndex, setCurrentIndex] = useState(activeIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setCurrentIndex(activeIndex);
  }, [activeIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    currentXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const diff = startXRef.current - currentXRef.current;
    const threshold = 50; // Minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentIndex < panels.length - 1) {
        // Swipe left - go to next panel
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        onPanelChange?.(newIndex);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - go to previous panel
        const newIndex = currentIndex - 1;
        setCurrentIndex(newIndex);
        onPanelChange?.(newIndex);
      }
    }
  };

  const goToPanel = (index: number) => {
    setCurrentIndex(index);
    onPanelChange?.(index);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Panel indicators */}
      <div className="flex items-center justify-center gap-2 py-2 bg-slate-900/50">
        {panels.map((panel, index) => (
          <button
            key={panel.id}
            onClick={() => goToPanel(index)}
            className={cn(
              'px-3 py-1 text-xs rounded-full transition-colors',
              index === currentIndex
                ? 'bg-helix-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            )}
          >
            {panel.label}
          </button>
        ))}
      </div>

      {/* Swipeable panels */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            width: `${panels.length * 100}%`,
          }}
        >
          {panels.map(panel => (
            <div
              key={panel.id}
              className="h-full overflow-y-auto"
              style={{ width: `${100 / panels.length}%` }}
            >
              {panel.content}
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-900/50">
        {panels.map((_, index) => (
          <button
            key={index}
            onClick={() => goToPanel(index)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              index === currentIndex ? 'w-4 bg-helix-500' : 'w-1.5 bg-slate-600 hover:bg-slate-500'
            )}
          />
        ))}
      </div>
    </div>
  );
}
