import React, { createContext, useContext, ReactNode } from 'react';
import { useSecretsStore } from '../stores/secrets-store';
import type { SecretsState } from '../stores/secrets-store';

const SecretsContext = createContext<SecretsState | undefined>(undefined);

export const SecretsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const store = useSecretsStore();

  return (
    <SecretsContext.Provider value={store}>
      {children}
    </SecretsContext.Provider>
  );
};

export const useSecrets = (): SecretsState => {
  const context = useContext(SecretsContext);
  if (!context) {
    throw new Error('useSecrets must be used within a SecretsProvider');
  }
  return context;
};
