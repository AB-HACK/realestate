import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDataStore } from "@/stores/data-store";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { leadStatusConfig, leadStatusOrder } from "@/lib/constants";
import type { Client, LeadStatus, PropertyType } from "@/types";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(1, "Phone is required"),
  budget: z.coerce.number().min(0, "Budget must be positive"),
  status: z.string(),
});
type FormData = z.infer<typeof schema>;

const propertyTypes: PropertyType[] = ["house", "apartment", "condo", "townhouse", "land", "commercial"];

export default function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, addClient, updateClient } = useDataStore();
  const user = useAuthStore((s) => s.user);
  const isEdit = Boolean(id);
  const existing = isEdit ? clients.find((c) => c.id === id) : undefined;

  const [preferredLocations, setPreferredLocations] = useState<string[]>(existing?.preferredLocations ?? []);
  const [propertyTypeInterest, setPropertyTypeInterest] = useState<PropertyType[]>(existing?.propertyTypeInterest ?? []);
  const [locationInput, setLocationInput] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? { firstName: existing.firstName, lastName: existing.lastName, email: existing.email, phone: existing.phone, budget: existing.budget, status: existing.status }
      : { firstName: "", lastName: "", email: "", phone: "", budget: 0, status: "new" },
  });

  const onSubmit = (data: FormData) => {
    const payload: Client = {
      id: existing?.id ?? `c-${Date.now()}`,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      status: data.status as LeadStatus,
      budget: data.budget,
      preferredLocations,
      propertyTypeInterest,
      assignedAgentId: existing?.assignedAgentId ?? user?.id ?? "u-2",
      notes: existing?.notes ?? [],
      activities: existing?.activities ?? [{
        id: `a-${Date.now()}`,
        clientId: existing?.id ?? "",
        type: "created",
        description: "Lead created",
        authorName: user ? `${user.firstName} ${user.lastName}` : "System",
        createdAt: new Date().toISOString(),
      }],
      interestedPropertyIds: existing?.interestedPropertyIds ?? [],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (isEdit) {
      updateClient(existing!.id, payload);
    } else {
      addClient(payload);
    }
    navigate(`/clients/${payload.id}`);
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <Link to={isEdit ? `/clients/${id}` : "/clients"}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button>
      </Link>

      <h2 className="font-display text-2xl font-bold">{isEdit ? "Edit Client" : "New Client"}</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lead Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget ($)</Label>
              <Input id="budget" type="number" {...register("budget")} />
              {errors.budget && <p className="text-xs text-destructive">{errors.budget.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select defaultValue={watch("status")} onValueChange={(v) => setValue("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leadStatusOrder.map((s) => <SelectItem key={s} value={s}>{leadStatusConfig[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Preferred Locations</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Add a location..."
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && locationInput.trim()) {
                      e.preventDefault();
                      setPreferredLocations((prev) => [...prev, locationInput.trim()]);
                      setLocationInput("");
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => {
                  if (locationInput.trim()) {
                    setPreferredLocations((prev) => [...prev, locationInput.trim()]);
                    setLocationInput("");
                  }
                }}>Add</Button>
              </div>
              {preferredLocations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {preferredLocations.map((loc, i) => (
                    <button key={i} type="button" onClick={() => setPreferredLocations((prev) => prev.filter((_, idx) => idx !== i))}
                      className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-destructive/10 hover:text-destructive">
                      {loc} ×
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Property Types of Interest</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {propertyTypes.map((type) => {
                  const selected = propertyTypeInterest.includes(type);
                  return (
                    <button key={type} type="button"
                      onClick={() => setPropertyTypeInterest((prev) => selected ? prev.filter((t) => t !== type) : [...prev, type])}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Link to={isEdit ? `/clients/${id}` : "/clients"}><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={isSubmitting}><Save className="h-4 w-4" /> {isEdit ? "Save Changes" : "Create Client"}</Button>
        </div>
      </form>
    </div>
  );
}
