import { ReactNode } from 'react';

export const Tabs = ({ children }: { children: ReactNode }) => <div>{children}</div>;
export const TabsList = ({ children }: { children: ReactNode }) => <div className="flex gap-2 border-b">{children}</div>;
export const TabsTrigger = ({ children, value }: { children: ReactNode; value: string }) => (
  <button className="px-4 py-2 hover:bg-slate-700">{children}</button>
);
export const TabsContent = ({ children }: { children: ReactNode }) => <div>{children}</div>;
