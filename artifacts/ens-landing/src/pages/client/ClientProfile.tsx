import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { getAccountSettings, saveAccountAvatar, saveAccountSettings, updateAccountPassword } from "@/lib/platform-api";
import { User, Building, Shield, Bell, Camera } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
});

const companySchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  industry: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
});

export default function ClientProfile() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarTone, setAvatarTone] = useState("green");
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState({
    assignments: true,
    milestones: true,
    reports: true,
    system: true,
  });
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });

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

  const displayName = profileForm.watch("name") || user?.name || "Client Reviewer";

  useEffect(() => {
    let mounted = true;

    getAccountSettings()
      .then((settings) => {
        if (!mounted) return;
        profileForm.reset({
          name: settings.profile.name || user?.name || "Client Reviewer",
          email: settings.profile.email || user?.email || "client@ens.test",
          phone: settings.profile.phone,
        });
        setAvatarUrl(settings.profile.avatarUrl);
        setAvatarTone(settings.profile.avatarTone || "green");
        setNotifications(settings.notifications);
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Profile settings could not be loaded");
      });

    return () => {
      mounted = false;
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
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
      showToast("Profile changes saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Profile could not be saved");
    }
  }

  function saveCompany(values: z.infer<typeof companySchema>) {
    companyForm.reset(values);
    showToast("Company information saved");
  }

  async function setAvatarImageFromFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file");
      return;
    }
    if (file.size > 1_500_000) {
      showToast("Choose an image under 1.5 MB");
      return;
    }

    try {
      const nextAvatarUrl = await readFileAsDataUrl(file);
      const settings = await saveAccountAvatar({ avatarUrl: nextAvatarUrl, avatarTone });
      setAvatarUrl(settings.profile.avatarUrl);
      setAvatarTone(settings.profile.avatarTone);
      showToast("Profile picture updated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Profile picture could not be saved");
    }
  }

  async function removeAvatar() {
    try {
      const settings = await saveAccountAvatar({ avatarUrl: "", avatarTone });
      setAvatarUrl(settings.profile.avatarUrl);
      setAvatarTone(settings.profile.avatarTone);
      showToast("Profile picture removed");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Profile picture could not be removed");
    }
  }

  async function toggleNotification(key: keyof typeof notifications) {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    try {
      await saveAccountSettings({ notifications: next });
      showToast(`${notificationLabel(key)} ${next[key] ? "enabled" : "disabled"}`);
    } catch (error) {
      setNotifications(notifications);
      showToast(error instanceof Error ? error.message : "Notification setting could not be saved");
    }
  }

  async function updatePassword() {
    if (!password.current || !password.next || !password.confirm) {
      showToast("Fill all password fields");
      return;
    }
    if (password.next !== password.confirm) {
      showToast("New passwords do not match");
      return;
    }
    if (password.next.length < 8) {
      showToast("Password must be at least 8 characters");
      return;
    }

    try {
      await updateAccountPassword({ currentPassword: password.current, newPassword: password.next });
      setPassword({ current: "", next: "", confirm: "" });
      showToast("Password update saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Password could not be updated");
    }
  }

  return (
    <DashboardLayout role="client">
      <PageHeader 
        title="Profile Settings" 
        breadcrumbs={[{ label: "Dashboard", href: "/client" }, { label: "Profile" }]} 
      />

      <div className="mt-6 max-w-4xl">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" /> Personal Info
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <Building className="h-4 w-4" /> Company
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" /> Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details and how we can reach you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6 pb-6 border-b">
                  <div className="relative group">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarUrl} alt={displayName} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials(displayName)}</AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </button>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => setAvatarImageFromFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold">Profile Picture</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">JPG, GIF or PNG. Max size 1.5MB.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>Upload New</Button>
                      <Button size="sm" variant="ghost" type="button" className="text-red-500" onClick={removeAvatar} disabled={!avatarUrl}>Remove</Button>
                    </div>
                  </div>
                </div>

                <Form {...profileForm}>
                  <form className="grid gap-4 md:grid-cols-2" onSubmit={profileForm.handleSubmit(saveProfile)}>
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
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
                          <FormLabel>Email Address</FormLabel>
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
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-2 pt-4">
                      <Button type="submit">Save Changes</Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Manage your company details and exhibition profile.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...companyForm}>
                  <form className="space-y-4" onSubmit={companyForm.handleSubmit(saveCompany)}>
                    <FormField
                      control={companyForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
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
                            <FormLabel>Industry</FormLabel>
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
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="pt-4">
                      <Button type="submit">Update Company Info</Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to be notified about project updates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "milestones" as const, title: "Project Milestones", desc: "Get notified when a stage is completed." },
                  { key: "assignments" as const, title: "New Messages", desc: "Get notified when your PM sends a message." },
                  { key: "reports" as const, title: "Revision Requests", desc: "Get notified when a new design version is ready." },
                  { key: "system" as const, title: "Security Alerts", desc: "Get notified about account logins." }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                    <div>
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Button type="button" variant={notifications[item.key] ? "outline" : "ghost"} size="sm" onClick={() => toggleNotification(item.key)}>
                      {notifications[item.key] ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
             <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your password and account security settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                   <div className="grid gap-2">
                     <Label>Current Password</Label>
                     <Input type="password" value={password.current} onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))} />
                   </div>
                   <div className="grid md:grid-cols-2 gap-4">
                     <div className="grid gap-2">
                       <Label>New Password</Label>
                       <Input type="password" value={password.next} onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))} />
                     </div>
                     <div className="grid gap-2">
                       <Label>Confirm New Password</Label>
                       <Input type="password" value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} />
                     </div>
                   </div>
                   <Button type="button" onClick={updatePassword}>Update Password</Button>
                </div>
                
                <Separator />
                
                <div className="pt-2">
                   <h4 className="text-sm font-bold text-red-500 mb-2">Danger Zone</h4>
                   <p className="text-xs text-muted-foreground mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                   <Button type="button" variant="destructive" onClick={() => showToast("Account deletion request queued")}>Delete Account</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Image could not be read"));
    reader.readAsDataURL(file);
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CR";
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function notificationLabel(key: keyof ReturnType<typeof notificationDefaults>) {
  const labels: Record<keyof ReturnType<typeof notificationDefaults>, string> = {
    assignments: "Message notifications",
    milestones: "Milestone notifications",
    reports: "Revision notifications",
    system: "Security alerts",
  };
  return labels[key];
}

function notificationDefaults() {
  return {
    assignments: true,
    milestones: true,
    reports: true,
    system: true,
  };
}
