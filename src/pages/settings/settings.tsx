import { useState } from "react";
import { User as UserIcon, Building, Bell, Save } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import type { NotificationPrefs } from "@/types";

export default function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saved, setSaved] = useState(false);

  const [company, setCompany] = useState({
    name: "AecrenEstates",
    email: "contact@aecrenestates.com",
    phone: "+1 202-555-0100",
    address: "1200 Market St, Suite 500, Washington DC",
    website: "www.aecrenestates.com",
    description: "Premium real estate agency serving clients nationwide.",
  });

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    emailNotifications: true,
    newLeadAlerts: true,
    appointmentReminders: true,
    propertyUpdates: false,
    weeklyReports: true,
    smsNotifications: false,
  });

  const handleSaveProfile = () => {
    updateProfile({ firstName, lastName, email, phone, bio });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const notifLabels: Record<string, string> = {
    emailNotifications: "Email Notifications",
    newLeadAlerts: "New Lead Alerts",
    appointmentReminders: "Appointment Reminders",
    propertyUpdates: "Property Updates",
    weeklyReports: "Weekly Reports",
    smsNotifications: "SMS Notifications",
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader title="Settings" description="Manage your profile, company, and notification preferences." />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Profile</TabsTrigger>
          <TabsTrigger value="company" className="flex items-center gap-2"><Building className="h-4 w-4" /> Company</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary/10 text-lg font-semibold">
                    {initials(`${firstName} ${lastName}`)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{firstName} {lastName}</p>
                  <p className="text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea id="bio" rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Tell us about yourself..." value={bio} onChange={(e) => setBio(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveProfile}><Save className="h-4 w-4" /> Save Changes</Button>
                {saved && <span className="text-sm text-success">Saved successfully!</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Company Settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" value={company.name} onChange={(e) => setCompany((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Contact Email</Label>
                  <Input id="companyEmail" type="email" value={company.email} onChange={(e) => setCompany((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Contact Phone</Label>
                  <Input id="companyPhone" value={company.phone} onChange={(e) => setCompany((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">Website</Label>
                  <Input id="companyWebsite" value={company.website} onChange={(e) => setCompany((p) => ({ ...p, website: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Address</Label>
                <Input id="companyAddress" value={company.address} onChange={(e) => setCompany((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyDescription">Description</Label>
                <textarea id="companyDescription" rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={company.description} onChange={(e) => setCompany((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(notifLabels).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={notifPrefs[key as keyof NotificationPrefs]}
                    onCheckedChange={(v) => setNotifPrefs((prev) => ({ ...prev, [key]: v }))}
                  />
                </div>
              ))}
              <Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
                <Save className="h-4 w-4" /> Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
