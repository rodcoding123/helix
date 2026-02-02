import React, { useState, useRef, useEffect, useId, useCallback } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  size?: SelectSize;
  multiple?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  error,
  size = 'md',
  multiple = false,
  searchable = false,
  disabled = false,
  fullWidth = false,
  className = '',
}: SelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (multiple) {
        const newValues = selectedValues.includes(optionValue)
          ? selectedValues.filter((v) => v !== optionValue)
          : [...selectedValues, optionValue];
        onChange?.(newValues);
      } else {
        onChange?.(optionValue);
        setIsOpen(false);
      }
      setSearchQuery('');
    },
    [multiple, selectedValues, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((i) =>
              Math.min(i + 1, filteredOptions.length - 1)
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (isOpen && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value);
          } else {
            setIsOpen(true);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filteredOptions, highlightedIndex, handleSelect]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  const getDisplayValue = () => {
    if (selectedValues.length === 0) return placeholder;
    if (multiple) {
      return selectedValues
        .map((v) => options.find((o) => o.value === v)?.label)
        .filter(Boolean)
        .join(', ');
    }
    return options.find((o) => o.value === selectedValues[0])?.label || placeholder;
  };

  const baseClass = 'select';
  const sizeClass = `select--${size}`;
  const openClass = isOpen ? 'select--open' : '';
  const errorClass = error ? 'select--error' : '';
  const disabledClass = disabled ? 'select--disabled' : '';
  const fullWidthClass = fullWidth ? 'select--full-width' : '';

  const classes = [baseClass, sizeClass, openClass, errorClass, disabledClass, fullWidthClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} ref={containerRef}>
      {label && <label className="select__label">{label}</label>}
      <div
        className="select__trigger"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <span className="select__value">{getDisplayValue()}</span>
        <span className="select__arrow" aria-hidden="true">
          ▼
        </span>
      </div>
      {isOpen && (
        <div className="select__dropdown" role="listbox" id={`${id}-listbox`}>
          {searchable && (
            <input
              ref={searchInputRef}
              type="text"
              className="select__search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="select__options">
            {filteredOptions.length === 0 ? (
              <div className="select__no-options">No options found</div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={[
                    'select__option',
                    selectedValues.includes(option.value) ? 'select__option--selected' : '',
                    index === highlightedIndex ? 'select__option--highlighted' : '',
                    option.disabled ? 'select__option--disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="option"
                  aria-selected={selectedValues.includes(option.value)}
                  aria-disabled={option.disabled}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {multiple && (
                    <span className="select__checkbox">
                      {selectedValues.includes(option.value) ? '☑' : '☐'}
                    </span>
                  )}
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {error && <span className="select__error">{error}</span>}
    </div>
  );
}

export default Select;
