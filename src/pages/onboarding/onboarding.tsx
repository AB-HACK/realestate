import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building, User, Settings, Check, ArrowRight, ArrowLeft, Briefcase, Home, DollarSign, MapPin } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useThemeStore } from "@/stores/theme-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { UserRole } from "@/types";

const steps = [
  { id: 0, title: "Welcome", icon: Building },
  { id: 1, title: "Your Role", icon: User },
  { id: 2, title: "Agency Info", icon: Briefcase },
  { id: 3, title: "Preferences", icon: Settings },
];

const roleOptions: { value: UserRole; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "admin", label: "Administrator", description: "Full access to all features, team management, and analytics", icon: Briefcase },
  { value: "agent", label: "Real Estate Agent", description: "Manage listings, clients, appointments, and deals", icon: Home },
];

const preferenceOptions = [
  { id: "emailNotifications", label: "Email Notifications", description: "Receive updates about your listings and clients", icon: Building },
  { id: "newLeadAlerts", label: "New Lead Alerts", description: "Get notified instantly when a new lead comes in", icon: User },
  { id: "appointmentReminders", label: "Appointment Reminders", description: "Never miss a scheduled viewing", icon: Check },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateProfile, completeOnboarding } = useAuthStore();
  const { theme, set: setTheme } = useThemeStore();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<UserRole>(user?.role ?? "agent");
  const [agencyName, setAgencyName] = useState("");
  const [agencyLocation, setAgencyLocation] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>(["emailNotifications", "newLeadAlerts"]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      updateProfile({ role });
      completeOnboarding();
      toast.success("Welcome aboard!", "Your account is all set up and ready to go.");
      navigate("/dashboard");
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const togglePref = (id: string) => {
    setSelectedPrefs((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-bold">AecrenEstates</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          {/* Progress */}
          <div className="mb-8 flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  i <= step ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                )}>
                  {i < step ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn("h-0.5 w-8 transition-colors sm:w-16", i < step ? "bg-primary" : "bg-border")} />
                )}
              </div>
            ))}
          </div>

          <div className="min-h-[280px]">
            {step === 0 && (
              <div className="animate-fade-in-up text-center">
                <h1 className="font-display text-2xl font-bold sm:text-3xl">Welcome to AecrenEstates, {user?.firstName}!</h1>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  Let's set up your account in just a few quick steps. This will help us tailor your experience and get you up and running in no time.
                </p>
                <div className="mt-8 grid grid-cols-3 gap-4">
                  {[
                    { icon: Home, label: "Manage Listings", color: "text-success" },
                    { icon: DollarSign, label: "Track Revenue", color: "text-info" },
                    { icon: MapPin, label: "Schedule Viewings", color: "text-warning" },
                  ].map((f) => (
                    <div key={f.label} className="flex flex-col items-center gap-2 rounded-xl border border-border p-4">
                      <f.icon className={cn("h-6 w-6", f.color)} />
                      <span className="text-xs font-medium">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="animate-fade-in-up">
                <h2 className="font-display text-xl font-bold">What best describes you?</h2>
                <p className="mt-2 text-sm text-muted-foreground">Choose your role to customize your dashboard and permissions.</p>
                <div className="mt-6 space-y-3">
                  {roleOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRole(opt.value)}
                      className={cn(
                        "flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                        role === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30",
                      )}
                    >
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", role === opt.value ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        <opt.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{opt.label}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{opt.description}</p>
                      </div>
                      {role === opt.value && <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in-up">
                <h2 className="font-display text-xl font-bold">Tell us about your agency</h2>
                <p className="mt-2 text-sm text-muted-foreground">This information appears on your listings and client communications.</p>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="agencyName">Agency Name</Label>
                    <Input id="agencyName" placeholder="e.g. Premier Real Estate Group" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agencyLocation">Primary Location</Label>
                    <Input id="agencyLocation" placeholder="e.g. Los Angeles, CA" value={agencyLocation} onChange={(e) => setAgencyLocation(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agencyWebsite">Website (optional)</Label>
                    <Input id="agencyWebsite" placeholder="www.youragency.com" value={agencyWebsite} onChange={(e) => setAgencyWebsite(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in-up">
                <h2 className="font-display text-xl font-bold">Customize your experience</h2>
                <p className="mt-2 text-sm text-muted-foreground">Choose how you'd like to be notified. You can change these anytime in Settings.</p>
                <div className="mt-6 space-y-3">
                  {preferenceOptions.map((pref) => (
                    <button
                      key={pref.id}
                      onClick={() => togglePref(pref.id)}
                      className={cn(
                        "flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                        selectedPrefs.includes(pref.id) ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30",
                      )}
                    >
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", selectedPrefs.includes(pref.id) ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        <pref.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{pref.label}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{pref.description}</p>
                      </div>
                      {selectedPrefs.includes(pref.id) && <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>
                <div className="mt-6 rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">Theme Preference</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setTheme("light")} className={cn("flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-all", theme === "light" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground")}>
                      Light
                    </button>
                    <button onClick={() => setTheme("dark")} className={cn("flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-all", theme === "dark" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground")}>
                      Dark
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={handleBack} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <div key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-8 bg-primary" : i < step ? "w-1.5 bg-primary" : "w-1.5 bg-border")} />
              ))}
            </div>
            <Button onClick={handleNext}>
              {step === 3 ? "Get Started" : "Continue"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
