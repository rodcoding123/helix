import { ReactNode } from 'react';

export const Select = ({
  children,
  value,
  onChange,
  className,
}: {
  children: ReactNode;
  value?: string;
  onChange?: (e: any) => void;
  className?: string;
}) => (
  <select
    value={value}
    onChange={onChange}
    className={`px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 ${className || ''}`}
  >
    {children}
  </select>
);

export const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <span>{placeholder || 'Select...'}</span>
);
export const SelectTrigger = ({ children }: { children: ReactNode }) => <div>{children}</div>;
export const SelectContent = ({ children }: { children: ReactNode }) => <div>{children}</div>;
export const SelectItem = ({ value, children }: { value: string; children: ReactNode }) => (
  <option value={value}>{children}</option>
);
