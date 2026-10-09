import type { PropertyStatus, PropertyType, ListingType, LeadStatus, AppointmentStatus } from "@/types";

export const propertyStatusConfig: Record<PropertyStatus, { label: string; badge: "success" | "warning" | "info" | "muted" | "destructive" }> = {
  available: { label: "Available", badge: "success" },
  under_offer: { label: "Under Offer", badge: "warning" },
  sold: { label: "Sold", badge: "info" },
  rented: { label: "Rented", badge: "muted" },
  draft: { label: "Draft", badge: "muted" },
};

export const propertyTypeConfig: Record<PropertyType, { label: string }> = {
  house: { label: "House" },
  apartment: { label: "Apartment" },
  condo: { label: "Condo" },
  townhouse: { label: "Townhouse" },
  land: { label: "Land" },
  commercial: { label: "Commercial" },
};

export const listingTypeConfig: Record<ListingType, { label: string }> = {
  sale: { label: "For Sale" },
  rent: { label: "For Rent" },
};

export const leadStatusConfig: Record<LeadStatus, { label: string; badge: "info" | "warning" | "success" | "destructive" | "muted" | "default" }> = {
  new: { label: "New", badge: "info" },
  contacted: { label: "Contacted", badge: "warning" },
  viewing: { label: "Viewing", badge: "warning" },
  negotiation: { label: "Negotiation", badge: "default" },
  closed: { label: "Closed", badge: "success" },
  lost: { label: "Lost", badge: "destructive" },
};

export const leadStatusOrder: LeadStatus[] = ["new", "contacted", "viewing", "negotiation", "closed", "lost"];

export const appointmentStatusConfig: Record<AppointmentStatus, { label: string; badge: "info" | "success" | "destructive" | "warning" }> = {
  scheduled: { label: "Scheduled", badge: "info" },
  completed: { label: "Completed", badge: "success" },
  cancelled: { label: "Cancelled", badge: "destructive" },
  no_show: { label: "No Show", badge: "warning" },
};

export const amenityLabels: Record<string, string> = {
  parking: "Parking",
  pool: "Swimming Pool",
  gym: "Gym",
  garden: "Garden",
  security: "24/7 Security",
  elevator: "Elevator",
  furnished: "Furnished",
  petFriendly: "Pet Friendly",
  airConditioning: "Air Conditioning",
  laundry: "Laundry",
};
