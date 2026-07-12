import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { normalizeThemeMode, readThemePreference, useTheme } from "@/components/theme-provider";
import { useAuth, type AuthUser, type UserRole } from "@/contexts/AuthContext";
import {
  LANGUAGES as I18N_LANGUAGES,
  normalizeLanguageCode,
  readLanguagePreference,
  setLanguagePreference,
  type LangCode,
} from "@/i18n";
import {
  getAccountSessions,
  getAccountSettings,
  getSystemReadiness,
  revokeAccountSession,
  saveAccountAvatar,
  saveAccountSettings,
  updateAccountPassword,
  type AccountSession,
  type SystemReadiness,
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
  AlertCircle,
  Bell,
  Camera,
  CheckCircle2,
  Copy,
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
  ServerCog,
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
  language: LangCode;
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
    email: "",
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
    language: "en",
  },
  twoFactorEnabled: false,
  recoveryCodes: [],
  sessions: [],
};

// Module-level tone classes (className only) — used by AvatarPreview sub-component
const AVATAR_TONE_CLASSES: Record<AvatarTone, string> = {
  primary: "bg-primary/20 text-primary border-primary",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500",
  green: "bg-green-500/15 text-green-400 border-green-500",
  amber: "bg-yellow-500/15 text-yellow-400 border-yellow-500",
};

const LANGUAGE_OPTIONS = I18N_LANGUAGES.map((language) => ({
  value: language.code,
  label: language.settingsLabel,
  flag: language.flag,
}));

export default function ChiefSettings({ role = "chief", sectionLabel = roleLabel(role) }: ChiefSettingsProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const storageKey = `ens-${role}-settings-v1`;
  const defaultSettings = useMemo(() => makeDefaultSettings(role, user), [role, user]);
  const dashboardHref = getDashboardHref(role);
  const readLocalSettings = () => readSettings(storageKey, defaultSettings);

  useEffect(() => {
    document.title = t("chief.settings.pageTitle");
  }, [t]);

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

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
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<AvatarTone>(profile.avatarTone);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [readiness, setReadiness] = useState<SystemReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState("");

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const notificationsDirty = JSON.stringify(notifications) !== JSON.stringify(savedNotifications);
  const appearanceDirty = JSON.stringify(appearance) !== JSON.stringify(savedAppearance);
  const enabledNotificationCount = Object.values(notifications).filter(Boolean).length;
  const passwordStrength = useMemo(() => getPasswordStrength(security.next, t), [security.next, t]);

  // Translated notification items
  const notificationItems = useMemo<Array<{ key: NotificationKey; title: string; desc: string }>>(() => [
    { key: "assignments", title: t("chief.settings.notifications.items.assignments.title"), desc: t("chief.settings.notifications.items.assignments.desc") },
    { key: "milestones",  title: t("chief.settings.notifications.items.milestones.title"),  desc: t("chief.settings.notifications.items.milestones.desc")  },
    { key: "reports",     title: t("chief.settings.notifications.items.reports.title"),     desc: t("chief.settings.notifications.items.reports.desc")     },
    { key: "system",      title: t("chief.settings.notifications.items.system.title"),      desc: t("chief.settings.notifications.items.system.desc")      },
  ], [t]);

  // Translated avatar tones (label + className)
  const localAvatarTones = useMemo<Array<{ value: AvatarTone; label: string; className: string }>>(() => [
    { value: "primary", label: t("chief.settings.profile.avatarTones.primary"), className: AVATAR_TONE_CLASSES.primary },
    { value: "blue",    label: t("chief.settings.profile.avatarTones.blue"),    className: AVATAR_TONE_CLASSES.blue    },
    { value: "green",   label: t("chief.settings.profile.avatarTones.green"),   className: AVATAR_TONE_CLASSES.green   },
    { value: "amber",   label: t("chief.settings.profile.avatarTones.amber"),   className: AVATAR_TONE_CLASSES.amber   },
  ], [t]);

  useEffect(() => {
    let mounted = true;

    setSessionsLoading(true);
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
        const nextAppearance = normalizeAppearance(settings.appearance, defaultSettings.appearance);
        nextAppearance.language = readLanguagePreference();
        setNotifications(settings.notifications);
        setSavedNotifications(settings.notifications);
        setAppearance(nextAppearance);
        setSavedAppearance(nextAppearance);
        setTwoFactorEnabled(settings.security.twoFactorEnabled);
        setRecoveryCodes(settings.security.recoveryCodes);
        setSessions(sessionResponse.sessions);
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : t("chief.settings.profile.toast.loadError"));
      })
      .finally(() => {
        if (mounted) setSessionsLoading(false);
      });

    return () => { mounted = false; };
  }, [defaultSettings.appearance, t]);

  useEffect(() => {
    setTheme(appearance.theme);
    document.documentElement.dataset.compact = appearance.compact ? "true" : "false";
  }, [appearance.compact, appearance.theme, setTheme]);

  useEffect(() => {
    const currentTheme = normalizeThemeMode(theme);
    if (!currentTheme) return;
    setAppearance((current) => current.theme === currentTheme ? current : { ...current, theme: currentTheme });
  }, [theme]);

  useEffect(() => {
    const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language);
    setAppearance((current) => current.language === currentLanguage ? current : { ...current, language: currentLanguage });
    setSavedAppearance((current) => current.language === currentLanguage ? current : { ...current, language: currentLanguage });
  }, [i18n.language, i18n.resolvedLanguage]);

  useEffect(() => {
    persistSettings(storageKey, {
      profile: savedProfile,
      notifications: savedNotifications,
      appearance: savedAppearance,
      twoFactorEnabled,
      recoveryCodes,
      sessions: [],
    });
  }, [recoveryCodes, savedAppearance, savedNotifications, savedProfile, storageKey, twoFactorEnabled]);

  useEffect(() => {
    if (role !== "chief") return;
    void refreshReadiness();
  }, [role]);

  function showToast(message: string) {
    setToastMsg(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2400);
  }

  async function refreshReadiness() {
    setReadinessLoading(true);
    setReadinessError("");
    try {
      setReadiness(await getSystemReadiness());
    } catch (error) {
      setReadinessError(error instanceof Error ? error.message : "Readiness check could not be loaded.");
    } finally {
      setReadinessLoading(false);
    }
  }

  async function saveProfile() {
    const error = validateProfile(profile, t);
    if (error) { showToast(error); return; }

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
      showToast(t("chief.settings.profile.toast.saved"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.profile.toast.saveError"));
    }
  }

  function resetProfile() {
    setProfile(savedProfile);
    setAvatarDraft(savedProfile.avatarTone);
    showToast(t("chief.settings.profile.toast.reverted"));
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
      showToast(t("chief.settings.profile.toast.avatarUpdated"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.profile.toast.avatarError"));
    }
  }

  async function saveNotifications() {
    try {
      const settings = await saveAccountSettings({ notifications });
      setNotifications(settings.notifications);
      setSavedNotifications(settings.notifications);
      showToast(t("chief.settings.notifications.toast.saved"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.notifications.toast.saveError"));
    }
  }

  function enableAllNotifications() {
    setNotifications({ assignments: true, milestones: true, reports: true, system: true });
    showToast(t("chief.settings.notifications.toast.allEnabled"));
  }

  function muteNonCritical() {
    setNotifications({ assignments: false, milestones: false, reports: false, system: true });
    showToast(t("chief.settings.notifications.toast.criticalOnly"));
  }

  async function updatePassword() {
    if (!security.current || !security.next || !security.confirm) {
      showToast(t("chief.settings.security.toast.passwordAllFields")); return;
    }
    if (security.next !== security.confirm) {
      showToast(t("chief.settings.security.toast.passwordMismatch")); return;
    }
    if (passwordStrength.score < 3) {
      showToast(t("chief.settings.security.toast.passwordWeak")); return;
    }
    if (security.current === security.next) {
      showToast(t("chief.settings.security.toast.passwordSame")); return;
    }

    try {
      await updateAccountPassword({ currentPassword: security.current, newPassword: security.next });
      setSecurity({ current: "", next: "", confirm: "" });
      showToast(t("chief.settings.security.toast.passwordSaved"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.security.toast.passwordError"));
    }
  }

  async function disableTwoFactor() {
    try {
      const settings = await saveAccountSettings({ security: { twoFactorEnabled: false, recoveryCodes: [] } });
      setTwoFactorEnabled(settings.security.twoFactorEnabled);
      setRecoveryCodes(settings.security.recoveryCodes);
      showToast(t("chief.settings.security.toast.twoFactorDisabled"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.security.toast.twoFactorDisableError"));
    }
  }

  async function regenerateRecoveryCodes() {
    if (!twoFactorEnabled) {
      showToast(t("chief.settings.security.toast.twoFactorRequired")); return;
    }
    try {
      const settings = await saveAccountSettings({ security: { twoFactorEnabled: true, recoveryCodes: makeRecoveryCodes() } });
      setRecoveryCodes(settings.security.recoveryCodes);
      showToast(t("chief.settings.security.toast.codesRegenerated"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.security.toast.codesError"));
    }
  }

  function copyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join("\n")).then(() => {
      showToast(t("chief.settings.security.toast.codesCopied"));
    }).catch(() => {
      showToast(t("chief.settings.security.toast.clipboardError"));
    });
  }

  async function endSession(id: string) {
    const session = sessions.find((item) => item.id === id);
    if (!session || session.current) return;
    try {
      await revokeAccountSession(id);
      setSessions((current) => current.filter((item) => item.id !== id));
      showToast(t("chief.settings.security.toast.sessionSignedOut", { device: session.device }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.security.toast.sessionError"));
    }
  }

  async function endOtherSessions() {
    const otherCount = sessions.filter((session) => !session.current).length;
    if (!otherCount) {
      showToast(t("chief.settings.security.toast.noOtherSessions")); return;
    }

    try {
      await Promise.all(sessions.filter((session) => !session.current).map((session) => revokeAccountSession(session.id)));
      setSessions((current) => current.filter((session) => session.current));
      showToast(t("chief.settings.security.toast.sessionsSignedOut", { count: otherCount }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.security.toast.sessionsError"));
    }
  }

  async function saveAppearance() {
    const nextAppearance = normalizeAppearance(appearance, defaultSettings.appearance);
    try {
      await setLanguagePreference(nextAppearance.language);
      const settings = await saveAccountSettings({ appearance: nextAppearance });
      const saved = normalizeAppearance(settings.appearance, defaultSettings.appearance);
      saved.language = nextAppearance.language;
      setAppearance(saved);
      setSavedAppearance(saved);
      showToast(t("chief.settings.appearance.toast.saved"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.settings.appearance.toast.saveError"));
    }
  }

  function resetAppearance() {
    const next = defaultSettings.appearance;
    setAppearance(next);
    setSavedAppearance(next);
    void setLanguagePreference(next.language);
    showToast(t("chief.settings.appearance.toast.reset"));
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
    anchor.download = `${role}-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(t("chief.settings.toast.exported"));
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
    setSecurity({ current: "", next: "", confirm: "" });
    setAvatarDraft(defaultSettings.profile.avatarTone);
    setResetOpen(false);
    void setLanguagePreference(defaultSettings.appearance.language);
    localStorage.removeItem(storageKey);
    const otherSessions = sessions.filter((s) => !s.current);
    try {
      await Promise.all([
        saveAccountSettings({
          profile: defaultSettings.profile,
          notifications: defaultSettings.notifications,
          appearance: defaultSettings.appearance,
          security: { twoFactorEnabled: false, recoveryCodes: [] },
        }),
        ...otherSessions.map((s) => revokeAccountSession(s.id)),
      ]);
      setSessions((current) => current.filter((s) => s.current));
      showToast(t("chief.settings.toast.restored"));
    } catch {
      setSessions([]);
      showToast(t("chief.settings.toast.restoredLocal"));
    }
  }

  function setAvatarImageFromFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("chief.settings.profile.toast.imageTypeError")); return;
    }
    if (file.size > 1_500_000) {
      showToast(t("chief.settings.profile.toast.imageSizeError")); return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfile((current) => ({ ...current, avatarUrl: String(reader.result ?? "") }));
      showToast(t("chief.settings.profile.toast.pictureSelected"));
    };
    reader.readAsDataURL(file);
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <PageHeader
          title={t("chief.settings.title")}
          breadcrumbs={[{ label: sectionLabel, href: dashboardHref }, { label: t("chief.settings.breadcrumb") }]}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportSettings}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.export")}
            </Button>
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.reset")}
            </Button>
          </div>
        </PageHeader>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className={cn("bg-card/50 backdrop-blur-sm border p-1 h-auto grid grid-cols-2 md:grid-cols-4", role === "chief" ? "lg:w-[760px] lg:grid-cols-5" : "lg:w-[600px]")}>
            <TabsTrigger value="profile" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
              <User className="h-4 w-4" aria-hidden="true" /> {t("chief.settings.tabs.profile")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
              <Bell className="h-4 w-4" aria-hidden="true" /> {t("chief.settings.tabs.notifications")}
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
              <Shield className="h-4 w-4" aria-hidden="true" /> {t("chief.settings.tabs.security")}
            </TabsTrigger>
            <TabsTrigger value="appearance" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
              <Palette className="h-4 w-4" aria-hidden="true" /> {t("chief.settings.tabs.appearance")}
            </TabsTrigger>
            {role === "chief" && (
              <TabsTrigger value="production" className="data-[state=active]:bg-primary flex items-center gap-2 py-2">
                <ServerCog className="h-4 w-4" aria-hidden="true" /> Production
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{t("chief.settings.profile.title")}</CardTitle>
                    <CardDescription>{t("chief.settings.profile.description")}</CardDescription>
                  </div>
                  {profileDirty && <Badge variant="outline" className="border-yellow-500 text-yellow-500">{t("chief.settings.profile.unsaved")}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <AvatarPreview name={profile.name} tone={profile.avatarTone} avatarUrl={profile.avatarUrl} size="lg" />
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setAvatarDraft(profile.avatarTone); setAvatarOpen(true); }}>
                        <Camera className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.profile.changeAvatar")}
                      </Button>
                      <Label className="inline-flex min-h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-xs font-medium">
                        {t("chief.settings.profile.uploadPicture")}
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
                      <Label htmlFor="name">{t("chief.settings.profile.fullName")}</Label>
                      <Input id="name" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("chief.settings.profile.emailLabel")}</Label>
                      <Input id="email" type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">{t("chief.settings.profile.roleLabel")}</Label>
                      <Input id="role" value={profile.role} disabled className="bg-muted/30" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("chief.settings.profile.phone")}</Label>
                      <Input id="phone" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} placeholder={t("chief.settings.profile.phonePlaceholder")} className="bg-muted/50" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={resetProfile} disabled={!profileDirty}>{t("chief.settings.profile.revert")}</Button>
                  <Button onClick={saveProfile} disabled={!profileDirty} data-testid="button-save-profile">
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.profile.saveChanges")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{t("chief.settings.notifications.title")}</CardTitle>
                    <CardDescription>{t("chief.settings.notifications.description")}</CardDescription>
                  </div>
                  <Badge variant="secondary">{t("chief.settings.notifications.enabledCount", { count: enabledNotificationCount })}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {notificationItems.map((item) => (
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
                      <Mail className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.notifications.enableAll")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={muteNonCritical}>
                      <Bell className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.notifications.criticalOnly")}
                    </Button>
                  </div>
                  <Button onClick={saveNotifications} disabled={!notificationsDirty} data-testid="button-save-notifications">
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.notifications.savePreferences")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security tab */}
          <TabsContent value="security" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle>{t("chief.settings.security.title")}</CardTitle>
                <CardDescription>{t("chief.settings.security.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-pass">{t("chief.settings.security.currentPassword")}</Label>
                    <Input id="current-pass" type="password" value={security.current} onChange={(event) => setSecurity((current) => ({ ...current, current: event.target.value }))} className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pass">{t("chief.settings.security.newPassword")}</Label>
                    <Input id="new-pass" type="password" value={security.next} onChange={(event) => setSecurity((current) => ({ ...current, next: event.target.value }))} className="bg-muted/50" />
                    <PasswordMeter strength={passwordStrength} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pass">{t("chief.settings.security.confirmNewPassword")}</Label>
                    <Input id="confirm-pass" type="password" value={security.confirm} onChange={(event) => setSecurity((current) => ({ ...current, confirm: event.target.value }))} className="bg-muted/50" />
                  </div>
                  <Button onClick={updatePassword} data-testid="button-update-password">
                    <Lock className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.security.updatePassword")}
                  </Button>
                </div>

                <div className="flex flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{t("chief.settings.security.twoFactor.title")}</p>
                      <Badge variant={twoFactorEnabled ? "default" : "outline"}>
                        {twoFactorEnabled ? t("chief.settings.security.twoFactor.enabled") : t("chief.settings.security.twoFactor.disabled")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("chief.settings.security.twoFactor.description")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled>
                      <Lock className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.security.twoFactor.enable")} — Coming Soon
                    </Button>
                  </div>
                </div>

                {twoFactorEnabled && recoveryCodes.length > 0 && (
                  <div className="rounded-lg border bg-background/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">{t("chief.settings.security.recoveryCodes.title")}</p>
                      <Button variant="outline" size="sm" onClick={copyRecoveryCodes}>
                        <Copy className="mr-2 h-3 w-3" aria-hidden="true" /> {t("chief.settings.security.recoveryCodes.copyAll")}
                      </Button>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {t("chief.settings.security.recoveryCodes.description")}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {recoveryCodes.map((code) => (
                        <code key={code} className="rounded-md bg-muted px-3 py-2 text-xs font-mono">{code}</code>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 border-t pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t("chief.settings.security.sessions.title")}</p>
                      <p className="text-xs text-muted-foreground">{t("chief.settings.security.sessions.description")}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={endOtherSessions} disabled={sessionsLoading || sessions.every((session) => session.current)}>
                      <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.security.sessions.signOutOthers")}
                    </Button>
                  </div>
                  <div className="grid gap-3">
                    {sessionsLoading && (
                      <div className="rounded-lg border bg-background/40 p-3 text-sm text-muted-foreground">
                        {t("chief.settings.security.sessions.loading")}
                      </div>
                    )}
                    {!sessionsLoading && sessions.length === 0 && (
                      <div className="rounded-lg border bg-background/40 p-3 text-sm text-muted-foreground">
                        {t("chief.settings.security.sessions.empty")}
                      </div>
                    )}
                    {!sessionsLoading && sessions.map((session) => (
                      <div key={session.id} className="flex flex-col gap-3 rounded-lg border bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          {session.device.includes("iPhone")
                            ? <Smartphone className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            : <Laptop className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                          <div>
                            <p className="text-sm font-medium">
                              {session.device}{" "}
                              {session.current && <span className="text-xs text-primary">({t("chief.settings.security.sessions.current")})</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{session.location} / {session.lastActive}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => endSession(session.id)} disabled={session.current}>
                          {t("chief.settings.security.sessions.signOut")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance tab */}
          <TabsContent value="appearance" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{t("chief.settings.appearance.title")}</CardTitle>
                    <CardDescription>{t("chief.settings.appearance.description")}</CardDescription>
                  </div>
                  {appearanceDirty && <Badge variant="outline" className="border-yellow-500 text-yellow-500">{t("chief.settings.profile.unsaved")}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t("chief.settings.appearance.themeMode")}</p>
                      <p className="text-xs text-muted-foreground">{t("chief.settings.appearance.themeModeDesc")}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg" role="group" aria-label={t("chief.settings.appearance.themeMode")}>
                      <Button variant={appearance.theme === "light" ? "secondary" : "ghost"} size="sm" className="h-8" aria-pressed={appearance.theme === "light"} onClick={() => setAppearance((current) => ({ ...current, theme: "light" }))}>{t("chief.settings.appearance.light")}</Button>
                      <Button variant={appearance.theme === "dark" ? "secondary" : "ghost"} size="sm" className="h-8" aria-pressed={appearance.theme === "dark"} onClick={() => setAppearance((current) => ({ ...current, theme: "dark" }))}>{t("chief.settings.appearance.dark")}</Button>
                      <Button variant={appearance.theme === "system" ? "secondary" : "ghost"} size="sm" className="h-8" aria-pressed={appearance.theme === "system"} onClick={() => setAppearance((current) => ({ ...current, theme: "system" }))}>{t("chief.settings.appearance.system")}</Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t("chief.settings.appearance.compactView")}</p>
                      <p className="text-xs text-muted-foreground">{t("chief.settings.appearance.compactViewDesc")}</p>
                    </div>
                    <Switch checked={appearance.compact} onCheckedChange={(checked) => setAppearance((current) => ({ ...current, compact: checked }))} />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t("chief.settings.appearance.language")}</p>
                      <p className="text-xs text-muted-foreground">{t("chief.settings.appearance.languageDesc")}</p>
                    </div>
                    <Select
                      value={appearance.language}
                      onValueChange={(language) => {
                        const code = normalizeLanguageCode(language);
                        setAppearance((current) => ({ ...current, language: code }));
                        void setLanguagePreference(code);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <Globe className="mr-2 h-4 w-4" aria-hidden="true" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((language) => (
                          <SelectItem key={language.value} value={language.value}>
                            <span className="mr-2">{language.flag}</span>
                            {language.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={resetAppearance}>{t("chief.settings.appearance.resetDisplay")}</Button>
                  <Button onClick={saveAppearance} disabled={!appearanceDirty}>
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" /> {t("chief.settings.appearance.saveDisplay")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {role === "chief" && (
            <TabsContent value="production" className="space-y-4">
              <ProductionReadinessPanel
                readiness={readiness}
                loading={readinessLoading}
                error={readinessError}
                onRefresh={refreshReadiness}
              />
            </TabsContent>
          )}
        </Tabs>

        {/* Avatar dialog */}
        <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("chief.settings.profile.avatarDialog.title")}</DialogTitle>
              <DialogDescription>{t("chief.settings.profile.avatarDialog.description")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={t("chief.settings.profile.avatarDialog.title")}>
              {localAvatarTones.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  aria-pressed={avatarDraft === tone.value}
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
              <Button variant="outline" onClick={() => setAvatarOpen(false)}>{t("chief.settings.profile.avatarDialog.cancel")}</Button>
              <Button onClick={saveAvatar}>{t("chief.settings.profile.avatarDialog.apply")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2FA setup dialog — placeholder until TOTP is implemented */}
        <Dialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                TOTP-based two-factor authentication is planned for an upcoming release.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              2FA setup is not yet available. We will notify you when this feature is ready.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTwoFactorOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset confirmation dialog */}
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("chief.settings.resetDialog.title")}</DialogTitle>
              <DialogDescription>{t("chief.settings.resetDialog.description")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(false)}>{t("chief.settings.resetDialog.cancel")}</Button>
              <Button variant="destructive" onClick={resetAllSettings}>{t("chief.settings.resetDialog.confirm")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Always-rendered ARIA live toast */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl transition-all duration-300 ${
            toastVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
            {toastMsg}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function ProductionReadinessPanel({
  readiness,
  loading,
  error,
  onRefresh,
}: {
  readiness: SystemReadiness | null;
  loading: boolean;
  error: string;
  onRefresh: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const checks = readiness?.checks ?? {};
  const operationalRows = [
    { label: "Pending clients", value: readiness?.operational?.pendingClients ?? 0, desc: "Need Chief approval" },
    { label: "Unassigned projects", value: readiness?.operational?.unassignedProjects ?? 0, desc: "Need PM ownership" },
    { label: "Failed invites", value: readiness?.operational?.failedInvitations ?? 0, desc: "Email delivery failed" },
    { label: "Stalled reviews", value: readiness?.operational?.stalledReviews ?? 0, desc: "Client review > 3 days" },
    { label: "Overloaded PMs", value: readiness?.operational?.overloadedPMs ?? 0, desc: "At or above capacity" },
  ];
  const checkRows = [
    "databaseConfigured",
    "emailConfigured",
    "appUrlConfigured",
    "staffAccessConfigured",
    "authSecretConfigured",
    "assetStorageConfigured",
    "productionMode",
  ] as const;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("chief.settings.readiness.title")}</CardTitle>
            <CardDescription>
              {t("chief.settings.readiness.desc")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {readiness && (
              <Badge variant={readiness.ready ? "default" : "destructive"}>
                {readiness.ready ? t("chief.settings.readiness.ready") : t("chief.settings.readiness.notReady")}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
              {t("chief.settings.readiness.refresh")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {checkRows.map((key) => {
            const passed = Boolean(checks[key]);
            return (
              <div key={key} className="flex items-start gap-3 rounded-lg border bg-background/40 p-4">
                {passed ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(`chief.settings.readiness.checks.${key}.title`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`chief.settings.readiness.checks.${key}.desc`)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 rounded-lg border bg-background/40 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("chief.settings.readiness.mode")}</p>
            <p className="font-medium">{readiness?.mode ?? t("chief.settings.readiness.unknown")}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("chief.settings.readiness.apiJsonLimit")}</p>
            <p className="font-medium">{readiness?.limits?.apiJsonLimit ?? t("chief.settings.readiness.unknown")}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("chief.settings.readiness.assetStorage")}</p>
            <p className="font-medium">{readiness?.storage?.assetStorageProvider ?? t("chief.settings.readiness.unknown")}</p>
          </div>
        </div>

        {readiness && (
          <div className="rounded-lg border bg-background/40 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold">Operational snapshot</p>
              <p className="text-xs text-muted-foreground">Live workflow counts that need Chief attention.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {operationalRows.map((item) => {
                const needsAttention = item.value > 0;
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-md border p-3",
                      needsAttention ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/20 bg-emerald-500/5",
                    )}
                  >
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {readiness?.warnings?.length ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="mb-2 text-sm font-medium text-amber-200">{t("chief.settings.readiness.blockingWarnings")}</p>
            <ul className="space-y-1 text-sm text-amber-100">
              {readiness.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {t("chief.settings.readiness.noWarnings")}
          </div>
        )}

        {readiness && (
          <div className="rounded-lg border bg-background/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Recent system activity</p>
                <p className="text-xs text-muted-foreground">Latest audited workflow events for this organization.</p>
              </div>
              <Badge variant="secondary">{readiness.recentActivity?.length ?? 0}</Badge>
            </div>
            {readiness.recentActivity?.length ? (
              <div className="divide-y divide-border/70">
                {readiness.recentActivity.map((event) => (
                  <div key={event.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{event.message}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {event.eventType.replace(/_/g, " ")}
                        {event.actorName ? ` / ${event.actorName}` : ""}
                        {event.projectName ? ` / ${event.projectName}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatReadinessDate(event.createdAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No audited activity has been recorded yet.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatReadinessDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AvatarPreview({ name, tone, avatarUrl, size }: { name: string; tone: AvatarTone; avatarUrl: string; size: "sm" | "lg" }) {
  const toneClass = AVATAR_TONE_CLASSES[tone] ?? AVATAR_TONE_CLASSES.primary;
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
  const { t } = useTranslation();
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
      <p className="text-xs text-muted-foreground">{t("chief.settings.security.strengthPrefix")} {strength.label}</p>
    </div>
  );
}

// ─── Pure helpers ────────────────────────────────────────────────────────────────

function makeDefaultSettings(role: UserRole, user: AuthUser | null): StoredSettings {
  return {
    ...FALLBACK_SETTINGS,
    appearance: {
      ...FALLBACK_SETTINGS.appearance,
      theme: readThemePreference(FALLBACK_SETTINGS.appearance.theme),
      language: readLanguagePreference(),
    },
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
    const parsedAppearance = normalizeAppearance(parsed.appearance, defaults.appearance);
    return {
      ...defaults,
      ...parsed,
      profile: { ...defaults.profile, ...parsed.profile },
      notifications: { ...defaults.notifications, ...parsed.notifications },
      appearance: { ...parsedAppearance, theme: readThemePreference(parsedAppearance.theme) },
      sessions: defaults.sessions,
      recoveryCodes: parsed.recoveryCodes ?? defaults.recoveryCodes,
    };
  } catch {
    return defaults;
  }
}

function persistSettings(storageKey: string, settings: StoredSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

function normalizeAppearance(
  value: (Partial<Omit<AppearanceState, "language">> & { language?: string | null }) | undefined,
  defaults: AppearanceState,
): AppearanceState {
  return {
    ...defaults,
    ...value,
    language: normalizeLanguageCode(value?.language ?? readLanguagePreference()),
  };
}

function validateProfile(profile: ProfileState, t: (key: string) => string) {
  if (!profile.name.trim()) return t("chief.settings.profile.validation.nameRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return t("chief.settings.profile.validation.emailInvalid");
  if (profile.phone && !/^[\d\s()+.-]+$/.test(profile.phone)) return t("chief.settings.profile.validation.phoneInvalid");
  return "";
}

function getPasswordStrength(password: string, t: (key: string) => string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = [
    t("chief.settings.security.passwordStrength.empty"),
    t("chief.settings.security.passwordStrength.weak"),
    t("chief.settings.security.passwordStrength.fair"),
    t("chief.settings.security.passwordStrength.good"),
    t("chief.settings.security.passwordStrength.strong"),
  ];
  return { score, label: labels[score] };
}

function makeRecoveryCodes() {
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);

  return Array.from({ length: 6 }, (_, index) => {
    const left = 1000 + (values[index * 2] % 9000);
    const right = 1000 + (values[index * 2 + 1] % 9000);
    return `ENS-${index + 1}${left}-${right}`;
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AC";
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function normalizeAvatarTone(value: string): AvatarTone {
  return (value in AVATAR_TONE_CLASSES) ? value as AvatarTone : "primary";
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
  return "";
}

function getDashboardHref(role: UserRole) {
  if (role === "pm") return "/pm";
  if (role === "client") return "/client";
  return "/chief";
}
