import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type UserRole = 'chief' | 'pm' | 'client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  company: string;
  role: UserRole;
  systemRole?: string;
  avatarUrl?: string;
  avatarTone?: string;
  clientStatus?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  signup: (input: SignupInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

interface LoginCredentials {
  email: string;
  password: string;
  organizationSlug?: string;
}

interface SignupInput {
  name: string;
  company: string;
  exhibition?: string;
  boothWidthM?: number;
  boothDepthM?: number;
  preferredSystem?: string;
  venueCity?: string;
  targetDate?: string;
  intakeNotes?: string;
  email: string;
  password: string;
  organizationSlug?: string;
  role?: UserRole;
  setupKey?: string;
}

interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    systemRole?: string;
    avatarUrl?: string;
    avatarTone?: string;
  } | null;
  organization: {
    name: string;
    slug: string;
  } | null;
  clientRecord?: { id: string; status: string } | null;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');
const ORGANIZATION_SLUG = import.meta.env.VITE_ORGANIZATION_SLUG ?? 'ens-demo-agency';
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';
const MOCK_AUTH_STORAGE_KEY = 'ens-mock-auth-user';
// Dev-only: set VITE_MOCK_DEV_PASSWORD in .env.local to override the default demo password.
// This only applies when VITE_USE_MOCK_API=true and never reaches production.
const MOCK_PASSWORD = import.meta.env.VITE_MOCK_DEV_PASSWORD ?? 'EnsDev2026!';

const MOCK_USERS: Record<string, AuthUser> = {
  'owner@ens.test': {
    id: 'mock-chief',
    name: 'Owner Chief',
    email: 'owner@ens.test',
    company: 'ENS Demo Agency',
    role: 'chief',
    systemRole: 'owner',
    avatarUrl: '',
    avatarTone: 'primary',
  },
  'pm@ens.test': {
    id: 'mock-pm',
    name: 'Project Manager',
    email: 'pm@ens.test',
    company: 'ENS Demo Agency',
    role: 'pm',
    systemRole: 'pm',
    avatarUrl: '',
    avatarTone: 'blue',
  },
  'client@ens.test': {
    id: 'mock-client',
    name: 'Client Reviewer',
    email: 'client@ens.test',
    company: 'ENS Demo Agency',
    role: 'client',
    systemRole: 'client',
    avatarUrl: '',
    avatarTone: 'green',
  },
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {
    throw new Error('AuthProvider is not mounted');
  },
  signup: async () => {
    throw new Error('AuthProvider is not mounted');
  },
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (USE_MOCK_API) {
      setUser(readMockUser());
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    request<AuthResponse>('/auth/me', {
      headers: { 'x-auth-optional': '1' },
    })
      .then((response) => {
        if (!isMounted) return;
        const nextUser = toAuthUser(response);
        setUser(nextUser);
        persistCurrentUser(nextUser);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
        persistCurrentUser(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    if (USE_MOCK_API) {
      const nextUser = mockLogin(credentials);
      setUser(nextUser);
      return nextUser;
    }

    const response = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...credentials,
        organizationSlug: credentials.organizationSlug ?? ORGANIZATION_SLUG,
      }),
    });
    const nextUser = requireAuthUser(response);
    setUser(nextUser);
    persistCurrentUser(nextUser);
    return nextUser;
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    if (USE_MOCK_API) {
      const role = input.role ?? 'client';
      const nextUser: AuthUser = {
        id: `mock-${Date.now()}`,
        name: input.name.trim() || input.email.split('@')[0] || (role === 'chief' ? 'Chief Manager' : role === 'pm' ? 'Project Manager' : 'Client Reviewer'),
        email: input.email,
        company: input.company.trim() || 'ENS Demo Agency',
        role,
        systemRole: role === 'chief' ? 'owner' : role,
        avatarUrl: '',
        avatarTone: role === 'chief' ? 'primary' : role === 'pm' ? 'blue' : 'green',
      };
      localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      return nextUser;
    }

    const role = input.role ?? 'client';
    const signupPath = role === 'client' ? '/auth/signup' : '/auth/signup-staff';
    const response = await request<AuthResponse>(signupPath, {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        role,
        organizationSlug: input.organizationSlug ?? ORGANIZATION_SLUG,
      }),
    });
    const nextUser = requireAuthUser(response);
    setUser(nextUser);
    persistCurrentUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    if (USE_MOCK_API) {
      localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
      setUser(null);
      return;
    }

    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      persistCurrentUser(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getRoleDashboard(role: UserRole): string {
  const map: Record<UserRole, string> = { chief: '/chief', pm: '/pm', client: '/client' };
  return map[role];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await requestFetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await readError(response);
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// Shared refresh promise — prevents concurrent 401s from spawning multiple refresh requests
let _authRefreshPromise: Promise<boolean> | null = null;

async function requestFetch(path: string, init: RequestInit, retried = false): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (response.status !== 401 || retried || path === '/auth/refresh') return response;

  if (!_authRefreshPromise) {
    _authRefreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { _authRefreshPromise = null; });
  }

  const refreshed = await _authRefreshPromise;
  if (!refreshed) return response;
  return requestFetch(path, init, true);
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function toAuthUser(response: AuthResponse): AuthUser | null {
  if (!response.user || !response.organization) return null;

  return {
    id: response.user.id,
    name: response.user.name,
    email: response.user.email,
    company: response.organization.name,
    role: response.user.role,
    systemRole: response.user.systemRole,
    avatarUrl: response.user.avatarUrl,
    avatarTone: response.user.avatarTone,
    clientStatus: response.clientRecord?.status,
  };
}

function requireAuthUser(response: AuthResponse): AuthUser {
  const user = toAuthUser(response);
  if (!user) throw new Error('Authentication did not return a user.');
  return user;
}

function readMockUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as AuthUser : null;
  } catch {
    localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
    return null;
  }
}

function persistCurrentUser(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
  }
}

function mockLogin(credentials: LoginCredentials): AuthUser {
  const email = credentials.email.trim().toLowerCase();
  const user = MOCK_USERS[email];

  if (!user || credentials.password !== MOCK_PASSWORD) {
    throw new Error('Invalid email or password.');
  }

  localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(user));
  return user;
}
