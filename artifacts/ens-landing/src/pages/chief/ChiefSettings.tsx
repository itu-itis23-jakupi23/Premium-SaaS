import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  User, 
  Bell, 
  Shield, 
  Palette,
  Mail,
  Lock,
  Globe
} from "lucide-react";

export default function ChiefSettings() {
  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader 
          title="Settings" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Settings" }]}
        />

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
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal and professional details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary border-2 border-dashed border-primary">
                      CM
                    </div>
                    <Button variant="outline" size="sm">Change Avatar</Button>
                  </div>
                  <div className="flex-1 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" defaultValue="Chief Manager" className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" defaultValue="admin@ens-expo.com" className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Input id="role" defaultValue="Chief Executive Manager" disabled className="bg-muted/30" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" placeholder="+1 (555) 000-0000" className="bg-muted/50" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button data-testid="button-save-profile">Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Configure which updates you want to receive via email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    { title: "New Project Assignments", desc: "Get notified when a new project is created and assigned." },
                    { title: "Project Milestones", desc: "Alerts for completed stages or approval requests." },
                    { title: "Manager Activity Reports", desc: "Weekly summary of manager performance and workload." },
                    { title: "System Alerts", desc: "Critical updates and security notifications." }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-4">
                  <Button data-testid="button-save-notifications">Save Preferences</Button>
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
                    <Input id="current-pass" type="password" className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pass">New Password</Label>
                    <Input id="new-pass" type="password" className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pass">Confirm New Password</Label>
                    <Input id="confirm-pass" type="password" className="bg-muted/50" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-6">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
                  </div>
                  <Button variant="outline" size="sm">Enable 2FA</Button>
                </div>
                <div className="flex justify-end">
                  <Button data-testid="button-update-password">Update Password</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle>Display Settings</CardTitle>
                <CardDescription>Customize the look and feel of your dashboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Theme Mode</p>
                      <p className="text-xs text-muted-foreground">Switch between light and dark themes.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                      <Button variant="ghost" size="sm" className="h-8">Light</Button>
                      <Button variant="secondary" size="sm" className="h-8">Dark</Button>
                      <Button variant="ghost" size="sm" className="h-8">System</Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Compact View</p>
                      <p className="text-xs text-muted-foreground">Reduce spacing in tables and lists.</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Language</p>
                      <p className="text-xs text-muted-foreground">Select your preferred display language.</p>
                    </div>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Globe className="h-4 w-4" /> English (US)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
