import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Building2, Eye, BedDouble, Bath, Maximize, MapPin, SlidersHorizontal, Star, Heart } from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { PageHeader, EmptyState } from "@/components/shared/states";
import { PropertyCardSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { propertyStatusConfig, propertyTypeConfig, listingTypeConfig } from "@/lib/constants";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { PropertyStatus, PropertyType, ListingType } from "@/types";

export default function PropertiesPage() {
  const { properties } = useDataStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [listingFilter, setListingFilter] = useState<string>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading] = useState(false);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.location.toLowerCase().includes(search.toLowerCase()) ||
        p.city.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchType = typeFilter === "all" || p.type === typeFilter;
      const matchListing = listingFilter === "all" || p.listingType === listingFilter;
      return matchSearch && matchStatus && matchType && matchListing;
    });
  }, [properties, search, statusFilter, typeFilter, listingFilter]);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        toast.info("Added to favorites", "Property saved to your favorites.");
      }
      return next;
    });
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader title="Properties" description={`${properties.length} total listings in your portfolio.`}>
        <Link to="/properties/new"><Button><Plus className="h-4 w-4" /> Add Property</Button></Link>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by title, location, or city..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SlidersHorizontal className="mr-1 h-3.5 w-3.5" /><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(Object.keys(propertyStatusConfig) as PropertyStatus[]).map((k) => (
                <SelectItem key={k} value={k}>{propertyStatusConfig[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {(Object.keys(propertyTypeConfig) as PropertyType[]).map((k) => (
                <SelectItem key={k} value={k}>{propertyTypeConfig[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={listingFilter} onValueChange={setListingFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Listing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(Object.keys(listingTypeConfig) as ListingType[]).map((k) => (
                <SelectItem key={k} value={k}>{listingTypeConfig[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No properties found" description="Try adjusting your filters or add a new property to get started." action={<Link to="/properties/new"><Button><Plus className="h-4 w-4" /> Add Property</Button></Link>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`} className="group">
              <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
                {/* Image */}
                <div className="relative h-56 overflow-hidden">
                  <img src={p.images[0]} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <Badge variant={propertyStatusConfig[p.status].badge}>{propertyStatusConfig[p.status].label}</Badge>
                    <Badge variant="secondary">{listingTypeConfig[p.listingType].label}</Badge>
                  </div>
                  <button
                    onClick={(e) => toggleFavorite(e, p.id)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-all hover:bg-black/60"
                  >
                    <Heart className={`h-4 w-4 transition-all ${favorites.has(p.id) ? "fill-destructive text-destructive" : "text-white"}`} />
                  </button>
                  <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                    <Eye className="h-3 w-3" /> {p.views}
                  </div>
                  {p.featured && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-warning/90 px-2.5 py-1 text-xs font-medium text-warning-foreground backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-current" /> Featured
                    </div>
                  )}
                </div>
                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {p.neighborhood}, {p.city}
                  </div>
                  <h3 className="mt-1.5 truncate font-display text-base font-semibold transition-colors group-hover:text-primary">{p.title}</h3>
                  <div className="mt-2.5 flex items-center gap-4 text-xs text-muted-foreground">
                    {p.bedrooms > 0 && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {p.bedrooms}</span>}
                    {p.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>}
                    <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {p.area.toLocaleString()} sqft</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="font-display text-lg font-bold text-primary">
                      {formatCurrency(p.price)}{p.listingType === "rent" && <span className="text-xs font-normal text-muted-foreground">/mo</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{propertyTypeConfig[p.type].label}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
