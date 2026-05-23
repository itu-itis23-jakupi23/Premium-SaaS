import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useTheme } from "@/components/theme-provider";
import { useAuth, type AuthUser, type UserRole } from "@/contexts/AuthContext";
import {
  getAccountSessions,
  getAccountSettings,
  revokeAccountSession,
  saveAccountAvatar,
  saveAccountSettings,
  updateAccountPassword,
  type AccountSession,
} from "@/lib/platform-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Camera,
  CheckCircle2,
  Download,
  Globe,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Mail,
  Palette,
  RefreshCcw,
  Save,
  Shield,
  Smartphone,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";
type AvatarTone = "primary" | "blue" | "green" | "amber";
type NotificationKey = "assignments" | "milestones" | "reports" | "system";

interface ProfileState {
  name: string;
  email: string;
  phone: string;
  role: string;
  avatarTone: AvatarTone;
  avatarUrl: string;
}

interface NotificationState {
  assignments: boolean;
  milestones: boolean;
  reports: boolean;
  system: boolean;
}

interface AppearanceState {
  theme: ThemeMode;
  compact: boolean;
  language: string;
}

interface StoredSettings {
  profile: ProfileState;
  notifications: NotificationState;
  appearance: AppearanceState;
  twoFactorEnabled: boolean;
  recoveryCodes: string[];
  sessions: AccountSession[];
}

interface ChiefSettingsProps {
  role?: UserRole;
  sectionLabel?: string;
}

const FALLBACK_SETTINGS: StoredSettings = {
  profile: {
    name: "Account User",
    email: "account@ens.test",
    phone: "",
    role: "Account",
    avatarTone: "primary",
    avatarUrl: "",
  },
  notifications: {
    assignments: true,
    milestones: true,
    reports: true,
    system: true,
  },
  appearance: {
    theme: "dark",
    compact: false,
    language: "English (US)",
  },
  twoFactorEnabled: false,
  recoveryCodes: [],
  sessions: [
    { id: "s1", device: "Chrome on Windows", location: "Istanbul, TR", lastActive: "Now", current: true },
    { id: "s2", device: "Safari on iPhone", location: "Istanbul, TR", lastActive: "Yesterday", current: false },
    { id: "s3", device: "Edge on Windows", location: "Berlin, DE", lastActive: "May 19, 2026", current: false },
  ],
};

const AVATAR_TONES: Array<{ value: AvatarTone; label: string; className: string }> = [
  { value: "primary", label: "Primary", className: "bg-primary/20 text-primary border-primary" },
  { value: "blue", label: "Blue", className: "bg-blue-500/15 text-blue-400 border-blue-500" },
  { value: "green", label: "Green", className: "bg-green-500/15 text-green-400 border-green-500" },
  { value: "amber", label: "Amber", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500" },
];

const NOTIFICATION_ITEMS: Array<{ key: NotificationKey; title: string; desc: string }> = [
  { key: "assignments", title: "New Project Assignments", desc: "Get notified when a new project is created and assigned." },
  { key: "milestones", title: "Project Milestones", desc: "Alerts for completed stages or approval requests." },
  { key: "reports", title: "Manager Activity Reports", desc: "Weekly summary of manager performance and workload." },
  { key: "system", title: "System Alerts", desc: "Critical updates and security notifications." },
];

export default function ChiefSettings({ role = "chief", sectionLabel = roleLabel(role) }: ChiefSettingsProps) {
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const storageKey = `ens-${role}-settings-v1`;
  const defaultSettings = useMemo(() => makeDefaultSettings(role, user), [role, user]);
  const dashboardHref = getDashboardHref(role);
  const readLocalSettings = () => readSettings(storageKey, defaultSettings);
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState<ProfileState>(() => readLocalSettings().profile);
  const [savedProfile, setSavedProfile] = useState<ProfileState>(() => readLocalSettings().profile);
  const [notifications, setNotifications] = useState<NotificationState>(() => readLocalSettings().notifications);
  const [savedNotifications, setSavedNotifications] = useState<NotificationState>(() => readLocalSettings().notifications);
  const [appearance, setAppearance] = useState<AppearanceState>(() => readLocalSettings().appearance);
  const [savedAppearance, setSavedAppearance] = useState<AppearanceState>(() => readLocalSettings().appearance);
  const [security, setSecurity] = useState({ current: "", next: "", confirm: "" });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => readLocalSettings().twoFactorEnabled);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>(() => readLocalSettings().recoveryCodes);
  const [sessions, setSessions] = useState<AccountSession[]>(() => readLocalSettings().sessions);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<AvatarTone>(profile.avatarTone);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const notificationsDirty = JSON.stringify(notifications) !== JSON.stringify(savedNotifications);
  const appearanceDirty = JSON.stringify(appearance) !== JSON.stringify(savedAppearance);
  const enabledNotificationCount = Object.values(notifications).filter(Boolean).length;
  const passwordStrength = useMemo(() => getPasswordStrength(security.next), [security.next]);

  useEffect(() => {
    let mounted = true;

    Promise.all([getAccountSettings(), getAccountSessions()])
      .then(([settings, sessionResponse]) => {
        if (!mounted) return;
        setProfile({
          name: settings.profile.name,
          email: settings.profile.email,
          phone: settings.profile.phone,
          role: settings.profile.role,
          avatarTone: normalizeAvatarTone(settings.profile.avatarTone),
          avatarUrl: settings.profile.avatarUrl,
        });
        setSavedProfile({
          name: settings.profile.name,
          email: settings.profile.email,
          phone: settings.profile.phone,
          role: settings.profile.role,
          avatarTone: normalizeAvatarTone(settings.profile.avatarTone),
          avatarUrl: settings.profile.avatarUrl,
        });
        setNotifications(settings.notifications);
        setSavedNotifications(settings.notifications);
        setAppearance(settings.appearance);
        setSavedAppearance(settings.appearance);
        setTwoFactorEnabled(settings.security.twoFactorEnabled);
        setRecoveryCodes(settings.security.recoveryCodes);
        setSessions(sessionResponse.sessions);
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Settings could not be loaded");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setTheme(appearance.theme);
    document.documentElement.dataset.compact = appearance.compact ? "true" : "false";
  }, [appearance.compact, appearance.theme, setTheme]);

  useEffect(() => {
    persistSettings(storageKey, {
      profile: savedProfile,
      notifications: savedNotifications,
      appearance: savedAppearance,
      twoFactorEnabled,
      recoveryCodes,
      sessions,
    });
  }, [recoveryCodes, savedAppearance, savedNotifications, savedProfile, sessions, storageKey, twoFactorEnabled]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function saveProfile() {
    const error = validateProfile(profile);
    if (error) {
      showToast(error);
      return;
    }

    try {
      const settings = await saveAccountSettings({ profile });
      const nextProfile = {
        ...profile,
        role: settings.profile.role,
        avatarTone: normalizeAvatarTone(settings.profile.avatarTone),
        avatarUrl: settings.profile.avatarUrl,
      };
      setProfile(nextProfile);
      setSavedProfile(nextProfile);
      showToast("Profile changes saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Profile could not be saved");
    }
  }

  function resetProfile() {
    setProfile(savedProfile);
    setAvatarDraft(savedProfile.avatarTone);
    showToast("Profile changes reverted");
  }

  async function saveAvatar() {
    try {
      const nextProfile = { ...profile, avatarTone: avatarDraft };
      const settings = await saveAccountAvatar({ avatarUrl: nextProfile.avatarUrl, avatarTone: nextProfile.avatarTone });
      setProfile((current) => ({
        ...current,
        avatarTone: normalizeAvatarTone(settings.profile.avatarTone),
        avatarUrl: settings.profile.avatarUrl,
      }));
      setSavedProfile((current) => ({
        ...current,
        avatarTone: normalizeAvatarTone(settings.profile.avatarTone),
        avatarUrl: settings.profile.avatarUrl,
      }));
      setAvatarOpen(false);
      showToast("Avatar updated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Avatar could not be saved");
    }
  }

  async function saveNotifications() {
    try {
      const settings = await saveAccountSettings({ notifications });
      setNotifications(settings.notifications);
      setSavedNotifications(settings.notifications);
      showToast("Notification preferences saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Notifications could not be saved");
    }
  }

  function enableAllNotifications() {
    setNotifications({ assignments: true, milestones: true, reports: true, system: true });
    showToast("All notifications enabled");
  }

  function muteNonCritical() {
    setNotifications({ assignments: false, milestones: false, reports: false, system: true });
    showToast("Only system alerts remain enabled");
  }

  async function updatePassword() {
    if (!security.current || !security.next || !security.confirm) {
      showToast("Fill all password fields");
      return;
    }
    if (security.next !== security.confirm) {
      showToast("New passwords do not match");
      return;
    }
    if (passwordStrength.score < 3) {
      showToast("Use a stronger password");
      return;
    }
    if (security.current === security.next) {
      showToast("New password must be different");
      return;
    }

    try {
      await updateAccountPassword({ currentPassword: security.current, newPassword: security.next });
      setSecurity({ current: "", next: "", confirm: "" });
      showToast("Password update saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Password could not be updated");
    }
  }

  function beginTwoFactorSetup() {
    setTwoFactorCode("");
    setTwoFactorOpen(true);
  }

  async function verifyTwoFactor() {
    if (twoFactorCode.trim() !== "246810") {
      showToast("Enter verification code 246810");
      return;
    }

    const codes = makeRecoveryCodes();
    try {
      const settings = await saveAccountSettings({ security: { twoFactorEnabled: true, recoveryCodes: codes } });
      setRecoveryCodes(settings.security.recoveryCodes);
      setTwoFactorEnabled(settings.security.twoFactorEnabled);
      setTwoFactorOpen(false);
      showToast("Two-factor authentication enabled");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Two-factor setup could not be saved");
    }
  }

  async function disableTwoFactor() {
    try {
      const settings = await saveAccountSettings({ security: { twoFactorEnabled: false, recoveryCodes: [] } });
      setTwoFactorEnabled(settings.security.twoFactorEnabled);
      setRecoveryCodes(settings.security.recoveryCodes);
      showToast("Two-factor authentication disabled");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Two-factor status could not be saved");
    }
  }

  async function regenerateRecoveryCodes() {
    if (!twoFactorEnabled) {
      showToast("Enable 2FA before generating recovery codes");
      return;
    }
    try {
      const settings = await saveAccountSettings({ security: { twoFactorEnabled: true, recoveryCodes: makeRecoveryCodes() } });
      setRecoveryCodes(settings.security.recoveryCodes);
      showToast("Recovery codes regenerated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Recovery codes could not be saved");
    }
  }

  async function endSession(id: string) {
    const session = sessions.find((item) => item.id === id);
    if (!session || session.current) return;
    try {
      await revokeAccountSession(id);
      setSessions((current) => current.filter((item) => item.id !== id));
      showToast(`${session.device} signed out`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Session could not be signed out");
    }
  }

  async function endOtherSessions() {
    const otherCount = sessions.filter((session) => !session.current).length;
    if (!otherCount) {
      showToast("No other sessions to sign out");
      return;
    }

    try {
      await Promise.all(sessions.filter((session) => !session.current).map((session) => revokeAccountSession(session.id)));
      setSessions((current) => current.filter((session) => session.current));
      showToast(`${otherCount} session${otherCount === 1 ? "" : "s"} signed out`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Sessions could not be signed out");
    }
  }

  async function saveAppearance() {
    try {
      const settings = await saveAccountSettings({ appearance });
      setAppearance(settings.appearance);
      setSavedAppearance(settings.appearance);
      showToast("Display settings saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Display settings could not be saved");
    }
  }

  function resetAppearance() {
    const next = defaultSettings.appearance;
    setAppearance(next);
    setSavedAppearance(next);
    showToast("Display settings reset");
  }

  function exportSettings() {
    const payload = {
      profile,
      notifications,
      appearance,
      twoFactorEnabled,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${role}-settings.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Settings exported");
  }

  async function resetAllSettings() {
    setProfile(defaultSettings.profile);
    setSavedProfile(defaultSettings.profile);
    setNotifications(defaultSettings.notifications);
    setSavedNotifications(defaultSettings.notifications);
    setAppearance(defaultSettings.appearance);
    setSavedAppearance(defaultSettings.appearance);
    setTwoFactorEnabled(defaultSettings.twoFactorEnabled);
    setRecoveryCodes(defaultSettings.recoveryCodes);
    setSessions(defaultSettings.sessions);
    setSecurity({ current: "", next: "", confirm: "" });
    setAvatarDraft(defaultSettings.profile.avatarTone);
    setResetOpen(false);
    localStorage.removeItem(storageKey);
    try {
      await saveAccountSettings({
        profile: defaultSettings.profile,
        notifications: defaultSettings.notifications,
        appearance: defaultSettings.appearance,
        security: { twoFactorEnabled: false, recoveryCodes: [] },
      });
      showToast("Settings restored to defaults");
    } catch {
      showToast("Local settings restored to defaults");
    }
  }

  function setAvatarImageFromFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file");
      return;
    }
    if (file.size > 1_500_000) {
      showToast("Choose an image under 1.5 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfile((current) => ({ ...current, avatarUrl: String(reader.result ?? "") }));
      showToast("Profile picture selected");
    };
    reader.readAsDataURL(file);
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          breadcrumbs={[{ label: sectionLabel, href: dashboardHref }, { label: "Settings" }]}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportSettings}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </div>
        </PageHeader>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-card/50 backdrop-blur-sm border p-1 h-auto grid grid-cols-2 md:grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="profile" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
              <User className="h-4 w-4" /> Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
              <Bell className="h-4 w-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
              <Shield className="h-4 w-4" /> Security
            </TabsTrigger>
            <TabsTrigger value="appearance" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
              <Palette className="h-4 w-4" /> Appearance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal and professional details</CardDescription>
                  </div>
                  {profileDirty && <Badge variant="outline" className="border-yellow-500 text-yellow-500">Unsaved</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <AvatarPreview name={profile.name} tone={profile.avatarTone} avatarUrl={profile.avatarUrl} size="lg" />
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setAvatarDraft(profile.avatarTone); setAvatarOpen(true); }}>
                        <Camera className="mr-2 h-4 w-4" /> Change Avatar
                      </Button>
                      <Label className="inline-flex min-h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-xs font-medium">
                        Upload Picture
                        <Input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => setAvatarImageFromFile(event.target.files?.[0] ?? null)}
                        />
                      </Label>
                    </div>
                  </div>
                  <div className="flex-1 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Input id="role" value={profile.role} disabled className="bg-muted/30" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} placeholder="+1 (555) 000-0000" className="bg-muted/50" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={resetProfile} disabled={!profileDirty}>Revert</Button>
                  <Button onClick={saveProfile} disabled={!profileDirty} data-testid="button-save-profile">
                    <Save className="mr-2 h-4 w-4" /> Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Email Notifications</CardTitle>
                    <CardDescription>Configure which updates you want to receive via email</CardDescription>
                  </div>
                  <Badge variant="secondary">{enabledNotificationCount}/4 enabled</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {NOTIFICATION_ITEMS.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 py-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch
                        checked={notifications[item.key]}
                        onCheckedChange={(checked) => setNotifications((current) => ({ ...current, [item.key]: checked }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={enableAllNotifications}>
                      <Mail className="mr-2 h-4 w-4" /> Enable All
                    </Button>
                    <Button variant="outline" size="sm" onClick={muteNonCritical}>
                      <Bell className="mr-2 h-4 w-4" /> Critical Only
                    </Button>
                  </div>
                  <Button onClick={saveNotifications} disabled={!notificationsDirty} data-testid="button-save-notifications">
                    <Save className="mr-2 h-4 w-4" /> Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your password and account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-pass">Current Password</Label>
                    <Input id="current-pass" type="password" value={security.current} onChange={(event) => setSecurity((current) => ({ ...current, current: event.target.value }))} className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pass">New Password</Label>
                    <Input id="new-pass" type="password" value={security.next} onChange={(event) => setSecurity((current) => ({ ...current, next: event.target.value }))} className="bg-muted/50" />
                    <PasswordMeter strength={passwordStrength} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pass">Confirm New Password</Label>
                    <Input id="confirm-pass" type="password" value={security.confirm} onChange={(event) => setSecurity((current) => ({ ...current, confirm: event.target.value }))} className="bg-muted/50" />
                  </div>
                  <Button onClick={updatePassword} data-testid="button-update-password">
                    <Lock className="mr-2 h-4 w-4" /> Update Password
                  </Button>
                </div>

                <div className="flex flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Two-Factor Authentication</p>
                      <Badge variant={twoFactorEnabled ? "default" : "outline"}>{twoFactorEnabled ? "Enabled" : "Disabled"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Use a verification code for sensitive account actions.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {twoFactorEnabled ? (
                      <>
                        <Button variant="outline" size="sm" onClick={regenerateRecoveryCodes}>
                          <KeyRound className="mr-2 h-4 w-4" /> New Recovery Codes
                        </Button>
                        <Button variant="outline" size="sm" onClick={disableTwoFactor}>Disable 2FA</Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={beginTwoFactorSetup}>Enable 2FA</Button>
                    )}
                  </div>
                </div>

                {twoFactorEnabled && recoveryCodes.length > 0 && (
                  <div className="rounded-lg border bg-background/40 p-4">
                    <p className="mb-3 text-sm font-medium">Recovery Codes</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {recoveryCodes.map((code) => (
                        <code key={code} className="rounded-md bg-muted px-3 py-2 text-xs">{code}</code>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 border-t pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Active Sessions</p>
                      <p className="text-xs text-muted-foreground">Review devices currently signed into this account.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={endOtherSessions}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out Others
                    </Button>
                  </div>
                  <div className="grid gap-3">
                    {sessions.map((session) => (
                      <div key={session.id} className="flex flex-col gap-3 rounded-lg border bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          {session.device.includes("iPhone") ? <Smartphone className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <Laptop className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                          <div>
                            <p className="text-sm font-medium">{session.device} {session.current && <span className="text-xs text-primary">(current)</span>}</p>
                            <p className="text-xs text-muted-foreground">{session.location} / {session.lastActive}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => endSession(session.id)} disabled={session.current}>
                          Sign Out
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Display Settings</CardTitle>
                    <CardDescription>Customize the look and feel of your dashboard</CardDescription>
                  </div>
                  {appearanceDirty && <Badge variant="outline" className="border-yellow-500 text-yellow-500">Unsaved</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Theme Mode</p>
                      <p className="text-xs text-muted-foreground">Switch between light, dark, and system themes.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                      <Button variant={appearance.theme === "light" ? "secondary" : "ghost"} size="sm" className="h-8" onClick={() => setAppearance((current) => ({ ...current, theme: "light" }))}>Light</Button>
                      <Button variant={appearance.theme === "dark" ? "secondary" : "ghost"} size="sm" className="h-8" onClick={() => setAppearance((current) => ({ ...current, theme: "dark" }))}>Dark</Button>
                      <Button variant={appearance.theme === "system" ? "secondary" : "ghost"} size="sm" className="h-8" onClick={() => setAppearance((current) => ({ ...current, theme: "system" }))}>System</Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Compact View</p>
                      <p className="text-xs text-muted-foreground">Reduce spacing in tables and lists.</p>
                    </div>
                    <Switch checked={appearance.compact} onCheckedChange={(checked) => setAppearance((current) => ({ ...current, compact: checked }))} />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Language</p>
                      <p className="text-xs text-muted-foreground">Select your preferred display language.</p>
                    </div>
                    <Select value={appearance.language} onValueChange={(language) => setAppearance((current) => ({ ...current, language }))}>
                      <SelectTrigger className="w-full sm:w-[190px]">
                        <Globe className="mr-2 h-4 w-4" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English (US)">English (US)</SelectItem>
                        <SelectItem value="Turkish (TR)">Turkish (TR)</SelectItem>
                        <SelectItem value="German (DE)">German (DE)</SelectItem>
                        <SelectItem value="Italian (IT)">Italian (IT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={resetAppearance}>Reset Display</Button>
                  <Button onClick={saveAppearance} disabled={!appearanceDirty}>
                    <Save className="mr-2 h-4 w-4" /> Save Display Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Avatar</DialogTitle>
              <DialogDescription>Choose a local avatar style for this account profile.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {AVATAR_TONES.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  onClick={() => setAvatarDraft(tone.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/60",
                    avatarDraft === tone.value && "border-primary bg-primary/5",
                  )}
                >
                  <AvatarPreview name={profile.name} tone={tone.value} avatarUrl={profile.avatarUrl} size="sm" />
                  <span className="text-sm font-medium">{tone.label}</span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAvatarOpen(false)}>Cancel</Button>
              <Button onClick={saveAvatar}>Apply Avatar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
              <DialogDescription>Enter the demo verification code to finish setup.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Demo authenticator code</p>
                <p className="mt-2 text-2xl font-bold tracking-[0.35em]">246810</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="two-factor-code">Verification Code</Label>
                <Input id="two-factor-code" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} placeholder="246810" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTwoFactorOpen(false)}>Cancel</Button>
              <Button onClick={verifyTwoFactor}>Verify & Enable</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Settings</DialogTitle>
              <DialogDescription>This restores local account settings to the default demo values.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={resetAllSettings}>Reset Settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function AvatarPreview({ name, tone, avatarUrl, size }: { name: string; tone: AvatarTone; avatarUrl: string; size: "sm" | "lg" }) {
  const toneClass = AVATAR_TONES.find((item) => item.value === tone)?.className ?? AVATAR_TONES[0].className;
  return (
    <div className={cn(
      "flex items-center justify-center overflow-hidden rounded-full border-2 border-dashed font-bold",
      toneClass,
      size === "lg" ? "h-24 w-24 text-3xl" : "h-12 w-12 text-base",
    )}>
      {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </div>
  );
}

function PasswordMeter({ strength }: { strength: { score: number; label: string } }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              "h-1 rounded-full bg-muted",
              index < strength.score && strength.score <= 2 && "bg-red-500",
              index < strength.score && strength.score === 3 && "bg-yellow-500",
              index < strength.score && strength.score >= 4 && "bg-green-500",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Strength: {strength.label}</p>
    </div>
  );
}

function makeDefaultSettings(role: UserRole, user: AuthUser | null): StoredSettings {
  return {
    ...FALLBACK_SETTINGS,
    profile: {
      ...FALLBACK_SETTINGS.profile,
      name: user?.name ?? defaultNameForRole(role),
      email: user?.email ?? defaultEmailForRole(role),
      role: user?.systemRole ?? roleLabel(role),
      avatarTone: role === "pm" ? "blue" : role === "client" ? "green" : "primary",
    },
    sessions: FALLBACK_SETTINGS.sessions,
  };
}

function readSettings(storageKey: string, defaults: StoredSettings): StoredSettings {
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      ...defaults,
      ...parsed,
      profile: { ...defaults.profile, ...parsed.profile },
      notifications: { ...defaults.notifications, ...parsed.notifications },
      appearance: { ...defaults.appearance, ...parsed.appearance },
      sessions: parsed.sessions?.length ? parsed.sessions : defaults.sessions,
      recoveryCodes: parsed.recoveryCodes ?? defaults.recoveryCodes,
    };
  } catch {
    return defaults;
  }
}

function persistSettings(storageKey: string, settings: StoredSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

function validateProfile(profile: ProfileState) {
  if (!profile.name.trim()) return "Name is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return "Enter a valid email";
  if (profile.phone && !/^[\d\s()+.-]+$/.test(profile.phone)) return "Enter a valid phone number";
  return "";
}

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ["Empty", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score] };
}

function makeRecoveryCodes() {
  return Array.from({ length: 6 }, (_, index) => {
    const left = Math.floor(1000 + Math.random() * 9000);
    const right = Math.floor(1000 + Math.random() * 9000);
    return `ENS-${index + 1}${left}-${right}`;
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AC";
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function normalizeAvatarTone(value: string): AvatarTone {
  return AVATAR_TONES.some((tone) => tone.value === value) ? value as AvatarTone : "primary";
}

function roleLabel(role: UserRole) {
  if (role === "pm") return "PM";
  if (role === "client") return "Client";
  return "Chief";
}

function defaultNameForRole(role: UserRole) {
  if (role === "pm") return "Project Manager";
  if (role === "client") return "Client Reviewer";
  return "Chief Manager";
}

function defaultEmailForRole(role: UserRole) {
  if (role === "pm") return "pm@ens.test";
  if (role === "client") return "client@ens.test";
  return "owner@ens.test";
}

function getDashboardHref(role: UserRole) {
  if (role === "pm") return "/pm";
  if (role === "client") return "/client";
  return "/chief";
}
