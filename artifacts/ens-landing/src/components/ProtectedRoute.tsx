import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth, UserRole, getRoleDashboard } from '@/contexts/AuthContext';
import { getPortalLoginPath, isRoleAllowedInPortal } from '@/lib/portal';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Clock, Mail, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  component: React.ComponentType<Record<string, unknown>>;
  allowedRoles?: UserRole[];
  params?: Record<string, unknown>;
}

function ClientPendingScreen({
  name,
  isRefreshing,
  onRefresh,
}: {
  name: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <div style={{ maxWidth: 440, width: '100%', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '48px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Clock size={26} style={{ color: '#a16207' }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 10px', color: '#0f172a' }}>
          {t('client.pendingApproval.title')}
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 24px' }}>
          {t('client.pendingApproval.body', { firstName: name.split(' ')[0] })}
        </p>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
          <Mail size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
            {t('client.pendingApproval.emailNote')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void onRefresh(); }}
          disabled={isRefreshing}
          style={{
            width: '100%',
            marginTop: 16,
            minHeight: 44,
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            background: '#0f172a',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: isRefreshing ? 'wait' : 'pointer',
            opacity: isRefreshing ? 0.65 : 1,
          }}
          data-testid="button-refresh-client-approval"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          {t('pm.dashboard.retry')}
        </button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ component: Component, allowedRoles, params = {} }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, refresh, logout } = useAuth();
  const [, navigate] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const clientIsPending = user?.role === 'client' && !!user.clientStatus && user.clientStatus !== 'active';

  async function refreshClientStatus() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refresh();
    } catch {
      // Keep the current authenticated session visible when a status recheck
      // is temporarily unavailable; the automatic poll will retry.
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate(loginPathWithReturnTo());
      return;
    }
    if (user && !isRoleAllowedInPortal(user.role)) {
      void logout().finally(() => navigate(getPortalLoginPath(), { replace: true }));
      return;
    }
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      navigate(getRoleDashboard(user.role), { replace: true });
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, navigate, logout]);

  useEffect(() => {
    if (!clientIsPending) return;
    const intervalId = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(intervalId);
  }, [clientIsPending, refresh]);

  if (isLoading) return <LoadingScreen label="Checking access" />;
  if (!isAuthenticated) return null;
  if (user && !isRoleAllowedInPortal(user.role)) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;

  // Client accounts that haven't been approved yet see a holding screen
  // rather than empty dashboards or confusing 403 errors.
  if (clientIsPending && user) {
    return <ClientPendingScreen name={user.name} isRefreshing={isRefreshing} onRefresh={refreshClientStatus} />;
  }

  return <Component {...params} />;
}

function loginPathWithReturnTo() {
  const target = `${window.location.pathname}${window.location.search}`;
  return `${getPortalLoginPath()}?returnTo=${encodeURIComponent(target)}`;
}
