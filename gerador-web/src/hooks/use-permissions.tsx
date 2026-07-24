'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface PermissionsContextType {
  permissions: string[];
  can: (resource: string, action: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  can: () => false,
});

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: ReactNode;
}) {
  const value = useMemo(() => {
    const can = (resource: string, action: string): boolean => {
      // Owner wildcard
      if (permissions.includes('*:manage')) return true;

      // Exact match
      if (permissions.includes(`${resource}:${action}`)) return true;

      // resource:manage includes CRUD
      if (
        ['create', 'read', 'update', 'delete'].includes(action) &&
        permissions.includes(`${resource}:manage`)
      ) {
        return true;
      }

      // resource:* = all actions
      if (permissions.includes(`${resource}:*`)) return true;

      return false;
    };

    return { permissions, can };
  }, [permissions]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function Can({
  resource,
  action,
  children,
  fallback = null,
}: {
  resource: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = usePermissions();
  return can(resource, action) ? <>{children}</> : <>{fallback}</>;
}
