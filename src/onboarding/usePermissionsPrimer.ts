import { useContext } from 'react';

import { PermissionsPrimerContext } from '@/onboarding/PermissionsPrimerContext';

export function usePermissionsPrimer() {
  const ctx = useContext(PermissionsPrimerContext);
  if (!ctx) {
    throw new Error('usePermissionsPrimer must be used within a PermissionsPrimerProvider');
  }
  return ctx;
}
