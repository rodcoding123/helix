/**
 * Bottom Sheet Modal Component
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Reusable bottom sheet for mobile interactions
 */

import React from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: 'sm' | 'md' | 'lg' | 'full';
}

const heightClasses = {
  sm: 'h-1/3',
  md: 'h-1/2',
  lg: 'h-2/3',
  full: 'h-full',
};

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  height = 'md',
}) => {
  const [startY, setStartY] = React.useState<number>(0);
  const [translateY, setTranslateY] = React.useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (diff > 0) {
      setTranslateY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (translateY > 100) {
      onClose();
    }
    setTranslateY(0);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-40"
      onClick={onClose}
    >
      <div
        className="fixed bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl z-50 flex flex-col touch-none transition-transform"
        style={{
          transform: `translateY(${translateY}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle Bar */}
        <div className="flex justify-center py-2">
          <div className="w-12 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};
