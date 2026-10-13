import type { PropsWithChildren, ReactNode } from 'react';

import { useAuth } from '@/auth/useAuth';

type AccessGateProps = PropsWithChildren<{
  permissions?: string[];
  roles?: string[];
  fallback?: ReactNode;
}>;

/** Render role-sensitive UI only when the authenticated user has every requested access claim. */
export function AccessGate({ children, permissions = [], roles = [], fallback = null }: AccessGateProps) {
  const { user } = useAuth();
  const allowed = user !== null
    && permissions.every((permission) => user.permissions.includes(permission))
    && roles.every((role) => user.roles.includes(role));

  return allowed ? <>{children}</> : <>{fallback}</>;
}
