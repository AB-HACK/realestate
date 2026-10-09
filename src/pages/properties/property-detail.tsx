import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit, Trash2, MapPin, BedDouble, Bath, Maximize,
  Eye, Calendar, Car, Waves, Dumbbell, Trees, Shield, ArrowUpDown,
  Sofa, PawPrint, Snowflake, WashingMachine, Check,
} from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { propertyStatusConfig, propertyTypeConfig, listingTypeConfig, amenityLabels } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  parking: Car, pool: Waves, gym: Dumbbell, garden: Trees, security: Shield,
  elevator: ArrowUpDown, furnished: Sofa, petFriendly: PawPrint,
  airConditioning: Snowflake, laundry: WashingMachine,
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { properties, deleteProperty } = useDataStore();
  const [activeImage, setActiveImage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const property = properties.find((p) => p.id === id);

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="font-display text-xl font-bold">Property not found</h2>
        <Link to="/properties" className="mt-4"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back to Properties</Button></Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/properties"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Properties</Button></Link>
        <div className="flex gap-2">
          <Link to={`/properties/${property.id}/edit`}><Button variant="outline" size="sm"><Edit className="h-4 w-4" /> Edit</Button></Link>
          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <DialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /> Delete</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Delete this property?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">This action cannot be undone. The listing "{property.title}" will be permanently removed.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => { deleteProperty(property.id); navigate("/properties"); }}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Image gallery */}
      <Card className="overflow-hidden p-0">
        <div className="relative h-[400px] overflow-hidden rounded-t-xl">
          <img src={property.images[activeImage]} alt="" className="h-full w-full object-cover" />
          <div className="absolute left-4 top-4 flex gap-2">
            <Badge variant={propertyStatusConfig[property.status].badge}>{propertyStatusConfig[property.status].label}</Badge>
            <Badge variant="secondary">{listingTypeConfig[property.listingType].label}</Badge>
          </div>
        </div>
        {property.images.length > 1 && (
          <div className="flex gap-2 p-4 overflow-x-auto scrollbar-thin">
            {property.images.map((img, i) => (
              <button key={i} onClick={() => setActiveImage(i)} className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${i === activeImage ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}>
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {property.location}
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold">{property.title}</h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{property.description}</p>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader><CardTitle>Property Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="flex flex-col items-center rounded-lg border border-border p-4">
                  <BedDouble className="h-5 w-5 text-muted-foreground" />
                  <span className="mt-2 font-display text-xl font-bold">{property.bedrooms || "—"}</span>
                  <span className="text-xs text-muted-foreground">Bedrooms</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-border p-4">
                  <Bath className="h-5 w-5 text-muted-foreground" />
                  <span className="mt-2 font-display text-xl font-bold">{property.bathrooms || "—"}</span>
                  <span className="text-xs text-muted-foreground">Bathrooms</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-border p-4">
                  <Maximize className="h-5 w-5 text-muted-foreground" />
                  <span className="mt-2 font-display text-xl font-bold">{property.area.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">Sq Ft</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-border p-4">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  <span className="mt-2 font-display text-xl font-bold">{property.views}</span>
                  <span className="text-xs text-muted-foreground">Views</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{propertyTypeConfig[property.type].label}</span></div>
                <div><span className="text-muted-foreground">Listing:</span> <span className="font-medium">{listingTypeConfig[property.listingType].label}</span></div>
                <div><span className="text-muted-foreground">Neighborhood:</span> <span className="font-medium">{property.neighborhood}</span></div>
                <div><span className="text-muted-foreground">City:</span> <span className="font-medium">{property.city}</span></div>
                <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{formatDate(property.createdAt)}</span></div>
                <div><span className="text-muted-foreground">Updated:</span> <span className="font-medium">{formatDate(property.updatedAt)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Amenities */}
          <Card>
            <CardHeader><CardTitle>Amenities</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(property.amenities).map(([key, has]) => {
                  const Icon = amenityIcons[key];
                  return (
                    <div key={key} className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 ${has ? "" : "opacity-40"}`}>
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">{amenityLabels[key]}</span>
                      {has && <Check className="ml-auto h-3.5 w-3.5 text-success" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - price card */}
        <div className="space-y-4">
          <Card className="sticky top-0">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="mt-1 font-display text-3xl font-bold text-primary">
                {formatCurrency(property.price)}
                {property.listingType === "rent" && <span className="text-base font-normal text-muted-foreground">/month</span>}
              </p>
              <div className="mt-4 space-y-2">
                <Link to="/appointments"><Button className="w-full"><Calendar className="h-4 w-4" /> Schedule Viewing</Button></Link>
                <Link to="/clients"><Button variant="outline" className="w-full">Find Matching Clients</Button></Link>
              </div>
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Listed by</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">JC</div>
                  <div>
                    <p className="text-sm font-medium">James Carter</p>
                    <p className="text-xs text-muted-foreground">Senior Agent</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
