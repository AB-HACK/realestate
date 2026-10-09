export type UserRole = "admin" | "agent" | "client";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  bio?: string;
  createdAt: string;
}

export type PropertyStatus = "available" | "under_offer" | "sold" | "rented" | "draft";
export type PropertyType = "house" | "apartment" | "condo" | "townhouse" | "land" | "commercial";
export type ListingType = "sale" | "rent";

export interface PropertyAmenities {
  parking: boolean;
  pool: boolean;
  gym: boolean;
  garden: boolean;
  security: boolean;
  elevator: boolean;
  furnished: boolean;
  petFriendly: boolean;
  airConditioning: boolean;
  laundry: boolean;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  type: PropertyType;
  listingType: ListingType;
  status: PropertyStatus;
  bedrooms: number;
  bathrooms: number;
  area: number;
  location: string;
  city: string;
  neighborhood: string;
  lat?: number;
  lng?: number;
  images: string[];
  amenities: PropertyAmenities;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  featured: boolean;
  views: number;
}

export type LeadStatus = "new" | "contacted" | "viewing" | "negotiation" | "closed" | "lost";

export interface ClientNote {
  id: string;
  clientId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface ClientActivity {
  id: string;
  clientId: string;
  type: "note" | "call" | "email" | "viewing" | "status_change" | "created";
  description: string;
  authorName: string;
  createdAt: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: LeadStatus;
  budget: number;
  preferredLocations: string[];
  propertyTypeInterest: PropertyType[];
  assignedAgentId: string;
  notes: ClientNote[];
  activities: ClientActivity[];
  interestedPropertyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyImage: string;
  clientId: string;
  clientName: string;
  agentId: string;
  agentName: string;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  type: "contract" | "id" | "inspection" | "offer" | "other";
  fileType: string;
  size: number;
  url: string;
  propertyId?: string;
  clientId?: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export interface DashboardMetrics {
  totalListings: number;
  activeListings: number;
  totalClients: number;
  activeDeals: number;
  appointmentsThisWeek: number;
  totalRevenue: number;
  monthlyRevenue: { month: string; revenue: number }[];
  listingsByStatus: { status: string; count: number }[];
  leadsByStatus: { status: string; count: number }[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: "property" | "client" | "appointment" | "document" | "deal";
  description: string;
  actorName: string;
  createdAt: string;
}

export interface CompanySettings {
  name: string;
  logoUrl?: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  description?: string;
}

export interface NotificationPrefs {
  emailNotifications: boolean;
  newLeadAlerts: boolean;
  appointmentReminders: boolean;
  propertyUpdates: boolean;
  weeklyReports: boolean;
  smsNotifications: boolean;
}
