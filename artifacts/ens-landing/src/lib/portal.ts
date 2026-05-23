import type { UserRole } from '@/contexts/AuthContext';

export type PortalMode = 'all' | 'staff' | 'client';

const rawPortalMode = import.meta.env.VITE_PORTAL;

export const PORTAL_MODE: PortalMode =
  rawPortalMode === 'staff' || rawPortalMode === 'client' ? rawPortalMode : 'all';

export const STAFF_ROLES: UserRole[] = ['chief', 'pm'];
export const CLIENT_ROLES: UserRole[] = ['client'];

export function isRoleAllowedInPortal(role: UserRole) {
  if (PORTAL_MODE === 'staff') return STAFF_ROLES.includes(role);
  if (PORTAL_MODE === 'client') return CLIENT_ROLES.includes(role);
  return true;
}

export function getPortalLoginPath() {
  return '/login';
}

export function getPortalHomePath() {
  if (PORTAL_MODE === 'staff') return '/team';
  if (PORTAL_MODE === 'client') return '/client';
  return '/';
}

export function getPortalForbiddenMessage(role: UserRole) {
  if (PORTAL_MODE === 'staff') {
    return `The ${role} account belongs in the client portal.`;
  }
  if (PORTAL_MODE === 'client') {
    return 'Staff accounts belong in the staff portal.';
  }
  return 'This account is not available in this portal.';
}
