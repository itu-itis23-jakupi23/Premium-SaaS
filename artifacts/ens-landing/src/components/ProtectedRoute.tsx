import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth, UserRole, getRoleDashboard } from '@/contexts/AuthContext';
import { getPortalHomePath, getPortalLoginPath, isRoleAllowedInPortal } from '@/lib/portal';
import { LoadingScreen } from '@/components/LoadingScreen';

interface ProtectedRouteProps {
  component: React.ComponentType<Record<string, unknown>>;
  allowedRoles?: UserRole[];
  params?: Record<string, unknown>;
}

export function ProtectedRoute({ component: Component, allowedRoles, params = {} }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate(loginPathWithReturnTo());
      return;
    }
    if (user && !isRoleAllowedInPortal(user.role)) {
      navigate(getPortalHomePath());
      return;
    }
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      navigate(getRoleDashboard(user.role));
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, navigate]);

  if (isLoading) return <LoadingScreen label="Checking access" />;
  if (!isAuthenticated) return null;
  if (user && !isRoleAllowedInPortal(user.role)) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;

  return <Component {...params} />;
}

function loginPathWithReturnTo() {
  const target = `${window.location.pathname}${window.location.search}`;
  return `${getPortalLoginPath()}?returnTo=${encodeURIComponent(target)}`;
}
