import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  className?: string;
  label?: string;
}

export function Spinner({
  size = 'md',
  color,
  className = '',
  label = 'Loading...',
}: SpinnerProps): React.ReactElement {
  const baseClass = 'spinner';
  const sizeClass = `spinner--${size}`;
  const classes = [baseClass, sizeClass, className].filter(Boolean).join(' ');

  const sizeMap: Record<SpinnerSize, number> = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  const pixelSize = sizeMap[size];

  return (
    <div className={classes} role="status" aria-label={label}>
      <svg
        className="spinner__svg"
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          className="spinner__track"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeOpacity="0.25"
        />
        <path
          className="spinner__head"
          d="M12 2C6.47715 2 2 6.47715 2 12"
          stroke={color || 'currentColor'}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

// Full page spinner overlay
export interface SpinnerOverlayProps extends SpinnerProps {
  message?: string;
}

export function SpinnerOverlay({
  message,
  ...spinnerProps
}: SpinnerOverlayProps): React.ReactElement {
  return (
    <div className="spinner-overlay" role="status" aria-busy="true">
      <div className="spinner-overlay__content">
        <Spinner {...spinnerProps} size="lg" />
        {message && <p className="spinner-overlay__message">{message}</p>}
      </div>
    </div>
  );
}

export default Spinner;
