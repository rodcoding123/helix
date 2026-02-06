import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';

interface SessionSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
}

export function SessionSearchBar({
  searchQuery,
  onSearchChange,
  placeholder = 'Search conversations...',
}: SessionSearchBarProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleInputChange = (value: string) => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce search by 300ms
    debounceTimerRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  const handleClear = () => {
    onSearchChange('');
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      className={clsx(
        'relative flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-white/[0.05] border transition-all duration-200',
        isFocused
          ? 'border-helix-500/40 bg-white/[0.08]'
          : 'border-white/10 bg-white/[0.05]'
      )}
      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.07)' }}
    >
      <Search className="h-4 w-4 text-text-tertiary flex-shrink-0" />

      <input
        type="text"
        defaultValue={searchQuery}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={clsx(
          'flex-1 bg-transparent text-sm text-text-primary',
          'placeholder:text-text-tertiary',
          'focus:outline-none',
          'font-body'
        )}
        aria-label="Search conversations"
      />

      {searchQuery && (
        <motion.button
          onClick={handleClear}
          className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0 text-text-tertiary hover:text-white"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </motion.button>
      )}
    </motion.div>
  );
}
