import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { readJsonStore, writeJsonStore } from "../storage.js";

type UserRole = "chief" | "pm" | "client";

interface StoredAuthUser {
  id: string;
  name: string;
  company: string;
  agency?: string;
  email: string;
  role: UserRole;
  systemRole: string;
  passwordHash: string;
  avatarUrl: string;
  avatarTone: string;
  createdAt: string;
  exhibition?: string;
  boothWidthM?: number;
  boothDepthM?: number;
  preferredSystem?: string;
  venueCity?: string;
  targetDate?: string;
  intakeNotes?: string;
  phone?: string;
  notifications?: {
    assignments: boolean;
    milestones: boolean;
    reports: boolean;
    system: boolean;
  };
  appearance?: {
    theme: "light" | "dark" | "system";
    compact: boolean;
    language: string;
  };
  security?: {
    twoFactorEnabled: boolean;
    recoveryCodes: string[];
  };
}

interface StoredSession {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

interface LoginAttempt {
  key: string;
  count: number;
  firstAttemptAt: string;
  lockedUntil: string | null;
}

interface AuthStore {
  users: StoredAuthUser[];
  sessions: StoredSession[];
  loginAttempts?: LoginAttempt[];
}

const router = Router();
export const accountRouter = Router();
const scrypt = promisify(scryptCallback);
const STORE_KEY = "auth";
const SESSION_COOKIE = "ens_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  exhibition: z.string().trim().min(2).max(160),
  boothWidthM: z.number().finite().min(1).max(50).optional(),
  boothDepthM: z.number().finite().min(1).max(50).optional(),
  preferredSystem: z.string().trim().max(80).optional(),
  venueCity: z.string().trim().max(160).optional(),
  targetDate: z.string().trim().max(40).optional(),
  intakeNotes: z.string().trim().max(1000).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200).regex(/[A-Z]/).regex(/[0-9]/),
  organizationSlug: z.string().trim().max(120).optional(),
});

const chiefBootstrapSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200).regex(/[A-Z]/).regex(/[0-9]/),
  organizationSlug: z.string().trim().max(120).optional(),
  setupKey: z.string().trim().max(200).optional(),
});

const staffSignupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).default(""),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200).regex(/[A-Z]/).regex(/[0-9]/),
  organizationSlug: z.string().trim().max(120).optional(),
  role: z.enum(["pm", "chief"]),
  setupKey: z.string().trim().max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
  organizationSlug: z.string().trim().max(120).optional(),
});

const invitedUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200).regex(/[A-Z]/).regex(/[0-9]/),
  role: z.enum(["pm", "chief"]),
});

const accountSettingsSchema = z.object({
  profile: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(254).optional(),
    phone: z.string().trim().max(80).optional(),
    role: z.string().trim().max(80).optional(),
    avatarTone: z.string().trim().max(80).optional(),
    avatarUrl: z.string().trim().max(4000).optional(),
  }).optional(),
  notifications: z.object({
    assignments: z.boolean().optional(),
    milestones: z.boolean().optional(),
    reports: z.boolean().optional(),
    system: z.boolean().optional(),
  }).optional(),
  appearance: z.object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    compact: z.boolean().optional(),
    language: z.string().trim().min(2).max(20).optional(),
  }).optional(),
  security: z.object({
    twoFactorEnabled: z.boolean().optional(),
    recoveryCodes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  }).optional(),
});

const avatarSchema = z.object({
  avatarUrl: z.string().trim().max(4000),
  avatarTone: z.string().trim().min(1).max(80),
});

const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200).regex(/[A-Z]/).regex(/[0-9]/),
});

const seedStore: AuthStore = {
  users: [],
  sessions: [],
  loginAttempts: [],
};

async function ensureOperationalClientRecord(user: StoredAuthUser) {
  if (user.role !== "client") return;
  const agency = user.agency || process.env.DEFAULT_AGENCY_NAME || "NIKA";
  const coreSeed = {
    projects: [],
    clients: [],
    activity: [],
    workspaces: {},
    tasks: [],
    calendarEvents: [],
  };
  const store = await readJsonStore<any>("core", coreSeed);
  store.projects ??= [];
  store.clients ??= [];
  store.activity ??= [];
  store.workspaces ??= {};
  store.tasks ??= [];
  store.calendarEvents ??= [];

  const email = user.email.trim().toLowerCase();
  const existing = store.clients.find((client: any) => String(client.contactEmail || "").trim().toLowerCase() === email);
  if (existing) {
    existing.name = user.company || user.name;
    existing.company = user.company || user.name;
    existing.contactName = user.name;
    existing.contactEmail = email;
    existing.exhibition = user.exhibition || existing.exhibition || "Pending onboarding";
    existing.boothWidthM = user.boothWidthM ?? existing.boothWidthM ?? null;
    existing.boothDepthM = user.boothDepthM ?? existing.boothDepthM ?? null;
    existing.preferredSystem = user.preferredSystem || existing.preferredSystem || "";
    existing.venueCity = user.venueCity || existing.venueCity || "";
    existing.targetDate = user.targetDate || existing.targetDate || "";
    existing.intakeNotes = user.intakeNotes || existing.intakeNotes || "";
    existing.pm = existing.pm || "Unassigned";
    existing.status = existing.status || "Pending";
    existing.lastActivity = "Just now";
    existing.agency = existing.agency || agency;
  } else {
    store.clients.unshift({
      id: `client-${Date.now()}-${randomBytes(3).toString("hex")}`,
      name: user.company || user.name,
      company: user.company || user.name,
      contactName: user.name,
      contactEmail: email,
      projectId: null,
      pm: "Unassigned",
      exhibition: user.exhibition || "Pending onboarding",
      boothWidthM: user.boothWidthM ?? null,
      boothDepthM: user.boothDepthM ?? null,
      preferredSystem: user.preferredSystem || "",
      venueCity: user.venueCity || "",
      targetDate: user.targetDate || "",
      intakeNotes: user.intakeNotes || "",
      status: "Pending",
      lastActivity: "Just now",
      agency,
    });
  }
  store.activity = [
    {
      id: `activity-${Date.now()}-${randomBytes(3).toString("hex")}`,
      type: "update",
      user: user.name,
      action: "created client account awaiting chief assignment",
      project: "Client onboarding",
      time: "Just now",
    },
    ...store.activity,
  ].slice(0, 100);
  notifyChiefUsers(store, {
    title: "New client awaiting assignment",
    body: `${user.company || user.name} signed up and needs a project manager.`,
    href: "/chief/managers",
  });
  await writeJsonStore("core", store);
}

async function notifyChiefUsers(
  coreStore: any,
  notification: { title: string; body: string; href: string | null },
) {
  const authStore = await readStore();
  const chiefs = authStore.users.filter((user) => user.role === "chief");
  if (!chiefs.length) return;
  coreStore.notifications ??= {};
  const now = new Date().toISOString();
  for (const chief of chiefs) {
    const key = chief.id || chief.email || "dev-chief";
    const current = Array.isArray(coreStore.notifications[key]) ? coreStore.notifications[key] : [];
    coreStore.notifications[key] = [
      {
        id: `notification-${Date.now()}-${randomBytes(3).toString("hex")}`,
        title: notification.title,
        body: notification.body,
        href: notification.href,
        readAt: null,
        read: false,
        createdAt: now,
        time: "Just now",
      },
      ...current,
    ].slice(0, 100);
  }
}

async function notifyChiefsAboutStaffSignup(user: StoredAuthUser) {
  if (user.role !== "pm") return;
  const coreSeed = {
    projects: [],
    clients: [],
    activity: [],
    workspaces: {},
    tasks: [],
    calendarEvents: [],
  };
  const store = await readJsonStore<any>("core", coreSeed);
  store.projects ??= [];
  store.clients ??= [];
  store.activity ??= [];
  store.notifications ??= {};
  store.activity = [
    {
      id: `activity-${Date.now()}-${randomBytes(3).toString("hex")}`,
      type: "update",
      user: user.name,
      action: "created project manager account awaiting chief assignment",
      project: "PM onboarding",
      time: "Just now",
    },
    ...store.activity,
  ].slice(0, 100);
  await notifyChiefUsers(store, {
    title: "New project manager joined",
    body: `${user.name} signed up as a PM and is available for assignment.`,
    href: "/chief/managers",
  });
  await writeJsonStore("core", store);
}

export async function createInvitedUser(input: {
  name: string;
  email: string;
  password: string;
  role: "pm" | "chief";
  company: string;
}) {
  const parsed = invitedUserSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invitation account details are invalid.");
  const store = await readStore();
  const email = parsed.data.email.toLowerCase();
  if (store.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("An account already exists for this email.");
  }
  const user: StoredAuthUser = {
    id: `user-${Date.now()}-${randomBytes(4).toString("hex")}`,
    name: parsed.data.name,
    company: input.company,
    email,
    role: parsed.data.role,
    systemRole: parsed.data.role,
    passwordHash: await hashPassword(parsed.data.password),
    avatarUrl: "",
    avatarTone: parsed.data.role === "chief" ? "primary" : "blue",
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  pruneSessions(store);
  await writeStore(store);
  return authResponse(user);
}

router.get("/me", async (req, res) => {
  const auth = await currentAuth(req);
  if (!auth) {
    if (req.header("x-auth-optional") === "1") {
      return res.json({ user: null, organization: null });
    }
    return res.status(401).json(errorBody("Not signed in."));
  }
  res.json(authResponse(auth.user));
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const email = parsed.data.email.toLowerCase();
  const existingUser = store.users.find((user) => user.email.toLowerCase() === email);
  if (existingUser) {
    if (isDev && await verifyPassword(parsed.data.password, existingUser.passwordHash)) {
      existingUser.name = parsed.data.name;
      existingUser.company = parsed.data.company;
      existingUser.agency = existingUser.agency || process.env.DEFAULT_AGENCY_NAME || "NIKA";
      existingUser.exhibition = parsed.data.exhibition;
      existingUser.boothWidthM = parsed.data.boothWidthM;
      existingUser.boothDepthM = parsed.data.boothDepthM;
      existingUser.preferredSystem = parsed.data.preferredSystem;
      existingUser.venueCity = parsed.data.venueCity;
      existingUser.targetDate = parsed.data.targetDate;
      existingUser.intakeNotes = parsed.data.intakeNotes;
      existingUser.role = "client";
      existingUser.systemRole = "client";
      existingUser.avatarTone = "green";
      await ensureOperationalClientRecord(existingUser);
      const session = createSession(existingUser.id);
      store.sessions.push(session);
      pruneSessions(store);
      await writeStore(store);
      setSessionCookie(res, session.id);
      return res.status(200).json(authResponse(existingUser));
    }
    return res.status(409).json(errorBody("An account already exists for this email."));
  }

  const now = new Date().toISOString();
  const user: StoredAuthUser = {
    id: `user-${Date.now()}-${randomBytes(4).toString("hex")}`,
    name: parsed.data.name,
    company: parsed.data.company,
    agency: process.env.DEFAULT_AGENCY_NAME || "NIKA",
    exhibition: parsed.data.exhibition,
    boothWidthM: parsed.data.boothWidthM,
    boothDepthM: parsed.data.boothDepthM,
    preferredSystem: parsed.data.preferredSystem,
    venueCity: parsed.data.venueCity,
    targetDate: parsed.data.targetDate,
    intakeNotes: parsed.data.intakeNotes,
    email,
    role: "client",
    systemRole: "client",
    passwordHash: await hashPassword(parsed.data.password),
    avatarUrl: "",
    avatarTone: "green",
    createdAt: now,
  };
  store.users.push(user);
  await ensureOperationalClientRecord(user);
  const session = createSession(user.id);
  store.sessions.push(session);
  pruneSessions(store);
  await writeStore(store);
  setSessionCookie(res, session.id);
  res.status(201).json(authResponse(user));
});

router.post("/bootstrap-chief", async (req, res) => {
  const parsed = chiefBootstrapSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const requiredKey = process.env.CHIEF_BOOTSTRAP_KEY;
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && (!requiredKey || parsed.data.setupKey !== requiredKey)) {
    return res.status(403).json(errorBody("Chief bootstrap requires a valid setup key."));
  }

  const email = parsed.data.email.toLowerCase();
  if (store.users.some((user) => user.email.toLowerCase() === email)) {
    return res.status(409).json(errorBody("An account already exists for this email."));
  }
  const user: StoredAuthUser = {
    id: `user-${Date.now()}-${randomBytes(4).toString("hex")}`,
    name: parsed.data.name,
    company: parsed.data.company,
    email,
    role: "chief",
    systemRole: "owner",
    passwordHash: await hashPassword(parsed.data.password),
    avatarUrl: "",
    avatarTone: "primary",
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  const session = createSession(user.id);
  store.sessions.push(session);
  pruneSessions(store);
  await writeStore(store);
  setSessionCookie(res, session.id);
  res.status(201).json(authResponse(user));
});

router.post("/signup-staff", async (req, res) => {
  const parsed = staffSignupSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const isDev = process.env.NODE_ENV !== "production";
  const requiredKey = isDev
    ? process.env.STAFF_SIGNUP_KEY || process.env.CHIEF_BOOTSTRAP_KEY || process.env.STAFF_ACCESS_CODE || process.env.VITE_STAFF_ACCESS_CODE
    : process.env.STAFF_SIGNUP_KEY || process.env.CHIEF_BOOTSTRAP_KEY || process.env.STAFF_ACCESS_CODE;
  if (!isDev && (!requiredKey || parsed.data.setupKey !== requiredKey)) {
    return res.status(403).json(errorBody("Staff signup requires a valid setup key."));
  }

  const store = await readStore();
  const email = parsed.data.email.toLowerCase();
  const existingStaffUser = store.users.find((user) => user.email.toLowerCase() === email);
  if (existingStaffUser) {
    if (isDev && await verifyPassword(parsed.data.password, existingStaffUser.passwordHash)) {
      const role = parsed.data.role;
      existingStaffUser.name = parsed.data.name;
      existingStaffUser.company = parsed.data.company;
      existingStaffUser.role = role;
      existingStaffUser.systemRole = role === "chief" ? "owner" : "pm";
      existingStaffUser.avatarTone = role === "chief" ? "primary" : "blue";
      await notifyChiefsAboutStaffSignup(existingStaffUser);
      const session = createSession(existingStaffUser.id);
      store.sessions.push(session);
      pruneSessions(store);
      await writeStore(store);
      setSessionCookie(res, session.id);
      return res.status(200).json(authResponse(existingStaffUser));
    }
    return res.status(409).json(errorBody("An account already exists for this email."));
  }

  const role = parsed.data.role;
  const user: StoredAuthUser = {
    id: `user-${Date.now()}-${randomBytes(4).toString("hex")}`,
    name: parsed.data.name,
    company: parsed.data.company,
    email,
    role,
    systemRole: role === "chief" ? "owner" : "pm",
    passwordHash: await hashPassword(parsed.data.password),
    avatarUrl: "",
    avatarTone: role === "chief" ? "primary" : "blue",
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  await notifyChiefsAboutStaffSignup(user);
  const session = createSession(user.id);
  store.sessions.push(session);
  pruneSessions(store);
  await writeStore(store);
  setSessionCookie(res, session.id);
  res.status(201).json(authResponse(user));
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const email = parsed.data.email.toLowerCase();
  const attemptKey = loginAttemptKey(req, email);
  const user = store.users.find((item) => item.email.toLowerCase() === email);
  const locked = loginLock(store, attemptKey);
  if (locked) {
    if (process.env.NODE_ENV !== "production" && user && await verifyPassword(parsed.data.password, user.passwordHash)) {
      clearFailedLogin(store, attemptKey);
    } else {
    return res.status(429).json(errorBody(`Too many login attempts. Try again in ${Math.ceil(locked / 1000)} seconds.`));
    }
  }
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    recordFailedLogin(store, attemptKey);
    await writeStore(store);
    return res.status(401).json(errorBody("Invalid email or password."));
  }

  clearFailedLogin(store, attemptKey);
  const session = createSession(user.id);
  store.sessions.push(session);
  pruneSessions(store);
  await writeStore(store);
  setSessionCookie(res, session.id);
  res.json(authResponse(user));
});

router.post("/refresh", async (req, res) => {
  const auth = await currentAuth(req);
  if (!auth) return res.status(401).json(errorBody("Session expired."));
  auth.session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  auth.store.sessions = auth.store.sessions.map((session) => session.id === auth.session.id ? auth.session : session);
  await writeStore(auth.store);
  setSessionCookie(res, auth.session.id);
  res.json({ ok: true });
});

router.post("/logout", async (req, res) => {
  const sessionId = readCookie(req, SESSION_COOKIE);
  if (sessionId) {
    const store = await readStore();
    store.sessions = store.sessions.filter((session) => session.id !== sessionId);
    await writeStore(store);
  }
  clearSessionCookie(res);
  res.status(204).end();
});

accountRouter.get("/settings", async (req, res) => {
  const auth = await currentAuth(req);
  if (!auth) return res.status(401).json(errorBody("Not signed in."));
  res.json(accountSettings(auth.user));
});

accountRouter.put("/settings", async (req, res) => {
  const parsed = accountSettingsSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const auth = await currentAuth(req);
  if (!auth) return res.status(401).json(errorBody("Not signed in."));
  const { user, store } = auth;
  const profile = parsed.data.profile;
  if (profile?.email && profile.email.toLowerCase() !== user.email.toLowerCase()) {
    const nextEmail = profile.email.toLowerCase();
    if (store.users.some((item) => item.id !== user.id && item.email.toLowerCase() === nextEmail)) {
      return res.status(409).json(errorBody("An account already exists for this email."));
    }
    user.email = nextEmail;
  }
  if (profile?.name) user.name = profile.name;
  if (profile?.phone !== undefined) user.phone = profile.phone;
  if (profile?.avatarTone !== undefined) user.avatarTone = profile.avatarTone;
  if (profile?.avatarUrl !== undefined) user.avatarUrl = profile.avatarUrl;
  user.notifications = { ...defaultNotifications(), ...(user.notifications ?? {}), ...(parsed.data.notifications ?? {}) };
  user.appearance = { ...defaultAppearance(), ...(user.appearance ?? {}), ...(parsed.data.appearance ?? {}) };
  user.security = { ...defaultSecurity(), ...(user.security ?? {}), ...(parsed.data.security ?? {}) };
  await writeStore(store);
  res.json(accountSettings(user));
});

accountRouter.put("/avatar", async (req, res) => {
  const parsed = avatarSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const auth = await currentAuth(req);
  if (!auth) return res.status(401).json(errorBody("Not signed in."));
  auth.user.avatarUrl = parsed.data.avatarUrl;
  auth.user.avatarTone = parsed.data.avatarTone;
  await writeStore(auth.store);
  res.json(accountSettings(auth.user));
});

accountRouter.put("/password", async (req, res) => {
  const parsed = passwordUpdateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const auth = await currentAuth(req);
  if (!auth) return res.status(401).json(errorBody("Not signed in."));
  if (!(await verifyPassword(parsed.data.currentPassword, auth.user.passwordHash))) {
    return res.status(403).json(errorBody("Current password is incorrect."));
  }
  auth.user.passwordHash = await hashPassword(parsed.data.newPassword);
  const currentSessionId = readCookie(req, SESSION_COOKIE);
  auth.store.sessions = auth.store.sessions.filter((session) => session.userId !== auth.user.id || session.id === currentSessionId);
  await writeStore(auth.store);
  res.status(204).end();
});

accountRouter.get("/sessions", async (req, res) => {
  const auth = await currentAuth(req);
  if (!auth) return res.status(401).json(errorBody("Not signed in."));
  const currentSessionId = readCookie(req, SESSION_COOKIE);
  res.json({
    sessions: auth.store.sessions
      .filter((session) => session.userId === auth.user.id)
      .map((session) => formatSession(session, session.id === currentSessionId)),
  });
});

accountRouter.delete("/sessions/:sessionId", async (req, res) => {
  const auth = await currentAuth(req);
  if (!auth) return res.status(401).json(errorBody("Not signed in."));
  const currentSessionId = readCookie(req, SESSION_COOKIE);
  if (req.params.sessionId === currentSessionId) {
    return res.status(400).json(errorBody("The current session cannot be revoked from this list."));
  }
  const before = auth.store.sessions.length;
  auth.store.sessions = auth.store.sessions.filter((session) => !(session.userId === auth.user.id && session.id === req.params.sessionId));
  await writeStore(auth.store);
  res.json({ revoked: before - auth.store.sessions.length });
});

async function readStore() {
  return readJsonStore<AuthStore>(STORE_KEY, seedStore);
}

async function writeStore(store: AuthStore) {
  await writeJsonStore(STORE_KEY, store);
}

async function currentAuth(req: Request) {
  const sessionId = readCookie(req, SESSION_COOKIE);
  if (!sessionId) return null;
  const store = await readStore();
  pruneSessions(store);
  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) {
    await writeStore(store);
    return null;
  }
  const user = store.users.find((item) => item.id === session.userId);
  if (!user) {
    store.sessions = store.sessions.filter((item) => item.id !== session.id);
    await writeStore(store);
    return null;
  }
  await writeStore(store);
  return { store, session, user };
}

export async function authenticatedUserFromRequest(req: Request) {
  const auth = await currentAuth(req);
  if (!auth) return null;
  return {
    id: auth.user.id,
    name: auth.user.name,
    email: auth.user.email,
    role: auth.user.role,
    systemRole: auth.user.systemRole,
    company: auth.user.agency || auth.user.company,
  };
}

function authResponse(user: StoredAuthUser) {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      systemRole: user.systemRole,
      avatarUrl: user.avatarUrl,
      avatarTone: user.avatarTone,
    },
    organization: {
      name: user.agency || user.company,
      slug: "ens-demo-agency",
    },
  };
}

function accountSettings(user: StoredAuthUser) {
  return {
    profile: {
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      role: roleLabel(user.role),
      avatarTone: user.avatarTone,
      avatarUrl: user.avatarUrl,
    },
    notifications: { ...defaultNotifications(), ...(user.notifications ?? {}) },
    appearance: { ...defaultAppearance(), ...(user.appearance ?? {}) },
    security: { ...defaultSecurity(), ...(user.security ?? {}) },
  };
}

function defaultNotifications() {
  return {
    assignments: true,
    milestones: true,
    reports: false,
    system: true,
  };
}

function defaultAppearance() {
  return {
    theme: "system" as const,
    compact: false,
    language: "en",
  };
}

function defaultSecurity() {
  return {
    twoFactorEnabled: false,
    recoveryCodes: [] as string[],
  };
}

function roleLabel(role: UserRole) {
  if (role === "chief") return "Chief manager";
  if (role === "pm") return "Project manager";
  return "Client";
}

function formatSession(session: StoredSession, current: boolean) {
  return {
    id: session.id,
    device: "Browser session",
    location: "Current device",
    lastActive: session.createdAt,
    expiresAt: session.expiresAt,
    current,
  };
}

function createSession(userId: string): StoredSession {
  return {
    id: `sess-${randomBytes(24).toString("hex")}`,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function pruneSessions(store: AuthStore) {
  const now = Date.now();
  store.sessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
  store.loginAttempts = (store.loginAttempts ?? []).filter((attempt) => {
    const lockedUntil = attempt.lockedUntil ? new Date(attempt.lockedUntil).getTime() : 0;
    const firstAttempt = new Date(attempt.firstAttemptAt).getTime();
    return lockedUntil > now || firstAttempt + LOGIN_WINDOW_MS > now;
  });
}

function loginAttemptKey(req: Request, email: string) {
  const forwarded = String(req.header("x-forwarded-for") || "").split(",")[0]?.trim();
  const ip = forwarded || req.ip || req.socket.remoteAddress || "unknown";
  return `${email}:${ip}`;
}

function loginLock(store: AuthStore, key: string) {
  pruneSessions(store);
  const attempt = (store.loginAttempts ?? []).find((item) => item.key === key);
  if (!attempt?.lockedUntil) return 0;
  return Math.max(0, new Date(attempt.lockedUntil).getTime() - Date.now());
}

function recordFailedLogin(store: AuthStore, key: string) {
  pruneSessions(store);
  store.loginAttempts ??= [];
  const now = new Date();
  const existing = store.loginAttempts.find((attempt) => attempt.key === key);
  if (!existing) {
    store.loginAttempts.push({ key, count: 1, firstAttemptAt: now.toISOString(), lockedUntil: null });
    return;
  }
  existing.count += 1;
  if (existing.count >= MAX_LOGIN_ATTEMPTS) {
    existing.lockedUntil = new Date(Date.now() + LOGIN_LOCK_MS).toISOString();
  }
}

function clearFailedLogin(store: AuthStore, key: string) {
  store.loginAttempts = (store.loginAttempts ?? []).filter((attempt) => attempt.key !== key);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

function readCookie(req: Request, name: string) {
  const raw = req.header("cookie");
  if (!raw) return null;
  const cookies = raw.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const value = cookies.find((cookie) => cookie.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

function badRequest(res: Response, error: z.ZodError) {
  return res.status(400).json({
    error: {
      message: "Invalid request body.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

function errorBody(message: string) {
  return { error: { message } };
}

async function seedStaffJsonStoreData(company: string, name: string, role: string) {
  const STORE_KEY = "core";
  const seedStore: any = {
    projects: [],
    clients: [],
    activity: [],
    workspaces: {},
    tasks: [],
    calendarEvents: [],
  };
  
  const store = await readJsonStore<any>(STORE_KEY, seedStore);
  
  if (!store.projects) store.projects = [];
  if (!store.clients) store.clients = [];
  if (!store.activity) store.activity = [];
  if (!store.workspaces) store.workspaces = {};
  if (!store.tasks) store.tasks = [];
  if (!store.calendarEvents) store.calendarEvents = [];

  // Remove any pre-existing projects/clients/tasks/activity for this company name to avoid duplicates
  store.projects = store.projects.filter((p: any) => !p.agency || p.agency.trim().toLowerCase() !== company.trim().toLowerCase());
  store.clients = store.clients.filter((c: any) => !c.agency || c.agency.trim().toLowerCase() !== company.trim().toLowerCase());
  store.tasks = store.tasks.filter((t: any) => !t.agency || t.agency.trim().toLowerCase() !== company.trim().toLowerCase());
  store.activity = store.activity.filter((act: any) => {
    if (!act.project) return true;
    const project = store.projects.find((p: any) => p.name === act.project);
    if (!project) return true;
    return !project.agency || project.agency.trim().toLowerCase() !== company.trim().toLowerCase();
  });

  const pmName = role === "pm" ? name : "Jane Project Manager";

  // 1. Seed 3 Clients
  const client1Id = `c1-${Date.now()}`;
  const client2Id = `c2-${Date.now()}`;
  const client3Id = `c3-${Date.now()}`;

  const c1: any = {
    id: client1Id,
    name: "Acme Corp",
    company: "Acme Corp",
    contactName: "John Acme",
    contactEmail: `john@acme.${client1Id.slice(-4)}.com`,
    projectId: `p1-${Date.now()}`,
    pm: pmName,
    exhibition: "Tech Expo 2026",
    status: "Active",
    lastActivity: "2h ago",
    agency: company,
  };

  const c2: any = {
    id: client2Id,
    name: "Globex Showcase",
    company: "Globex Showcase",
    contactName: "Hank Globex",
    contactEmail: `hank@globex.${client2Id.slice(-4)}.com`,
    projectId: `p2-${Date.now()}`,
    pm: pmName,
    exhibition: "Global Fair 2026",
    status: "Active",
    lastActivity: "1d ago",
    agency: company,
  };

  const c3: any = {
    id: client3Id,
    name: "Initech Labs",
    company: "Initech Labs",
    contactName: "Peter Initech",
    contactEmail: `peter@initech.${client3Id.slice(-4)}.com`,
    projectId: `p3-${Date.now()}`,
    pm: pmName,
    exhibition: "Initech Expo 2026",
    status: "Pending",
    lastActivity: "Just now",
    agency: company,
  };

  store.clients.push(c1, c2, c3);

  // 2. Seed 3 Projects
  const p1: any = {
    id: c1.projectId,
    name: "Acme Exhibition Stand",
    client: "Acme Corp",
    pm: pmName,
    status: "Active",
    health: "On Track",
    progress: 45,
    deadline: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    system: "Octanorm",
    dimensions: "6 x 4 m",
    exhibition: "Tech Expo 2026",
    standType: "Octanorm",
    description: "Modular exhibition stand with graphic panels.",
    pipelineStage: "design",
    lifecycleHistory: [],
    lastUpdate: "2h ago",
    agency: company,
  };

  const p2: any = {
    id: c2.projectId,
    name: "Globex Summit Booth",
    client: "Globex Showcase",
    pm: pmName,
    status: "Completed",
    health: "On Track",
    progress: 100,
    deadline: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    system: "Maxima",
    dimensions: "8 x 5 m",
    exhibition: "Global Fair 2026",
    standType: "Maxima",
    description: "Double height premium presentation stand.",
    pipelineStage: "closed",
    lifecycleHistory: [],
    lastUpdate: "1d ago",
    agency: company,
  };

  const p3: any = {
    id: c3.projectId,
    name: "Initech Custom Space",
    client: "Initech Labs",
    pm: pmName,
    status: "Delayed",
    health: "Delayed",
    progress: 20,
    deadline: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    system: "Custom",
    dimensions: "4 x 3 m",
    exhibition: "Initech Expo 2026",
    standType: "Custom",
    description: "Bespoke wooden design layout.",
    pipelineStage: "review",
    lifecycleHistory: [],
    lastUpdate: "Just now",
    agency: company,
  };

  store.projects.push(p1, p2, p3);

  // 3. Seed workspaces
  const w1: any = {
    designId: `design-${p1.id}`,
    designName: `${p1.name} design`,
    widthMm: 6000,
    depthMm: 4000,
    heightMm: 2500,
    currentVersionId: `v-${p1.id}`,
    versions: [
      {
        id: `v-${p1.id}`,
        versionNumber: 1,
        status: "submitted",
        title: "Initial concept layout",
        snapshotUrl: null,
        assetSummary: {},
        costEstimateCents: 3500000,
        submittedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        lockedAt: null,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        workspace: { gridMm: 1000, boothSystem: "octanorm", dimensions: { widthMm: 6000, depthMm: 4000, heightMm: 2500 }, objects: [] },
      }
    ],
    revisionCount: 0,
    revisionLimit: 3,
    elementStatus: {},
    approved: false,
    comments: [
      {
        id: `comment-${Date.now()}`,
        user: pmName,
        initials: "PM",
        text: "Please review the structure heights.",
        type: "comment",
        status: "open",
        resolvedAt: null,
        createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      }
    ],
  };

  const w2: any = {
    designId: `design-${p2.id}`,
    designName: `${p2.name} design`,
    widthMm: 8000,
    depthMm: 5000,
    heightMm: 4000,
    currentVersionId: `v-${p2.id}`,
    versions: [
      {
        id: `v-${p2.id}`,
        versionNumber: 1,
        status: "approved",
        title: "Final build version",
        snapshotUrl: null,
        assetSummary: {},
        costEstimateCents: 6200000,
        submittedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        lockedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
        workspace: { gridMm: 1000, boothSystem: "maxima", dimensions: { widthMm: 8000, depthMm: 5000, heightMm: 4000 }, objects: [] },
      }
    ],
    revisionCount: 1,
    revisionLimit: 3,
    elementStatus: {},
    approved: true,
    comments: [],
  };

  const w3: any = {
    designId: `design-${p3.id}`,
    designName: `${p3.name} design`,
    widthMm: 4000,
    depthMm: 3000,
    heightMm: 2500,
    currentVersionId: `v-${p3.id}`,
    versions: [
      {
        id: `v-${p3.id}`,
        versionNumber: 1,
        status: "submitted",
        title: "Review draft",
        snapshotUrl: null,
        assetSummary: {},
        costEstimateCents: 1500000,
        submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        lockedAt: null,
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        workspace: { gridMm: 1000, boothSystem: "custom", dimensions: { widthMm: 4000, depthMm: 3000, heightMm: 2500 }, objects: [] },
      }
    ],
    revisionCount: 0,
    revisionLimit: 3,
    elementStatus: {},
    approved: false,
    comments: [],
  };

  store.workspaces[p1.id] = w1;
  store.workspaces[p2.id] = w2;
  store.workspaces[p3.id] = w3;

  // 4. Seed tasks
  store.tasks.push(
    {
      id: `t1-${Date.now()}`,
      title: "Design initial concept layout",
      client: "Acme Corp",
      project: "Acme Exhibition Stand",
      projectId: p1.id,
      priority: "High",
      deadline: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
      col: "done",
      notes: "Create 3D octanorm mockups.",
      agency: company,
    },
    {
      id: `t2-${Date.now()}`,
      title: "Review materials quote",
      client: "Acme Corp",
      project: "Acme Exhibition Stand",
      projectId: p1.id,
      priority: "Medium",
      deadline: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      col: "in_progress",
      notes: "Check prices for PVC panels.",
      agency: company,
    },
    {
      id: `t3-${Date.now()}`,
      title: "Submit budget proposal",
      client: "Acme Corp",
      project: "Acme Exhibition Stand",
      projectId: p1.id,
      priority: "High",
      deadline: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      col: "todo",
      notes: "Send total cost estimation.",
      agency: company,
    },
    {
      id: `t4-${Date.now()}`,
      title: "Setup structure frame",
      client: "Initech Labs",
      project: "Initech Custom Space",
      projectId: p3.id,
      priority: "High",
      deadline: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
      col: "todo",
      notes: "Assemble the booth space frame.",
      agency: company,
    },
    {
      id: `t5-${Date.now()}`,
      title: "Prepare graphic assets",
      client: "Initech Labs",
      project: "Initech Custom Space",
      projectId: p3.id,
      priority: "Medium",
      deadline: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      col: "todo",
      notes: "Review print resolution.",
      agency: company,
    }
  );

  // 5. Seed activity
  store.activity.push(
    {
      id: `act1-${Date.now()}`,
      type: "project_created",
      user: name,
      action: "created project",
      project: p1.name,
      time: "5d ago",
    },
    {
      id: `act2-${Date.now()}`,
      type: "layout_updated",
      user: pmName,
      action: "saved booth layout v1",
      project: p1.name,
      time: "3d ago",
    },
    {
      id: `act3-${Date.now()}`,
      type: "approval_requested",
      user: pmName,
      action: "requested layout approval",
      project: p1.name,
      time: "1d ago",
    }
  );

  // 6. Seed calendarEvents
  store.calendarEvents.push(
    {
      id: `cal1-${Date.now()}`,
      name: "Tech Expo 2026",
      client: "Acme Corp",
      pm: pmName,
      status: "Active",
      startDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 19 * 86400000).toISOString().slice(0, 10),
      location: "London Excel Center",
      standType: "Octanorm",
      agency: company,
    },
    {
      id: `cal2-${Date.now()}`,
      name: "Global Fair 2026",
      client: "Globex Showcase",
      pm: pmName,
      status: "Completed",
      startDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
      endDate: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
      location: "Frankfurt Messe",
      standType: "Maxima",
      agency: company,
    }
  );

  await writeJsonStore(STORE_KEY, store);
}

export default router;
