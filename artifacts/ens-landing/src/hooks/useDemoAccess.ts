import { useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { getRoleDashboard, useAuth, type UserRole } from '@/contexts/AuthContext';
import { isRoleAllowedInPortal } from '@/lib/portal';

const DEV_PASSWORD = 'EnsDev2026!';
const DEV_EMAIL_BY_ROLE: Record<UserRole, string> = {
  chief: 'owner@ens.test',
  pm: 'pm@ens.test',
  client: 'client@ens.test',
};

export function useDemoAccess() {
  const auth = useAuth();
  const [, navigate] = useLocation();
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  const enterAs = useCallback(async (role: UserRole, targetPath = getRoleDashboard(role)) => {
    const destination = safeTargetPath(targetPath, role);

    if (!import.meta.env.DEV) {
      navigate(loginPathFor(destination));
      return;
    }

    setPendingRole(role);

    try {
      const user = await auth.login({
        email: DEV_EMAIL_BY_ROLE[role],
        password: DEV_PASSWORD,
      });

      if (user.role !== role || !isRoleAllowedInPortal(user.role)) {
        await auth.logout();
        navigate(loginPathFor(destination));
        return;
      }

      navigate(destination);
    } catch {
      navigate(loginPathFor(destination));
    } finally {
      setPendingRole(null);
    }
  }, [auth, navigate]);

  return { enterAs, pendingRole };
}

function safeTargetPath(path: string, role: UserRole) {
  if (!path.startsWith('/') || path.startsWith('//')) return getRoleDashboard(role);
  return path;
}

function loginPathFor(targetPath: string) {
  return `/login?returnTo=${encodeURIComponent(targetPath)}`;
}
