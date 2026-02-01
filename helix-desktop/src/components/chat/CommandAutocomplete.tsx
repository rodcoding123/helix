/**
 * Command Autocomplete - Dropdown for slash command completions
 */

import { useEffect, useState, useRef } from 'react';
import { getCompletions, type CommandCompletion } from '../../hooks/useSlashCommands';
import './CommandAutocomplete.css';

interface CommandAutocompleteProps {
  input: string;
  onSelect: (value: string) => void;
  visible: boolean;
  onClose: () => void;
}

export function CommandAutocomplete({
  input,
  onSelect,
  visible,
  onClose,
}: CommandAutocompleteProps) {
  const [completions, setCompletions] = useState<CommandCompletion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Update completions when input changes
  useEffect(() => {
    if (!visible) return;
    const results = getCompletions(input);
    setCompletions(results);
    setSelectedIndex(0);
  }, [input, visible]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible || completions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, completions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Tab':
        case 'Enter':
          if (completions.length > 0) {
            e.preventDefault();
            onSelect(completions[selectedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, completions, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('.selected');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!visible || completions.length === 0) return null;

  return (
    <div className="command-autocomplete" ref={listRef}>
      {completions.map((completion, index) => (
        <button
          key={completion.value}
          className={`completion-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(completion.value)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="completion-value">{completion.display}</span>
          <span className="completion-description">{completion.description}</span>
        </button>
      ))}
      <div className="autocomplete-hint">
        <span>Tab</span> to complete <span>↑↓</span> to navigate <span>Esc</span> to close
      </div>
    </div>
  );
}
