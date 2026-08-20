import type { UserRole } from '@/contexts/AuthContext';

export type PortalMode = 'all' | 'staff' | 'client';

const rawPortalMode = import.meta.env.VITE_PORTAL;

export const PORTAL_MODE: PortalMode =
  rawPortalMode === 'staff' || rawPortalMode === 'client' ? rawPortalMode : 'all';

export const STAFF_ROLES: UserRole[] = ['chief', 'pm'];
export const CLIENT_ROLES: UserRole[] = ['client'];

export type RequestPortal = 'staff' | 'client';

/**
 * Identifies which authentication cookie namespace an API request belongs to.
 * Explicit staff/client builds are authoritative. The path fallback keeps the
 * combined local build usable without relying on ports or referrer parsing.
 *
 * The portal decides which auth cookie namespace the API reads (`ens_access`
 * vs `ens_client_access`), so the order of the checks below is deliberate:
 * an explicit build mode wins over a dev port, which wins over the path, which
 * wins over the query string. Nothing here writes a cookie - auth cookies are
 * httpOnly and set by the API - so a wrong value can only read the wrong jar
 * and surface as a 401, never corrupt or cross a session.
 */
export function getRequestPortal(): RequestPortal {
  if (PORTAL_MODE === 'staff' || PORTAL_MODE === 'client') return PORTAL_MODE;
  if (typeof window === 'undefined') return 'staff';

  const port = window.location.port;
  if (port === '5174') return 'staff';
  if (port === '5175') return 'client';

  const pathname = window.location.pathname;
  if (pathname === '/client' || pathname.startsWith('/client/')) return 'client';

  const params = new URLSearchParams(window.location.search);

  const returnTo = params.get('returnTo');
  if (returnTo === '/client' || returnTo?.startsWith('/client/')) return 'client';

  // Public signup is client signup.
  //
  // Staff never arrive here: chief and PM invitations are emailed as
  // /pm/join?token=..., which is a different path and still resolves to
  // 'staff'. Every link to /signup is a prospect - the home page calls to
  // action, "Sign up free" on the login screen, and the 404 footer.
  //
  // Without this, /signup fell through to the 'staff' default on the combined
  // build and rendered the invitation-only form: an invitation-code field and
  // no email or password input at all. `?returnTo=/client` above was the
  // stopgap; it still works, but is no longer required.
  //
  // ?role=pm / ?role=chief opts explicitly back into staff, which keeps the
  // invitation-code entry point in Signup.tsx reachable for someone holding a
  // code but not the link.
  if (pathname === '/signup') {
    const role = params.get('role')?.toLowerCase();
    if (role === 'pm' || role === 'chief') return 'staff';
    return 'client';
  }

  return 'staff';
}

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
