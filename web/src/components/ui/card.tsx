import { ReactNode } from 'react';

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-slate-700 bg-slate-800 ${className || ''}`}>{children}</div>
);
export const CardHeader = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={`border-b border-slate-700 p-4 ${className || ''}`}>{children}</div>
);
export const CardTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-lg font-semibold text-slate-100">{children}</h2>
);
export const CardContent = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={`p-4 ${className || ''}`}>{children}</div>
);
