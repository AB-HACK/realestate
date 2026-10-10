import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, Upload, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { amenityLabels } from "@/lib/constants";
import { toast } from "@/components/ui/toast";
import type { Property, PropertyStatus, PropertyType, ListingType, PropertyAmenities } from "@/types";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.coerce.number().min(0, "Price must be positive"),
  type: z.string(),
  listingType: z.string(),
  status: z.string(),
  bedrooms: z.coerce.number().min(0),
  bathrooms: z.coerce.number().min(0),
  area: z.coerce.number().min(0),
  location: z.string().min(1, "Location is required"),
  city: z.string().min(1, "City is required"),
  neighborhood: z.string().min(1, "Neighborhood is required"),
});
type FormData = z.infer<typeof schema>;

const propertyTypes: PropertyType[] = ["house", "apartment", "condo", "townhouse", "land", "commercial"];
const statuses: PropertyStatus[] = ["available", "under_offer", "sold", "rented", "draft"];
const listingTypes: ListingType[] = ["sale", "rent"];
const amenityKeys = Object.keys(amenityLabels);

export default function PropertyFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { properties, addProperty, updateProperty } = useDataStore();
  const user = useAuthStore((s) => s.user);
  const isEdit = Boolean(id);
  const existing = isEdit ? properties.find((p) => p.id === id) : undefined;

  const [amenities, setAmenities] = useState<PropertyAmenities>(
    existing?.amenities ?? {
      parking: false, pool: false, gym: false, garden: false, security: false,
      elevator: false, furnished: false, petFriendly: false, airConditioning: false, laundry: false,
    },
  );
  const [imageUrls, setImageUrls] = useState<string[]>(existing?.images ?? []);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          title: existing.title, description: existing.description, price: existing.price,
          type: existing.type, listingType: existing.listingType, status: existing.status,
          bedrooms: existing.bedrooms, bathrooms: existing.bathrooms, area: existing.area,
          location: existing.location, city: existing.city, neighborhood: existing.neighborhood,
        }
      : {
          title: "", description: "", price: 0, type: "house", listingType: "sale",
          status: "available", bedrooms: 0, bathrooms: 0, area: 0,
          location: "", city: "", neighborhood: "",
        },
  });

  const onSubmit = (data: FormData) => {
    const payload: Property = {
      id: existing?.id ?? `p-${Date.now()}`,
      title: data.title,
      description: data.description,
      price: data.price,
      type: data.type as PropertyType,
      listingType: data.listingType as ListingType,
      status: data.status as PropertyStatus,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      area: data.area,
      location: data.location,
      city: data.city,
      neighborhood: data.neighborhood,
      images: imageUrls.length > 0 ? imageUrls : ["https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=800"],
      amenities,
      agentId: existing?.agentId ?? user?.id ?? "u-2",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      featured: existing?.featured ?? false,
      views: existing?.views ?? 0,
    };
    if (isEdit) {
      updateProperty(existing!.id, payload);
      toast.success("Property updated", "Your changes have been saved.");
    } else {
      addProperty(payload);
      toast.success("Property created", `"${payload.title}" has been added to your portfolio.`);
    }
    navigate(`/properties/${payload.id}`);
  };

  const handleImageAdd = (url: string) => {
    if (url.trim()) setImageUrls((prev) => [...prev, url.trim()]);
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between">
        <Link to={isEdit ? `/properties/${id}` : "/properties"}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
      </div>

      <h2 className="font-display text-2xl font-bold">{isEdit ? "Edit Property" : "New Property"}</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="e.g. Modern Glass Villa with Infinity Pool" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Describe the property..." {...register("description")} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Price & type */}
        <Card>
          <CardHeader><CardTitle>Pricing & Classification</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input id="price" type="number" {...register("price")} />
              {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Property Type</Label>
              <Select defaultValue={watch("type")} onValueChange={(v) => setValue("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Listing Type</Label>
              <Select defaultValue={watch("listingType")} onValueChange={(v) => setValue("listingType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {listingTypes.map((t) => <SelectItem key={t} value={t}>{t === "sale" ? "For Sale" : "For Rent"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select defaultValue={watch("status")} onValueChange={(v) => setValue("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader><CardTitle>Property Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input id="bedrooms" type="number" {...register("bedrooms")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input id="bathrooms" type="number" {...register("bathrooms")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Area (sqft)</Label>
              <Input id="area" type="number" {...register("area")} />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader><CardTitle>Location</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="location">Full Location</Label>
              <Input id="location" placeholder="e.g. Beverly Hills, CA" {...register("location")} />
              {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="e.g. Beverly Hills" {...register("city")} />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Neighborhood</Label>
              <Input id="neighborhood" placeholder="e.g. Trousdale" {...register("neighborhood")} />
              {errors.neighborhood && <p className="text-xs text-destructive">{errors.neighborhood.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Amenities */}
        <Card>
          <CardHeader><CardTitle>Amenities</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {amenityKeys.map((key) => (
                <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <span className="text-sm">{amenityLabels[key]}</span>
                  <Switch
                    checked={amenities[key as keyof PropertyAmenities]}
                    onCheckedChange={(v) => setAmenities((prev) => ({ ...prev, [key]: v }))}
                  />
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader><CardTitle>Property Images</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2">
              <Input
                id="image-url"
                placeholder="Paste image URL..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleImageAdd((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => {
                const el = document.getElementById("image-url") as HTMLInputElement;
                handleImageAdd(el.value);
                el.value = "";
              }}><Upload className="h-4 w-4" /> Add</Button>
            </div>
            {imageUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {imageUrls.map((url, i) => (
                  <div key={i} className="group relative h-24 overflow-hidden rounded-lg border border-border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No images added yet. A placeholder will be used if none are provided.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link to={isEdit ? `/properties/${id}` : "/properties"}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4" /> {isEdit ? "Save Changes" : "Create Property"}
          </Button>
        </div>
      </form>
    </div>
  );
}
