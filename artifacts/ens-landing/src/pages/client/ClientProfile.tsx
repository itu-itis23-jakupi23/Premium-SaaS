import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAccountSettings,
  saveAccountAvatar,
  saveAccountSettings,
  updateAccountPassword,
} from "@/lib/platform-api";
import { User, Building, Shield, Bell, Camera, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function ClientProfile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarTone, setAvatarTone] = useState("green");
  const { toast } = useToast();
  const [notifications, setNotifications] = useState({
    assignments: true,
    milestones: true,
    reports: true,
    system: true,
  });
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  useEffect(() => {
    document.title = t("client.profile.pageTitle");
  }, [t]);

  // Zod schemas use t() so messages are in the active locale on mount
  const profileSchema = z.object({
    name: z.string().min(2, t("client.profile.validation.nameMin")),
    email: z.string().email(t("client.profile.validation.emailInvalid")),
    phone: z.string().optional(),
  });

  const companySchema = z.object({
    companyName: z
      .string()
      .min(2, t("client.profile.validation.companyNameRequired")),
    industry: z.string().optional(),
    website: z
      .string()
      .url(t("client.profile.validation.websiteInvalid"))
      .optional()
      .or(z.literal("")),
  });

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "Alex Thompson",
      email: "alex@techcorp.com",
      phone: "+1 (555) 000-0000",
    },
  });

  const companyForm = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: "TechCorp Industries",
      industry: "Technology",
      website: "https://techcorp.com",
    },
  });

  const displayName =
    profileForm.watch("name") || user?.name || "Client";

  useEffect(() => {
    let mounted = true;

    getAccountSettings()
      .then((settings) => {
        if (!mounted) return;
        profileForm.reset({
          name: settings.profile.name || user?.name || "Client",
          email:
            settings.profile.email || user?.email || "",
          phone: settings.profile.phone,
        });
        setAvatarUrl(settings.profile.avatarUrl);
        setAvatarTone(settings.profile.avatarTone || "green");
        setNotifications(settings.notifications);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        showToast(
          error instanceof Error
            ? error.message
            : t("client.profile.toast.profileLoadError"),
        );
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(message: string) {
    toast({ title: message });
  }

  async function saveProfile(values: z.infer<typeof profileSchema>) {
    try {
      await saveAccountSettings({
        profile: {
          name: values.name,
          email: values.email,
          phone: values.phone ?? "",
          role: user?.systemRole ?? "client",
          avatarTone,
          avatarUrl,
        },
      });
      profileForm.reset(values);
      showToast(t("client.profile.toast.profileSaved"));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("client.profile.toast.profileError"),
      );
    }
  }

  function saveCompany(values: z.infer<typeof companySchema>) {
    companyForm.reset(values);
    showToast(t("client.profile.toast.companySaved"));
  }

  async function setAvatarImageFromFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("client.profile.toast.avatarNotImage"));
      return;
    }
    if (file.size > 1_500_000) {
      showToast(t("client.profile.toast.avatarTooLarge"));
      return;
    }
    try {
      const nextAvatarUrl = await readFileAsDataUrl(
        file,
        t("client.profile.toast.imageReadError"),
      );
      const settings = await saveAccountAvatar({
        avatarUrl: nextAvatarUrl,
        avatarTone,
      });
      setAvatarUrl(settings.profile.avatarUrl);
      setAvatarTone(settings.profile.avatarTone);
      showToast(t("client.profile.toast.avatarUpdated"));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("client.profile.toast.avatarError"),
      );
    }
  }

  async function removeAvatar() {
    try {
      const settings = await saveAccountAvatar({ avatarUrl: "", avatarTone });
      setAvatarUrl(settings.profile.avatarUrl);
      setAvatarTone(settings.profile.avatarTone);
      showToast(t("client.profile.toast.avatarRemoved"));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("client.profile.toast.avatarRemoveError"),
      );
    }
  }

  async function toggleNotification(
    key: keyof typeof notifications,
  ) {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    try {
      await saveAccountSettings({ notifications: next });
      const label = t(`client.profile.notifications.${key}.title`);
      const state = next[key]
        ? t("client.profile.notifications.enabled")
        : t("client.profile.notifications.disabled");
      showToast(`${label} ${state}`);
    } catch (error) {
      setNotifications(notifications);
      showToast(
        error instanceof Error
          ? error.message
          : t("client.profile.toast.notificationError"),
      );
    }
  }

  async function updatePasswordHandler() {
    if (!password.current || !password.next || !password.confirm) {
      showToast(t("client.profile.toast.passwordFillAll"));
      return;
    }
    if (password.next !== password.confirm) {
      showToast(t("client.profile.toast.passwordMismatch"));
      return;
    }
    if (password.next.length < 8) {
      showToast(t("client.profile.toast.passwordTooShort"));
      return;
    }
    try {
      await updateAccountPassword({
        currentPassword: password.current,
        newPassword: password.next,
      });
      setPassword({ current: "", next: "", confirm: "" });
      showToast(t("client.profile.toast.passwordUpdated"));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("client.profile.toast.passwordError"),
      );
    }
  }

  const notificationItems = [
    {
      key: "milestones" as const,
      title: t("client.profile.notifications.milestones.title"),
      desc: t("client.profile.notifications.milestones.desc"),
    },
    {
      key: "assignments" as const,
      title: t("client.profile.notifications.assignments.title"),
      desc: t("client.profile.notifications.assignments.desc"),
    },
    {
      key: "reports" as const,
      title: t("client.profile.notifications.reports.title"),
      desc: t("client.profile.notifications.reports.desc"),
    },
    {
      key: "system" as const,
      title: t("client.profile.notifications.system.title"),
      desc: t("client.profile.notifications.system.desc"),
    },
  ];

  return (
    <DashboardLayout role="client">

      <PageHeader
        title={t("client.profile.title")}
        breadcrumbs={[
          {
            label: t("client.profile.breadcrumbDashboard"),
            href: "/client",
          },
          { label: t("client.profile.breadcrumbProfile") },
        ]}
      />

      <div className="mt-6 max-w-4xl">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" aria-hidden="true" />
              {t("client.profile.tab.profile")}
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <Building className="h-4 w-4" aria-hidden="true" />
              {t("client.profile.tab.company")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" aria-hidden="true" />
              {t("client.profile.tab.notifications")}
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" aria-hidden="true" />
              {t("client.profile.tab.security")}
            </TabsTrigger>
          </TabsList>

          {/* ── Personal Info ───────────────────────────────── */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("client.profile.personalInfo.heading")}
                </CardTitle>
                <CardDescription>
                  {t("client.profile.personalInfo.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar section */}
                <div className="flex items-center gap-6 pb-6 border-b">
                  <div className="relative group">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarUrl} alt={displayName} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {initials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={t("client.profile.avatar.changeBtn")}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera
                        className="h-6 w-6 text-white"
                        aria-hidden="true"
                      />
                    </button>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-hidden="true"
                      onChange={(event) =>
                        setAvatarImageFromFile(
                          event.target.files?.[0] ?? null,
                        )
                      }
                    />
                  </div>
                  <div>
                    <h3 className="font-bold">
                      {t("client.profile.avatar.heading")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      {t("client.profile.avatar.hint")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {t("client.profile.avatar.uploadNew")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="text-red-500"
                        onClick={removeAvatar}
                        disabled={!avatarUrl}
                      >
                        {t("client.profile.avatar.remove")}
                      </Button>
                    </div>
                  </div>
                </div>

                <Form {...profileForm}>
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={profileForm.handleSubmit(saveProfile)}
                  >
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("client.profile.field.name")}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("client.profile.field.email")}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("client.profile.field.phone")}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-2 pt-4">
                      <Button type="submit">
                        {t("client.profile.btn.saveChanges")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Company ─────────────────────────────────────── */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("client.profile.company.heading")}
                </CardTitle>
                <CardDescription>
                  {t("client.profile.company.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...companyForm}>
                  <form
                    className="space-y-4"
                    onSubmit={companyForm.handleSubmit(saveCompany)}
                  >
                    <FormField
                      control={companyForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("client.profile.field.companyName")}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={companyForm.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("client.profile.field.industry")}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={companyForm.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("client.profile.field.website")}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="pt-4">
                      <Button type="submit">
                        {t("client.profile.btn.updateCompany")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Notifications ───────────────────────────────── */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("client.profile.notifications.heading")}
                </CardTitle>
                <CardDescription>
                  {t("client.profile.notifications.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notificationItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card/50"
                  >
                    <div>
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={
                        notifications[item.key] ? "outline" : "ghost"
                      }
                      size="sm"
                      aria-pressed={notifications[item.key]}
                      onClick={() => toggleNotification(item.key)}
                    >
                      {notifications[item.key]
                        ? t("client.profile.notifications.enabled")
                        : t("client.profile.notifications.disabled")}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Security ────────────────────────────────────── */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("client.profile.security.heading")}
                </CardTitle>
                <CardDescription>
                  {t("client.profile.security.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="current-password">
                      {t("client.profile.field.currentPassword")}
                    </Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={password.current}
                      autoComplete="current-password"
                      onChange={(event) =>
                        setPassword((curr) => ({
                          ...curr,
                          current: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="new-password">
                        {t("client.profile.field.newPassword")}
                      </Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={password.next}
                        autoComplete="new-password"
                        onChange={(event) =>
                          setPassword((curr) => ({
                            ...curr,
                            next: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirm-password">
                        {t("client.profile.field.confirmPassword")}
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={password.confirm}
                        autoComplete="new-password"
                        onChange={(event) =>
                          setPassword((curr) => ({
                            ...curr,
                            confirm: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Button type="button" onClick={updatePasswordHandler}>
                    {t("client.profile.btn.updatePassword")}
                  </Button>
                </div>

                <Separator />

                <div className="pt-2">
                  <h4 className="text-sm font-bold text-red-500 mb-2">
                    {t("client.profile.dangerZone.heading")}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t("client.profile.dangerZone.description")}
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() =>
                      showToast(t("client.profile.toast.deleteQueued"))
                    }
                  >
                    {t("client.profile.dangerZone.deleteBtn")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function readFileAsDataUrl(file: File, errorMsg: string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(errorMsg));
    reader.readAsDataURL(file);
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CR";
  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
