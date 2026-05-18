import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth, UserRole, getRoleDashboard } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  component: React.ComponentType<Record<string, unknown>>;
  allowedRoles?: UserRole[];
  params?: Record<string, unknown>;
}

export function ProtectedRoute({ component: Component, allowedRoles, params = {} }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      navigate(getRoleDashboard(user.role));
    }
  }, [isAuthenticated, user, allowedRoles, navigate]);

  if (!isAuthenticated) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;

  return <Component {...params} />;
}
