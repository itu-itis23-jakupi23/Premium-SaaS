import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type UserRole = 'chief' | 'pm' | 'client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  company: string;
  role: UserRole;
  systemRole?: string;
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
  email: string;
  password: string;
  organizationSlug?: string;
}

interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    systemRole?: string;
  };
  organization: {
    name: string;
    slug: string;
  };
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');
const ORGANIZATION_SLUG = import.meta.env.VITE_ORGANIZATION_SLUG ?? 'ens-demo-agency';
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';
const MOCK_AUTH_STORAGE_KEY = 'ens-mock-auth-user';
const MOCK_PASSWORD = 'EnsDev2026!';

const MOCK_USERS: Record<string, AuthUser> = {
  'owner@ens.test': {
    id: 'mock-chief',
    name: 'Owner Chief',
    email: 'owner@ens.test',
    company: 'ENS Demo Agency',
    role: 'chief',
    systemRole: 'owner',
  },
  'pm@ens.test': {
    id: 'mock-pm',
    name: 'Project Manager',
    email: 'pm@ens.test',
    company: 'ENS Demo Agency',
    role: 'pm',
    systemRole: 'pm',
  },
  'client@ens.test': {
    id: 'mock-client',
    name: 'Client Reviewer',
    email: 'client@ens.test',
    company: 'ENS Demo Agency',
    role: 'client',
    systemRole: 'client',
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

    request<AuthResponse>('/auth/me')
      .then((response) => {
        if (isMounted) setUser(toAuthUser(response));
      })
      .catch(() => {
        if (isMounted) setUser(null);
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
    const nextUser = toAuthUser(response);
    setUser(nextUser);
    return nextUser;
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    if (USE_MOCK_API) {
      const nextUser: AuthUser = {
        id: `mock-${Date.now()}`,
        name: input.name.trim() || input.email.split('@')[0] || 'Client Reviewer',
        email: input.email,
        company: input.company.trim() || 'ENS Demo Agency',
        role: 'client',
        systemRole: 'client',
      };
      localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      return nextUser;
    }

    const response = await request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        organizationSlug: input.organizationSlug ?? ORGANIZATION_SLUG,
      }),
    });
    const nextUser = toAuthUser(response);
    setUser(nextUser);
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

async function requestFetch(path: string, init: RequestInit, retried = false): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (response.status !== 401 || retried || path === '/auth/refresh') return response;

  const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
  });

  if (!refreshed.ok) return response;
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

function toAuthUser(response: AuthResponse): AuthUser {
  return {
    id: response.user.id,
    name: response.user.name,
    email: response.user.email,
    company: response.organization.name,
    role: response.user.role,
    systemRole: response.user.systemRole,
  };
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

function mockLogin(credentials: LoginCredentials): AuthUser {
  const email = credentials.email.trim().toLowerCase();
  const user = MOCK_USERS[email];

  if (!user || credentials.password !== MOCK_PASSWORD) {
    throw new Error('Invalid email or password.');
  }

  localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(user));
  return user;
}
