import React, { forwardRef, useId } from 'react';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  size?: InputSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      size = 'md',
      iconLeft,
      iconRight,
      fullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const baseClass = 'input';
    const sizeClass = `input--${size}`;
    const errorClass = error ? 'input--error' : '';
    const fullWidthClass = fullWidth ? 'input--full-width' : '';
    const hasIconLeftClass = iconLeft ? 'input--has-icon-left' : '';
    const hasIconRightClass = iconRight ? 'input--has-icon-right' : '';

    const wrapperClasses = [
      `${baseClass}-wrapper`,
      fullWidthClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const inputClasses = [
      baseClass,
      sizeClass,
      errorClass,
      hasIconLeftClass,
      hasIconRightClass,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClasses}>
        {label && (
          <label htmlFor={inputId} className="input__label">
            {label}
          </label>
        )}
        <div className="input__container">
          {iconLeft && <span className="input__icon input__icon--left">{iconLeft}</span>}
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            {...props}
          />
          {iconRight && <span className="input__icon input__icon--right">{iconRight}</span>}
        </div>
        {error && (
          <span id={errorId} className="input__error" role="alert">
            {error}
          </span>
        )}
        {hint && !error && (
          <span id={hintId} className="input__hint">
            {hint}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
