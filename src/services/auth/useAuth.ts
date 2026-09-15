import { useContext } from 'react';

import { AuthContext } from './AuthProvider';
import type { AuthContextValue } from './authTypes';

/**
 * Доступ к сессии: `status`, `user`, `profile`, `error` и действия входа,
 * шагов регистрации и выхода. Любой экран или фича могут импортировать хук.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return context;
}
