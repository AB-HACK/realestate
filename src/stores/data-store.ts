import { create } from "zustand";
import type { Property, Client, Appointment, DocumentItem } from "@/types";
import {
  mockProperties,
  mockClients,
  mockAppointments,
  mockDocuments,
} from "@/lib/mock-data";

interface DataState {
  properties: Property[];
  clients: Client[];
  appointments: Appointment[];
  documents: DocumentItem[];
  addProperty: (p: Property) => void;
  updateProperty: (id: string, p: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, c: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addAppointment: (a: Appointment) => void;
  updateAppointment: (id: string, a: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  addDocument: (d: DocumentItem) => void;
  deleteDocument: (id: string) => void;
  addClientNote: (clientId: string, content: string, authorId: string, authorName: string) => void;
  updateClientStatus: (clientId: string, status: Client["status"], authorName: string) => void;
}

export const useDataStore = create<DataState>()((set) => ({
  properties: mockProperties,
  clients: mockClients,
  appointments: mockAppointments,
  documents: mockDocuments,

  addProperty: (p) => set((s) => ({ properties: [p, ...s.properties] })),
  updateProperty: (id, p) =>
    set((s) => ({
      properties: s.properties.map((x) => (x.id === id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x)),
    })),
  deleteProperty: (id) => set((s) => ({ properties: s.properties.filter((x) => x.id !== id) })),

  addClient: (c) => set((s) => ({ clients: [c, ...s.clients] })),
  updateClient: (id, c) =>
    set((s) => ({
      clients: s.clients.map((x) => (x.id === id ? { ...x, ...c, updatedAt: new Date().toISOString() } : x)),
    })),
  deleteClient: (id) => set((s) => ({ clients: s.clients.filter((x) => x.id !== id) })),

  addAppointment: (a) => set((s) => ({ appointments: [a, ...s.appointments] })),
  updateAppointment: (id, a) =>
    set((s) => ({ appointments: s.appointments.map((x) => (x.id === id ? { ...x, ...a } : x)) })),
  deleteAppointment: (id) => set((s) => ({ appointments: s.appointments.filter((x) => x.id !== id) })),

  addDocument: (d) => set((s) => ({ documents: [d, ...s.documents] })),
  deleteDocument: (id) => set((s) => ({ documents: s.documents.filter((x) => x.id !== id) })),

  addClientNote: (clientId, content, authorId, authorName) =>
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              notes: [
                {
                  id: `n-${Date.now()}`,
                  clientId,
                  content,
                  authorId,
                  authorName,
                  createdAt: new Date().toISOString(),
                },
                ...c.notes,
              ],
              activities: [
                {
                  id: `a-${Date.now()}`,
                  clientId,
                  type: "note" as const,
                  description: `Note added: "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`,
                  authorName,
                  createdAt: new Date().toISOString(),
                },
                ...c.activities,
              ],
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    })),

  updateClientStatus: (clientId, status, authorName) =>
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              status,
              activities: [
                {
                  id: `a-${Date.now()}`,
                  clientId,
                  type: "status_change" as const,
                  description: `Lead status changed to ${status.replace("_", " ")}`,
                  authorName,
                  createdAt: new Date().toISOString(),
                },
                ...c.activities,
              ],
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    })),
}));

// Selectors for optimized subscriptions
export const selectProperties = (state: DataState) => state.properties;
export const selectClients = (state: DataState) => state.clients;
export const selectAppointments = (state: DataState) => state.appointments;
export const selectDocuments = (state: DataState) => state.documents;
export const selectAddProperty = (state: DataState) => state.addProperty;
export const selectUpdateProperty = (state: DataState) => state.updateProperty;
export const selectDeleteProperty = (state: DataState) => state.deleteProperty;
export const selectAddClient = (state: DataState) => state.addClient;
export const selectUpdateClient = (state: DataState) => state.updateClient;
export const selectDeleteClient = (state: DataState) => state.deleteClient;
export const selectAddAppointment = (state: DataState) => state.addAppointment;
export const selectUpdateAppointment = (state: DataState) => state.updateAppointment;
export const selectDeleteAppointment = (state: DataState) => state.deleteAppointment;
export const selectAddDocument = (state: DataState) => state.addDocument;
export const selectDeleteDocument = (state: DataState) => state.deleteDocument;
export const selectAddClientNote = (state: DataState) => state.addClientNote;
export const selectUpdateClientStatus = (state: DataState) => state.updateClientStatus;
